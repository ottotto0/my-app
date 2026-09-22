import { getGemmaResponseStream, completeImagePrompt } from '../../lib/gemmaClient.js'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co'
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder'
const supabase = createClient(supabaseUrl, supabaseKey)

// セクション区切りマーカー
const KEY_TAG_PATTERN = /(?:\[\s*key[_\s-]*tag\s*\]\s*:?|\*{2}\[?\s*key[_\s-]*tag\s*\]?\*{2}\s*:?|\bkey[_\s-]*tag\s*:)/i
const IMAGE_PROMPT_PATTERN = /(?:\[\s*image[_\s-]*prompt\s*\]\s*:?|\*{2}\[?\s*image[_\s-]*prompt\s*\]?\*{2}\s*:?|\bimage[_\s-]*prompt\s*:)/i
const CHAT_PATTERN = /(?:\[\s*chat\s*\]\s*:?|\*{2}\[?\s*chat\s*\]?\*{2}\s*:?|\bchat\s*:|【\s*chat\s*】)/i
const EMOTION_PATTERN = /\[(?:whispers|sighs|laughs|giggles|excited|softly|clears\s+throat|gasps|pause|serious|crying|shouting)\]/i
const JAPANESE_CHAR_PATTERN = /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FAF]/

// 後続セクション（着衣度・画像プロンプト情報）の開始行判定
const SECTION_START_REGEX = /^(?:\[\s*(?:key[_\s-]*tag|image[_\s-]*prompt|clothing|wear|status)\s*\]|user[\s_]*wear\s*:|[a-z0-9_\s-–—]+:\s*[0-9.]+)/i

