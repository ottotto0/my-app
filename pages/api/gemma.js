import { getGemmaResponseStream, completeImagePrompt } from '../../lib/gemmaClient.js'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const supabase = createClient(supabaseUrl, supabaseKey)

// [KEY_TAG], [IMAGE_PROMPT], [CHAT] のタグでセクションを分離
const KEY_TAG_PATTERN = /(?:\[\s*key[_\s-]*tag\s*\]\s*:?|\*{2}\[?\s*key[_\s-]*tag\s*\]?\*{2}\s*:?|\bkey[_\s-]*tag\s*:)/i
const IMAGE_PROMPT_PATTERN = /(?:\[\s*image[_\s-]*prompt\s*\]\s*:?|\*{2}\[?\s*image[_\s-]*prompt\s*\]?\*{2}\s*:?|\bimage[_\s-]*prompt\s*:)/i
const CHAT_PATTERN = /(?:\[\s*chat\s*\]\s*:?|\*{2}\[?\s*chat\s*\]?\*{2}\s*:?|\bchat\s*:|【\s*chat\s*】)/i
const EMOTION_PATTERN = /\[(?:whispers|sighs|laughs|giggles|excited|softly|clears\s+throat|gasps|pause|serious|crying|shouting)\]/i

function parseGemmaSections(output) {
  const chatMatch = output.match(CHAT_PATTERN)
  let chatStart = -1
  let chatPrefixLen = 0

  if (chatMatch) {
    chatStart = chatMatch.index
    chatPrefixLen = chatMatch[0].length
  } else {
    // [CHAT] タグが省略され、感情タグから始まっている場合（IMAGE_PROMPT または KEY_TAG の後）
    const promptMatch = output.match(IMAGE_PROMPT_PATTERN)
    const keyMatch = output.match(KEY_TAG_PATTERN)
    const searchFrom = promptMatch
      ? promptMatch.index + promptMatch[0].length
      : (keyMatch ? keyMatch.index + keyMatch[0].length : 0)
    if (searchFrom > 0) {
      const sub = output.slice(searchFrom)
      const emotionMatch = sub.match(EMOTION_PATTERN)
      if (emotionMatch) {
        chatStart = searchFrom + emotionMatch.index
        chatPrefixLen = 0
      }
    }
  }

  if (chatStart === -1) return null

  const preChat = output.slice(0, chatStart)
  const initialChatDelta = output.slice(chatStart + chatPrefixLen).trimStart()

  const keyMatch = preChat.match(KEY_TAG_PATTERN)
  const promptMatch = preChat.match(IMAGE_PROMPT_PATTERN)

  let wearEnd = -1
  if (keyMatch) wearEnd = keyMatch.index
  else if (promptMatch) wearEnd = promptMatch.index

  const wearSection = wearEnd !== -1 ? preChat.slice(0, wearEnd).trim() : ''

  let keyTag = ''
  if (keyMatch) {
    const kStart = keyMatch.index + keyMatch[0].length
    const kEnd = promptMatch && promptMatch.index > keyMatch.index ? promptMatch.index : preChat.length
    keyTag = preChat.slice(kStart, kEnd).trim().split('\n')[0].trim()
  }

  let imagePrompt = ''
  if (promptMatch) {
    const pStart = promptMatch.index + promptMatch[0].length
    imagePrompt = preChat.slice(pStart).trim()
  } else if (keyMatch) {
    const kStart = keyMatch.index + keyMatch[0].length
    imagePrompt = preChat.slice(kStart).trim()
  } else {
    imagePrompt = preChat.trim()
  }

  return { wearSection, keyTag, imagePrompt, initialChatDelta }
}

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
        const parsed = parseGemmaSections(output)
        if (!parsed) continue

        let { wearSection, keyTag, imagePrompt, initialChatDelta } = parsed
        if (!imagePrompt && !keyTag) {
          imagePrompt = character.last_image_prompt || ''
        }

        if (keyTag) {
          console.log('Detected key tag:', keyTag)
        }

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
            keyTag,
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
        if (initialChatDelta) writeEvent(res, 'message', { delta: initialChatDelta })
        continue
      }

      if (chatStarted && delta) {
        writeEvent(res, 'message', { delta })
      }
    }

    // ストリーム終了時点でまだ画像プロンプトが確定していない場合のフォールバック
    if (!imagePromptSaved) {
      console.log('Gemma stream finished without delimiter detected during streaming. Raw output:\n', output)
      if (!output.trim()) {
        throw new Error('Gemmaからの返答が空でした')
      }

      let parsed = parseGemmaSections(output)
      let wearSection = ''
      let keyTag = ''
      let imagePrompt = character.last_image_prompt || ''
      let chatText = output.trim()

      if (parsed) {
        wearSection = parsed.wearSection
        keyTag = parsed.keyTag
        if (parsed.imagePrompt || parsed.keyTag) {
          imagePrompt = parsed.imagePrompt
        }
        chatText = parsed.initialChatDelta || output.trim()
      }

      let finalImagePrompt = imagePrompt
      try {
        finalImagePrompt = await completeImagePrompt({
          supabase,
          character,
          wearSection,
          rawImagePrompt: imagePrompt,
          keyTag,
        })
      } catch (promptErr) {
        console.error('Failed to complete image prompt in fallback:', promptErr)
      }

      if (finalImagePrompt) {
        await supabase
          .from('characters')
          .update({ last_image_prompt: finalImagePrompt })
          .eq('id', character.id)
      }

      imagePromptSaved = true
      writeEvent(res, 'image_prompt', { prompt: finalImagePrompt })
      writeEvent(res, 'message', { delta: chatText })
      chatStarted = true
    }

    res.write('event: done\ndata: {}\n\n')
    res.end()
  } catch (error) {
    console.error(error)
    if (res.headersSent) {
      writeEvent(res, 'error', { error: error.message || 'Gemma呼び出しエラー' })
      res.end()
      return
    }
    res.status(500).json({ error: error.message || 'Gemma呼び出しエラー' })
  }
}
