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
      <ul style={{ listStyle: 'none', padding: 0 }}>
        {characters.map((ch) => (
          <li key={ch.id} style={{ display: 'flex', alignItems: 'center', marginBottom: 12 }}>
            {ch.image_url ? (
              <img
                src={ch.image_url}
                alt={ch.name}
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  objectFit: 'cover',
                  marginRight: 12,
                }}
              />
            ) : (
              <div
                style={{
                  width: 50,
                  height: 50,
                  borderRadius: '50%',
                  background: '#ddd',
                  marginRight: 12,
                }}
              />
            )}
            <Link href={`/characters/${ch.id}`} style={{ fontSize: 18, fontWeight: 'bold' }}>
              {ch.name}
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/">← ホームへ</Link>
    </div>
  )
}
