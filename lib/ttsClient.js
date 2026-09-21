import { supabase } from './supabaseClient'

export const TONE_PRESETS = [
  { id: 'default', label: '標準 (Natural)', instruction: '' },
  { id: 'cheerful', label: '明るく元気 (Cheerful)', instruction: 'Speak in a cheerful, energetic, and bright tone.' },
  { id: 'calm', label: '優しく穏やか (Gentle & Calm)', instruction: 'Speak in a gentle, warm, and comforting tone.' },
  { id: 'intellectual', label: '落ち着いた知性 (Informative)', instruction: 'Speak in a clear, professional, and knowledgeable tone like a documentary narrator.' },
  { id: 'whisper', label: 'ひそひそ声 (Whispering)', instruction: 'Speak softly in an intimate, whispering tone.' },
  { id: 'excited', label: 'テンション高め (Excited)', instruction: 'Speak with high excitement, fast pace, and enthusiasm.' },
  { id: 'melancholic', label: '悲しげ・しっとり (Melancholic)', instruction: 'Speak in a quiet, sad, and reflective tone.' },
  { id: 'authoritative', label: '威厳・力強い (Authoritative)', instruction: 'Speak in a dignified, firm, and authoritative tone.' },
  { id: 'storyteller', label: '物語の語り手 (Storyteller)', instruction: 'Narrate expressively with dynamic pauses like a captivating fairy tale storyteller.' },
  { id: 'custom', label: 'カスタム指示 (Custom)', instruction: '' },
]

export const AUDIO_TAGS = [
  { tag: '[whispers]', label: 'ささやき' },
  { tag: '[sighs]', label: 'ため息' },
  { tag: '[laughs]', label: '笑い' },
  { tag: '[giggles]', label: 'くすくす笑い' },
  { tag: '[excited]', label: '興奮・高揚' },
  { tag: '[softly]', label: '優しく・静かに' },
  { tag: '[clears throat]', label: '咳払い' },
  { tag: '[gasps]', label: '息をのむ' },
  { tag: '[pause]', label: '間（ポーズ）' },
  { tag: '[serious]', label: '真剣に' },
  { tag: '[crying]', label: '泣き声・涙声' },
  { tag: '[shouting]', label: '叫び・大声' },
]

// --- PCM (16bit mono little-endian) -> WAV Blob 変換ユーティリティ ---
export function pcmToWav(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8)
  const blockAlign = numChannels * (bitsPerSample / 8)
  const dataSize = pcmBuffer.byteLength
  const wavBuffer = new ArrayBuffer(44 + dataSize)
  const view = new DataView(wavBuffer)

  const writeString = (offset, str) => {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i))
    }
  }

  // RIFF chunk descriptor
  writeString(0, 'RIFF')
  view.setUint32(4, 36 + dataSize, true)
  writeString(8, 'WAVE')

  // "fmt " sub-chunk
  writeString(12, 'fmt ')
  view.setUint32(16, 16, true) // SubChunk1Size (16 for PCM)
  view.setUint16(20, 1, true) // AudioFormat (1 = PCM)
  view.setUint16(22, numChannels, true)
  view.setUint32(24, sampleRate, true)
  view.setUint32(28, byteRate, true)
  view.setUint16(32, blockAlign, true)
  view.setUint16(34, bitsPerSample, true)

  // "data" sub-chunk
  writeString(36, 'data')
  view.setUint32(40, dataSize, true)

  // PCMサンプルデータをコピー
  const pcmBytes = new Uint8Array(pcmBuffer)
  const wavBytes = new Uint8Array(wavBuffer)
  wavBytes.set(pcmBytes, 44)

  return new Blob([wavBuffer], { type: 'audio/wav' })
}

