export async function generateImagePrompt(character, records) {
    // ユーザーが後で設定するシステムプロンプトのプレースホルダー
    const systemPrompt = `
  あなたは画像生成プロンプトを作成するAIです。
  以下の「キャラの外見の特徴」と「キャラとの会話履歴」を元に、
  その場面を描写するための画像生成プロンプト（英語）を作成してください。
  
  出力はプロンプトのみを行ってください。
  `

    // 会話履歴を文字列に変換
    const historyText = records.map(r => `${r.role === 'user' ? 'User' : 'Character'}: ${r.message}`).join('\n')

    const prompt = `
  キャラの外見の特徴：
  ${character.appearance || '（特徴なし）'}

  キャラとの会話履歴：
  ${historyText}
  `

    const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt }
    ]

    const safetySettings = [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
    ]

    try {
        const response = await fetch(
            'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-pro:generateContent?key=' + process.env.GEMINI_API_KEY,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [
                        {
                            parts: messages.map(m => ({ text: `${m.role}: ${m.content}` })),
                        },
                    ],
                    safetySettings: safetySettings,
                }),
            }
        )

        if (!response.ok) {
            throw new Error(`Gemini API Error: ${response.statusText}`)
        }

        const data = await response.json()
        console.log('🔍 Image Prompt API Response:', JSON.stringify(data, null, 2))

        const generatedPrompt =
            data?.candidates?.[0]?.content?.parts?.[0]?.text ||
            data?.candidates?.[0]?.output ||
            data?.output_text ||
            data?.text ||
            '(プロンプト生成失敗)'

        return generatedPrompt
    } catch (error) {
        console.error('🔴 Image Prompt Generation Error:', error)
        return '(エラーが発生しました)'
    }
}
