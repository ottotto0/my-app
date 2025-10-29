import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'
import { useEffect, useState } from 'react'

export default function CharacterList() {
  const [characters, setCharacters] = useState([])

  useEffect(() => {
    const fetchData = async () => {
      const { data } = await supabase.from('characters').select('*').order('created_at', { ascending: false })
      setCharacters(data)
    }
    fetchData()
  }, [])

  return (
    <div style={{ padding: 24 }}>
      <h2>キャラ一覧</h2>
      <ul>
        {characters.map((ch) => (
          <li key={ch.id}>
            <Link href={`/characters/${ch.id}`}>{ch.name}</Link>
          </li>
        ))}
      </ul>
      <Link href="/">← ホームへ</Link>
    </div>
  )
}
