import { useRouter } from 'next/router'
import { supabase } from '../../../lib/supabaseClient'
import { useEffect, useState } from 'react'
import { AppearanceSelector, Dialog, categoryToColumnName } from '../../../components/AppearanceSelector'

export default function EditCharacter() {
  const router = useRouter()
  const { id } = router.query
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [description, setDescription] = useState('')
  const [imageFile, setImageFile] = useState(null)
  const [imageUrl, setImageUrl] = useState(null)
  const [categories, setCategories] = useState([])
  const [tagsByCategory, setTagsByCategory] = useState({})
  const [appearanceValues, setAppearanceValues] = useState({})
  const [loadingAppearance, setLoadingAppearance] = useState(true)
  const [dialog, setDialog] = useState(null)

  useEffect(() => {
    if (!id) return
    const load = async () => {
      console.log('🟢 キャラ情報および外見設定を取得中...', id)
      setLoadingAppearance(true)

      const [charResult, catResult, tagResult] = await Promise.all([
        supabase.from('characters').select('*').eq('id', id).single(),
        supabase.from('image_prompt_categories').select('category, character_appearance').order('category'),
        supabase.from('image_prompt_tags').select('category, tag').order('category').order('tag'),
      ])

      if (charResult.error) console.error('🔴 キャラ情報取得エラー:', charResult.error)
      if (catResult.error || tagResult.error) {
        console.error('🔴 カテゴリーまたはタグ取得エラー:', catResult.error || tagResult.error)
      }

      const charData = charResult.data
      if (charData) {
        console.log('🟢 キャラ情報:', charData)
        setName(charData.name || '')
        setAge(charData.age || '')
        setDescription(charData.description || '')
        setImageUrl(charData.image_url)
      }

      const activeCategories = (catResult.data || [])
        .filter((item) => item.character_appearance === 'on')
        .map((item) => item.category)
      setCategories(activeCategories)

      const tagMap = {}
      for (const item of tagResult.data || []) {
        if (!tagMap[item.category]) tagMap[item.category] = []
        tagMap[item.category].push(item.tag)
      }
      setTagsByCategory(tagMap)

      // 各カテゴリーの初期値を characters テーブルのカラムから復元
      const initialValues = {}
      for (const cat of activeCategories) {
        const colName = categoryToColumnName(cat)
        const savedVal = charData ? charData[colName] : null
        if (savedVal && typeof savedVal === 'string' && savedVal.trim() !== '') {
          initialValues[cat] = { enabled: true, tag: savedVal }
        } else {
          initialValues[cat] = { enabled: false, tag: '' }
        }
      }
      setAppearanceValues(initialValues)
      setLoadingAppearance(false)
    }

    load()
  }, [id])

  const handleAppearanceChange = (category, { enabled, tag }) => {
    setAppearanceValues((prev) => ({
      ...prev,
      [category]: { enabled, tag },
    }))
  }

  const handleUpdate = async (e) => {
    e.preventDefault()
    console.log('🟢 更新処理開始')

    // スイッチがONなのに未選択のカテゴリーをチェック
    const missingCategories = categories.filter((cat) => {
      const val = appearanceValues[cat]
      return val?.enabled && (!val?.tag || val.tag.trim() === '')
    })

    if (missingCategories.length > 0) {
      setDialog({
        message: `スイッチがONになっている以下のカテゴリーで、タグが選択されていません：\n\n${missingCategories.map((c) => `・${c}`).join('\n')}\n\nタグを選択するか、スイッチをOFFにしてください。`,
      })
      return
    }

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

    // 外見特徴の動的カラムを作成
    const dynamicAppearance = {}
    for (const cat of categories) {
      const colName = categoryToColumnName(cat)
      const val = appearanceValues[cat]
      dynamicAppearance[colName] = val?.enabled && val?.tag ? val.tag : null
    }

    // DB更新
    const { error: updateError } = await supabase
      .from('characters')
      .update({
        name,
        age,
        description,
        appearance: null,
        image_url,
        ...dynamicAppearance,
      })
      .eq('id', id)

    if (updateError) {
      console.error('🔴 更新エラー:', updateError)
      setDialog({
        message: `キャラ情報の更新に失敗しました。${updateError.message || ''}`,
      })
    } else {
      console.log('🟢 キャラ情報を更新しました')
      router.push(`/characters/${id}`)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md mx-auto bg-white rounded-xl shadow-md overflow-hidden md:max-w-2xl p-8">
        <h2 className="text-3xl font-bold text-gray-900 mb-6 text-center">キャラ情報の編集</h2>

        {imageUrl && (
          <div className="flex justify-center mb-6">
            <img
              src={imageUrl}
              alt="icon"
              className="w-32 h-32 rounded-full object-cover shadow-lg"
            />
          </div>
        )}

        <form onSubmit={handleUpdate} className="space-y-6">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">名前</label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="名前"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="age" className="block text-sm font-medium text-gray-700">年齢</label>
            <input
              id="age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              placeholder="年齢"
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <label htmlFor="description" className="block text-sm font-medium text-gray-700">説明</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="説明"
              rows={4}
              className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
            />
          </div>
          <div>
            <AppearanceSelector
              categories={categories}
              tagsByCategory={tagsByCategory}
              values={appearanceValues}
              onChange={handleAppearanceChange}
              loading={loadingAppearance}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">画像を変更</label>
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
              更新
            </button>
          </div>
        </form>
      </div>
      {dialog && <Dialog dialog={dialog} onClose={() => setDialog(null)} />}
    </div>
  )
}
