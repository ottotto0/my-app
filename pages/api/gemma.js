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
const JAPANESE_CHAR_PATTERN = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/

function parseGemmaSections(output) {
  if (!output || !output.trim()) return null

  let chatStart = -1
  let chatPrefixLen = 0

  // 1. [CHAT] 明示タグの判定
  const chatMatch = output.match(CHAT_PATTERN)
  if (chatMatch) {
    chatStart = chatMatch.index
    chatPrefixLen = chatMatch[0].length
  } else {
    // 2. 感情タグ（[giggles] 等）の判定（Gemmaが[CHAT]を省略して感情タグから直接開始した場合）
    const emotionMatch = output.match(EMOTION_PATTERN)
    if (emotionMatch) {
      chatStart = emotionMatch.index
      chatPrefixLen = 0
    } else {
      // 3. 日本語文字を含む最初の行の判定（タグなしで直接セリフが出力された場合）
      const lines = output.split('\n')
      let offset = 0
      for (const line of lines) {
        if (JAPANESE_CHAR_PATTERN.test(line)) {
          chatStart = offset
          chatPrefixLen = 0
          break
        }
        offset += line.length + 1
      }
    }
  }

  if (chatStart === -1) return null

  const preChat = output.slice(0, chatStart).trim()
  const initialChatDelta = output.slice(chatStart + chatPrefixLen).trimStart()

  const keyMatch = preChat.match(KEY_TAG_PATTERN)
  const promptMatch = preChat.match(IMAGE_PROMPT_PATTERN)

  let wearSection = ''
  let keyTag = ''
  let imagePrompt = ''

  if (keyMatch || promptMatch) {
    let wearEnd = -1
    if (keyMatch) wearEnd = keyMatch.index
    else if (promptMatch) wearEnd = promptMatch.index
    wearSection = wearEnd !== -1 ? preChat.slice(0, wearEnd).trim() : ''

    if (keyMatch) {
      const kStart = keyMatch.index + keyMatch[0].length
      const kEnd = promptMatch && promptMatch.index > keyMatch.index ? promptMatch.index : preChat.length
      keyTag = preChat.slice(kStart, kEnd).trim().split('\n')[0].replace(/^\[+|\]+$/g, '').trim()
    }
    if (promptMatch) {
      const pStart = promptMatch.index + promptMatch[0].length
      imagePrompt = preChat.slice(pStart).trim().replace(/^\[+|\]+$/g, '').trim()
    }
  } else {
    // [KEY_TAG] や [IMAGE_PROMPT] のキーワード自体が省略され、
    // 着衣度行や角括弧の候補タグ（例: [introducing], [smiling, ...]）が直接並んでいる場合
    const preLines = preChat.split('\n').map(l => l.trim()).filter(Boolean)
    const wearLines = []
    const otherLines = []

    for (const line of preLines) {
      if (/:\s*[0-9.]+\s*$/i.test(line)) {
        wearLines.push(line)
      } else {
        otherLines.push(line)
      }
    }
    wearSection = wearLines.join('\n')

    const cleanedItems = otherLines.map(l => l.replace(/^\[+|\]+$/g, '').trim()).filter(Boolean)
    if (cleanedItems.length === 1) {
      if (cleanedItems[0].includes(',')) {
        imagePrompt = cleanedItems[0]
      } else {
        keyTag = cleanedItems[0]
      }
    } else if (cleanedItems.length >= 2) {
      keyTag = cleanedItems[0]
      imagePrompt = cleanedItems.slice(1).join(', ')
    }
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
      let chatText = ''

      if (parsed) {
        wearSection = parsed.wearSection
        keyTag = parsed.keyTag
        if (parsed.imagePrompt || parsed.keyTag) {
          imagePrompt = parsed.imagePrompt
        }
        chatText = parsed.initialChatDelta
      } else {
        // 万が一パースできなかった場合でも着衣度行と先頭の角括弧タグを除去して本文を抽出
        chatText = output
          .replace(/^[^\n]*:\s*[0-9.]+\s*(?:\r?\n|$)/gmi, '')
          .replace(/^\s*\[[^\]]+\]\s*/gm, '')
          .trim()
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
