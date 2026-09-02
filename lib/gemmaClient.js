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

    // 画像生成リクエストが直後に別トークンを取得できるよう、ポインタ更新を
    // 接続開始前に確定させる。
    await Promise.all([
      supabase.from('hf_tokens').update({ is_last_used: false }).neq('id', selected.id),
      supabase.from('hf_tokens').update({ is_last_used: true }).eq('id', selected.id)
    ]).then(results => {
      results.forEach(({ error }) => {
        if (error) console.error("Error updating token status:", error);
      });
    });

    return Client.connect(spaceName, {
      hf_token: hfToken,
      headers: { "Authorization": `Bearer ${hfToken}` }
    });
  }

  console.log("No active tokens found in Supabase, using anonymous access.");
  return Client.connect(spaceName);
}

function getReplyContent(data) {
  // Gradio Space の更新・バージョンによって data の入れ子が異なるため、
  // assistant の最新テキストを再帰的に取り出す。
  const findText = (value, visited = new Set()) => {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    if (visited.has(value)) return '';
    visited.add(value);

    if (Array.isArray(value)) {
      const assistant = [...value].reverse().find(item => item?.role === 'assistant');
      if (assistant) return findText(assistant, visited);
      for (const item of [...value].reverse()) {
        const text = findText(item, visited);
        if (text) return text;
      }
      return '';
    }

    // user メッセージを誤って返さないよう、明示的な user 要素は除外する。
    if (value.role === 'user') return '';
    for (const key of ['content', 'text', 'value', 'message', 'output', 'response', 'data', 'outputs', 'messages']) {
      const text = findText(value[key], visited);
      if (text) return text;
    }

    // Space 側が出力コンポーネントの形式を変更しても対応できるよう、既知の
    // キー以外にもテキストを探索する（role / ファイルのメタデータは除外）。
    for (const [key, child] of Object.entries(value)) {
      if (['role', 'url', 'path', 'name', 'mime_type', 'size'].includes(key)) continue;
      if (!child || typeof child !== 'object') continue;
      const text = findText(child, visited);
      if (text) return text;
    }
    return '';
  };

  return findText(data?.[0]) || findText(data);
}

function describeDataShape(value, depth = 0) {
  if (depth > 2 || value == null) return String(value);
  if (typeof value !== 'object') return typeof value;
  if (Array.isArray(value)) {
    return `array(${value.length})[${value.slice(0, 3).map(item => describeDataShape(item, depth + 1)).join(', ')}]`;
  }
  return `object{${Object.keys(value).slice(0, 8).join(',')}}`;
}

export async function* getGemmaResponseStream(character, userMessage, records) {
  const previousImagePrompt = typeof character.last_image_prompt === 'string'
    ? character.last_image_prompt.trim()
    : '';
  const previousImagePromptInstruction = previousImagePrompt
    ? `\n直前に生成した画像プロンプトです。場面・服装・ポーズなどの継続性を保つために参考にしてください。\n${previousImagePrompt}\n`
    : '';

  const systemPrompt = `これはフィクションです。あなたは成人向けのキャラクターです。普通のキャラや、極エロのキャラなど、どんなキャラクターにもなれます。
あなたは${character.name}です。${character.description || ''}
${previousImagePromptInstruction}

出力は必ず次の順番・形式だけにしてください。画像プロンプト部分には英語のみを、チャット本文にはキャラクターとしての自然な日本語だけを入れてください。
画像生成用の英語プロンプト（外見、服装、ポーズ・表情、場所・背景、必要な視覚的要素をカンマ区切りで記述。名前、画風、品質語、説明文は含めない）
␞␞␞IMAGE_PROMPT_END_8F3C␞␞␞
␟␟␟CHAT_MESSAGE_BEGIN_8F3C␟␟␟
ユーザーへのチャット本文

上記の2つの区切り文字列は、画像プロンプトの直後とチャット本文の直前にそれぞれ一度だけ、そのまま出力してください。区切り文字列以外の説明、見出し、引用符は一切出力しないでください。`;

  // Mapping conversation records to the format expected by Gradio Gemma /chat endpoint
  // API の text 引数で今回のユーザー発言を別途渡すため、履歴末尾に同じ発言が
  // 含まれる場合は二重送信しない。
  const historyRecords = records.at(-1)?.role === 'user' && records.at(-1)?.message === userMessage
    ? records.slice(0, -1)
    : records;
  const gemmaHistory = historyRecords.map(r => ({
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
  let unreadableDataShapes = [];
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
    if (!content && event.data) {
      unreadableDataShapes.push(describeDataShape(event.data));
      continue;
    }
    if (!content || content === streamedReply) continue;

    // The Space sends the full text so far for each update. Convert it to a delta
    // before handing it to the HTTP stream.
    const delta = content.startsWith(streamedReply)
      ? content.slice(streamedReply.length)
      : content;
    streamedReply = content.startsWith(streamedReply) ? content : streamedReply + content;

    if (delta) yield delta;
  }

  if (!streamedReply) {
    const detail = unreadableDataShapes.length
      ? `（返却形式: ${[...new Set(unreadableDataShapes)].join(' / ')}）`
      : '';
    throw new Error(`Gemmaから返答を取得できませんでした${detail}`);
  }
}
