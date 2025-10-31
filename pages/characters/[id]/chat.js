import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'

export default function CharacterChat() {
  const router = useRouter()
  const { id } = router.query

  const [character, setCharacter] = useState(null)
  const [records, setRecords] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  // キャラ情報読み込み
  useEffect(() => {
    if (!id) return
    const load = async () => {
      const { data } = await supabase.from('characters').select('*').eq('id', id).single()
      if (data) {
        setCharacter(data)
        setRecords(data.records ? JSON.parse(data.records) : [])
      }
    }
    load()
  }, [id])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage = { role: 'user', message: input }
    const newRecords = [...records, userMessage]
    setRecords(newRecords)
    setInput('')
    setLoading(true)

    try {
      // ✅ 自作API経由でGeminiに問い合わせ
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character,
          userMessage: input,
          records: newRecords
        }),
      })

      const data = await res.json()
      const reply = data.reply || '（返答が取得できませんでした）'

      const aiMessage = { role: 'assistant', message: reply }
      const updatedRecords = [...newRecords, aiMessage]
      setRecords(updatedRecords)

      // Supabaseに保存
      await supabase
        .from('characters')
        .update({ records: JSON.stringify(updatedRecords) })
        .eq('id', id)
    } catch (err) {
      console.error(err)
      alert('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  if (!character) return <div>読み込み中...</div>

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: 'auto' }}>
      <h2>💬 {character.name}との会話</h2>

      <div style={{
        border: '1px solid #ccc',
        borderRadius: 8,
        padding: 16,
        height: 400,
        overflowY: 'auto',
        background: '#fafafa'
      }}>
        {records.map((r, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <b>{r.role === 'user' ? 'あなた' : character.name}：</b> {r.message}
          </div>
        ))}
        {loading && <div>{character.name}が考え中...</div>}
      </div>

      <form onSubmit={handleSend} style={{ marginTop: 12 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージを入力..."
          style={{ width: '80%', padding: 8 }}
        />
        <button type="submit" style={{ padding: 8 }}>送信</button>
      </form>

      <button onClick={() => router.push(`/characters/${id}`)} style={{ marginTop: 12 }}>
        ← キャラ情報ページへ戻る
      </button>
    </div>
  )
}
