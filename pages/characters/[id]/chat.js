import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'
import { synthesizeSpeech } from '../../../lib/ttsClient'

// チャット画面表示用：感情・アクションタグを除去（ストリーミング中の未完了タグも遮断）
export function stripDisplayTags(rawText) {
  if (!rawText) return ''
  let text = rawText
  // 文頭が "[" で始まっていて、まだ "]" が閉じていない場合は、タグ生成中と判定して表示しない
  if (/^\s*\[[^\]]*$/.test(text)) {
    return ''
  }
  // 文頭の確定したタグ "[...]" を除去
  text = text.replace(/^\s*\[[^\]]+\]\s*/g, '')
  // 文中の感情タグを除去
  text = text.replace(/\[(?:whispers|sighs|laughs|giggles|excited|softly|clears throat|gasps|pause|serious|crying|shouting)\]/gi, '')
  // 文末で未完了の "[..." がある場合はその部分を除去
  text = text.replace(/\[[^\]]*$/, '')
  return text
}

export default function CharacterChat() {
  const router = useRouter()
  const { id } = router.query
  const [character, setCharacter] = useState(null)
  const [records, setRecords] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [latestImage, setLatestImage] = useState(null)
  const [showMessages, setShowMessages] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const messageScrollRef = useRef(null)
  const menuRef = useRef(null)

  // 音声再生・生成ステート ('idle' | 'generating' | 'playing')
  const [audioState, setAudioState] = useState('idle')
  const audioCacheRef = useRef(null) // { text: '', url: '', audio: Audio }
  const currentAudioRef = useRef(null)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      const { data } = await supabase.from('characters').select('*').eq('id', id).single()
      if (data) {
        setCharacter(data)
        setRecords(data.records ? JSON.parse(data.records) : [])
        setLatestImage(data.image_latest_chat_url)
      }
    }
    load()
  }, [id])

  useEffect(() => {
    messageScrollRef.current?.scrollTo({
      top: messageScrollRef.current.scrollHeight,
      behavior: 'smooth',
    })
  }, [records, loading, latestImage])

  useEffect(() => {
    const closeMenu = (event) => {
      if (!menuRef.current?.contains(event.target)) setMenuOpen(false)
    }
    document.addEventListener('mousedown', closeMenu)
    return () => document.removeEventListener('mousedown', closeMenu)
  }, [])

  // コンポーネント破棄時やキャラ切り替え時に音声を停止
  useEffect(() => {
    return () => {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current = null
      }
    }
  }, [id])

  // 音声再生 / 停止トグルハンドラー
  const handleToggleVoice = async (targetMessage) => {
    if (!targetMessage || !character) return

    // 再生中の場合は停止して通常マークへ
    if (audioState === 'playing') {
      if (currentAudioRef.current) {
        currentAudioRef.current.pause()
        currentAudioRef.current.currentTime = 0
      }
      setAudioState('idle')
      return
    }

    // 生成中なら連打防止
    if (audioState === 'generating') return

    // 1. キャッシュが存在し、メッセージが一致していて有効な場合
    if (
      audioCacheRef.current &&
      audioCacheRef.current.text === targetMessage &&
      audioCacheRef.current.audio
    ) {
      try {
        const audio = audioCacheRef.current.audio
        audio.currentTime = 0
        currentAudioRef.current = audio
        audio.onended = () => {
          setAudioState('idle')
        }
        audio.onerror = () => {
          setAudioState('idle')
          audioCacheRef.current = null
        }
        setAudioState('playing')
        await audio.play()
        return
      } catch (err) {
        console.warn('キャッシュ音声の即座再生に失敗、再生成を試みます:', err)
        audioCacheRef.current = null
      }
    }

    // 2. 音声データが残っていない場合は、エラー文は表示せずに再度音声生成の手順を踏む
    setAudioState('generating')
    try {
      // 音声生成時にはタグとキャラの最新発言を両方渡す
      const { url } = await synthesizeSpeech(targetMessage, character)
      const audio = new Audio(url)
      audioCacheRef.current = {
        text: targetMessage,
        url,
        audio,
      }
      currentAudioRef.current = audio

      audio.onended = () => {
        setAudioState('idle')
      }
      audio.onerror = (err) => {
        console.error('音声再生エラー:', err)
        setAudioState('idle')
        audioCacheRef.current = null
      }

      // 生成できたと同時に音声再生（ボタンマークは□）
      setAudioState('playing')
      await audio.play()
    } catch (err) {
      console.error('音声生成エラー:', err)
      // エラー文は表示せず、再度生成の手順が踏めるようidleに戻す
      setAudioState('idle')
      audioCacheRef.current = null
    }
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const message = input.trim()
    if (!message || loading) return

    // 新たなメッセージ送信時は既存の再生を停止しキャッシュをクリア
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    setAudioState('idle')
    audioCacheRef.current = null

    const userMessage = { role: 'user', message }
    const newRecords = [...records, userMessage]
    const streamingRecords = [...newRecords, { role: 'assistant', message: '' }]
    setRecords(newRecords)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/gemma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character, userMessage: message, records: newRecords }),
      })
      if (!res.ok || !res.body) throw new Error('Gemma呼び出しエラー')

      setRecords(streamingRecords)
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let reply = ''
      let streamComplete = false

      while (!streamComplete) {
        const { value, done } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const events = buffer.split('\n\n')
        buffer = events.pop() || ''

        for (const event of events) {
          const eventType = event.match(/^event: (.+)$/m)?.[1]
          const dataLine = event.match(/^data: (.+)$/m)?.[1]
          if (!dataLine) continue
          const data = JSON.parse(dataLine)
          if (eventType === 'error') throw new Error(data.error)
          if (eventType === 'done') {
            streamComplete = true
            break
          }
          if (eventType === 'image_prompt') {
            // サーバー側で last_image_prompt を保存した後に届くイベント。
            // 本文のストリーム完了を待たず、別トークンで画像生成を開始する。
            setCharacter((current) => current ? { ...current, last_image_prompt: data.prompt } : current)
            void fetch('/api/generate-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: data.prompt, characterId: id }),
            })
              .then(res => res.json())
              .then(async imageData => {
                if (!imageData?.image_url) return
                setLatestImage(imageData.image_url)
                const { error } = await supabase
                  .from('characters')
                  .update({ image_latest_chat_url: imageData.image_url })
                  .eq('id', id)
                if (error) console.error('Latest image save error:', error)
              })
              .catch(err => console.error('Image generation error:', err))
            continue
          }
          if (!data.delta) continue

          reply += data.delta
          setRecords([...newRecords, { role: 'assistant', message: reply }])
        }
      }

      const updatedRecords = [...newRecords, { role: 'assistant', message: reply || '（返答が取得できませんでした）' }]
      setRecords(updatedRecords)
      // 文章の生成が終わった時点で次の入力を受け付ける。保存や画像生成は
      // バックグラウンドで続けるため、これらの通信待ちでUIを止めない。
      setLoading(false)

      supabase.from('characters').update({ records: JSON.stringify(updatedRecords) }).eq('id', id)
        .then(({ error }) => error && console.error('Conversation save error:', error))

    } catch (err) {
      console.error(err)
      alert('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  const handleClearHistory = async () => {
    if (!confirm('本当にこのキャラとの会話履歴を削除しますか？')) return
    setClearing(true)
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current = null
    }
    setAudioState('idle')
    audioCacheRef.current = null
    await supabase
      .from('characters')
      .update({ records: JSON.stringify([]), image_latest_chat_url: null, last_image_prompt: null })
      .eq('id', id)
    setRecords([])
    setLatestImage(null)
    setCharacter((current) => current ? { ...current, last_image_prompt: null } : current)
    setClearing(false)
    setMenuOpen(false)
  }

  if (!character) return <div className="min-h-screen grid place-items-center text-slate-500">読み込み中...</div>

  const characterInitial = character.name?.slice(0, 1) || '?'

  // 最新のキャラ発言のインデックス（音声再生ボタンの対象）
  const lastAssistantIndex = records
    .map((r, i) => (r.role === 'assistant' ? i : -1))
    .filter((i) => i !== -1)
    .pop()

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-slate-50 to-white px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto flex h-[calc(100dvh-2rem)] max-h-[900px] min-h-[560px] max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_20px_60px_rgba(79,70,229,0.16)] sm:h-[calc(100dvh-4rem)] sm:min-h-[720px]">
        <header className="relative z-40 flex items-center justify-between border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur">
          <button
            type="button"
            onClick={() => router.push(`/characters/${id}`)}
            className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-lg text-slate-700 transition hover:bg-slate-200 active:scale-95"
            aria-label="キャラクター情報へ戻る"
            title="戻る"
          >
            ←
          </button>
          <div className="flex min-w-0 items-center gap-3 text-center">
            {character.image_url ? (
              <img src={character.image_url} alt="" className="h-11 w-11 rounded-2xl object-cover shadow-sm" />
            ) : (
              <div className="grid h-11 w-11 place-items-center rounded-2xl bg-indigo-100 font-bold text-indigo-600">{characterInitial}</div>
            )}
            <div className="min-w-0 text-left">
              <h1 className="truncate font-bold text-slate-800">{character.name}</h1>
            </div>
          </div>
          <div className="relative" ref={menuRef}>
            <button
              type="button"
              onClick={() => setMenuOpen((open) => !open)}
              className="grid h-11 w-11 place-items-center rounded-2xl bg-slate-100 text-xl font-bold text-slate-700 transition hover:bg-slate-200 active:scale-95"
              aria-label="メニューを開く"
              aria-expanded={menuOpen}
              title="メニュー"
            >
              ⋮
            </button>
            {menuOpen && (
              <div className="absolute right-0 top-12 z-30 w-52 overflow-hidden rounded-2xl border border-slate-100 bg-white py-1 shadow-xl">
                <button
                  type="button"
                  onClick={() => router.push(`/characters/${id}/edit`)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <span>✏️</span> キャラを編集
                </button>
                <button
                  type="button"
                  onClick={handleClearHistory}
                  disabled={clearing}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
                >
                  <span>🗑️</span> {clearing ? '削除中…' : '会話履歴を削除'}
                </button>
              </div>
            )}
          </div>
        </header>

        <section
          className="relative min-h-0 flex-1 overflow-hidden bg-slate-100"
          aria-label={`${character.name}との会話`}
        >
          {latestImage && (
            <div className="pointer-events-none absolute inset-0 z-0 flex items-center justify-center bg-slate-100">
              <img
                src={latestImage}
                alt="この会話から生成された最新のシーン"
                className="h-full w-full object-contain"
              />
            </div>
          )}
          <button
            type="button"
            onClick={() => setShowMessages((visible) => !visible)}
            className="absolute left-4 top-4 z-20 rounded-2xl bg-white/90 px-3 py-2 text-xs font-medium text-slate-700 shadow-md backdrop-blur transition hover:bg-white active:scale-95 sm:left-6"
          >
            {showMessages ? '◉ 会話を隠す' : '◌ 会話を表示'}
          </button>
          <div
            ref={messageScrollRef}
            className={`absolute inset-0 z-10 overflow-y-auto px-4 pb-5 pt-16 transition-opacity sm:px-6 ${showMessages ? 'opacity-100' : 'pointer-events-none invisible opacity-0'}`}
          >
          <div className="mx-auto flex max-w-xl flex-col gap-4">
            {!records.length && !loading && (
              <div className="mt-16 rounded-3xl bg-white/85 p-6 text-center text-sm leading-6 text-slate-600 shadow-sm backdrop-blur">
                <p className="mb-1 text-lg">💬 会話をはじめよう</p>
                メッセージを送ると、{character.name}が返事をします。
              </div>
            )}
            {records.map((record, index) => {
              const isUser = record.role === 'user'
              const isLatestAssistant = !isUser && index === lastAssistantIndex
              const displayMessage = isUser ? record.message : stripDisplayTags(record.message)

              // ストリーミング生成中、先頭タグ生成中でまだ本文がない場合は吹き出しを非表示（「入力中...」で代用）
              if (!isUser && !displayMessage && loading && isLatestAssistant) {
                return null
              }

              return (
                <div key={`${record.role}-${index}`} className={`flex gap-2 ${isUser ? 'items-end justify-end' : 'items-start justify-start'}`}>
                  {!isUser && (character.image_url ? (
                    <img src={character.image_url} alt={`${character.name}のアイコン`} className="h-9 w-9 shrink-0 rounded-2xl object-cover shadow-md" />
                  ) : (
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-indigo-500 text-sm font-bold text-white shadow-md">{characterInitial}</div>
                  ))}
                  {isUser ? (
                    <div className="max-w-[78%] rounded-3xl rounded-br-lg bg-indigo-600/55 px-4 py-3 text-sm leading-6 text-white shadow-sm backdrop-blur-md">
                      {record.message}
                    </div>
                  ) : (
                    <div className="flex max-w-[78%] flex-col items-start gap-1">
                      <div className="rounded-3xl rounded-bl-lg bg-white/40 px-4 py-3 text-sm leading-6 text-slate-800 shadow-sm backdrop-blur-md">
                        {displayMessage}
                      </div>
                      {/* 最新のキャラの吹き出しの左下に音声再生ボタン */}
                      {isLatestAssistant && !loading && record.message && (
                        <div className="flex items-center pl-1 pt-0.5">
                          <button
                            type="button"
                            onClick={() => handleToggleVoice(record.message)}
                            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80 text-indigo-600 shadow-sm border border-indigo-100 hover:bg-white hover:text-indigo-700 transition active:scale-95"
                            aria-label={
                              audioState === 'generating'
                                ? '音声生成中'
                                : audioState === 'playing'
                                ? '音声を停止'
                                : '音声を再生'
                            }
                            title={
                              audioState === 'generating'
                                ? '音声生成中…'
                                : audioState === 'playing'
                                ? '停止'
                                : '音声再生'
                            }
                          >
                            {audioState === 'generating' ? (
                              <svg className="h-4 w-4 animate-spin text-indigo-600" viewBox="0 0 24 24" fill="none">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                              </svg>
                            ) : audioState === 'playing' ? (
                              <span className="block h-3 w-3 rounded-sm bg-indigo-600"></span>
                            ) : (
                              <svg className="h-4 w-4 translate-x-0.5 fill-current" viewBox="0 0 24 24">
                                <path d="M8 5v14l11-7z" />
                              </svg>
                            )}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
            {loading && (
              <div className="flex items-end gap-2">
                {character.image_url ? <img src={character.image_url} alt="" className="h-9 w-9 rounded-2xl object-cover shadow-md" /> : <div className="grid h-9 w-9 place-items-center rounded-2xl bg-indigo-500 text-sm font-bold text-white">{characterInitial}</div>}
                <div className="rounded-3xl rounded-bl-lg bg-white/40 px-4 py-3 text-sm text-slate-600 shadow-sm backdrop-blur-md">{character.name}が入力中<span className="animate-pulse">...</span></div>
              </div>
            )}
            <div />
          </div>
          </div>
        </section>

        <form onSubmit={handleSend} className="flex items-center gap-3 border-t border-slate-100 bg-white p-3 sm:p-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`${character.name}にメッセージ…`}
            disabled={loading}
            className="min-w-0 flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-base text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-300 disabled:opacity-60 sm:text-sm"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-indigo-600 text-xl text-white shadow-lg shadow-indigo-200 transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:bg-slate-300 disabled:shadow-none active:scale-95"
            aria-label="メッセージを送信"
            title="送信"
          >
            ↑
          </button>
        </form>
      </div>
    </main>
  )
}
