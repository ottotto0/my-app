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
  const [clearing, setClearing] = useState(false)
  const [latestImage, setLatestImage] = useState(null)

  // キャラ情報読み込み
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

  const handleSend = async (e) => {
    e.preventDefault()
    if (!input.trim()) return

    const userMessage = { role: 'user', message: input }
    const newRecords = [...records, userMessage]
    setRecords(newRecords)
    setInput('')
    setLoading(true)

    try {
      // ✅ 自作API経由でGemmaに問い合わせ
      const res = await fetch('/api/gemma', {
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

      // 🖼️ 画像生成プロンプトの作成（非同期で実行し、ユーザーを待たせない）
      fetch('/api/generate-image-prompt', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          character,
          records: updatedRecords // 最新のAI返答を含めた履歴
        }),
      })
        .then(res => res.json())
        .then(data => {
          console.log('🎨 Generated Image Prompt:', data.prompt)

          if (data.prompt) {
            // 🖼️ 画像生成を実行
            console.log('🖼️ Generating Image...')
            fetch('/api/generate-image', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ prompt: data.prompt }),
            })
              .then(res => res.json())
              .then(async (imageData) => {
                if (imageData.image_url) {
                  console.log('✅ Image Generated:', imageData.image_url)
                  setLatestImage(imageData.image_url)

                  // Supabaseに最新画像URLを保存
                  await supabase
                    .from('characters')
                    .update({ image_latest_chat_url: imageData.image_url })
                    .eq('id', id)
                }
              })
              .catch(err => console.error('🔴 Image Generation Error:', err))
          }
        })
        .catch(err => console.error('🔴 Prompt Generation Error:', err))
    } catch (err) {
      console.error(err)
      alert('通信エラーが発生しました')
    } finally {
      setLoading(false)
    }
  }

  // 🧹 会話履歴を削除
  const handleClearHistory = async () => {
    if (!confirm('本当にこのキャラとの会話履歴を削除しますか？')) return
    setClearing(true)

    await supabase
      .from('characters')
      .update({
        records: JSON.stringify([]),
        image_latest_chat_url: null
      })
      .eq('id', id)

    setRecords([])
    setLatestImage(null)
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
        {records.map((r, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <b>{r.role === 'user' ? 'あなた' : character.name}：</b> {r.message}
          </div>
        ))}
        {loading && <div>{character.name}が考え中...</div>}
      </div>

      {/* 最新画像の表示エリア */}
      {latestImage && (
        <div style={{ marginTop: 16, textAlign: 'center' }}>
          <img
            src={latestImage}
            alt="Generated Scene"
            style={{ maxWidth: '100%', borderRadius: 8, boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}
          />
        </div>
      )}

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

      <button
        onClick={handleClearHistory}
        disabled={clearing}
        style={{ backgroundColor: '#f66', color: 'white', padding: '8px 12px', borderRadius: 6, marginLeft: 12 }}
      >
        {clearing ? '削除中…' : '🧹 会話履歴を削除'}
      </button>

    </div>
  )
}

