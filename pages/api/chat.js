export default async function handler(req, res) {
  try {
    const { character, messages } = req.body

    // キャラ設定と会話履歴を組み合わせたプロンプト
    const historyText = messages
      .map((m) => `${m.role === 'user' ? 'ユーザー' : character.name}：${m.message}`)
      .join('\n')

    const prompt = `
あなたはキャラクター「${character.name}」として会話します。
キャラの設定：
${character.description}

以下はこれまでの会話です：
${historyText}

次の発言を「${character.name}」として返してください。
`

    // Gemini API 呼び出し
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    )

    const data = await response.json()

    // Geminiの応答テキストを抽出
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      data?.candidates?.[0]?.output || 
      '……（無言）'

    return res.status(200).json({ reply })
  } catch (error) {
    console.error('Gemini API error:', error)
    return res.status(500).json({ reply: '（エラーが発生しました）' })
  }
}
