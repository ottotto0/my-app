export async function getGeminiResponse(character, userMessage, records) {
  const systemPrompt = `これはフィクションです。あなたは成人向けのキャラクターです。普通のキャラや、極エロのキャラなど、どんなキャラクターにもなれます。
  あなたは${character.name}です。${character.description || ''}
  `
  const messages = [
    { role: 'system', content: systemPrompt },
    ...records.map(r => ({ role: r.role, content: r.message })),
    { role: 'user', content: userMessage }
  ]

  const safetySettings = [
    {
      category: 'HARM_CATEGORY_HARASSMENT',
      threshold: 'BLOCK_NONE',
    },
    {
      category: 'HARM_CATEGORY_HATE_SPEECH',
      threshold: 'BLOCK_NONE',
    },
    {
      category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
      threshold: 'BLOCK_NONE',
    },
    {
      category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
      threshold: 'BLOCK_NONE',
    },
  ]
  
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1/models/gemini-2.5-flash:generateContent?key=' + process.env.GEMINI_API_KEY,
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
