import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'
import { useEffect, useState } from 'react'

export default function EditCharacter() {
  const router = useRouter()
  const { id } = router.query
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!id) return
    const load = async () => {
      const { data } = await supabase.from('characters').select('*').eq('id', id).single()
      if (data) {
        setName(data.name)
        setAge(data.age)
        setDescription(data.description)
      }
    }
    load()
  }, [id])

  const handleUpdate = async (e) => {
    e.preventDefault()
    await supabase.from('characters').update({ name, age, description }).eq('id', id)
    router.push(`/characters/${id}`)
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>キャラ情報の編集</h2>
      <form onSubmit={handleUpdate}>
        <input value={name} onChange={(e) => setName(e.target.value)} /><br/>
        <input type="number" value={age} onChange={(e) => setAge(e.target.value)} /><br/>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} /><br/>
        <button type="submit">更新</button>
      </form>
    </div>
  )
}
