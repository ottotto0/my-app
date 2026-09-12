import React, { useState, useEffect, useRef } from 'react'
import Head from 'next/head'
import { supabase } from '../lib/supabaseClient'

// --- Gemini 3.1 Flash TTS 30種のプリセット音声定義 ---
const GEMINI_VOICES = [
  { name: 'Kore', gender: '女性', tone: '確信的・標準的', desc: 'クリアで芯のある標準的な女性の声。ビジネスや案内向き。', default: true },
  { name: 'Puck', gender: '男性', tone: '快活・エネルギッシュ', desc: '明るく元気で親しみやすい男性の声。若々しいキャラクター向け。' },
  { name: 'Aoede', gender: '女性', tone: '爽やか・自然', desc: '軽やかで心地よい語り口。物語の朗読やナレーション向き。' },
  { name: 'Charon', gender: '男性', tone: '理知的・ニュース風', desc: '落ち着きと知性を感じるトーン。解説やニュース報道向き。' },
  { name: 'Fenrir', gender: '男性', tone: '熱狂的・躍動感', desc: '情熱的でダイナミックな声。勢いのあるセリフに最適。' },
  { name: 'Achernar', gender: '女性', tone: '柔らか・繊細', desc: '優しく語りかけるソフトな声。癒やし系や穏やかな会話向き。' },
  { name: 'Achird', gender: '男性', tone: '親しみやすい', desc: '温かみのあるフレンドリーな男性の声。日常会話にぴったり。' },
  { name: 'Algenib', gender: '男性', tone: 'ハスキー・低音', desc: '深みと少しざらつきのある渋い声。クールな男性役向き。' },
  { name: 'Algieba', gender: '男性', tone: '滑らか・紳士的', desc: '上品で滑らかな口調。落ち着いた大人の男性キャラクター向き。' },
  { name: 'Alnilam', gender: '男性', tone: '力強い・芯のある', desc: 'まっすぐで頼りがいのある声。決意のこもったセリフ向き。' },
  { name: 'Autonoe', gender: '女性', tone: '明るい・晴れやか', desc: 'ポジティブで元気なトーン。アクティブな女性キャラ向き。' },
  { name: 'Callirrhoe', gender: '女性', tone: '軽快・チャーミング', desc: 'リズミカルで愛嬌のある声。会話を楽しく盛り上げる。' },
  { name: 'Despina', gender: '女性', tone: '明瞭・ハキハキ', desc: '聞き取りやすく歯切れのよい声。プレゼンや解説向き。' },
  { name: 'Enceladus', gender: '男性', tone: '重厚・深み', desc: '低く響く落ち着いた声。重みのある人物やナレーション向き。' },
  { name: 'Erinome', gender: '女性', tone: '温もり・包容力', desc: '温かく包み込むような優しい声。母親役やアドバイザー向き。' },
  { name: 'Gacrux', gender: '女性', tone: '成熟・落ち着き', desc: '落ち着いた大人の女性の声。優雅で気品のあるトーン。' },
  { name: 'Iapetus', gender: '男性', tone: '自然体・カジュアル', desc: '飾らないナチュラルな口調。等身大のキャラクター向き。' },
  { name: 'Laomedeia', gender: '女性', tone: '甘い・可憐', desc: '愛らしくソフトな声。可愛らしいキャラクターやヒロイン向き。' },
  { name: 'Leda', gender: '女性', tone: '若々しい・活発', desc: 'フレッシュで若さを感じる声。少女や学生キャラクター向き。' },
  { name: 'Orus', gender: '男性', tone: '堅実・重厚', desc: 'どっしりと落ち着いた声。指導者や武骨なキャラクター向き。' },
  { name: 'Pulcherrima', gender: '女性', tone: '澄んだ響き', desc: '透明感と響きの良さが特徴。格式高い雰囲気のセリフ向き。' },
  { name: 'Rasalgethi', gender: '男性', tone: '威厳・堂々とした', desc: '威厳に満ちた迫力のある声。王や長老、ボスキャラクター向き。' },
  { name: 'Sadachbia', gender: '女性', tone: 'メロディック・心地よい', desc: '歌うような心地よいリズム感を持つ声。ポエトリーや物語向き。' },
  { name: 'Sadaltager', gender: '男性', tone: '博学・解説風', desc: '物知りで落ち着いた学者風の声。ドキュメンタリーや解説向き。' },
  { name: 'Schedar', gender: '男性', tone: '均一・フラット', desc: '癖が少なく均質な発音。客観的なアナウンスやAIアシスタント向き。' },
  { name: 'Sulafat', gender: '女性', tone: '温和・おだやか', desc: '慈愛に満ちた穏やかなトーン。静かな夜の語りや朗読向き。' },
  { name: 'Umbriel', gender: '男性', tone: '静穏・ミステリアス', desc: '物静かでどこか影のある声。ミステリアスな人物向き。' },
  { name: 'Vindemiatrix', gender: '女性', tone: '優雅・たおやか', desc: 'しっとりとした大人の気品漂う声。丁寧で優美な表現向き。' },
  { name: 'Zephyr', gender: '女性', tone: '透明感・エアリー', desc: '息を多く含んだ幻想的な声。神秘的なセリフや内省的な独白向き。' },
  { name: 'Zubenelgenubi', gender: '男性', tone: '冷静沈着', desc: '感情を抑えたクールで冷静な声。参謀や無機質な役向き。' },
]

