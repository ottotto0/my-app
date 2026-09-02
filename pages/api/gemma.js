// pages/api/gemma.js
import { getGemmaResponseStream } from '../../lib/gemmaClient'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

// ␞ / ␟ は通常のチャット本文には使われない制御文字の可視表記。モデルには
// そのまま出力させ、プロンプトと本文を衝突なく分離する。
const IMAGE_PROMPT_END = '␞␞␞IMAGE_PROMPT_END_8F3C␞␞␞'
const CHAT_MESSAGE_START = '␟␟␟CHAT_MESSAGE_BEGIN_8F3C␟␟␟'

function writeEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end()

  try {
    const { character, userMessage, records } = req.body
    if (!character?.id || !userMessage || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Invalid chat request' })
    }
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    })
    res.flushHeaders?.()

    let output = ''
    let imagePromptSaved = false
    let chatStarted = false

    for await (const delta of getGemmaResponseStream(character, userMessage, records)) {
      output += delta

      if (!imagePromptSaved) {
        const end = output.indexOf(IMAGE_PROMPT_END)
        if (end === -1) continue

        const imagePrompt = output
          .slice(0, end)
          .trim()
        if (!imagePrompt) throw new Error('画像生成プロンプトが空です')

        // 画像プロンプトが確定した時点で永続化する。以降の本文ストリームを
        // 待たずに、クライアントへ画像生成開始を通知する。
        const { error: saveError } = await supabase
          .from('characters')
          .update({ last_image_prompt: imagePrompt })
          .eq('id', character.id)
        if (saveError) throw saveError

        imagePromptSaved = true
        writeEvent(res, 'image_prompt', { prompt: imagePrompt })
      }

      if (!imagePromptSaved || chatStarted) {
        if (chatStarted && delta) writeEvent(res, 'message', { delta })
        continue
      }

      const chatStart = output.indexOf(CHAT_MESSAGE_START)
      if (chatStart === -1) continue

      chatStarted = true
      const initialChatDelta = output.slice(chatStart + CHAT_MESSAGE_START.length)
      if (initialChatDelta) writeEvent(res, 'message', { delta: initialChatDelta })
    }
    if (!imagePromptSaved || !chatStarted) throw new Error('Gemmaの出力形式が不正です')
    res.write('event: done\ndata: {}\n\n')
    res.end()
  } catch (error) {
    console.error(error)
    if (res.headersSent) {
      writeEvent(res, 'error', { error: 'Gemma呼び出しエラー' })
      res.end()
      return
    }
    res.status(500).json({ error: 'Gemma呼び出しエラー' })
  }
}
