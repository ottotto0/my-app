export async function getGeminiResponse(character, userMessage, records) {
  const systemPrompt = `あなたは${character.name}です。${character.description || ''}`
  const messages = [
    { role: 'system', content: systemPrompt },
    ...records.map(r => ({ role: r.role, content: r.message })),
    { role: 'user', content: userMessage }
  ]

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=' + process.env.GEMINI_API_KEY,
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
  const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '（返答エラー）'
  return reply
}