// --- 感情・演技タグ（Gemini 3.1 Flash TTS 特有のインラインタグ） ---
const AUDIO_TAGS = [
  { tag: '[whispers]', label: 'ささやき', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { tag: '[sighs]', label: 'ため息', color: 'bg-slate-50 text-slate-700 border-slate-200' },
  { tag: '[laughs]', label: '笑い', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { tag: '[giggles]', label: 'くすくす笑い', color: 'bg-pink-50 text-pink-700 border-pink-200' },
  { tag: '[excited]', label: '興奮・高揚', color: 'bg-rose-50 text-rose-700 border-rose-200' },
  { tag: '[softly]', label: '優しく・静かに', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { tag: '[clears throat]', label: '咳払い', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { tag: '[gasps]', label: '息をのむ', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { tag: '[pause]', label: '間（ポーズ）', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { tag: '[serious]', label: '真剣に', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { tag: '[crying]', label: '泣き声・涙声', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { tag: '[shouting]', label: '叫び・大声', color: 'bg-orange-50 text-orange-700 border-orange-200' },
]

// --- トーン・演技スタイルプリセット ---
const TONE_PRESETS = [
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

// --- サンプル文章 ---
const SAMPLE_TEXTS = [
  {
    label: '日常のあいさつ',
    text: 'こんにちは！今日はとても良いお天気ですね。[excited] お散歩や買い物に出かけるのには最高の気分です！',
  },
  {
    label: '感情豊かなセリフ',
    text: 'えっ、本当ですか！？[gasps] まさかそんなことが起こるなんて…！[laughs] でも、信じてくれて本当に嬉しいです。ありがとう！',
  },
  {
    label: '物語の朗読',
    text: '深い森の奥深く、誰も知らない小さな湖がありました。[softly] その水面は鏡のように星空を映し、[whispers] 夜風がそっと木々を揺らしていました。[pause] 旅人は静かに息を呑みました。',
  },
  {
    label: 'ニュース解説',
    text: '本日の最新ニュースをお伝えします。[serious] 今週発表された新技術について、専門家からは期待の声が高まっています。今後の実用化に向けた動きに注目が集まります。',
  },
]

// --- PCM (16bit mono little-endian) -> WAV Blob 変換ユーティリティ ---
function pcmToWav(pcmBuffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16) {
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

// Base64 文字列を ArrayBuffer / Uint8Array に変換
function base64ToUint8Array(base64) {
  const binaryString = window.atob(base64)
  const len = binaryString.length
  const bytes = new Uint8Array(len)
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  return bytes
}

// Base64 または PCM から再生可能な Blob を生成
function createPlayableAudioBlob(base64Data, mimeType = '') {
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

export default function TTSTestPage() {
  // 固定モデル名
  const MODEL_NAME = 'Gemini 3.1 Flash TTS'
  const MODEL_ENDPOINT_ID = 'gemini-3.1-flash-tts-preview'

  // --- 入力・設定ステート ---
  const [inputText, setInputText] = useState(
    'こんにちは！Gemini 3.1 Flash TTSの音声テストへようこそ。[whispers] ここに文章を入力して、[excited] いろいろな声や感情表現を試してみてください！'
  )
  const [selectedVoice, setSelectedVoice] = useState('Kore')
  const [voiceFilter, setVoiceFilter] = useState('all') // 'all', '女性', '男性'
  const [voiceSearch, setVoiceSearch] = useState('')
  const [tonePreset, setTonePreset] = useState('default')
  const [customDirectorNote, setCustomDirectorNote] = useState('')
  const [speakingPace, setSpeakingPace] = useState('normal') // 'slow', 'normal', 'fast'
  const [pitchLevel, setPitchLevel] = useState('normal') // 'low', 'normal', 'high'

  // --- APIキー & ラウンドロビン管理ステート ---
  const [keyStatus, setKeyStatus] = useState({
    loading: false,
    activeKeyId: null,
    totalKeys: 0,
    currentIndex: 0,
    allKeyIds: [],
    error: null,
  })

  // --- 音声生成 & 再生ステート ---
  const [isGenerating, setIsGenerating] = useState(false)
  const [errorMsg, setErrorMsg] = useState(null)
  const [generatedAudioUrl, setGeneratedAudioUrl] = useState(null)
  const [audioBlob, setAudioBlob] = useState(null)
  const [lastGenInfo, setLastGenInfo] = useState(null)

  // --- プレイヤー操作ステート ---
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [volume, setVolume] = useState(1.0)
  const [isMuted, setIsMuted] = useState(false)
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0)

  // --- サンプル試聴キャッシュ & 試聴ステート ---
  const [previewLoadingVoice, setPreviewLoadingVoice] = useState(null)
  const [previewPlayingVoice, setPreviewPlayingVoice] = useState(null)
  const [previewSavingVoice, setPreviewSavingVoice] = useState(null)
  const previewAudioCacheRef = useRef({}) // { [voiceName]: audioUrl }
  const previewAudioPlayerRef = useRef(null)

  // 参照
  const textareaRef = useRef(null)
  const mainAudioRef = useRef(null)

  // 初期ロード時に Supabase の API キー情報を確認
  useEffect(() => {
    refreshKeyInfo()
  }, [])

  // オーディオプレイヤーの速度更新
  useEffect(() => {
    if (mainAudioRef.current) {
      mainAudioRef.current.playbackRate = playbackSpeed
    }
  }, [playbackSpeed])

  // オーディオプレイヤーの音量更新
  useEffect(() => {
    if (mainAudioRef.current) {
      mainAudioRef.current.volume = isMuted ? 0 : volume
    }
  }, [volume, isMuted])

  // --- Supabase から API キーを取得してラウンドロビンで選出する関数 ---
  const getNextApiKey = async (advancePointer = true) => {
    const { data: keys, error } = await supabase
      .from('google_ai_studio_api_key')
      .select('*')
      .order('id', { ascending: true })

    if (error || !keys || keys.length === 0) {
      const errDetail = error
        ? `Supabaseエラー: ${error.message}`
        : 'google_ai_studio_api_key テーブルにAPIキーのレコードが存在しません。'
      setKeyStatus((prev) => ({ ...prev, error: errDetail }))
      throw new Error(errDetail)
    }

    const n = keys.length
    // 1. is_last_used カラムの確認（hf_tokens 同様）
    let lastUsedIndex = keys.findIndex((k) => k.is_last_used === true)

    // 2. DB上に is_last_used が無かった場合の LocalStorage フォールバック
    if (lastUsedIndex === -1 && typeof window !== 'undefined') {
      const savedLastId = localStorage.getItem('last_used_google_ai_key_id')
      if (savedLastId) {
        lastUsedIndex = keys.findIndex((k) => String(k.id) === String(savedLastId))
      }
    }

    // 次のインデックスを選定（ラウンドロビン）
    const nextIndex = advancePointer
      ? (lastUsedIndex === -1 ? 0 : (lastUsedIndex + 1) % n)
      : (lastUsedIndex === -1 ? 0 : lastUsedIndex)

    const selected = keys[nextIndex]

    // LocalStorage に記録
    if (typeof window !== 'undefined' && advancePointer) {
      localStorage.setItem('last_used_google_ai_key_id', String(selected.id))
    }

    // DB上の is_last_used を更新（カラムが存在する場合のみ有効）
    if (advancePointer) {
      try {
        await Promise.all([
          supabase.from('google_ai_studio_api_key').update({ is_last_used: false }).neq('id', selected.id),
          supabase.from('google_ai_studio_api_key').update({ is_last_used: true }).eq('id', selected.id),
        ])
      } catch (e) {
        console.warn('is_last_used のDB更新をスキップ（カラム未作成等の可能性）:', e)
      }
    }

    setKeyStatus({
      loading: false,
      activeKeyId: selected.id,
      totalKeys: n,
      currentIndex: nextIndex + 1,
      allKeyIds: keys.map((k) => k.id),
      error: null,
    })

    return {
      apiKey: selected.key,
      keyId: selected.id,
      currentIndex: nextIndex + 1,
      totalKeys: n,
    }
  }

  // キー情報の確認/再読み込み
  const refreshKeyInfo = async () => {
    setKeyStatus((prev) => ({ ...prev, loading: true }))
    try {
      await getNextApiKey(false)
    } catch (err) {
      console.error('キー情報取得エラー:', err)
    }
  }

  // 手動でラウンドロビンを次に進める
  const handleManualAdvanceKey = async () => {
    try {
      const nextKey = await getNextApiKey(true)
      console.log(`手動でAPIキーを ID: ${nextKey.keyId} に切り替えました。`)
    } catch (err) {
      console.error('手動キー切り替えエラー:', err)
    }
  }

  // --- プロンプト組み立て（Director's Notes と TRANSCRIPT の分離） ---
  const buildPrompt = () => {
    const notes = []

    // 選択されたトーンプリセット
    const activePreset = TONE_PRESETS.find((p) => p.id === tonePreset)
    if (activePreset && activePreset.instruction) {
      notes.push(`- Style: ${activePreset.instruction}`)
    }

    // 読み上げペース
    if (speakingPace === 'slow') {
      notes.push('- Pace: Speak at a relaxed, unhurried, slower pace (around 0.85x).')
    } else if (speakingPace === 'fast') {
      notes.push('- Pace: Speak briskly and quickly (around 1.25x).')
    }

    // 音高
    if (pitchLevel === 'high') {
      notes.push('- Pitch: Speak with a slightly higher vocal pitch.')
    } else if (pitchLevel === 'low') {
      notes.push('- Pitch: Speak with a slightly deeper, lower vocal pitch.')
    }

    // カスタム演出指示
    if (customDirectorNote.trim()) {
      notes.push(`- Directing Note: ${customDirectorNote.trim()}`)
    }

    // 演出指示がある場合は公式推奨のフォーマットでラップ
    if (notes.length > 0) {
      return `Synthesize speech for the performance defined below. The director's notes are direction only. Do NOT speak them. Speak ONLY the lines under #### TRANSCRIPT.\n\n### DIRECTOR'S NOTES\n${notes.join(
        '\n'
      )}\n\n#### TRANSCRIPT\n${inputText}`
    }

    return inputText
  }

  // --- Gemini 3.1 Flash TTS API 呼び出し実行 ---
  const callGeminiTTS = async (textToSpeak, voiceName, customNotes = '') => {
    // ラウンドロビンで API キー取得 & ポインタ進め
    const keyInfo = await getNextApiKey(true)
    const apiKey = keyInfo.apiKey

    if (!apiKey) {
      throw new Error('有効な Google AI Studio APIキーが取得できませんでした。')
    }

    // プロンプト構築（systemInstruction は TTS モデルで非対応のためプロンプト内に含める）
    let promptContent = ''
    if (customNotes) {
      promptContent = `Synthesize speech for the performance defined below. The director's notes are direction only. Do NOT speak them. Speak ONLY the lines under #### TRANSCRIPT.\n\n### DIRECTOR'S NOTES\n- Style: ${customNotes}\n\n#### TRANSCRIPT\n${textToSpeak}`
    } else {
      promptContent = buildPrompt()
    }

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

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_ENDPOINT_ID}:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      }
    )

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

    return { blob, url, keyInfo }
  }

  // --- メイン音声生成ハンドラー ---
  const handleGenerateAndPlay = async () => {
    if (!inputText.trim()) {
      setErrorMsg('読み上げる文章を入力してください。')
      return
    }

    setIsGenerating(true)
    setErrorMsg(null)

    try {
      const { blob, url, keyInfo } = await callGeminiTTS(inputText, selectedVoice)

      // 古い URL を解放
      if (generatedAudioUrl) {
        URL.revokeObjectURL(generatedAudioUrl)
      }

      setGeneratedAudioUrl(url)
      setAudioBlob(blob)
      setLastGenInfo({
        voice: selectedVoice,
        keyId: keyInfo.keyId,
        charCount: inputText.length,
        timestamp: new Date().toLocaleTimeString(),
      })

      // 新しい音声を自動再生
      setTimeout(() => {
        if (mainAudioRef.current) {
          mainAudioRef.current.currentTime = 0
          mainAudioRef.current.play().catch((e) => console.log('Autoplay prevented:', e))
        }
      }, 100)
    } catch (err) {
      console.error('音声生成失敗:', err)
      setErrorMsg(err.message || '音声生成に失敗しました。')
    } finally {
      setIsGenerating(false)
    }
  }

  // --- 話者サンプルの試聴ハンドラー ---
  const handlePreviewVoice = async (voice) => {
    // 既に試聴中なら停止
    if (previewPlayingVoice === voice.name) {
      if (previewAudioPlayerRef.current) {
        previewAudioPlayerRef.current.pause()
      }
      setPreviewPlayingVoice(null)
      return
    }

    // キャッシュにあれば即時再生
    if (previewAudioCacheRef.current[voice.name]) {
      const cachedUrl = previewAudioCacheRef.current[voice.name]
      playPreviewAudio(cachedUrl, voice.name)
      return
    }

    // キャッシュがない場合はサンプル文で短く生成
    setPreviewLoadingVoice(voice.name)
    try {
      const sampleSentence = `こんにちは！私は${voice.name}です。私の声の特徴は「${voice.tone}」です。[softly] よろしくお願いします！`
      const { url } = await callGeminiTTS(sampleSentence, voice.name, 'Speak naturally and warmly in Japanese.')

      previewAudioCacheRef.current[voice.name] = url
      playPreviewAudio(url, voice.name)
    } catch (err) {
      console.error(`音声試聴エラー (${voice.name}):`, err)
      alert(`試聴の生成に失敗しました: ${err.message}`)
    } finally {
      setPreviewLoadingVoice(null)
    }
  }

  const playPreviewAudio = (audioUrl, voiceName) => {
    if (previewAudioPlayerRef.current) {
      previewAudioPlayerRef.current.pause()
    }
    const audio = new Audio(audioUrl)
    previewAudioPlayerRef.current = audio
    setPreviewPlayingVoice(voiceName)

    audio.onended = () => {
      setPreviewPlayingVoice(null)
    }
    audio.onerror = () => {
      setPreviewPlayingVoice(null)
    }

    audio.play().catch((err) => {
      console.error('試聴再生エラー:', err)
      setPreviewPlayingVoice(null)
    })
  }

  // --- 話者サンプルのローカル保存ハンドラー ---
  const handleSavePreview = async (voice) => {
    let url = previewAudioCacheRef.current[voice.name]
    if (!url) {
      setPreviewSavingVoice(voice.name)
      try {
        const sampleSentence = `こんにちは！私は${voice.name}です。私の声の特徴は「${voice.tone}」です。[softly] よろしくお願いします！`
        const { url: generatedUrl } = await callGeminiTTS(sampleSentence, voice.name, 'Speak naturally and warmly in Japanese.')
        url = generatedUrl
        previewAudioCacheRef.current[voice.name] = generatedUrl
      } catch (err) {
        console.error(`音声保存エラー (${voice.name}):`, err)
        alert(`保存用音声の生成に失敗しました: ${err.message}`)
        setPreviewSavingVoice(null)
        return
      } finally {
        setPreviewSavingVoice(null)
      }
    }

    // ダウンロード実行
    const a = document.createElement('a')
    a.href = url
    a.download = `gemini_tts_${voice.name}.wav`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // --- テキストエリアにタグをカーソル位置へ挿入 ---
  const handleInsertTag = (tag) => {
    if (!textareaRef.current) return
    const el = textareaRef.current
    const start = el.selectionStart
    const end = el.selectionEnd
    const before = inputText.substring(0, start)
    const after = inputText.substring(end)
    const newText = `${before}${tag} ${after}`
    setInputText(newText)

    // フォーカスとカーソル位置の復帰
    setTimeout(() => {
      el.focus()
      const newPos = start + tag.length + 1
      el.setSelectionRange(newPos, newPos)
    }, 0)
  }

  // --- プレイヤー操作 ---
  const togglePlayPause = () => {
    if (!mainAudioRef.current) return
    if (isPlaying) {
      mainAudioRef.current.pause()
    } else {
      mainAudioRef.current.play()
    }
  }

  const handleSeek = (e) => {
    const newTime = parseFloat(e.target.value)
    setCurrentTime(newTime)
    if (mainAudioRef.current) {
      mainAudioRef.current.currentTime = newTime
    }
  }

  const handleDownload = () => {
    if (!generatedAudioUrl) return
    const a = document.createElement('a')
    a.href = generatedAudioUrl
    a.download = `gemini_tts_${selectedVoice}_${Date.now()}.wav`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  // 秒を mm:ss 表示にフォーマット
  const formatTime = (time) => {
    if (isNaN(time)) return '00:00'
    const mins = Math.floor(time / 60)
    const secs = Math.floor(time % 60)
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // フィルタリングされた声のリスト
  const filteredVoices = GEMINI_VOICES.filter((voice) => {
    const matchFilter = voiceFilter === 'all' || voice.gender === voiceFilter
    const matchSearch =
      voiceSearch.trim() === '' ||
      voice.name.toLowerCase().includes(voiceSearch.toLowerCase()) ||
      voice.tone.includes(voiceSearch) ||
      voice.desc.includes(voiceSearch)
    return matchFilter && matchSearch
  })

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 pb-20">
      <Head>
        <title>Gemini 3.1 Flash TTS 音声テスト</title>
        <meta name="description" content="Gemini 3.1 Flash TTS の詳細音声設定・生成・再生テスト" />
      </Head>

      {/* 隠しオーディオ要素 */}
      <audio
        ref={mainAudioRef}
        src={generatedAudioUrl || undefined}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => setIsPlaying(false)}
        onTimeUpdate={() => setCurrentTime(mainAudioRef.current?.currentTime || 0)}
        onLoadedMetadata={() => setDuration(mainAudioRef.current?.duration || 0)}
      />

      {/* ヘッダー */}
      <header className="sticky top-0 z-30 border-b border-slate-800 bg-slate-950/80 backdrop-blur-md px-6 py-4 shadow-lg">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 via-purple-500 to-pink-500 text-xl font-bold shadow-md shadow-indigo-500/20">
              🎙️
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight text-white">Gemini 3.1 Flash TTS</h1>
                <span className="rounded-md border border-indigo-500/30 bg-indigo-500/10 px-2 py-0.5 text-xs font-semibold text-indigo-300">
                  Fixed: {MODEL_NAME}
                </span>
              </div>
              <p className="text-xs text-slate-400">Google AI Studio API × Supabase ラウンドロビン切り替え</p>
            </div>
          </div>

          {/* ラウンドロビン API キー ステータスバー */}
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/90 px-4 py-2 text-xs">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span
                  className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-75 ${
                    keyStatus.error ? 'bg-rose-400' : 'bg-emerald-400'
                  }`}
                />
                <span
                  className={`relative inline-flex h-2.5 w-2.5 rounded-full ${
                    keyStatus.error ? 'bg-rose-500' : 'bg-emerald-500'
                  }`}
                />
              </span>
              <span className="text-slate-400">APIキー (Supabase):</span>
              {keyStatus.error ? (
                <span className="font-medium text-rose-400">接続エラー</span>
              ) : (
                <span className="font-mono font-semibold text-indigo-300">
                  {keyStatus.activeKeyId
                    ? `ID: #${keyStatus.activeKeyId} (${keyStatus.currentIndex}/${keyStatus.totalKeys}番目)`
                    : '取得中...'}
                </span>
              )}
            </div>

            <button
              onClick={handleManualAdvanceKey}
              title="次のAPIキーに手動でローテーション進める"
              className="rounded-md border border-slate-700 bg-slate-800 px-2.5 py-1 text-slate-300 transition hover:border-slate-600 hover:bg-slate-700 hover:text-white"
            >
              ↻ 次のキーへ
            </button>
          </div>
        </div>
      </header>

      {/* エラーアラート */}
      {errorMsg && (
        <div className="mx-auto mt-4 max-w-7xl px-6">
          <div className="flex items-start justify-between rounded-xl border border-rose-500/40 bg-rose-950/40 p-4 text-sm text-rose-200 shadow-lg">
            <div className="flex items-center gap-2">
              <span className="text-lg">⚠️</span>
              <span>{errorMsg}</span>
            </div>
            <button onClick={() => setErrorMsg(null)} className="text-rose-400 hover:text-rose-200">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* メインコンテンツ */}
      <main className="mx-auto mt-6 max-w-7xl px-6">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
          {/* 左カラム: 文章入力 & プレイヤー & 感情タグ (幅 7/12) */}
          <div className="space-y-6 lg:col-span-7">
            {/* 文章入力カード */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 shadow-xl backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between">
                <label className="text-sm font-semibold tracking-wide text-slate-200">
                  読み上げる文章（TRANSCRIPT）
                </label>
                <span className="text-xs text-slate-500">{inputText.length} 文字</span>
              </div>

              {/* サンプル文章ロードボタン */}
              <div className="mb-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-slate-400">例文プリセット:</span>
                {SAMPLE_TEXTS.map((sample, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInputText(sample.text)}
                    className="rounded-md border border-slate-800 bg-slate-900/80 px-2 py-1 text-xs text-slate-300 transition hover:border-indigo-500/50 hover:bg-indigo-950/30 hover:text-indigo-200"
                  >
                    {sample.label}
                  </button>
                ))}
              </div>

              {/* テキスト入力欄 */}
              <textarea
                ref={textareaRef}
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="音声化したい日本語または英語の文章を入力してください..."
                rows={6}
                className="w-full rounded-xl border border-slate-700 bg-slate-900/90 p-4 text-sm leading-relaxed text-slate-100 placeholder-slate-500 shadow-inner focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />

              {/* 感情・演技タグのワンクリック挿入 */}
              <div className="mt-4 border-t border-slate-800/80 pt-4">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-300">
                    ✨ 感情・アクションタグの挿入（Gemini 3.1 Flash TTS 対応）
                  </span>
                  <span className="text-[11px] text-slate-500">クリックでカーソル位置に挿入</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {AUDIO_TAGS.map((item) => (
                    <button
                      key={item.tag}
                      onClick={() => handleInsertTag(item.tag)}
                      className={`rounded-lg border px-2.5 py-1 text-xs font-medium transition hover:scale-105 active:scale-95 ${item.color}`}
                    >
                      {item.tag} <span className="opacity-80">({item.label})</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* 音声生成ボタン */}
              <div className="mt-6 flex items-center gap-4">
                <button
                  onClick={handleGenerateAndPlay}
                  disabled={isGenerating || !inputText.trim()}
                  className={`flex flex-1 items-center justify-center gap-2.5 rounded-xl py-3.5 px-6 font-bold text-white shadow-lg transition duration-200 ${
                    isGenerating || !inputText.trim()
                      ? 'cursor-not-allowed bg-slate-800 text-slate-500'
                      : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 hover:from-indigo-500 hover:to-pink-500 hover:shadow-indigo-500/25'
                  }`}
                >
                  {isGenerating ? (
                    <>
                      <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                      <span>Gemini 3.1 Flash TTS で音声を生成中...</span>
                    </>
                  ) : (
                    <>
                      <span className="text-lg">▶</span>
                      <span>音声を生成して再生する</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* 音声プレイヤー */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 shadow-xl backdrop-blur-sm">
              <div className="mb-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🎧</span>
                  <h2 className="text-sm font-semibold tracking-wide text-slate-200">オーディオプレイヤー</h2>
                </div>
                {lastGenInfo && (
                  <div className="flex items-center gap-2 text-xs text-slate-400">
                    <span className="rounded bg-indigo-950/60 px-2 py-0.5 text-indigo-300 border border-indigo-800/40">
                      声: {lastGenInfo.voice}
                    </span>
                    <span className="rounded bg-slate-800 px-2 py-0.5 text-slate-300">
                      Key ID #{lastGenInfo.keyId}
                    </span>
                    <span>{lastGenInfo.timestamp}</span>
                  </div>
                )}
              </div>

              {generatedAudioUrl ? (
                <div className="space-y-4">
                  {/* 再生波形アニメーション（再生中のみ躍動） */}
                  <div className="flex h-12 items-center justify-center gap-1 rounded-xl border border-slate-800/60 bg-slate-900/50 px-4">
                    {[40, 65, 30, 85, 55, 95, 45, 75, 35, 60, 90, 50, 70, 30, 80, 60].map((h, i) => (
                      <div
                        key={i}
                        className={`w-1 rounded-full transition-all duration-150 ${
                          isPlaying
                            ? 'bg-gradient-to-t from-indigo-500 to-pink-400'
                            : 'bg-slate-700'
                        }`}
                        style={{
                          height: isPlaying ? `${Math.max(15, (h * Math.sin(currentTime * 8 + i)) % 100)}%` : '20%',
                        }}
                      />
                    ))}
                  </div>

                  {/* シークバー */}
                  <div className="space-y-1">
                    <input
                      type="range"
                      min={0}
                      max={duration || 100}
                      step={0.01}
                      value={currentTime}
                      onChange={handleSeek}
                      className="h-2 w-full cursor-pointer appearance-none rounded-lg bg-slate-800 accent-indigo-500 transition focus:outline-none"
                    />
                    <div className="flex justify-between text-xs font-mono text-slate-400">
                      <span>{formatTime(currentTime)}</span>
                      <span>{formatTime(duration)}</span>
                    </div>
                  </div>

                  {/* 再生コントロール */}
                  <div className="flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80 pt-4">
                    <div className="flex items-center gap-3">
                      {/* 再生 / 一時停止 */}
                      <button
                        onClick={togglePlayPause}
                        className="flex h-11 w-11 items-center justify-center rounded-full bg-indigo-600 text-white shadow-md transition hover:bg-indigo-500 active:scale-95"
                      >
                        {isPlaying ? '⏸' : '▶'}
                      </button>

                      {/* 先頭に戻る */}
                      <button
                        onClick={() => {
                          if (mainAudioRef.current) {
                            mainAudioRef.current.currentTime = 0
                            mainAudioRef.current.play()
                          }
                        }}
                        className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm text-slate-300 hover:bg-slate-700 hover:text-white"
                        title="最初から再生"
                      >
                        ⏮
                      </button>

                      {/* 音量コントロール */}
                      <div className="flex items-center gap-2 pl-2">
                        <button
                          onClick={() => setIsMuted(!isMuted)}
                          className="text-slate-400 hover:text-slate-200"
                        >
                          {isMuted || volume === 0 ? '🔇' : volume < 0.5 ? '🔉' : '🔊'}
                        </button>
                        <input
                          type="range"
                          min={0}
                          max={1}
                          step={0.05}
                          value={isMuted ? 0 : volume}
                          onChange={(e) => {
                            setVolume(parseFloat(e.target.value))
                            setIsMuted(false)
                          }}
                          className="h-1.5 w-16 cursor-pointer appearance-none rounded-lg bg-slate-800 accent-indigo-500"
                        />
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {/* 再生速度セレクタ */}
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-slate-400">再生速度:</span>
                        <select
                          value={playbackSpeed}
                          onChange={(e) => setPlaybackSpeed(parseFloat(e.target.value))}
                          className="rounded-lg border border-slate-700 bg-slate-900 px-2 py-1 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                        >
                          {[0.5, 0.75, 1.0, 1.25, 1.5, 2.0].map((rate) => (
                            <option key={rate} value={rate}>
                              {rate}x
                            </option>
                          ))}
                        </select>
                      </div>

                      {/* ダウンロードボタン */}
                      <button
                        onClick={handleDownload}
                        className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800/90 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:border-slate-600 hover:bg-slate-700 hover:text-white"
                      >
                        <span>⬇</span>
                        <span>WAV保存</span>
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 text-center text-slate-500">
                  <div className="mb-2 text-3xl opacity-40">🔈</div>
                  <p className="text-sm">まだ音声が生成されていません。</p>
                  <p className="text-xs text-slate-600">
                    文章を入力して「音声を生成して再生する」ボタンを押してください。
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* 右カラム: 音声の詳細設定 & 30人の話者セレクター (幅 5/12) */}
          <div className="space-y-6 lg:col-span-5">
            {/* 音声表現・演技設定カード */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 shadow-xl backdrop-blur-sm">
              <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold tracking-wide text-slate-200">
                <span>⚙️</span>
                <span>音声の表現・演技設定（Director's Notes）</span>
              </h2>

              <div className="space-y-4 text-xs">
                {/* トーンプリセット */}
                <div>
                  <label className="mb-1.5 block font-medium text-slate-300">トーン・雰囲気プリセット</label>
                  <select
                    value={tonePreset}
                    onChange={(e) => setTonePreset(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                  >
                    {TONE_PRESETS.map((preset) => (
                      <option key={preset.id} value={preset.id}>
                        {preset.label}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 読み上げペース & ピッチ */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="mb-1.5 block font-medium text-slate-300">話す速度 (Pacing)</label>
                    <select
                      value={speakingPace}
                      onChange={(e) => setSpeakingPace(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="slow">ゆっくり (0.85x)</option>
                      <option value="normal">標準 (1.0x)</option>
                      <option value="fast">少し早め (1.25x)</option>
                    </select>
                  </div>

                  <div>
                    <label className="mb-1.5 block font-medium text-slate-300">声の高さ (Pitch)</label>
                    <select
                      value={pitchLevel}
                      onChange={(e) => setPitchLevel(e.target.value)}
                      className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2 text-xs text-slate-200 focus:border-indigo-500 focus:outline-none"
                    >
                      <option value="low">低め (Deep)</option>
                      <option value="normal">標準 (Normal)</option>
                      <option value="high">高め (High)</option>
                    </select>
                  </div>
                </div>

                {/* カスタム演出指示 */}
                <div>
                  <label className="mb-1.5 block font-medium text-slate-300">
                    カスタム演出指示（自然言語で自由に指示可能）
                  </label>
                  <textarea
                    value={customDirectorNote}
                    onChange={(e) => setCustomDirectorNote(e.target.value)}
                    placeholder="例: 優しく微笑みながら、語尾を少し柔らかく発音してください。"
                    rows={2}
                    className="w-full rounded-xl border border-slate-700 bg-slate-900 p-2.5 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>

            {/* 30人の話者選択 & 試聴サンプルカード */}
            <div className="rounded-2xl border border-slate-800 bg-slate-950/60 p-6 shadow-xl backdrop-blur-sm">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="text-lg">👥</span>
                  <h2 className="text-sm font-semibold tracking-wide text-slate-200">
                    話者ペルソナ選択（全30種類・試聴可能）
                  </h2>
                </div>
                <span className="text-xs text-indigo-400 font-medium">現在選択: {selectedVoice}</span>
              </div>

              {/* フィルター & 検索バー */}
              <div className="mb-3 flex items-center gap-2">
                <div className="flex rounded-lg border border-slate-700 bg-slate-900 p-0.5 text-xs">
                  {['all', '女性', '男性'].map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setVoiceFilter(cat)}
                      className={`rounded-md px-2.5 py-1 font-medium transition ${
                        voiceFilter === cat ? 'bg-indigo-600 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {cat === 'all' ? '全員' : cat}
                    </button>
                  ))}
                </div>

                <div className="relative flex-1">
                  <input
                    type="text"
                    value={voiceSearch}
                    onChange={(e) => setVoiceSearch(e.target.value)}
                    placeholder="話者名・声質で検索..."
                    className="w-full rounded-lg border border-slate-700 bg-slate-900 py-1.5 pl-3 pr-8 text-xs text-slate-200 placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                  />
                  {voiceSearch && (
                    <button
                      onClick={() => setVoiceSearch('')}
                      className="absolute right-2.5 top-1.5 text-xs text-slate-400 hover:text-white"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* 話者リストスクロールエリア */}
              <div className="max-h-[460px] space-y-2 overflow-y-auto pr-1">
                {filteredVoices.map((voice) => {
                  const isSelected = selectedVoice === voice.name
                  const isPreviewLoading = previewLoadingVoice === voice.name
                  const isPreviewPlaying = previewPlayingVoice === voice.name
                  const isPreviewSaving = previewSavingVoice === voice.name

                  return (
                    <div
                      key={voice.name}
                      onClick={() => setSelectedVoice(voice.name)}
                      className={`group relative flex cursor-pointer items-center justify-between rounded-xl border p-3 transition duration-150 ${
                        isSelected
                          ? 'border-indigo-500 bg-indigo-950/40 shadow-md shadow-indigo-950/50'
                          : 'border-slate-800/80 bg-slate-900/60 hover:border-slate-700 hover:bg-slate-900'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* 性別アバターアイコン */}
                        <div
                          className={`flex h-9 w-9 items-center justify-center rounded-lg text-sm font-bold shadow-inner ${
                            voice.gender === '女性'
                              ? 'bg-gradient-to-tr from-pink-500/20 to-purple-500/20 text-pink-300 border border-pink-500/30'
                              : 'bg-gradient-to-tr from-sky-500/20 to-indigo-500/20 text-sky-300 border border-sky-500/30'
                          }`}
                        >
                          {voice.gender === '女性' ? '♀' : '♂'}
                        </div>

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-slate-100">{voice.name}</span>
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${
                                voice.gender === '女性'
                                  ? 'bg-pink-950/80 text-pink-300 border border-pink-800/40'
                                  : 'bg-sky-950/80 text-sky-300 border border-sky-800/40'
                              }`}
                            >
                              {voice.gender}
                            </span>
                            <span className="text-xs text-indigo-300 font-medium">[{voice.tone}]</span>
                            {voice.default && (
                              <span className="rounded bg-emerald-950/60 border border-emerald-700/40 px-1 py-0.5 text-[10px] text-emerald-300">
                                デフォルト
                              </span>
                            )}
                          </div>
                          <p className="mt-0.5 text-xs text-slate-400 leading-snug">{voice.desc}</p>
                        </div>
                      </div>

                      {/* 試聴 & 保存ボタン群 */}
                      <div className="ml-2 flex flex-shrink-0 items-center gap-1.5">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handlePreviewVoice(voice)
                          }}
                          disabled={isPreviewLoading || isPreviewSaving}
                          title={`${voice.name} のサンプル音声を試聴`}
                          className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                            isPreviewPlaying
                              ? 'border-pink-500 bg-pink-600 text-white animate-pulse'
                              : isPreviewLoading
                              ? 'border-slate-700 bg-slate-800 text-slate-400 cursor-wait'
                              : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-indigo-500 hover:bg-indigo-600 hover:text-white'
                          }`}
                        >
                          {isPreviewLoading ? (
                            <div className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white" />
                          ) : isPreviewPlaying ? (
                            <span>⏹ 停止</span>
                          ) : (
                            <span>▶ 試聴</span>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleSavePreview(voice)
                          }}
                          disabled={isPreviewLoading || isPreviewSaving}
                          title={`${voice.name} のサンプル音声をローカルに保存`}
                          className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition ${
                            isPreviewSaving
                              ? 'border-slate-700 bg-slate-800 text-slate-400 cursor-wait'
                              : 'border-slate-700 bg-slate-800 text-slate-300 hover:border-emerald-500 hover:bg-emerald-600 hover:text-white'
                          }`}
                        >
                          {isPreviewSaving ? (
                            <div className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white" />
                          ) : (
                            <>
                              <span>💾</span>
                              <span>保存</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
