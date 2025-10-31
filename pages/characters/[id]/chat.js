import { useEffect, useState } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'
import { getGeminiResponse } from '../../../lib/geminiClient'

export default function CharacterChat() {
  const router = useRouter()
  const { id } = router.query

  const [character, setCharacter] = useState(null)
  const [records, setRecords] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [clearing, setClearing] = useState(false)

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

  // メッセージ送信
  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim()) return
    const userMessage = { role: "user", message: input }

    const newRecords = [...records, userMessage]
    setRecords(newRecords)
    setInput('')
    setLoading(true)

    const reply = await getGeminiResponse(character, input, newRecords)

    const aiMessage = { role: "assistant", message: reply }
    const updatedRecords = [...newRecords, aiMessage]
    setRecords(updatedRecords)

    await supabase.from('characters').update({ records: JSON.stringify(updatedRecords) }).eq('id', id)

    setLoading(false)
  }

  // 🧹 会話履歴を削除
  const handleClearHistory = async () => {
    if (!confirm('本当にこのキャラとの会話履歴を削除しますか？')) return
    setClearing(true)

    await supabase
      .from('characters')
      .update({ records: JSON.stringify([]) })
      .eq('id', id)

    setRecords([])
    setClearing(false)
    alert('履歴を削除しました。')
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
        {records.length === 0 && <div style={{ color: '#777' }}>まだ会話はありません。</div>}
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

      <div style={{ marginTop: 16, display: 'flex', gap: 8 }}>
        <button onClick={() => router.push(`/characters/${id}`)}>
          ← キャラ情報ページへ戻る
        </button>
        <button
          onClick={handleClearHistory}
          disabled={clearing}
          style={{ backgroundColor: '#f66', color: 'white', padding: '8px 12px', borderRadius: 6 }}
        >
          {clearing ? '削除中…' : '🧹 会話履歴を削除'}
        </button>
      </div>
    </div>
  )
}