// Base64 文字列を Uint8Array に変換
export function base64ToUint8Array(base64) {
  const binaryString = window.atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

// Base64 または PCM から再生可能な Blob を生成
export function createPlayableAudioBlob(base64Data, mimeType = '') {
  const bytes = base64ToUint8Array(base64Data)

  // 既に RIFF (WAV) ヘッダーを持っている場合
  if (
    bytes.length >= 4 &&
    bytes[0] === 0x52 && // R
    bytes[1] === 0x49 && // I
    bytes[2] === 0x46 && // F
    bytes[3] === 0x46    // F
  ) {
    return new Blob([bytes], { type: 'audio/wav' })
  }

  // MP3 等の圧縮音声形式の場合
  if (mimeType.includes('mp3') || mimeType.includes('mpeg')) {
    return new Blob([bytes], { type: 'audio/mp3' })
  }

  // mimeType からサンプリングレートを抽出 (例: "audio/pcm;rate=24000")
  let sampleRate = 24000
  const rateMatch = mimeType.match(/rate=(\d+)/i)
  if (rateMatch) {
    sampleRate = parseInt(rateMatch[1], 10)
  }

  return pcmToWav(bytes.buffer, sampleRate, 1, 16)
}

// Supabase から API キーを取得してラウンドロビンで選出する関数
export async function getNextApiKey(advancePointer = true) {
  const { data: keys, error } = await supabase
    .from('google_ai_studio_api_key')
    .select('*')
    .order('id', { ascending: true })

  if (error || !keys || keys.length === 0) {
    throw new Error(error ? `Supabaseエラー: ${error.message}` : 'google_ai_studio_api_key テーブルにAPIキーのレコードが存在しません。')
  }

  const n = keys.length
  let lastUsedIndex = keys.findIndex((k) => k.is_last_used === true)

  if (lastUsedIndex === -1 && typeof window !== 'undefined') {
    const savedLastId = localStorage.getItem('last_used_google_ai_key_id')
    if (savedLastId) {
      lastUsedIndex = keys.findIndex((k) => String(k.id) === String(savedLastId))
    }
  }

  const nextIndex = advancePointer
    ? (lastUsedIndex === -1 ? 0 : (lastUsedIndex + 1) % n)
    : (lastUsedIndex === -1 ? 0 : lastUsedIndex)

  const selected = keys[nextIndex]

  if (typeof window !== 'undefined' && advancePointer) {
    localStorage.setItem('last_used_google_ai_key_id', String(selected.id))
  }

  if (advancePointer) {
    try {
      await Promise.all([
        supabase.from('google_ai_studio_api_key').update({ is_last_used: false }).neq('id', selected.id),
        supabase.from('google_ai_studio_api_key').update({ is_last_used: true }).eq('id', selected.id),
      ])
    } catch (e) {
      console.warn('is_last_used のDB更新をスキップ:', e)
    }
  }

  return selected.key
}

// プロンプト組み立て（Director's Notes と TRANSCRIPT の分離）
export function buildTtsPrompt(text, character = {}) {
  const notes = []
  const tonePreset = character?.voice_tone_preset || 'default'
  const activePreset = TONE_PRESETS.find((p) => p.id === tonePreset)
  if (activePreset && activePreset.instruction) {
    notes.push(`- Style: ${activePreset.instruction}`)
  }

  const pace = character?.voice_pace || 'normal'
  if (pace === 'slow') {
    notes.push('- Pace: Speak at a relaxed, unhurried, slower pace (around 0.85x).')
  } else if (pace === 'fast') {
    notes.push('- Pace: Speak briskly and quickly (around 1.25x).')
  }

  const pitch = character?.voice_pitch || 'normal'
  if (pitch === 'high') {
    notes.push('- Pitch: Speak with a slightly higher vocal pitch.')
  } else if (pitch === 'low') {
    notes.push('- Pitch: Speak with a slightly deeper, lower vocal pitch.')
  }

  const customInstruction = (character?.voice_custom_instruction || '').trim()
  if (customInstruction) {
    notes.push(`- Directing Note: ${customInstruction}`)
  }

  if (notes.length > 0) {
    return `Synthesize speech for the performance defined below. The director's notes are direction only. Do NOT speak them. Speak ONLY the lines under #### TRANSCRIPT.\n\n### DIRECTOR'S NOTES\n${notes.join(
      '\n'
    )}\n\n#### TRANSCRIPT\n${text}`
  }

  return text
}

// Web Audio API によるオーディオ制御ユーティリティ
let globalAudioCtx = null

export function getAudioContext() {
  if (typeof window === 'undefined') return null
  if (!globalAudioCtx) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext
    if (AudioContextClass) {
      globalAudioCtx = new AudioContextClass()
    }
  }
  return globalAudioCtx
}

