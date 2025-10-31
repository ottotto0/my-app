export default async function handler(req, res) {
  try {
    const { character, messages } = req.body

    // Gemini へ渡す「システム＋ユーザー履歴」構築
    const prompt = `
あなたはキャラクター「${character.name}」です。
キャラの設定：
${character.description}

以下はこれまでの会話履歴です。
この流れを踏まえて、次のユーザー発言に返答してください。
${messages.map(m => `${m.role === "user" ? "ユーザー" : "あなた"}: ${m.message}`).join('\n')}
`

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              role: "user",
              parts: [{ text: prompt }]
            }
          ]
        })
      }
    )

    const data = await response.json()

    console.log("Gemini API response:", JSON.stringify(data, null, 2)) // ← デバッグ用ログ

    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ||
      data?.candidates?.[0]?.output_text ||
      "（AIの返答が取得できませんでした）"

    res.status(200).json({ reply })
  } catch (error) {
    console.error("Gemini API error:", error)
    res.status(500).json({ reply: "（サーバーエラーが発生しました）" })
  }
}
