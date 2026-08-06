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
      console.log('🟢 キャラ詳細取得中...', id)
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('id', id)
        .single()
      if (error) console.error('🔴 取得エラー:', error)
      else setCharacter(data)
    }
    fetchCharacter()
  }, [id])

  const handleDelete = async () => {
    if (!confirm('本当にこのキャラを削除しますか？')) return

    try {
      // 1️⃣ アイコン画像削除処理
      if (character?.image_url) {
        const oldPath = character.image_url.split('/character-icons/')[1]
        if (oldPath) {
          console.log('🟡 アイコン画像削除パス:', oldPath)
          const { error: removeError } = await supabase.storage
            .from('character-icons')
            .remove([oldPath])
          if (removeError) console.error('🔴 アイコン画像削除エラー:', removeError)
          else console.log('🟢 アイコン画像削除完了')
        } else {
          console.log('⚠️ アイコン画像パスが解析できませんでした:', character.image_url)
        }
      }

      // 2️⃣ チャット生成画像削除処理
      const chatImagePath = `characters/${id}/latest.png`
      console.log('🟡 チャット画像削除パス:', chatImagePath)
      const { error: removeChatImageError } = await supabase.storage
        .from('chat-images')
        .remove([chatImagePath])
      if (removeChatImageError) {
        console.error('🔴 チャット画像削除エラー:', removeChatImageError)
      } else {
        console.log('🟢 チャット画像削除完了')
      }

      // 3️⃣ キャラデータ削除
      const { error: deleteError } = await supabase
        .from('characters')
        .delete()
        .eq('id', id)

      if (deleteError) {
        console.error('🔴 キャラ削除エラー:', deleteError)
        alert('キャラ削除に失敗しました')
        return
      }

      console.log('🟢 キャラ削除完了')
      router.push('/characters')
    } catch (err) {
      console.error('🔴 削除中の予期せぬエラー:', err)
      alert('削除処理中にエラーが発生しました')
    }
  }

  if (!character) return <div>読み込み中...</div>

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md overflow-hidden">
        <div className="md:flex">
          <div className="md:flex-shrink-0 p-8 flex justify-center items-start">
            {character.image_url ? (
              <img
                className="h-48 w-48 rounded-full object-cover shadow-lg"
                src={character.image_url}
                alt={character.name}
              />
            ) : (
              <div className="h-48 w-48 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-gray-400">No Image</span>
              </div>
            )}
          </div>
          <div className="p-8 w-full">
            <div className="uppercase tracking-wide text-sm text-indigo-500 font-semibold">Character Details</div>
            <h2 className="block mt-1 text-3xl leading-tight font-bold text-gray-900">{character.name}</h2>
            <p className="mt-2 text-gray-500">年齢: {character.age}歳</p>
            <p className="mt-4 text-gray-600 whitespace-pre-wrap">{character.description}</p>

            <div className="mt-8 flex flex-wrap gap-4">
              <Link href={`/characters/${id}/chat`} className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                💬 キャラと会話
              </Link>
              <Link href={`/characters/${id}/edit`} className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500">
                ✏️ 編集
              </Link>
              <button
                onClick={handleDelete}
                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-red-600 hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-red-500"
              >
                🗑️ 削除
              </button>
            </div>
          </div>
        </div>
        <div className="bg-gray-50 px-8 py-4 border-t border-gray-200">
          <Link href="/characters" className="text-indigo-600 hover:text-indigo-900 font-medium">
            ← 一覧へ戻る
          </Link>
        </div>
      </div>
    </div>
  )
}