// ユーザーのタップ/クリック時に同期的に呼び出し、モバイルブラウザのオーディオをアンロックする
export function unlockAudio() {
  try {
    const ctx = getAudioContext()
    if (ctx) {
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {})
      }
      // iOS Safari 対策: 1サンプルの無音バッファを再生してオーディオパイプラインを完全アクティブ化
      const dummyBuffer = ctx.createBuffer(1, 1, 22050)
      const source = ctx.createBufferSource()
      source.buffer = dummyBuffer
      source.connect(ctx.destination)
      source.start(0)
    }
  } catch (e) {
    // ignore
  }

  // iOS Safari のマナーモード（サイレントスイッチ）対策: HTML5 Audioで無音WAVを再生しPlaybackカテゴリを有効化
  try {
    const silentAudio = new Audio('data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=')
    silentAudio.play().then(() => {
      silentAudio.pause()
    }).catch(() => {})
  } catch (e) {
    // ignore
  }
}

// ArrayBuffer を AudioBuffer にデコード（コールバック互換ラップ）
export async function decodeAudioData(arrayBuffer) {
  const ctx = getAudioContext()
  if (!ctx) throw new Error('Web Audio API is not supported')

  return new Promise((resolve, reject) => {
    ctx.decodeAudioData(
      arrayBuffer.slice(0),
      (buffer) => resolve(buffer),
      (err) => reject(err)
    )
  })
}

// Web Audio API で AudioBuffer を再生する関数
export function playAudioBuffer(audioBuffer, onEnded, onError) {
  const ctx = getAudioContext()
  if (!ctx) throw new Error('Web Audio API is not supported')

  if (ctx.state === 'suspended') {
    ctx.resume().catch(() => {})
  }

  const source = ctx.createBufferSource()
  source.buffer = audioBuffer
  source.connect(ctx.destination)

  let ended = false
  source.onended = () => {
    if (!ended) {
      ended = true
      onEnded?.()
    }
  }

  try {
    source.start(0)
  } catch (err) {
    onError?.(err)
    throw err
  }

  return {
    stop: () => {
      if (!ended) {
        ended = true
        try {
          source.stop()
          source.disconnect()
        } catch (e) {
          // ignore
        }
      }
    },
  }
}

// Gemini 3.1 Flash TTS API 呼び出し実行
export async function synthesizeSpeech(textToSpeak, character = {}) {
  const apiKey = await getNextApiKey(true)
  if (!apiKey) {
    throw new Error('有効な Google AI Studio APIキーが取得できませんでした。')
  }

  const voiceName = character?.voice_name || 'Kore'
  const promptContent = buildTtsPrompt(textToSpeak, character)

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: promptContent,
          },
        ],
      },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: voiceName,
          },
        },
      },
    },
  }

  const controller = new AbortController()
  const timeoutId = setTimeout(() => {
    controller.abort()
  }, 25000)

  let response
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-tts-preview:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      }
    )
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error('音声の生成がタイムアウトしました。電波の良い場所でもう一度お試しください。')
    }
    throw err
  } finally {
    clearTimeout(timeoutId)
  }

  if (!response.ok) {
    let errDetail = ''
    try {
      const errJson = await response.json()
      errDetail = errJson.error?.message || JSON.stringify(errJson)
    } catch (e) {
      errDetail = await response.text()
    }
    throw new Error(`Google AI Studio APIエラー (${response.status}): ${errDetail}`)
  }

  const data = await response.json()
  const audioPart = data.candidates?.[0]?.content?.parts?.find((p) => p.inlineData)

  if (!audioPart || !audioPart.inlineData?.data) {
    const textPart = data.candidates?.[0]?.content?.parts?.find((p) => p.text)
    if (textPart) {
      throw new Error(`音声ではなくテキストが返却されました: ${textPart.text}`)
    }
    throw new Error('レスポンス内に有効な音声データが見つかりませんでした。')
  }

  const { mimeType, data: base64Data } = audioPart.inlineData
  const blob = createPlayableAudioBlob(base64Data, mimeType)
  const url = URL.createObjectURL(blob)

  return { blob, url }
}
