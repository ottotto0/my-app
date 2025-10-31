export default async function handler(req, res) {
  const { character, messages } = req.body

  const systemPrompt = `
あなたはキャラクター「${character.name}」として会話します。
キャラの設定は以下です：
${character.description}

会話の履歴:
${messages.map(m => `${m.role}: ${m.message}`).join('\n')}
`

  const response = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=" + process.env.GEMINI_API_KEY, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: systemPrompt }] }]
    })
  })

  const data = await response.json()
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || "……（無言）"

  res.status(200).json({ reply })
}
