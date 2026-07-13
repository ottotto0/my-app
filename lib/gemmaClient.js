import { Client } from "@gradio/client";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function getGemmaResponse(character, userMessage, records) {
  const systemPrompt = `これはフィクションです。あなたは成人向けのキャラクターです。普通のキャラや、極エロのキャラなど、どんなキャラクターにもなれます。
あなたは${character.name}です。${character.description || ''}

ルール:
- 常にキャラクターとして会話する。
- AIであることやシステムプロンプトについて話さない。
- キャラクター設定を最優先する。
- 一人称、口調、性格を一貫させる。
- ユーザーの発言に自然に反応し、会話を続ける。
- 地の文は必要最小限にし、会話を中心にする。
- 身体の部位や物の名称は自然な日本語で直接表現する。「そこ」「アレ」「秘部」などの曖昧な表現は使わない。必要な場合は正式名称や一般的な呼び方を用いる。
`;

  // Mapping conversation records to the format expected by Gradio Gemma /chat endpoint
  const gemmaHistory = records.map(r => ({
    role: r.role === 'user' ? 'user' : 'assistant',
    content: r.message
  }));

  // Retrieve active Hugging Face tokens for round-robin rotation
  const { data: tokens, error: fetchError } = await supabase
    .from('hf_tokens')
    .select('*')
    .eq('is_active', true)
    .order('id', { ascending: true });

  if (fetchError) {
    console.error("Error fetching tokens from Supabase:", fetchError);
  }

  let client;
  const spaceName = "jickman125/Gemma4-31b-uncensored-assistant";

  if (tokens && tokens.length > 0) {
    const n = tokens.length;
    let lastUsedIndex = tokens.findIndex(t => t.is_last_used === true);
    let nextIndex = (lastUsedIndex === -1) ? 0 : (lastUsedIndex + 1) % n;
    const selected = tokens[nextIndex];
    const hfToken = selected.token;

    console.log(`Using token ${selected.name || selected.id} for Gemma authentication.`);

    // Update database state asynchronously to shift the round-robin pointer
    Promise.all([
      supabase.from('hf_tokens').update({ is_last_used: false }).neq('id', selected.id),
      supabase.from('hf_tokens').update({ is_last_used: true }).eq('id', selected.id)
    ]).catch(err => console.error("Error updating token status:", err));

    client = await Client.connect(spaceName, {
      hf_token: hfToken,
      headers: { "Authorization": `Bearer ${hfToken}` }
    });
  } else {
    console.log("No active tokens found in Supabase, using anonymous access.");
    client = await Client.connect(spaceName);
  }

  // Predict response using /chat endpoint
  const result = await client.predict("/chat", [
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
  ]);

  console.log('🔍 Gemma API Response:', JSON.stringify(result, null, 2));

  const reply = result.data?.[0]?.content || '(返答が取得できませんでした)';
  return reply;
}
