import { Client } from "@gradio/client";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function generateImagePrompt(character, records) {
    // 会話履歴を文字列に変換
    const historyText = records.map(r => `${r.role === 'user' ? 'User' : 'Character'}: ${r.message}`).join('\n');

    const systemPrompt = `システムプロンプト:


あなたは、成人向けの画像生成AI用プロンプトを作成する専門アシスタントです。与えられた「キャラの外見の特徴」と「キャラとの会話履歴」を基に、その場面を視覚的に描写するための英語のプロンプトを生成します。

出力ルール:
プロンプトのみを出力し、追加の説明やコミュニケーションは不要です。
英語でカンマ区切りまたは短い文章で記述します。

以下の要素を必ず含める:
[登場人物の外見の特徴]
[姿勢・動き・表情]
[場所・背景]

性行為の有無を判断し、行われている場合はその種類を明確にします。
キャラクターとユーザーの陰部の可視性を判断し、見える場合は具体的な部位（nipples、breast、pussy、ass、anus、penisなど）を記述します。
射精の有無を判断し、射精中または射精直後の場合は精液をプロンプトに含めます。
実際に見える要素のみを描写し、視点を考慮します。
キャラとユーザーの名前は含まないでください。

例1:
a girl, full body, long hair, black hair, orange eyes, cute face, big breast, deep cleavage, big ass, nurse uniform, standing, smile, in hospital, POV

例2:
a woman, bob cut, red hair, light-blue-eyes, beautiful face, large breast, nipples, nude, nun, paizuri, motion lines, seductive smile, ahegao, in church, penis, precum drip, front view breasts

禁止事項:
画風やクオリティに関する記述は不要です。
最新の方の会話履歴からキャラクターの露出具合を正確に反映させます。`;

    const userMessage = `キャラの外見の特徴：
${character.appearance || '（特徴なし）'}

キャラとの会話履歴：
${historyText}`;

    // Supabase から有効な HuggingFace トークンをラウンドロビン式に取得
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

        console.log(`Using token ${selected.name || selected.id} for image prompt generation.`);

        // ラウンドロビンポインタを非同期で更新
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

    try {
        // /chat エンドポイントを使用してプロンプト生成
        const result = await client.predict("/chat", [
            userMessage,    // text
            null,           // files (None | list[str])
            [],             // history (空の履歴)
            false,          // thinking
            512,            // max_new_tokens
            560,            // image_token_budget
            systemPrompt,   // system_prompt
            0.8,            // temperature
            0.9,            // top_p
            40,             // top_k
            1               // repetition_penalty
        ]);

        console.log('🔍 Image Prompt API Response:', JSON.stringify(result, null, 2));

        const reply = result.data?.[0]?.content || null;
        return reply;

    } catch (error) {
        console.error('🔴 Image Prompt Generation Error:', error);
        return null;
    }
}