function writeEvent(res, event, data) {
  res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`)
}

// 新順序フォーマットでのセリフ境界判定
function findChatBoundaries(output) {
  if (!output || !output.trim()) {
    return { started: false, safeChatText: '', isFinished: false, chatEndIndex: -1 }
  }

  let chatStart = -1
  let chatPrefixLen = 0

  const chatMatch = output.match(CHAT_PATTERN)
  if (chatMatch) {
    chatStart = chatMatch.index
    chatPrefixLen = chatMatch[0].length
  } else {
    const emotionMatch = output.match(EMOTION_PATTERN)
    if (emotionMatch) {
      chatStart = emotionMatch.index
      chatPrefixLen = 0
    } else {
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

  if (chatStart === -1) {
    return { started: false, safeChatText: '', isFinished: false, chatEndIndex: -1 }
  }

  const chatContentStart = chatStart + chatPrefixLen
  const leadingWhitespaceMatch = output.slice(chatContentStart).match(/^\s+/)
  const actualStart = leadingWhitespaceMatch ? chatContentStart + leadingWhitespaceMatch[0].length : chatContentStart

  const afterChat = output.slice(actualStart)
  const lines = afterChat.split('\n')
  let currentOffset = actualStart
  let isFinished = false
  let chatEndIndex = -1
  let safeLength = 0

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const isLastLine = (i === lines.length - 1)
    const lineStart = currentOffset
    const lineEnd = currentOffset + line.length
    currentOffset = lineEnd + 1 // +1 は '\n' 分

    if (SECTION_START_REGEX.test(line.trim())) {
      isFinished = true
      chatEndIndex = lineStart
      break
    }

    if (isLastLine) {
      const trimmed = line.trim()
      if (JAPANESE_CHAR_PATTERN.test(trimmed)) {
        safeLength = lineEnd - actualStart
      } else if (/^[a-zA-Z0-9_\[\s:.-]*$/.test(trimmed) && trimmed.length > 0) {
        // マーカーの可能性があるため未完了行を保留
      } else {
        safeLength = lineEnd - actualStart
      }
    } else {
      safeLength = lineEnd - actualStart
    }
  }

  if (isFinished) {
    const safeChatText = output.slice(actualStart, chatEndIndex).trimEnd()
    return { started: true, safeChatText, isFinished: true, chatEndIndex }
  }

  const safeChatText = output.slice(actualStart, actualStart + safeLength).trimEnd()
  return { started: true, safeChatText, isFinished: false, chatEndIndex: -1 }
}

// 後続の画像情報テキストから wearSection, keyTag, imagePrompt を抽出
function parseImageInfo(imageInfoText) {
  if (!imageInfoText) return { wearSection: '', keyTag: '', imagePrompt: '' }

  const keyMatch = imageInfoText.match(KEY_TAG_PATTERN)
  const promptMatch = imageInfoText.match(IMAGE_PROMPT_PATTERN)

  let wearSection = ''
  let keyTag = ''
  let imagePrompt = ''

  if (keyMatch || promptMatch) {
    let wearEnd = -1
    if (keyMatch) wearEnd = keyMatch.index
    else if (promptMatch) wearEnd = promptMatch.index
    wearSection = wearEnd !== -1 ? imageInfoText.slice(0, wearEnd).trim() : ''

    if (keyMatch) {
      const kStart = keyMatch.index + keyMatch[0].length
      const kEnd = promptMatch && promptMatch.index > keyMatch.index ? promptMatch.index : imageInfoText.length
      keyTag = imageInfoText.slice(kStart, kEnd).trim().split('\n')[0].replace(/^\[+|\]+$/g, '').trim()
    }
    if (promptMatch) {
      const pStart = promptMatch.index + promptMatch[0].length
      imagePrompt = imageInfoText.slice(pStart).trim().replace(/^\[+|\]+$/g, '').trim()
    }
  } else {
    // [KEY_TAG] や [IMAGE_PROMPT] が省略された場合
    const lines = imageInfoText.split('\n').map(l => l.trim()).filter(Boolean)
    const wearLines = []
    const otherLines = []
    for (const line of lines) {
      if (/:\s*[0-9.]+\s*$/i.test(line)) {
        wearLines.push(line)
      } else {
        otherLines.push(line)
      }
    }
    wearSection = wearLines.join('\n')
    const cleanedItems = otherLines.map(l => l.replace(/^\[+|\]+$/g, '').trim()).filter(Boolean)
    if (cleanedItems.length === 1) {
      if (cleanedItems[0].includes(',')) imagePrompt = cleanedItems[0]
      else keyTag = cleanedItems[0]
    } else if (cleanedItems.length >= 2) {
      keyTag = cleanedItems[0]
      imagePrompt = cleanedItems.slice(1).join(', ')
    }
  }

  return { wearSection, keyTag, imagePrompt }
}

// 旧順序フォーマット用のフォールバックパース関数
function parseOldGemmaSections(output) {
  if (!output || !output.trim()) return null

  let chatStart = -1
  let chatPrefixLen = 0

  const chatMatch = output.match(CHAT_PATTERN)
  if (chatMatch) {
    chatStart = chatMatch.index
    chatPrefixLen = chatMatch[0].length
  } else {
    const emotionMatch = output.match(EMOTION_PATTERN)
    if (emotionMatch) {
      chatStart = emotionMatch.index
      chatPrefixLen = 0
    } else {
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
  const { wearSection, keyTag, imagePrompt } = parseImageInfo(preChat)

  return { wearSection, keyTag, imagePrompt, initialChatDelta }
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
    let streamedChat = ''
    let chatStarted = false
    let chatCompleted = false
    let chatEndIndex = -1
    let imagePromptSaved = false
    let isOldFormatDetected = false

    for await (const delta of getGemmaResponseStream(character, userMessage, records)) {
      output += delta

      // 旧形式（着衣度やKEY_TAGから開始）かどうかの救済判定
      if (!chatStarted && !isOldFormatDetected && output.length > 10) {
        const trimmed = output.trim()
        const firstLine = trimmed.split('\n')[0]
        if (
          !CHAT_PATTERN.test(firstLine) &&
          !EMOTION_PATTERN.test(firstLine) &&
          !JAPANESE_CHAR_PATTERN.test(firstLine) &&
          SECTION_START_REGEX.test(firstLine)
        ) {
          isOldFormatDetected = true
        }
      }

      // 1. 旧形式フォールバック処理
      if (isOldFormatDetected) {
        if (!imagePromptSaved) {
          const parsed = parseOldGemmaSections(output)
          if (!parsed) continue

          let { wearSection, keyTag, imagePrompt, initialChatDelta } = parsed
          if (!imagePrompt && !keyTag) {
            imagePrompt = character.last_image_prompt || ''
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
            console.error('Failed to complete image prompt:', promptErr)
          }

          await supabase
            .from('characters')
            .update({ last_image_prompt: finalImagePrompt })
            .eq('id', character.id)

          imagePromptSaved = true
          writeEvent(res, 'image_prompt', { prompt: finalImagePrompt })
          chatStarted = true
          if (initialChatDelta) {
            streamedChat += initialChatDelta
            writeEvent(res, 'message', { delta: initialChatDelta })
          }
          continue
        }

        if (chatStarted && delta) {
          streamedChat += delta
          writeEvent(res, 'message', { delta })
        }
        continue
      }

      // 2. 新形式（セリフ先行）ストリーミング処理
      if (!chatCompleted) {
        const bounds = findChatBoundaries(output)
        if (bounds.started) {
          chatStarted = true
          const newDelta = bounds.safeChatText.slice(streamedChat.length)
          if (newDelta) {
            streamedChat = bounds.safeChatText
            writeEvent(res, 'message', { delta: newDelta })
          }
        }

        if (bounds.isFinished) {
          chatCompleted = true
          chatEndIndex = bounds.chatEndIndex
          console.log('Character utterance completed during streaming. Safe chat text:', JSON.stringify(bounds.safeChatText))
          // セリフ確定イベント送信（クライアントで音声再生ボタンが即時有効化される）
          writeEvent(res, 'chat_done', { text: bounds.safeChatText })
        }
      }

      // セリフ完了後、後続の画像プロンプト情報が出力されている途中で早期確定できるかチェック
      if (chatCompleted && !imagePromptSaved && chatEndIndex !== -1) {
        const imageInfoText = output.slice(chatEndIndex).trim()
        const promptMatch = imageInfoText.match(IMAGE_PROMPT_PATTERN)
        // [IMAGE_PROMPT] が出現し、その後の行が存在して改行または十分な長さがある場合
        if (promptMatch) {
          const afterPrompt = imageInfoText.slice(promptMatch.index + promptMatch[0].length).trim()
          if (afterPrompt.includes('\n') || (afterPrompt.includes(',') && afterPrompt.length > 20)) {
            const { wearSection, keyTag, imagePrompt } = parseImageInfo(imageInfoText)
            let finalImagePrompt = imagePrompt || character.last_image_prompt || ''
            try {
              finalImagePrompt = await completeImagePrompt({
                supabase,
                character,
                wearSection,
                rawImagePrompt: imagePrompt,
                keyTag,
              })
              console.log('Completed image prompt (early):', finalImagePrompt)
            } catch (err) {
              console.error('Error completing image prompt early:', err)
            }

            try {
              await supabase
                .from('characters')
                .update({ last_image_prompt: finalImagePrompt })
                .eq('id', character.id)
            } catch (saveErr) {
              console.error('Error saving image prompt early:', saveErr)
            }

            imagePromptSaved = true
            writeEvent(res, 'image_prompt', { prompt: finalImagePrompt })
          }
        }
      }
    }

    // ストリーム終了後の後処理
    if (isOldFormatDetected) {
      if (!chatCompleted) {
        writeEvent(res, 'chat_done', { text: streamedChat })
        chatCompleted = true
      }
    } else {
      // 1. セリフがまだ確定していなかった場合の処理（セリフのみで終わった場合など）
      if (!chatCompleted) {
        let finalChat = ''
        const bounds = findChatBoundaries(output)
        if (bounds.started) {
          finalChat = bounds.safeChatText || output
          chatEndIndex = bounds.isFinished ? bounds.chatEndIndex : output.length
        } else {
          finalChat = output
            .replace(/^[^\n]*:\s*[0-9.]+\s*(?:\r?\n|$)/gmi, '')
            .replace(/^\s*\[[^\]]+\]\s*/gm, '')
            .trim()
          chatEndIndex = output.length
        }

        const remainingDelta = finalChat.slice(streamedChat.length)
        if (remainingDelta) {
          streamedChat = finalChat
          writeEvent(res, 'message', { delta: remainingDelta })
        }

        writeEvent(res, 'chat_done', { text: finalChat })
        chatCompleted = true
      }

      // 2. 画像プロンプトがまだ確定していなかった場合の処理
      if (!imagePromptSaved) {
        const imageInfoText = chatEndIndex !== -1 ? output.slice(chatEndIndex).trim() : ''
        const { wearSection, keyTag, imagePrompt } = parseImageInfo(imageInfoText)

        let finalImagePrompt = imagePrompt || character.last_image_prompt || ''
        try {
          finalImagePrompt = await completeImagePrompt({
            supabase,
            character,
            wearSection,
            rawImagePrompt: imagePrompt,
            keyTag,
          })
          console.log('Completed image prompt (on stream end):', finalImagePrompt)
        } catch (err) {
          console.error('Error completing image prompt on stream end:', err)
        }

        try {
          await supabase
            .from('characters')
            .update({ last_image_prompt: finalImagePrompt })
            .eq('id', character.id)
        } catch (saveErr) {
          console.error('Error saving image prompt on stream end:', saveErr)
        }

        imagePromptSaved = true
        writeEvent(res, 'image_prompt', { prompt: finalImagePrompt })
      }
    }

    writeEvent(res, 'done', {})
    res.end()
  } catch (error) {
    console.error('Gemma API handler error:', error)
    if (res.headersSent) {
      writeEvent(res, 'error', { error: error.message || 'Gemma呼び出しエラー' })
      res.end()
      return
    }
    res.status(500).json({ error: error.message || 'Gemma呼び出しエラー' })
  }
}
