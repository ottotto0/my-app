import { useRouter } from 'next/router'
import { supabase } from '../../lib/supabaseClient'
import { useEffect, useState } from 'react'
import Link from 'next/link'

export default function CharacterDetail() {
  const router = useRouter()
  const { id } = router.query
  const [character, setCharacter] = useState(null)

  useEffect(() => {
    if (!id) return
    const fetchCharacter = async () => {
      const { data } = await supabase.from('characters').select('*').eq('id', id).single()
      setCharacter(data)
    }
    fetchCharacter()
  }, [id])

  const handleDelete = async () => {
    await supabase.from('characters').delete().eq('id', id)
    router.push('/characters')
  }

  if (!character) return <div>読み込み中...</div>

  return (
    <div style={{ padding: 24 }}>
      <h2>{character.name}</h2>
      <p>年齢: {character.age}</p>
      <p>{character.description}</p>
      <p><Link href={`/characters/${id}/chat`}>キャラと会話</Link></p>
      <Link href={`/characters/${id}/edit`}>編集ページへ</Link>
      <button onClick={handleDelete}>削除</button><br/>
      <Link href="/characters">← 一覧へ戻る</Link>
    </div>
  )
}
