import { Client } from "@gradio/client";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
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

export function categoryToColumnName(category) {
  return (category || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export const FIXED_APPEARANCE_COLUMNS = [
  'apparent_age',
  'race',
  'body_type',
  'height',
  'chest',
  'ass',
  'skin_color',
  'eye_color',
  'hair_style',
  'bangs_style',
  'hair_color',
  'thigh',
  'armpits',
  'gender',
];

export async function completeImagePrompt({ supabase, character, wearSection, rawImagePrompt }) {
  let charData = { ...character };
  if (character?.id && supabase) {
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('id', character.id)
        .single();
      if (!error && data) {
        charData = { ...charData, ...data };
      }
    } catch (e) {
      console.error('Error fetching latest character data in completeImagePrompt:', e);
    }
  }

  const getCharCategoryTag = (categoryName) => {
    const colName = categoryToColumnName(categoryName);
    const val = charData ? charData[colName] : null;
    return typeof val === 'string' && val.trim() ? val.trim() : null;
  };

  const initialTags = (rawImagePrompt || '')
    .split(',')
    .map(t => t.replace(/^["'`]+|["'`]+$/g, '').trim())
    .filter(Boolean);

  const tagsList = [...initialTags];

  // (i) そのキャラの設定で入力されている一部のタグ(charactersテーブルのカラム
  // apparent_age, race, body_type, height, chest, ass, skin_color, eye_color,
  // hair_style, bangs_style, hair_color, thigh, armpits, gender)を追加
  // 空白の場合は追加しない
  for (const col of FIXED_APPEARANCE_COLUMNS) {
    const val = charData ? charData[col] : null;
    if (typeof val === 'string' && val.trim()) {
      tagsList.push(val.trim());
    }
  }

  // (ii) 着衣度に応じた服装・身体タグの追加
  let allPromptTags = [];
  let restrictedRows = [];
  if (supabase) {
    const [tagRes, restrictedRes] = await Promise.all([
      supabase.from('image_prompt_tags').select('category, tag'),
      supabase.from('image_restricted_categories').select('tag1, tag2, restricted_category'),
    ]);
    if (tagRes.data) allPromptTags = tagRes.data;
    if (restrictedRes.data) restrictedRows = restrictedRes.data;
  }

  const tagToCategory = new Map();
  for (const item of allPromptTags) {
    const tag = (item.tag || '').trim().toLowerCase();
    const cat = (item.category || '').trim().toLowerCase();
    if (tag && cat) {
      tagToCategory.set(tag, cat);
    }
  }

  const wearScores = {};
  const wearLines = (wearSection || '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.toLowerCase().startsWith('user'));

  for (const line of wearLines) {
    const match = line.match(/^(?:[-*•]\s*)?([^:]+?)\s*:\s*([0-9.]+)/i);
    if (!match) continue;
    const tagText = match[1].replace(/^["'`]+|["'`]+$/g, '').trim();
    const score = parseFloat(match[2]);
    const tagLower = tagText.toLowerCase();

    let matchedCat = tagToCategory.get(tagLower);
    if (!matchedCat) {
      if (['tops', 'bra', 'bottoms', 'panties'].includes(tagLower)) {
        matchedCat = tagLower;
      } else {
        for (const cat of ['tops', 'bra', 'bottoms', 'panties']) {
          const charVal = getCharCategoryTag(cat);
          if (charVal && charVal.toLowerCase() === tagLower) {
            matchedCat = cat;
            break;
          }
        }
      }
    }
    if (matchedCat) {
      wearScores[matchedCat] = score;
    }
  }

  const topsTag = getCharCategoryTag('tops');
  const braTag = getCharCategoryTag('bra');
  const nippleTag = getCharCategoryTag('nipple');
  const bottomsTag = getCharCategoryTag('bottoms');
  const pantiesTag = getCharCategoryTag('panties');
  const socksTag = getCharCategoryTag('socks');
  const pussyTag = getCharCategoryTag('pussy');
  const femalePubicHairTag = getCharCategoryTag('female pubic hair');
  const anusTag = getCharCategoryTag('anus');
  const analHairTag = getCharCategoryTag('anal hair');

  const isScore = (val, target) => val !== null && val !== undefined && Math.abs(val - target) < 0.05;

  const topsScore = wearScores['tops'] !== undefined ? wearScores['tops'] : (topsTag ? 1 : null);
  const braScore = wearScores['bra'] !== undefined ? wearScores['bra'] : (braTag ? 1 : null);
  const bottomsScore = wearScores['bottoms'] !== undefined ? wearScores['bottoms'] : (bottomsTag ? 1 : null);
  const pantiesScore = wearScores['panties'] !== undefined ? wearScores['panties'] : (pantiesTag ? 1 : null);

  const unworn = (tag) => {
    if (!tag) return '';
    return tag.toLowerCase().startsWith('unworn ') ? tag : `unworn ${tag}`;
  };

  // tops & bra 分岐
  if (isScore(topsScore, 1)) {
    if (topsTag) tagsList.push(topsTag);
  } else if (isScore(topsScore, 0.5) && isScore(braScore, 1)) {
    if (topsTag) tagsList.push(unworn(topsTag));
    if (braTag) tagsList.push(braTag);
  } else if (isScore(topsScore, 0.5) && isScore(braScore, 0.5)) {
    if (topsTag) tagsList.push(unworn(topsTag));
    if (braTag) tagsList.push(braTag);
    tagsList.push('areola slip');
  } else if (isScore(topsScore, 0.5) && isScore(braScore, 0)) {
    if (topsTag) tagsList.push(unworn(topsTag));
    if (nippleTag) tagsList.push(nippleTag);
    tagsList.push('no bra');
  } else if (isScore(topsScore, 0) && isScore(braScore, 1)) {
    if (braTag) tagsList.push(braTag);
  } else if (isScore(topsScore, 0) && isScore(braScore, 0.5)) {
    if (braTag) tagsList.push(braTag);
    tagsList.push('areola slip');
  } else if (isScore(topsScore, 0) && isScore(braScore, 0)) {
    if (nippleTag) tagsList.push(nippleTag);
    tagsList.push('topless');
  }

  // bottoms & panties 分岐
  const addLowerGenitalTags = () => {
    if (pussyTag) tagsList.push(pussyTag);
    if (femalePubicHairTag) tagsList.push(femalePubicHairTag);
    if (anusTag) tagsList.push(anusTag);
    if (analHairTag) tagsList.push(analHairTag);
  };

  if (isScore(bottomsScore, 1)) {
    if (bottomsTag) tagsList.push(bottomsTag);
    if (socksTag) tagsList.push(socksTag);
  } else if (isScore(bottomsScore, 0.5) && isScore(pantiesScore, 1)) {
    if (bottomsTag) tagsList.push(unworn(bottomsTag));
    if (socksTag) tagsList.push(socksTag);
    if (pantiesTag) tagsList.push(pantiesTag);
  } else if (isScore(bottomsScore, 0.5) && isScore(pantiesScore, 0.5)) {
    if (bottomsTag) tagsList.push(unworn(bottomsTag));
    if (pantiesTag) tagsList.push(unworn(pantiesTag));
    if (socksTag) tagsList.push(socksTag);
    addLowerGenitalTags();
  } else if (isScore(bottomsScore, 0.5) && isScore(pantiesScore, 0)) {
    if (bottomsTag) tagsList.push(unworn(bottomsTag));
    tagsList.push('no panties');
    if (socksTag) tagsList.push(socksTag);
    addLowerGenitalTags();
  } else if (isScore(bottomsScore, 0) && isScore(pantiesScore, 0)) {
    if (socksTag) tagsList.push(socksTag);
    tagsList.push('bottomless');
    addLowerGenitalTags();
  } else if (isScore(bottomsScore, 0) && isScore(pantiesScore, 1)) {
    if (socksTag) tagsList.push(socksTag);
    if (pantiesTag) tagsList.push(pantiesTag);
  } else if (isScore(bottomsScore, 0) && isScore(pantiesScore, 0.5)) {
    if (pantiesTag) tagsList.push(unworn(pantiesTag));
    if (socksTag) tagsList.push(socksTag);
    addLowerGenitalTags();
  }

  // (iii) さらに、POVというタグを画像生成プロンプトに追加
  tagsList.push('POV');

  // (iv) 制限カテゴリーに基づくタグ削除
  const normalizeCat = (cat) => (cat || '').trim().toLowerCase().replace(/[\s_]+/g, ' ');
  const deletionCategories = new Set();
  const addDeletionCategory = (cat) => {
    if (!cat) return;
    const parts = String(cat).split(',');
    for (const part of parts) {
      const norm = normalizeCat(part);
      if (norm) deletionCategories.add(norm);
    }
  };

  const currentTagSet = new Set(tagsList.map(t => (t || '').trim().toLowerCase()));

  // image_restricted_categories の各行判定
  for (const row of restrictedRows) {
    const t1 = (row.tag1 || '').trim().toLowerCase();
    const t2 = (row.tag2 || '').trim().toLowerCase();
    if (t1 && t2 && currentTagSet.has(t1) && currentTagSet.has(t2)) {
      addDeletionCategory(row.restricted_category);
    }
  }

  // front view / back view 判定
  if (currentTagSet.has('front view')) {
    addDeletionCategory('anus');
    addDeletionCategory('anal hair');
  }
  if (currentTagSet.has('back view')) {
    addDeletionCategory('bangs style');
  }

  // 削除カテゴリーメモにメモされている各テキストが image_prompt_tags の category に
  // 存在する場合、その category を持つ tag をプロンプトから削除
  const tagsToRemove = new Set();
  for (const item of allPromptTags) {
    const cat = normalizeCat(item.category);
    const tag = (item.tag || '').trim().toLowerCase();
    if (cat && tag && deletionCategories.has(cat)) {
      tagsToRemove.add(tag);
    }
  }

  // 調整した時に使った削除カテゴリーの中に bra と tops がある場合、
  // unworn (tag（charactersテーブルのカラムbraまたはカラムtopsのテキスト）), areola slip, no bra, topless を削除
  const hasBraCategory = deletionCategories.has('bra');
  const hasTopsCategory = deletionCategories.has('tops') || deletionCategories.has('top');
  const upperPatternsToRemove = [];
  if (hasBraCategory && hasTopsCategory) {
    tagsToRemove.add('areola slip');
    tagsToRemove.add('no bra');
    tagsToRemove.add('topless');

    const addUpperTagPatterns = (text) => {
      if (!text || typeof text !== 'string') return;
      const clean = text.trim();
      if (!clean) return;
      const cleanLower = clean.toLowerCase();
      tagsToRemove.add(cleanLower);
      tagsToRemove.add(`unworn ${cleanLower}`);
      tagsToRemove.add(`unworn (${cleanLower})`);
      const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      upperPatternsToRemove.push(new RegExp(`^unworn\\s*\\(?\\s*${escaped}\\s*\\)?$`, 'i'));
      if (cleanLower.startsWith('unworn ')) {
        const withoutPrefix = clean.slice(7).trim();
        if (withoutPrefix) {
          tagsToRemove.add(withoutPrefix.toLowerCase());
          tagsToRemove.add(`unworn (${withoutPrefix.toLowerCase()})`);
          const escWithout = withoutPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          upperPatternsToRemove.push(new RegExp(`^unworn\\s*\\(?\\s*${escWithout}\\s*\\)?$`, 'i'));
        }
      }
    };
    addUpperTagPatterns(braTag);
    addUpperTagPatterns(topsTag);
    addUpperTagPatterns('bra');
    addUpperTagPatterns('tops');
  }

  // 調整した時に使った削除カテゴリーの中に bottoms と panties がある場合、
  // unworn (tag（charactersテーブルのカラムbottomsまたはカラムpantiesのテキスト）), no panties, bottomless を削除
  const hasBottomsCategory = deletionCategories.has('bottoms') || deletionCategories.has('bottom');
  const hasPantiesCategory = deletionCategories.has('panties') || deletionCategories.has('panty') || deletionCategories.has('underwear');
  const lowerPatternsToRemove = [];
  if (hasBottomsCategory && hasPantiesCategory) {
    tagsToRemove.add('no panties');
    tagsToRemove.add('bottomless');

    const addLowerTagPatterns = (text) => {
      if (!text || typeof text !== 'string') return;
      const clean = text.trim();
      if (!clean) return;
      const cleanLower = clean.toLowerCase();
      tagsToRemove.add(cleanLower);
      tagsToRemove.add(`unworn ${cleanLower}`);
      tagsToRemove.add(`unworn (${cleanLower})`);
      const escaped = clean.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      lowerPatternsToRemove.push(new RegExp(`^unworn\\s*\\(?\\s*${escaped}\\s*\\)?$`, 'i'));
      if (cleanLower.startsWith('unworn ')) {
        const withoutPrefix = clean.slice(7).trim();
        if (withoutPrefix) {
          tagsToRemove.add(withoutPrefix.toLowerCase());
          tagsToRemove.add(`unworn (${withoutPrefix.toLowerCase()})`);
          const escWithout = withoutPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          lowerPatternsToRemove.push(new RegExp(`^unworn\\s*\\(?\\s*${escWithout}\\s*\\)?$`, 'i'));
        }
      }
    };
    addLowerTagPatterns(bottomsTag);
    addLowerTagPatterns(pantiesTag);
    addLowerTagPatterns('bottoms');
    addLowerTagPatterns('panties');
  }

  const allPatternsToRemove = [...upperPatternsToRemove, ...lowerPatternsToRemove];

  const isTagToRemove = (trimmed) => {
    const lower = trimmed.toLowerCase();
    if (tagsToRemove.has(lower)) return true;
    const normalized = lower.replace(/\s+/g, ' ');
    if (tagsToRemove.has(normalized)) return true;
    for (const pattern of allPatternsToRemove) {
      if (pattern.test(trimmed)) return true;
    }
    return false;
  };

  const uniqueTags = [];
  const seenLower = new Set();
  for (const tag of tagsList) {
    const trimmed = (tag || '').trim();
    const lower = trimmed.toLowerCase();
    if (!lower || isTagToRemove(trimmed) || seenLower.has(lower)) continue;
    seenLower.add(lower);
    uniqueTags.push(trimmed);
  }

  return uniqueTags.join(', ');
}

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
import { Client } from "@gradio/client";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder';
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

export function categoryToColumnName(category) {
  return (category || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
}

export const FIXED_APPEARANCE_COLUMNS = [
  'apparent_age',
  'race',
  'body_type',
  'height',
  'chest',
  'ass',
  'skin_color',
  'eye_color',
  'hair_style',
  'bangs_style',
  'hair_color',
  'thigh',
  'armpits',
  'gender',
];

export async function completeImagePrompt({ supabase, character, wearSection, rawImagePrompt }) {
  let charData = { ...character };
  if (character?.id && supabase) {
    try {
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('id', character.id)
        .single();
      if (!error && data) {
        charData = { ...charData, ...data };
      }
    } catch (e) {
      console.error('Error fetching latest character data in completeImagePrompt:', e);
    }
  }

  const getCharCategoryTag = (categoryName) => {
    const colName = categoryToColumnName(categoryName);
    const val = charData ? charData[colName] : null;
    return typeof val === 'string' && val.trim() ? val.trim() : null;
  };

  const initialTags = (rawImagePrompt || '')
    .split(',')
    .map(t => t.replace(/^["'`]+|["'`]+$/g, '').trim())
    .filter(Boolean);

  const tagsList = [...initialTags];

  // (i) そのキャラの設定で入力されている一部のタグ(charactersテーブルのカラム
  // apparent_age, race, body_type, height, chest, ass, skin_color, eye_color,
  // hair_style, bangs_style, hair_color, thigh, armpits, gender)を追加
  // 空白の場合は追加しない
  for (const col of FIXED_APPEARANCE_COLUMNS) {
    const val = charData ? charData[col] : null;
    if (typeof val === 'string' && val.trim()) {
      tagsList.push(val.trim());
    }
  }

  // (ii) 着衣度に応じた服装・身体タグの追加
  let allPromptTags = [];
  let restrictedRows = [];
  if (supabase) {
    const [tagRes, restrictedRes] = await Promise.all([
      supabase.from('image_prompt_tags').select('category, tag'),
      supabase.from('image_restricted_categories').select('tag1, tag2, restricted_category'),
    ]);
    if (tagRes.data) allPromptTags = tagRes.data;
    if (restrictedRes.data) restrictedRows = restrictedRes.data;
  }

  const tagToCategory = new Map();
  for (const item of allPromptTags) {
    const tag = (item.tag || '').trim().toLowerCase();
    const cat = (item.category || '').trim().toLowerCase();
    if (tag && cat) {
      tagToCategory.set(tag, cat);
    }
  }

  const wearScores = {};
  const wearLines = (wearSection || '')
    .split('\n')
    .map(l => l.trim())
    .filter(l => l && !l.toLowerCase().startsWith('user'));

  for (const line of wearLines) {
    const match = line.match(/^(?:[-*•]\s*)?([^:]+?)\s*:\s*([0-9.]+)/i);
    if (!match) continue;
    const tagText = match[1].replace(/^["'`]+|["'`]+$/g, '').trim();
    const score = parseFloat(match[2]);
    const tagLower = tagText.toLowerCase();

    let matchedCat = tagToCategory.get(tagLower);
    if (!matchedCat) {
      if (['tops', 'bra', 'bottoms', 'panties'].includes(tagLower)) {
        matchedCat = tagLower;
      } else {
        for (const cat of ['tops', 'bra', 'bottoms', 'panties']) {
          const charVal = getCharCategoryTag(cat);
          if (charVal && charVal.toLowerCase() === tagLower) {
            matchedCat = cat;
            break;
          }
        }
      }
    }
    if (matchedCat) {
      wearScores[matchedCat] = score;
    }
  }

  const topsTag = getCharCategoryTag('tops');
  const braTag = getCharCategoryTag('bra');
  const nippleTag = getCharCategoryTag('nipple');
  const bottomsTag = getCharCategoryTag('bottoms');
  const pantiesTag = getCharCategoryTag('panties');
  const socksTag = getCharCategoryTag('socks');
  const pussyTag = getCharCategoryTag('pussy');
  const femalePubicHairTag = getCharCategoryTag('female pubic hair');
  const anusTag = getCharCategoryTag('anus');
  const analHairTag = getCharCategoryTag('anal hair');

  const isScore = (val, target) => val !== null && val !== undefined && Math.abs(val - target) < 0.05;

  const topsScore = wearScores['tops'] !== undefined ? wearScores['tops'] : (topsTag ? 1 : null);
  const braScore = wearScores['bra'] !== undefined ? wearScores['bra'] : (braTag ? 1 : null);
  const bottomsScore = wearScores['bottoms'] !== undefined ? wearScores['bottoms'] : (bottomsTag ? 1 : null);
  const pantiesScore = wearScores['panties'] !== undefined ? wearScores['panties'] : (pantiesTag ? 1 : null);

  const unworn = (tag) => {
    if (!tag) return '';
    return tag.toLowerCase().startsWith('unworn ') ? tag : `unworn ${tag}`;
  };

  // tops & bra 分岐
  if (isScore(topsScore, 1)) {
    if (topsTag) tagsList.push(topsTag);
  } else if (isScore(topsScore, 0.5) && isScore(braScore, 1)) {
    if (topsTag) tagsList.push(unworn(topsTag));
    if (braTag) tagsList.push(braTag);
  } else if (isScore(topsScore, 0.5) && isScore(braScore, 0.5)) {
    if (topsTag) tagsList.push(unworn(topsTag));
    if (braTag) tagsList.push(braTag);
    tagsList.push('areola slip');
  } else if (isScore(topsScore, 0.5) && isScore(braScore, 0)) {
    if (topsTag) tagsList.push(unworn(topsTag));
    if (nippleTag) tagsList.push(nippleTag);
    tagsList.push('no bra');
  } else if (isScore(topsScore, 0) && isScore(braScore, 1)) {
    if (braTag) tagsList.push(braTag);
  } else if (isScore(topsScore, 0) && isScore(braScore, 0.5)) {
    if (braTag) tagsList.push(braTag);
    tagsList.push('areola slip');
  } else if (isScore(topsScore, 0) && isScore(braScore, 0)) {
    if (nippleTag) tagsList.push(nippleTag);
    tagsList.push('topless');
  }

  // bottoms & panties 分岐
  const addLowerGenitalTags = () => {
    if (pussyTag) tagsList.push(pussyTag);
    if (femalePubicHairTag) tagsList.push(femalePubicHairTag);
    if (anusTag) tagsList.push(anusTag);
    if (analHairTag) tagsList.push(analHairTag);
  };

  if (isScore(bottomsScore, 1)) {
    if (bottomsTag) tagsList.push(bottomsTag);
    if (socksTag) tagsList.push(socksTag);
  } else if (isScore(bottomsScore, 0.5) && isScore(pantiesScore, 1)) {
    if (bottomsTag) tagsList.push(unworn(bottomsTag));
    if (socksTag) tagsList.push(socksTag);
    if (pantiesTag) tagsList.push(pantiesTag);
  } else if (isScore(bottomsScore, 0.5) && isScore(pantiesScore, 0.5)) {
    if (bottomsTag) tagsList.push(unworn(bottomsTag));
    if (pantiesTag) tagsList.push(unworn(pantiesTag));
    if (socksTag) tagsList.push(socksTag);
    addLowerGenitalTags();
  } else if (isScore(bottomsScore, 0.5) && isScore(pantiesScore, 0)) {
    if (bottomsTag) tagsList.push(unworn(bottomsTag));
    tagsList.push('no panties');
    if (socksTag) tagsList.push(socksTag);
    addLowerGenitalTags();
  } else if (isScore(bottomsScore, 0) && isScore(pantiesScore, 0)) {
    if (socksTag) tagsList.push(socksTag);
    tagsList.push('bottomless');
    addLowerGenitalTags();
  } else if (isScore(bottomsScore, 0) && isScore(pantiesScore, 1)) {
    if (socksTag) tagsList.push(socksTag);
    if (pantiesTag) tagsList.push(pantiesTag);
  } else if (isScore(bottomsScore, 0) && isScore(pantiesScore, 0.5)) {
    if (pantiesTag) tagsList.push(unworn(pantiesTag));
    if (socksTag) tagsList.push(socksTag);
    addLowerGenitalTags();
  }

  // (iii) さらに、POVというタグを画像生成プロンプトに追加
  tagsList.push('POV');

  // (iv) 制限カテゴリーに基づくタグ削除
  const normalizeCat = (cat) => (cat || '').trim().toLowerCase().replace(/[\s_]+/g, ' ');
  const deletionCategories = new Set();
  const addDeletionCategory = (cat) => {
    if (!cat) return;
    const parts = String(cat).split(',');
    for (const part of parts) {
      const norm = normalizeCat(part);
      if (norm) deletionCategories.add(norm);
    }
  };

  const currentTagSet = new Set(tagsList.map(t => (t || '').trim().toLowerCase()));

  // image_restricted_categories の各行判定
  for (const row of restrictedRows) {
    const t1 = (row.tag1 || '').trim().toLowerCase();
    const t2 = (row.tag2 || '').trim().toLowerCase();
    if (t1 && t2 && currentTagSet.has(t1) && currentTagSet.has(t2)) {
      addDeletionCategory(row.restricted_category);
    }
  }

  // front view / back view 判定
  if (currentTagSet.has('front view')) {
    addDeletionCategory('anus');
    addDeletionCategory('anal hair');
  }
  if (currentTagSet.has('back view')) {
    addDeletionCategory('bangs style');
  }

  // 削除カテゴリーメモにメモされている各テキストが image_prompt_tags の category に
  // 存在する場合、その category を持つ tag をプロンプトから削除
  const tagsToRemove = new Set();
  for (const item of allPromptTags) {
    const cat = normalizeCat(item.category);
    const tag = (item.tag || '').trim().toLowerCase();
    if (cat && tag && deletionCategories.has(cat)) {
      tagsToRemove.add(tag);
    }
  }

  const uniqueTags = [];
  const seenLower = new Set();
  for (const tag of tagsList) {
    const trimmed = (tag || '').trim();
    const lower = trimmed.toLowerCase();
    if (!lower || tagsToRemove.has(lower) || seenLower.has(lower)) continue;
    seenLower.add(lower);
    uniqueTags.push(trimmed);
  }

  return uniqueTags.join(', ');
}

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
