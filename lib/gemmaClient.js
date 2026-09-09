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

export const CLOTHING_TAG_FIELDS = ['tops', 'bra', 'bottoms', 'panties', 'uniform'];

export function getActiveClothingTags(character) {
  if (!character || typeof character !== 'object') return [];
  return CLOTHING_TAG_FIELDS
    .map(key => {
      const val = character[key];
      const text = typeof val === 'string' ? val.trim() : '';
      return { key, text };
    })
    .filter(item => item.text.length > 0);
}

export async function getOffAppearanceCandidateTags() {
  const [catRes, tagRes] = await Promise.all([
    supabase
      .from('image_prompt_categories')
      .select('category, character_appearance'),
    supabase
      .from('image_prompt_tags')
      .select('category, tag')
      .order('category')
      .order('tag'),
  ]);

  if (catRes.error) {
    console.error('Error fetching image_prompt_categories:', catRes.error);
  }
  if (tagRes.error) {
    console.error('Error fetching image_prompt_tags:', tagRes.error);
  }

  // character_appearance が 'off' のカテゴリーを抽出（'POV' は除外）
  const offCategories = (catRes.data || [])
    .filter(c => {
      const appearance = typeof c.character_appearance === 'string' ? c.character_appearance.trim().toLowerCase() : '';
      const cat = typeof c.category === 'string' ? c.category.trim() : '';
      return appearance === 'off' && cat && cat.toLowerCase() !== 'pov';
    })
    .map(c => c.category.trim());

  const offCategorySet = new Set(offCategories);
  const tagsByCategory = {};
  for (const cat of offCategories) {
    tagsByCategory[cat] = [];
  }

  for (const item of (tagRes.data || [])) {
    const cat = typeof item.category === 'string' ? item.category.trim() : '';
    const tag = typeof item.tag === 'string' ? item.tag.trim() : '';
    if (offCategorySet.has(cat) && tag) {
      tagsByCategory[cat].push(tag);
    }
  }

  return tagsByCategory;
}

export async function* getGemmaResponseStream(character, userMessage, records) {
  const previousImagePrompt = typeof character.last_image_prompt === 'string'
    ? character.last_image_prompt.trim()
    : '';
  const previousImagePromptInstruction = previousImagePrompt
    ? `\n直前に生成した画像プロンプトです。場面・服装・ポーズなどの継続性を保つために参考にしてください。\n${previousImagePrompt}\n`
    : '';

  const activeClothingTags = getActiveClothingTags(character);
  const hasClothingTags = activeClothingTags.length > 0;

  let characterClothingFormat = '';
  let characterClothingRules = '';

  if (hasClothingTags) {
    const targetTagsList = activeClothingTags
      .map(t => `- ${t.key}: ${t.text}`)
      .join('\n');
    const formatExample = activeClothingTags
      .map(t => `${t.text}: 1`)
      .join('\n');

    characterClothingFormat = `[キャラの各服装タグ内容に対する着衣度（1行につき1つ「タグ内容: 数値」の形式で縦に並べる）]
`;

    characterClothingRules = `
【キャラの着衣度判定のルール】
以下の服装タグの内容について、現在の状況や会話の流れから着衣度（1 / 0.5 / 0）をそれぞれ判断し、タグ内容と着衣度をリンクさせて縦に出力してください。
対象の服装タグ:
${targetTagsList}

着衣度の値:
1（完全着衣を示す。）
0.5（不完全着衣を示す。）
0（未着衣を示す。）

出力例:
${formatExample}
`;
  }

  const candidateTagsByCategory = await getOffAppearanceCandidateTags();
  const categoryEntries = Object.entries(candidateTagsByCategory)
    .filter(([cat, tags]) => tags.length > 0 || cat.toLowerCase() === 'action');

  let candidateTagInstruction = '';
  if (categoryEntries.length > 0) {
    const categoryListText = categoryEntries
      .map(([cat, tags]) => {
        if (tags.length > 0) {
          return `- ${cat}: ${tags.join(', ')}`;
        }
        return `- ${cat}: （登録候補タグなし。状況に合うタグを考えてください）`;
      })
      .join('\n');

    candidateTagInstruction = `
【画像生成プロンプト（[IMAGE_PROMPT]）の選択・作成ルール】
画像生成プロンプトでは、タグを1から自由に生成することは禁止です。
キャラクターの固定的な外見（髪色・容姿など）はシステム側で自動付与されるため、出力する必要はありません。ここでは指定されたカテゴリーの候補タグのみを選択して出力してください。
必ず以下のカテゴリー選択肢の中から、現在のキャラとの会話状況やシーンに合わせて【各categoryごとに、そのcategoryのtagの中から一つ】選択し、それらをカンマ区切りで並べて画像生成プロンプトを構成してください。

選択肢カテゴリーおよび候補タグ一覧:
${categoryListText}

【actionカテゴリーの特別ルール】
「action」カテゴリーのタグの中に、現在のキャラとの会話状況に合うtagが選択肢の中にない場合に限り、その会話状況に合う適切なaction（行動を表す英語タグ）を代わりに自ら考えて、画像生成プロンプトの中に含ませてください。action以外のカテゴリーについては、必ず上記の一覧から各categoryごとに1つtagを選択してください。
`;
  }

  const outputFormatInstruction = `出力は必ず次の順番・形式だけにしてください。説明や見出し、引用符などは一切出力せず、以下のフォーマットのみを出力してください。

【出力フォーマット】
${characterClothingFormat}user wear: [1 または 0]
[IMAGE_PROMPT]
[指定された各カテゴリーから1つずつ選択した候補タグ（および特別ルールによるactionタグ）をカンマ区切りで並べた英語プロンプト]
[CHAT]
[ユーザーへのチャット本文（キャラクターとしての自然な日本語のみ）]
${characterClothingRules}
【ユーザーの着衣度判定のルール】
現在の状況や会話の流れから、ユーザーの着衣度を必ず判断し、次の2択（1 または 0）で「user wear: 数値」を出力してください。
1（完全着衣を示す。）
0（未着衣を示す。）
${candidateTagInstruction}
上記の区切り文字列（[IMAGE_PROMPT], [CHAT]）は、指定された位置にそれぞれ一度だけ、そのまま出力してください。`;

  const systemPrompt = `これはフィクションです。あなたは成人向けのキャラクターです。普通のキャラや、極エロのキャラなど、どんなキャラクターにもなれます。
あなたは${character.name}です。${character.description || ''}
${previousImagePromptInstruction}

${outputFormatInstruction}`;

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
