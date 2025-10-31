import { getGeminiResponse } from "../../lib/geminiClient"

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end()
  try {
    const { character, userMessage, records } = req.body
    const reply = await getGeminiResponse(character, userMessage, records)
    res.status(200).json({ reply })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: "Gemini呼び出しエラー" })
  }
}
