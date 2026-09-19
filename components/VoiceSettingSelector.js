import React, { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabaseClient'

// --- Gemini 3.1 Flash TTS 30種のプリセット音声定義 ---
export const GEMINI_VOICES = [
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

// --- トーン・演技スタイルプリセット ---
export const TONE_PRESETS = [
  { id: 'default', label: '標準 (Natural)' },
  { id: 'cheerful', label: '明るく元気 (Cheerful)' },
  { id: 'calm', label: '優しく穏やか (Gentle & Calm)' },
  { id: 'intellectual', label: '落ち着いた知性 (Informative)' },
  { id: 'whisper', label: 'ひそひそ声 (Whispering)' },
  { id: 'excited', label: 'テンション高め (Excited)' },
  { id: 'melancholic', label: '悲しげ・しっとり (Melancholic)' },
  { id: 'authoritative', label: '威厳・力強い (Authoritative)' },
  { id: 'storyteller', label: '物語の語り手 (Storyteller)' },
  { id: 'custom', label: 'カスタム指示 (Custom)' },
]

export function VoiceSettingSelector({
  values = {
    voice_name: 'Kore',
    voice_tone_preset: 'default',
    voice_pace: 'normal',
    voice_pitch: 'normal',
    voice_custom_instruction: '',
  },
  onChange,
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [voiceFilter, setVoiceFilter] = useState('all') // 'all', '女性', '男性'
  const [voiceSearch, setVoiceSearch] = useState('')
  const [previewPlayingVoice, setPreviewPlayingVoice] = useState(null)
  const previewAudioPlayerRef = useRef(null)

  // コンポーネント破棄時に試聴音声を停止
  useEffect(() => {
    return () => {
      if (previewAudioPlayerRef.current) {
        previewAudioPlayerRef.current.pause()
      }
    }
  }, [])

  // Supabase Storage から視聴音声URLを取得
  const getVoiceSampleUrl = (voiceName) => {
    const { data } = supabase.storage.from('voice_sample').getPublicUrl(`gemini_tts_${voiceName}.wav`)
    if (data?.publicUrl && !data.publicUrl.includes('placeholder.supabase.co')) {
      return data.publicUrl
    }
    return `https://kooukemsxecuvmuvnbys.supabase.co/storage/v1/object/public/voice_sample/gemini_tts_${voiceName}.wav`
  }

  // 試聴ハンドラー
  const handlePreviewVoice = (e, voiceName) => {
    e.stopPropagation()

    if (previewPlayingVoice === voiceName) {
      if (previewAudioPlayerRef.current) {
        previewAudioPlayerRef.current.pause()
      }
      setPreviewPlayingVoice(null)
      return
    }

    if (previewAudioPlayerRef.current) {
      previewAudioPlayerRef.current.pause()
    }

    const audioUrl = getVoiceSampleUrl(voiceName)
    const audio = new Audio(audioUrl)
    previewAudioPlayerRef.current = audio
    setPreviewPlayingVoice(voiceName)

    audio.onended = () => {
      setPreviewPlayingVoice(null)
    }
    audio.onerror = (err) => {
      console.error('試聴再生エラー:', err)
      setPreviewPlayingVoice(null)
      alert(`音声の再生に失敗しました (${voiceName})`)
    }

    audio.play().catch((err) => {
      console.error('試聴再生エラー:', err)
      setPreviewPlayingVoice(null)
    })
  }

  // 設定更新ヘルパー
  const handleFieldChange = (field, val) => {
    if (onChange) {
      onChange({
        ...values,
        [field]: val,
      })
    }
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

  // 選択中の話者情報
  const currentVoice = GEMINI_VOICES.find((v) => v.name === (values.voice_name || 'Kore')) || GEMINI_VOICES[0]
  const currentTone = TONE_PRESETS.find((t) => t.id === (values.voice_tone_preset || 'default')) || TONE_PRESETS[0]

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
      {/* アコーディオンヘッダー */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left select-none"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-800">音声設定</span>
          <span className="text-xs text-indigo-700 bg-indigo-50 border border-indigo-200 rounded px-2 py-0.5 font-medium">
            話者: {currentVoice.name} ({currentVoice.gender}・{currentVoice.tone})
          </span>
          <span className="text-xs text-gray-500 bg-gray-100 border border-gray-200 rounded px-2 py-0.5">
            {currentTone.label}
          </span>
        </div>
        <span
          className={`text-gray-500 text-sm transition-transform duration-200 transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          ▼
        </span>
      </button>

      {/* アコーディオンコンテンツ */}
      {isOpen && (
        <div className="p-4 border-t border-gray-200 space-y-6">
          {/* ① 音声の表現・演技設定（Director's Notes） */}
          <div className="rounded-lg border border-gray-200 bg-gray-50/50 p-4">
            <h3 className="text-sm font-semibold text-gray-800 mb-3 flex items-center gap-1.5">
              <span>⚙️</span>
              <span>音声の表現・演技設定（Director's Notes）</span>
            </h3>

            <div className="space-y-3">
              {/* トーン・雰囲気プリセット */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  トーン・雰囲気プリセット
                </label>
                <select
                  value={values.voice_tone_preset || 'default'}
                  onChange={(e) => handleFieldChange('voice_tone_preset', e.target.value)}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  {TONE_PRESETS.map((preset) => (
                    <option key={preset.id} value={preset.id}>
                      {preset.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* 話す速度 & 声の高さ */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    話す速度 (Pacing)
                  </label>
                  <select
                    value={values.voice_pace || 'normal'}
                    onChange={(e) => handleFieldChange('voice_pace', e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="slow">ゆっくり (0.85x)</option>
                    <option value="normal">標準 (1.0x)</option>
                    <option value="fast">少し早め (1.25x)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">
                    声の高さ (Pitch)
                  </label>
                  <select
                    value={values.voice_pitch || 'normal'}
                    onChange={(e) => handleFieldChange('voice_pitch', e.target.value)}
                    className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="low">低め (Deep)</option>
                    <option value="normal">標準 (Normal)</option>
                    <option value="high">高め (High)</option>
                  </select>
                </div>
              </div>

              {/* カスタム演出指示 */}
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">
                  カスタム演出指示（自然言語で自由に指示可能）
                </label>
                <textarea
                  value={values.voice_custom_instruction || ''}
                  onChange={(e) => handleFieldChange('voice_custom_instruction', e.target.value)}
                  placeholder="例: 優しく微笑みながら、語尾を少し柔らかく発音してください。"
                  rows={2}
                  className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 placeholder-gray-400"
                />
              </div>
            </div>
          </div>

          {/* ② 話者ペルソナ選択（全30種類・試聴可能） */}
          <div>
            <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
              <h3 className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                <span>👥</span>
                <span>話者ペルソナ選択（全30種類・試聴可能）</span>
              </h3>
              <span className="text-xs font-semibold text-indigo-600">
                選択中: {values.voice_name || 'Kore'}
              </span>
            </div>

            {/* フィルター & 検索バー */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 mb-3">
              <div className="flex rounded-md border border-gray-300 bg-gray-100 p-0.5 text-xs">
                {['all', '女性', '男性'].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setVoiceFilter(cat)}
                    className={`rounded px-3 py-1 font-medium transition ${
                      voiceFilter === cat
                        ? 'bg-white text-indigo-700 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
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
                  placeholder="話者名・声質・特徴で検索..."
                  className="w-full rounded-md border border-gray-300 bg-white py-1.5 pl-3 pr-8 text-xs shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
                {voiceSearch && (
                  <button
                    type="button"
                    onClick={() => setVoiceSearch('')}
                    className="absolute right-2.5 top-1.5 text-xs text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>

            {/* 話者一覧スクロールエリア */}
            <div className="max-h-72 overflow-y-auto divide-y divide-gray-100 border border-gray-200 rounded-lg pr-1">
              {filteredVoices.map((voice) => {
                const isSelected = (values.voice_name || 'Kore') === voice.name
                const isPlaying = previewPlayingVoice === voice.name

                return (
                  <div
                    key={voice.name}
                    onClick={() => handleFieldChange('voice_name', voice.name)}
                    className={`flex items-center justify-between p-2.5 cursor-pointer transition ${
                      isSelected
                        ? 'bg-indigo-50/80 border-l-4 border-indigo-600'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                      {/* 性別アイコン */}
                      <span
                        className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          voice.gender === '女性'
                            ? 'bg-pink-100 text-pink-700'
                            : 'bg-blue-100 text-blue-700'
                        }`}
                      >
                        {voice.gender === '女性' ? '♀' : '♂'}
                      </span>

                      {/* 話者情報 */}
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-xs font-bold text-gray-900">{voice.name}</span>
                          <span
                            className={`rounded px-1 py-0.2 text-[10px] font-medium ${
                              voice.gender === '女性'
                                ? 'bg-pink-50 text-pink-700 border border-pink-200'
                                : 'bg-blue-50 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {voice.gender}
                          </span>
                          <span className="text-[11px] text-indigo-600 font-medium">
                            [{voice.tone}]
                          </span>
                          {voice.default && (
                            <span className="rounded bg-emerald-50 border border-emerald-200 px-1 text-[10px] text-emerald-700">
                              初期値
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-gray-500 truncate">{voice.desc}</p>
                      </div>
                    </div>

                    {/* 試聴ボタン */}
                    <div className="flex-shrink-0">
                      <button
                        type="button"
                        onClick={(e) => handlePreviewVoice(e, voice.name)}
                        className={`flex items-center gap-1 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                          isPlaying
                            ? 'bg-pink-600 text-white animate-pulse'
                            : 'bg-white border border-gray-300 text-gray-700 hover:bg-indigo-50 hover:border-indigo-400 hover:text-indigo-700'
                        }`}
                        title={`${voice.name} のサンプル音声を試聴`}
                      >
                        {isPlaying ? '⏹ 停止' : '▶ 試聴'}
                      </button>
                    </div>
                  </div>
                )
              })}

              {filteredVoices.length === 0 && (
                <div className="p-4 text-center text-xs text-gray-500">
                  該当する話者が見つかりませんでした。
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
