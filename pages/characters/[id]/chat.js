import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'

export default function CharacterChat() {
  const router = useRouter()
  const { id } = router.query
  const [character, setCharacter] = useState(null)
  const [records, setRecords] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)
  const [latestImage, setLatestImage] = useState(null)
  const messagesEndRef = useRef(null)

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
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [records, loading])

  const handleSend = async (e) => {
    e.preventDefault()
    const message = input.trim()
    if (!message || loading) return

    const userMessage = { role: 'user', message }
    const newRecords = [...records, userMessage]
    setRecords(newRecords)
    setInput('')
    setLoading(true)

    try {
      const res = await fetch('/api/gemma', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character, userMessage: message, records: newRecords }),
      })
      const data = await res.json()
      const reply = data.reply || '（返答が取得できませんでした）'
      const updatedRecords = [...newRecords, { role: 'assistant', message: reply }]
      setRecords(updatedRecords)

      await supabase.from('characters').update({ records: JSON.stringify(updatedRecords) }).eq('id', id)

      // 画像は会話画面の背景として更新するので、文章のやり取りを止めずに生成する。
      fetch('/api/generate-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ character, records: updatedRecords }),
      })
        .then(res => res.json())
        .then(data => data.prompt && fetch('/api/generate-image', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: data.prompt }),
        }))
        .then(res => res?.json())
        .then(async imageData => {
          if (!imageData?.image_url) return
          setLatestImage(imageData.image_url)
          await supabase
            .from('characters')
            .update({ image_latest_chat_url: imageData.image_url })
            .eq('id', id)
        })
        .catch(err => console.error('Image generation error:', err))
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
    await supabase
      .from('characters')
      .update({ records: JSON.stringify([]), image_latest_chat_url: null })
      .eq('id', id)
    setRecords([])
    setLatestImage(null)
    setClearing(false)
  }

  if (!character) return <div className="min-h-screen grid place-items-center text-slate-500">読み込み中...</div>

  const characterInitial = character.name?.slice(0, 1) || '?'

  return (
    <main className="min-h-screen bg-gradient-to-b from-indigo-50 via-slate-50 to-white px-3 py-4 sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] max-w-2xl flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-white shadow-[0_20px_60px_rgba(79,70,229,0.16)] sm:min-h-[720px]">
        <header className="flex items-center justify-between border-b border-slate-100 bg-white/90 px-4 py-3 backdrop-blur">
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
              <p className="text-xs text-emerald-500">● オンライン</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearHistory}
            disabled={clearing}
            className="grid h-11 w-11 place-items-center rounded-2xl bg-rose-50 text-lg text-rose-500 transition hover:bg-rose-100 disabled:opacity-50 active:scale-95"
            aria-label="会話履歴を削除"
            title="会話履歴を削除"
          >
            🗑
          </button>
        </header>

        <section
          className="relative flex-1 overflow-y-auto bg-slate-100 px-4 py-5 sm:px-6"
          aria-label={`${character.name}との会話`}
          style={latestImage ? {
            backgroundImage: `linear-gradient(rgba(15, 23, 42, 0.18), rgba(15, 23, 42, 0.18)), url(${latestImage})`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundAttachment: 'fixed',
          } : undefined}
        >
          <div className="mx-auto flex max-w-xl flex-col gap-4">
            {latestImage && (
              <p className="self-center rounded-full bg-slate-950/55 px-3 py-1 text-xs font-medium text-white shadow-sm backdrop-blur">
                ✨ いま、このシーンで会話中
              </p>
            )}
            {!records.length && !loading && (
              <div className="mt-16 rounded-3xl bg-white/85 p-6 text-center text-sm leading-6 text-slate-600 shadow-sm backdrop-blur">
                <p className="mb-1 text-lg">💬 会話をはじめよう</p>
                メッセージを送ると、{character.name}が返事をします。
              </div>
            )}
            {records.map((record, index) => {
              const isUser = record.role === 'user'
              return (
                <div key={`${record.role}-${index}`} className={`flex items-end gap-2 ${isUser ? 'justify-end' : 'justify-start'}`}>
                  {!isUser && (character.image_url ? (
                    <img src={character.image_url} alt={`${character.name}のアイコン`} className="h-9 w-9 shrink-0 rounded-2xl object-cover shadow-md" />
                  ) : (
                    <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-indigo-500 text-sm font-bold text-white shadow-md">{characterInitial}</div>
                  ))}
                  <div className={`max-w-[78%] rounded-3xl px-4 py-3 text-sm leading-6 shadow-sm ${isUser ? 'rounded-br-lg bg-indigo-600 text-white' : 'rounded-bl-lg bg-white/95 text-slate-700 backdrop-blur'}`}>
                    {record.message}
                  </div>
                  {isUser && <div className="grid h-9 w-9 shrink-0 place-items-center rounded-2xl bg-slate-700 text-xs font-bold text-white shadow-md">私</div>}
                </div>
              )
            })}
            {loading && (
              <div className="flex items-end gap-2">
                {character.image_url ? <img src={character.image_url} alt="" className="h-9 w-9 rounded-2xl object-cover shadow-md" /> : <div className="grid h-9 w-9 place-items-center rounded-2xl bg-indigo-500 text-sm font-bold text-white">{characterInitial}</div>}
                <div className="rounded-3xl rounded-bl-lg bg-white/95 px-4 py-3 text-sm text-slate-500 shadow-sm backdrop-blur">{character.name}が入力中<span className="animate-pulse">...</span></div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </section>

        <form onSubmit={handleSend} className="flex items-center gap-3 border-t border-slate-100 bg-white p-3 sm:p-4">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`${character.name}にメッセージ…`}
            disabled={loading}
            className="min-w-0 flex-1 rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:bg-white focus:ring-2 focus:ring-indigo-300 disabled:opacity-60"
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


