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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900">キャラ一覧</h2>
          <Link href="/" className="text-indigo-600 hover:text-indigo-900 font-medium">
            ← ホームへ
          </Link>
        </div>
        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {characters.map((ch) => (
            <li key={ch.id} className="col-span-1 bg-white rounded-lg shadow divide-y divide-gray-200 hover:shadow-lg transition-shadow duration-300">
              <div className="w-full flex items-center justify-between p-6 space-x-6">
                <div className="flex-1 truncate">
                  <div className="flex items-center space-x-3">
                    <h3 className="text-gray-900 text-lg font-medium truncate">{ch.name}</h3>
                  </div>
                  <p className="mt-1 text-gray-500 text-sm truncate">{ch.description}</p>
                </div>
                {ch.image_url ? (
                  <img
                    className="w-12 h-12 bg-gray-300 rounded-full flex-shrink-0 object-cover"
                    src={ch.image_url}
                    alt={ch.name}
                  />
                ) : (
                  <div className="w-12 h-12 bg-gray-200 rounded-full flex-shrink-0" />
                )}
              </div>
              <div>
                <div className="-mt-px flex divide-x divide-gray-200">
                  <div className="w-0 flex-1 flex">
                    <Link
                      href={`/characters/${ch.id}`}
                      className="relative -mr-px w-0 flex-1 inline-flex items-center justify-center py-4 text-sm text-gray-700 font-medium border border-transparent rounded-bl-lg hover:text-gray-500"
                    >
                      <span className="ml-3">詳細を見る</span>
                    </Link>
                  </div>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
