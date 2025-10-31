export default async function handler(req, res) {
  try {
    const { character, messages } = req.body

    // 会話履歴をGemini形式に変換
    const contents = messages.map((m) => ({
      role: m.role === 'user' ? 'user' : 'model',
      parts: [{ text: m.message }]
    }))

    // 最後にキャラ設定を追加
    contents.unshift({
      role: 'user',
      parts: [{
        text: `
あなたはキャラクター「${character.name}」として会話します。
キャラの設定：
${character.description}

キャラになりきって、自然で感情豊かな日本語で会話してください。
`
      }]
    })

    // Gemini API 呼び出し
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents })
      }
    )

    const data = await response.json()

    // Geminiの応答テキストを抽出
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      '……（無言）'

    return res.status(200).json({ reply })
  } catch (error) {
    console.error('Gemini API error:', error)
    return res.status(500).json({ reply: '（エラーが発生しました）' })
  }
}
