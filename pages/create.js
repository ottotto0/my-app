import { useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useRouter } from 'next/router'

export default function CreateCharacter() {
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const router = useRouter()

  const handleSubmit = async (e) => {
    e.preventDefault()

    let image_url = null

    // 画像をSupabase Storageへアップロード
    if (imageFile) {
      const fileName = `${Date.now()}_${imageFile.name}`
      const { data, error } = await supabase.storage
        .from('character-icons')
        .upload(fileName, imageFile)

      if (!error) {
        const { data: publicUrl } = supabase.storage
          .from('character-icons')
          .getPublicUrl(fileName)
        image_url = publicUrl.publicUrl
      }
    }

    const { error } = await supabase
      .from('characters')
      .insert([{ name, age, description, image_url }])

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
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files[0])}
        /><br/>
        <button type="submit">保存</button>
      </form>
    </div>
  )
}
