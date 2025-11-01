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
      // 1️⃣ 画像削除処理
      if (character?.image_url) {
        const oldPath = character.image_url.split('/character-icons/')[1]
        if (oldPath) {
          console.log('🟡 画像削除パス:', oldPath)
          const { error: removeError } = await supabase.storage
            .from('character-icons')
            .remove([oldPath])
          if (removeError) console.error('🔴 画像削除エラー:', removeError)
          else console.log('🟢 画像削除完了')
        } else {
          console.log('⚠️ 画像パスが解析できませんでした:', character.image_url)
        }
      }

      // 2️⃣ キャラデータ削除
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
    <div style={{ padding: 24 }}>
      <h2>{character.name}</h2>
      {character.image_url && (
        <img
          src={character.image_url}
          alt="icon"
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            marginBottom: 12,
            objectFit: 'cover',
          }}
        />
      )}
      <p>年齢: {character.age}</p>
      <p>{character.description}</p>

      <div style={{ marginTop: 16 }}>
        <p><Link href={`/characters/${id}/chat`}>💬 キャラと会話</Link></p>
        <Link href={`/characters/${id}/edit`}>✏️ 編集ページへ</Link>
        <button
          onClick={handleDelete}
          style={{
            marginLeft: 12,
            background: '#f55',
            color: 'white',
            border: 'none',
            padding: '6px 12px',
            borderRadius: 6,
            cursor: 'pointer',
          }}
        >
          🗑️ 削除
        </button>
      </div>

      <br/>
      <Link href="/characters">← 一覧へ戻る</Link>
    </div>
  )
}
