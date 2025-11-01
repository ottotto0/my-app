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
    console.log('🟢 フォーム送信開始')

    let image_url = null

    // 画像をSupabase Storageへアップロード
    if (imageFile) {
      const fileName = `${Date.now()}_${imageFile.name}`
      console.log('🟡 アップロードするファイル名:', fileName)

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('character-icons')
        .upload(fileName, imageFile)

      if (uploadError) {
        console.error('🔴 アップロードエラー:', uploadError)
      } else {
        console.log('🟢 アップロード成功:', uploadData)

        const { data: publicUrlData, error: publicUrlError } = supabase.storage
          .from('character-icons')
          .getPublicUrl(fileName)

        if (publicUrlError) {
          console.error('🔴 URL取得エラー:', publicUrlError)
        } else {
          console.log('🟢 取得したPublic URLデータ:', publicUrlData)
          image_url = publicUrlData.publicUrl
          console.log('🟢 保存予定のimage_url:', image_url)
        }
      }
    } else {
      console.log('⚪ 画像ファイルが選択されていません')
    }

    // charactersテーブルにデータ挿入
    const { data: insertData, error: insertError } = await supabase
      .from('characters')
      .insert([{ name, age, description, image_url }])
      .select()

    if (insertError) {
      console.error('🔴 挿入エラー:', insertError)
    } else {
      console.log('🟢 挿入成功:', insertData)
      router.push('/characters')
    }
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
