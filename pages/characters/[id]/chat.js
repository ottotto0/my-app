import { useState, useEffect } from 'react'
import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'
import { GoogleGenerativeAI } from '@google/generative-ai'

export default function CharacterChat() {
  const router = useRouter()
  const { id } = router.query
  const [character, setCharacter] = useState(null)
  const [records, setRecords] = useState([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)

  const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY)

  useEffect(() => {
    if (!id) return
    const fetchCharacter = async () => {
      const { data } = await supabase.from('characters').select('*').eq('id', id).single()
      if (data) {
        setCharacter(data)
        setRecords(data.records || [])
      }
    }
    fetchCharacter()
  }, [id])

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim()) return
    setLoading(true)

    const newRecord = { role: 'user', message: input }
    const updatedRecords = [...records, newRecord]
    setRecords(updatedRecords)
    setInput('')

    try {
      // キャラ情報をもとにGeminiにプロンプトを作成
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      const prompt = `
      あなたはキャラクター「${character.name}」です。
      キャラの設定: ${character.description}
      以下の会話の続きをキャラとして返答してください。
      会話履歴:
      ${updatedRecords.map(r => `${r.role === 'user' ? 'ユーザー' : character.name'}: ${r.message}`).join('\n')}
      `

      const result = await model.generateContent(prompt)
      const reply = result.response.text()

      const aiRecord = { role: 'character', message: reply }
      const newHistory = [...updatedRecords, aiRecord]
      setRecords(newHistory)

      // Supabase に保存（更新）
      await supabase.from('characters').update({ records: newHistory }).eq('id', id)

    } catch (error) {
      console.error('Geminiエラー:', error)
    }

    setLoading(false)
  }

  if (!character) return <div>読み込み中...</div>

  return (
    <div style={{ padding: 24 }}>
      <h2>💬 {character.name} との会話</h2>

      <div style={{ border: '1px solid #ccc', padding: 12, height: 400, overflowY: 'auto', marginBottom: 12 }}>
        {records.map((r, i) => (
          <p key={i} style={{ color: r.role === 'user' ? 'blue' : 'green' }}>
            <b>{r.role === 'user' ? 'あなた' : character.name}：</b>{r.message}
          </p>
        ))}
        {loading && <p>{character.name}が考え中…💭</p>}
      </div>

      <form onSubmit={handleSend}>
        <input
          style={{ width: '80%' }}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="メッセージを入力..."
        />
        <button type="submit" disabled={loading}>送信</button>
      </form>

      <button style={{ marginTop: 12 }} onClick={() => router.push(`/characters/${id}`)}>
        ← キャラ情報へ戻る
      </button>
    </div>
  )
}
