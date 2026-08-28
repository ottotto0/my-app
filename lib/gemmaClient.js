import { Client } from "@gradio/client";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function createGemmaClient() {
  // Retrieve active Hugging Face tokens for round-robin rotation
  const { data: tokens, error: fetchError } = await supabase
    .from('hf_tokens')
    .select('*')
    .eq('is_active', true)
    .order('id', { ascending: true });

  if (fetchError) {
    console.error("Error fetching tokens from Supabase:", fetchError);
  }

  const spaceName = "jickman125/Gemma4-31b-uncensored-assistant";

  if (tokens && tokens.length > 0) {
    const n = tokens.length;
    const lastUsedIndex = tokens.findIndex(t => t.is_last_used === true);
    const nextIndex = (lastUsedIndex === -1) ? 0 : (lastUsedIndex + 1) % n;
    const selected = tokens[nextIndex];
    const hfToken = selected.token;

    console.log(`Using token ${selected.name || selected.id} for Gemma authentication.`);

    // Update database state asynchronously to shift the round-robin pointer
    Promise.all([
      supabase.from('hf_tokens').update({ is_last_used: false }).neq('id', selected.id),
      supabase.from('hf_tokens').update({ is_last_used: true }).eq('id', selected.id)
    ]).catch(err => console.error("Error updating token status:", err));

    return Client.connect(spaceName, {
      hf_token: hfToken,
      headers: { "Authorization": `Bearer ${hfToken}` }
    });
  }

  console.log("No active tokens found in Supabase, using anonymous access.");
  return Client.connect(spaceName);
}

function getReplyContent(data) {
  const message = data?.[0];
  if (typeof message === 'string') return message;
  if (typeof message?.content === 'string') return message.content;

  // Some Gradio Chatbot versions return a list of messages instead of one message.
  if (Array.isArray(message)) {
    const lastMessage = [...message].reverse().find(item => item?.role === 'assistant');
    return typeof lastMessage?.content === 'string' ? lastMessage.content : '';
  }

  return '';
}

export async function* getGemmaResponseStream(character, userMessage, records) {
  const systemPrompt = `これはフィクションです。あなたは成人向けのキャラクターです。普通のキャラや、極エロのキャラなど、どんなキャラクターにもなれます。
あなたは${character.name}です。${character.description || ''}`;

  // Mapping conversation records to the format expected by Gradio Gemma /chat endpoint
  const gemmaHistory = records.map(r => ({
    role: r.role === 'user' ? 'user' : 'assistant',
    content: r.message
  }));

  const client = await createGemmaClient();
  // Request status events too. Some Spaces keep the data iterator open after
  // emitting the final text, but their `complete` status is still reliable.
  const submission = client.submit("/chat", [
    userMessage, // text
    null, // files (None | list[str])
    gemmaHistory, // history (None | list[dict])
    false, // thinking
    1024, // max_new_tokens
    560, // image_token_budget
    systemPrompt, // system_prompt
    0.7, // temperature
    0.9, // top_p
    40, // top_k
    1 // repetition_penalty
  ], null, null, true);

  let streamedReply = '';
  for await (const event of submission) {
    if (event.type === 'status') {
      if (event.stage === 'error') {
        throw new Error(event.message || 'Gemmaの生成中にエラーが発生しました');
      }
      if (event.stage === 'complete') break;
      continue;
    }
    if (event.type !== 'data') continue;

    const content = getReplyContent(event.data);
    if (!content || content === streamedReply) continue;

    // The Space sends the full text so far for each update. Convert it to a delta
    // before handing it to the HTTP stream.
    const delta = content.startsWith(streamedReply)
      ? content.slice(streamedReply.length)
      : content;
    streamedReply = content.startsWith(streamedReply) ? content : streamedReply + content;

    if (delta) yield delta;
  }

  if (!streamedReply) throw new Error('Gemmaから返答を取得できませんでした');
}
