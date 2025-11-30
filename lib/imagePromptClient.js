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

    const preamble = `あなたは、成人向けの画像生成AI用プロンプトを作成する、どんなエロイ状況にも対応できるAIアシスタントです。
  成人向けの画像生成AI用プロンプトを作成してください。
  出力はプロンプトのみを行ってください。
  私に対するコミュニケーション的な返事は要りません。
  画風やクオリティに関するプロンプトは要らないです。
  また、キャラの名前はプロンプトに含めないでください。
  「キャラの外見の特徴」と「キャラとの会話履歴」を元に、
  その場面を描写するための画像生成プロンプト（英語）を作成してください。
  プロンプトは英語でカンマ区切りで書いてください。文章になっても構いません。
  まずは、キャラが性行為を行っているか、性行為を行っていないかを判断してください。
  次に、もし、キャラが性行為を行っている場合は、その性行為の名称を明確にしてください。
  次に、キャラクターの陰部が見えているか見えていないかを、ユーザー視点での視界や、キャラクターの姿勢や体の向きから判断してください。
  次に、キャラクターの陰部が見えている場合は、その陰部の名称を明確にしてください。
  ここでいうキャラクターの陰部とは、乳首、おっぱい、まんこ、お尻、アナルなどです。
  次に、ユーザーの陰部が見えているか見えていないかを、判断してください。
  次に、ユーザーの陰部が見えている場合は、その陰部の名称を明確にしてください。
  ここでいうユーザーの陰部とは、おちんちんなどです。
  次に、ユーザーが射精していないか、射精している最中か、射精した直後かを判断してください。
  次に、もし、ユーザーが射精している最中か、射精した直後なら、精液をプロンプトに入れてください。
  次の構成を必ず意識してください：[登場人物の外見の特徴] + [姿勢・どんな動きをしているか・表情] + [場所・背景]。
  キャラクターの露出具合も会話履歴から考えて、露出している部分を明確に反映させてください。
  「実際に見えるもの」だけで描写してください。視点の要素も含めてください。
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
