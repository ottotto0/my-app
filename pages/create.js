import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'

export default function CreateCharacter() {
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [description, setDescription] = useState('')
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()
    const { error } = await supabase
      .from('characters')
      .insert([{ name, age, description }])
    if (!error) router.push('/characters')
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>キャラクター作成</h2>
      <form onSubmit={handleSubmit}>
        <input
          placeholder="名前"
          value={name}
          onChange={(e) => setName(e.target.value)}
        /><br/>
        <input
          placeholder="年齢"
          type="number"
          value={age}
          onChange={(e) => setAge(e.target.value)}
        /><br/>
        <textarea
          placeholder="説明"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        /><br/>
        <button type="submit">保存</button>
      </form>
    </div>
  )
}
