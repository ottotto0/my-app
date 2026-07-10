// pages/api/gemma.js
import { getGemmaResponse } from '../../lib/gemmaClient'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { character, userMessage, records } = req.body
    const reply = await getGemmaResponse(character, userMessage, records)
    res.status(200).json({ reply })
  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Gemma呼び出しエラー' })
  }
}
