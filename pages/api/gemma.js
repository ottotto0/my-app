import { getGemmaResponseStream, completeImagePrompt } from '../../lib/gemmaClient'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
)

// [IMAGE_PROMPT] と [CHAT] の2つのタグのみでセクションを分離
const IMAGE_PROMPT_TAG = '[IMAGE_PROMPT]'
const CHAT_TAG = '[CHAT]'

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
        const chatStart = output.indexOf(CHAT_TAG)
        if (chatStart === -1) continue

        let imagePrompt = ''
        const promptBegin = output.indexOf(IMAGE_PROMPT_TAG)
        if (promptBegin !== -1) {
          imagePrompt = output
            .slice(promptBegin + IMAGE_PROMPT_TAG.length, chatStart)
            .trim()
        } else {
          imagePrompt = output
            .slice(0, chatStart)
            .trim()
        }
        if (!imagePrompt) throw new Error('画像生成プロンプトが空です')

        // [IMAGE_PROMPT] より前のセクション（着衣度判定）
        const wearSection = promptBegin !== -1 ? output.slice(0, promptBegin).trim() : ''

        // ユーザー着衣度判定テキスト（例: "user wear: 1"）
        const userWearMatch = wearSection.match(/user[\s_]*wear\s*:\s*([0-9.]+)/i)
        if (userWearMatch) {
          console.log('Detected user clothing wear level:', userWearMatch[1])
        }

        // キャラの着衣度判定テキスト（user wear行を除外した各服装タグ行）
        const charWearLines = wearSection
          .split('\n')
          .map(line => line.trim())
          .filter(line => line && !line.toLowerCase().startsWith('user'))
        if (charWearLines.length > 0) {
          console.log('Detected character clothing wear levels:\n' + charWearLines.join('\n'))
        }

        // (i), (ii), (iii), (iv) の手順を踏んで画像生成プロンプトを完成させる
        let finalImagePrompt = imagePrompt
        try {
          finalImagePrompt = await completeImagePrompt({
            supabase,
            character,
            wearSection,
            rawImagePrompt: imagePrompt,
          })
          console.log('Completed image prompt:', finalImagePrompt)
        } catch (promptErr) {
          console.error('Failed to complete image prompt, falling back to raw prompt:', promptErr)
        }

        // 画像プロンプトが確定した時点で永続化する。以降の本文ストリームを
        // 待たずに、クライアントへ画像生成開始を通知する。
        const { error: saveError } = await supabase
          .from('characters')
          .update({ last_image_prompt: finalImagePrompt })
          .eq('id', character.id)
        if (saveError) throw saveError

        imagePromptSaved = true
        writeEvent(res, 'image_prompt', { prompt: finalImagePrompt })

        chatStarted = true
        const initialChatDelta = output.slice(chatStart + CHAT_TAG.length)
        if (initialChatDelta) writeEvent(res, 'message', { delta: initialChatDelta })
        continue
      }

      if (chatStarted && delta) {
        writeEvent(res, 'message', { delta })
      }
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
