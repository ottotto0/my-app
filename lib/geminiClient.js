export async function getGeminiResponse(character, userMessage, records) {
  const systemPrompt = `
あなたは次のキャラクターとして会話します。
キャラ名: ${character.name}
年齢: ${character.age}
性格・設定: ${character.description}

これまでの会話履歴を参考にしながら、自然で優しい返答を返してください。
返答はキャラになりきって日本語で行ってください。
`

  const prompt = [
    { role: "system", content: systemPrompt },
    ...records.map(r => ({ role: r.role, content: r.message })),
    { role: "user", content: userMessage },
  ]

  const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": process.env.GEMINI_API_KEY,
    },
    body: JSON.stringify({ contents: prompt }),
  })

  const data = await res.json()
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "（返答エラー）"
  return text
}
