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
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl p-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">キャラクター作成</h2>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">名前</label>
            <input
              id="name"
              placeholder="名前を入力"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="age" className="block text-sm font-medium text-gray-700">年齢</label>
            <input
              id="age"
              placeholder="年齢を入力"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">説明</label>
            <textarea
              id="description"
              placeholder="説明を入力"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={4}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">画像</label>
            <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-gray-300 border-dashed rounded-md">
              <div className="space-y-1 text-center">
                <svg
                  className="mx-auto h-12 w-12 text-gray-400"
                  stroke="currentColor"
                  fill="none"
                  viewBox="0 0 48 48"
                  aria-hidden="true"
                >
                  <path
                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
                <div className="flex text-sm text-gray-600">
                  <label
                    htmlFor="file-upload"
                    className="relative cursor-pointer bg-white rounded-md font-medium text-indigo-600 hover:text-indigo-500 focus-within:outline-none focus-within:ring-2 focus-within:ring-offset-2 focus-within:ring-indigo-500"
                  >
                    <span>ファイルをアップロード</span>
                    <input
                      id="file-upload"
                      name="file-upload"
                      type="file"
                      accept="image/*"
                      className="sr-only"
                      onChange={(e) => setImageFile(e.target.files[0])}
                    />
                  </label>
                  <p className="pl-1">またはドラッグ＆ドロップ</p>
                </div>
                <p className="text-xs text-gray-500">PNG, JPG, GIF up to 10MB</p>
                {imageFile && <p className="text-sm text-green-600 mt-2">選択済み: {imageFile.name}</p>}
              </div>
            </div>
          </div>
          <div>
            <button
              type="submit"
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
