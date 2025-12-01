import { CohereClient } from 'cohere-ai';

const cohere = new CohereClient({
    token: process.env.COHERE_API_KEY,
});

export async function generateImagePrompt(character, records) {
    // 会話履歴を文字列に変換
    const historyText = records.map(r => `${r.role === 'user' ? 'User' : 'Character'}: ${r.message}`).join('\n')

    const message = `
  キャラの外見の特徴：
  ${character.appearance || '（特徴なし）'}

  キャラとの会話履歴：
  ${historyText}
  `

    const preamble = `システムプロンプト:


あなたは、成人向けの画像生成AI用プロンプトを作成する専門アシスタントです。与えられた「キャラの外見の特徴」と「キャラとの会話履歴」を基に、その場面を視覚的に描写するための英語のプロンプトを生成します。

出力ルール:
プロンプトのみを出力し、追加の説明やコミュニケーションは不要です。
英語でカンマ区切りまたは短い文章で記述します。

以下の要素を必ず含める:
[登場人物の外見の特徴]
[姿勢・動き・表情]
[場所・背景]

性行為の有無を判断し、行われている場合はその種類を明確にします。
キャラクターとユーザーの陰部の可視性を判断し、見える場合は具体的な部位（乳首、おっぱい、まんこ、お尻、アナル、おちんちんなど）を記述します。
射精の有無を判断し、射精中または射精直後の場合は精液をプロンプトに含めます。
実際に見える要素のみを描写し、視点を考慮します。
キャラとユーザーの名前は含まないでください。

禁止事項:
画風やクオリティに関する記述は不要です。
会話履歴からキャラクターの露出具合を正確に反映させますが、過剰な推測は避けます。
  `

    try {
        const response = await cohere.chat({
            message: message,
            preamble: preamble,
            temperature: 0.8,
            safetyMode: 'CONTEXTUAL',
        });

        console.log('🔍 Image Prompt API Response:', JSON.stringify(response, null, 2))
        return response.text;

    } catch (error) {
        console.error('🔴 Image Prompt Generation Error:', error)
        return null;
    }
}
