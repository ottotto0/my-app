import { useRouter } from 'next/router'
import { useEffect, useState } from 'react'
import { supabase } from '../../../lib/supabaseClient'

export default function ChatPage() {
  const router = useRouter()
  const { id } = router.query
  const [character, setCharacter] = useState(null)
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])

  // キャラ情報と履歴の取得
  useEffect(() => {
    if (!id) return
    const fetchCharacter = async () => {
      const { data } = await supabase.from('characters').select('*').eq('id', id).single()
      if (data) {
        setCharacter(data)
        setMessages(data.records ? JSON.parse(data.records) : [])
      }
    }
    fetchCharacter()
  }, [id])

  // Gemini APIへ問い合わせ
  const fetchGeminiResponse = async (userMessage) => {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        character,
        messages: [...messages, { role: 'user', message: userMessage }]
      })
    })
    const data = await res.json()
    return data.reply
  }

  // メッセージ送信処理
  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMsg = { role: 'user', message: input }
    const updatedMessages = [...messages, userMsg]
    setMessages(updatedMessages)
    setInput('')

    // Geminiにリクエスト
    const reply = await fetchGeminiResponse(input)
    const charMsg = { role: 'character', message: reply }
    const newRecords = [...updatedMessages, charMsg]

    setMessages(newRecords)

    // Supabaseに保存
    await supabase
      .from('characters')
      .update({ records: JSON.stringify(newRecords) })
      .eq('id', id)
  }

  if (!character) return <div>読み込み中...</div>

  return (
    <div style={{ padding: 24 }}>
      <h2>{character.name}との会話</h2>
      <div
        style={{
          border: '1px solid #ccc',
          borderRadius: 8,
          padding: 16,
          height: 400,
          overflowY: 'auto',
          marginBottom: 16,
        }}
      >
        {messages.map((m, i) => (
          <p key={i}>
            <strong>{m.role === 'user' ? 'あなた' : character.name}：</strong> {m.message}
          </p>
        ))}
      </div>

      <form onSubmit={handleSend}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージを入力..."
          style={{ width: '80%' }}
        />
        <button type="submit">送信</button>
      </form>

      <button onClick={() => router.push(`/characters/${id}`)}>← キャラ情報へ戻る</button>
    </div>
  )
}
