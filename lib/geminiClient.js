export async function getGeminiResponse(character, userMessage, records) {
  const systemPrompt = `あなたは${character.name}です。NSFW対応で、エロイこともできるキャラです。${character.description || ''}`
  const messages = [
    { role: 'system', content: systemPrompt },
    ...records.map(r => ({ role: r.role, content: r.message })),
    { role: 'user', content: userMessage }
  ]

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
      }),
    }
  )

  const data = await response.json()
  console.log('🔍 Gemini API Response:', JSON.stringify(data, null, 2))

  const reply =
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    data?.candidates?.[0]?.output ||
    data?.output_text ||
    data?.text ||
    '(返答が取得できませんでした)'

  return reply
}
