import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'

const modes = { add: 'カテゴリー追加', remove: 'カテゴリー削除', list: 'カテゴリー一覧' }

export default function CategoryPage() {
  const [mode, setMode] = useState('add')
  const [isModeOpen, setIsModeOpen] = useState(false)
  const [categories, setCategories] = useState([])
  const [newCategory, setNewCategory] = useState('')
  const [selected, setSelected] = useState('')
  const [dialog, setDialog] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadCategories = async () => {
    setLoading(true)
    const { data, error } = await supabase.from('image_prompt_categories').select('category').order('category')
    if (error) setDialog({ type: 'error', message: 'カテゴリーの取得に失敗しました。' })
    else setCategories(data || [])
    setLoading(false)
  }
  useEffect(() => { loadCategories() }, [])

  const addCategory = async () => {
    const category = newCategory.trim()
    if (!category || categories.some((item) => item.category === category)) {
      setDialog({ type: 'invalid', message: 'カテゴリー追加は無効です。' })
      return
    }
    const { error } = await supabase.from('image_prompt_categories').insert({ category })
    if (error) setDialog({ type: 'error', message: 'カテゴリーの追加に失敗しました。' })
    else { setNewCategory(''); await loadCategories() }
  }
  const confirmDelete = async () => {
    const { error } = await supabase.from('image_prompt_categories').delete().eq('category', selected)
    if (error) { setDialog({ type: 'error', message: 'カテゴリーの削除に失敗しました。' }); return }
    window.location.reload()
  }
  const switchMode = (nextMode) => { setMode(nextMode); setIsModeOpen(false); setSelected('') }

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 to-indigo-100 p-4 sm:p-6">
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <Link href="/setting/img-gen-setting" className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800">← 画像生成の設定に戻る</Link>
        <h1 className="mt-5 text-3xl font-bold text-slate-800">カテゴリー管理</h1>
        <div className="relative mt-6">
          <button onClick={() => setIsModeOpen(!isModeOpen)} className="flex w-full items-center justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700">ページモード：{modes[mode]} <span>⌄</span></button>
          {isModeOpen && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg">{Object.entries(modes).map(([key, label]) => <button key={key} onClick={() => switchMode(key)} className="block w-full px-4 py-3 text-left hover:bg-indigo-50">{label}</button>)}</div>}
        </div>

        {mode === 'add' && <div className="mt-8"><label className="mb-2 block font-semibold text-slate-700">新しいカテゴリー</label><div className="flex gap-3"><input value={newCategory} onChange={(e) => setNewCategory(e.target.value)} placeholder="新しいカテゴリーを入力" className="min-w-0 flex-1 rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-indigo-500" /><button onClick={addCategory} className="rounded-lg bg-indigo-600 px-5 py-3 font-bold text-white hover:bg-indigo-700">追加</button></div></div>}
        {mode === 'remove' && <div className="mt-8"><label className="mb-2 block font-semibold text-slate-700">削除するカテゴリー</label><select value={selected} onChange={(e) => setSelected(e.target.value)} className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3" size={Math.min(Math.max(categories.length + 1, 1), 7)}><option value="">削除するカテゴリーを選択</option>{categories.map(({ category }) => <option key={category} value={category}>{category}</option>)}</select><button disabled={!selected} onClick={() => setDialog({ type: 'confirm', message: `「${selected}」をカテゴリーから削除しますか？` })} className="mt-5 w-full rounded-lg bg-rose-600 px-5 py-3 font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300">削除</button></div>}
        {mode === 'list' && <div className="mt-8 overflow-hidden rounded-lg border"><table className="w-full text-left"><thead className="bg-slate-100"><tr><th className="px-4 py-3">category</th></tr></thead><tbody>{loading ? <tr><td className="px-4 py-3 text-slate-500">読み込み中...</td></tr> : categories.length ? categories.map(({ category }) => <tr key={category} className="border-t"><td className="px-4 py-3">{category}</td></tr>) : <tr><td className="px-4 py-3 text-slate-500">カテゴリーはありません。</td></tr>}</tbody></table></div>}
      </section>
      {dialog && <Dialog dialog={dialog} onClose={() => setDialog(null)} onConfirm={confirmDelete} />}
    </main>
  )
}

function Dialog({ dialog, onClose, onConfirm }) { return <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/50 p-4"><div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"><p className="text-lg font-semibold text-slate-800">{dialog.message}</p><div className="mt-6 flex justify-end gap-3">{dialog.type === 'confirm' && <button onClick={onClose} className="rounded-lg border px-4 py-2 font-semibold">キャンセル</button>}<button onClick={dialog.type === 'confirm' ? onConfirm : onClose} className="rounded-lg bg-indigo-600 px-4 py-2 font-semibold text-white">{dialog.type === 'confirm' ? '確定' : '閉じる'}</button></div></div></div> }
