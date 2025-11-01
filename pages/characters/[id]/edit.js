import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'
import { useEffect, useState } from 'react'

export default function EditCharacter() {
  const router = useRouter()
  const { id } = router.query
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imageUrl, setImageUrl] = useState(null)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      const { data } = await supabase.from('characters').select('*').eq('id', id).single()
      if (data) {
        setName(data.name)
        setAge(data.age)
        setDescription(data.description)
        setImageUrl(data.image_url)
      }
    }
    load()
  }, [id])

  const handleUpdate = async (e) => {
    e.preventDefault()

    let image_url = imageUrl

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

    await supabase
      .from('characters')
      .update({ name, age, description, image_url })
      .eq('id', id)

    router.push(`/characters/${id}`)
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>キャラ情報の編集</h2>
      {imageUrl && <img src={imageUrl} alt="icon" style={{ width: 100, height: 100, borderRadius: '50%' }} />}
      <form onSubmit={handleUpdate}>
        <input value={name} onChange={(e) => setName(e.target.value)} /><br/>
        <input type="number" value={age} onChange={(e) => setAge(e.target.value)} /><br/>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} /><br/>
        <input type="file" accept="image/*" onChange={(e) => setImageFile(e.target.files[0])} /><br/>
        <button type="submit">更新</button>
      </form>
    </div>
  )
}
