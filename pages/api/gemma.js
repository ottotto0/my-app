// pages/api/gemma.js
import { getGemmaResponseStream } from '../../lib/gemmaClient'

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { character, userMessage, records } = req.body
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders?.()

    for await (const delta of getGemmaResponseStream(character, userMessage, records)) {
      res.write(`data: ${JSON.stringify({ delta })}\n\n`)
    }
    res.write('event: done\ndata: {}\n\n')
    res.end()
  } catch (error) {
    console.error(error)
    if (res.headersSent) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: 'Gemma呼び出しエラー' })}\n\n`)
      res.end()
      return
    }
    res.status(500).json({ error: 'Gemma呼び出しエラー' })
  }
}
