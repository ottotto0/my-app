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
      console.log('🟢 キャラ情報を取得中...', id)
      const { data, error } = await supabase
        .from('characters')
        .select('*')
        .eq('id', id)
        .single()
      if (error) console.error('🔴 キャラ情報取得エラー:', error)
      if (data) {
        console.log('🟢 キャラ情報:', data)
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
    console.log('🟢 更新処理開始')

    let image_url = imageUrl

    // 新しい画像が選択された場合のみ実行
    if (imageFile) {
      console.log('🟡 新しい画像が選択されました:', imageFile.name)

      // 旧画像の削除
      if (imageUrl) {
        try {
          const oldPath = imageUrl.split('/character-icons/')[1] // パス抽出
          if (oldPath) {
            console.log('🟡 旧画像削除パス:', oldPath)
            const { error: removeError } = await supabase.storage
              .from('character-icons')
              .remove([oldPath])
            if (removeError) console.error('🔴 旧画像削除エラー:', removeError)
            else console.log('🟢 旧画像削除完了')
          }
        } catch (err) {
          console.error('🔴 パス解析エラー:', err)
        }
      }

      // 新しい画像のアップロード
      const fileName = `${Date.now()}_${imageFile.name}`
      console.log('🟡 新しいファイル名:', fileName)
      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('character-icons')
        .upload(fileName, imageFile)

      if (uploadError) {
        console.error('🔴 アップロードエラー:', uploadError)
      } else {
        console.log('🟢 アップロード成功:', uploadData)
        const { data: publicUrlData } = supabase.storage
          .from('character-icons')
          .getPublicUrl(fileName)
        image_url = publicUrlData.publicUrl
        console.log('🟢 新しいimage_url:', image_url)
      }
    }

    // DB更新
    const { error: updateError } = await supabase
      .from('characters')
      .update({ name, age, description, image_url })
      .eq('id', id)

    if (updateError) {
      console.error('🔴 更新エラー:', updateError)
    } else {
      console.log('🟢 キャラ情報を更新しました')
      router.push(`/characters/${id}`)
    }
  }

  return (
    <div style={{ padding: 24 }}>
      <h2>キャラ情報の編集</h2>

      {imageUrl && (
        <img
          src={imageUrl}
          alt="icon"
          style={{
            width: 100,
            height: 100,
            borderRadius: '50%',
            marginBottom: 12,
            objectFit: 'cover',
          }}
        />
      )}

      <form onSubmit={handleUpdate}>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="名前"
        /><br/>
        <input
          type="number"
          value={age}
          onChange={(e) => setAge(e.target.value)}
          placeholder="年齢"
        /><br/>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="説明"
        /><br/>
        <input
          type="file"
          accept="image/*"
          onChange={(e) => setImageFile(e.target.files[0])}
        /><br/>
        <button type="submit">更新</button>
      </form>
    </div>
  )
}
