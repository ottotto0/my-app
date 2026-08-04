import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'

const modes = { add: 'タグ追加', remove: 'タグ削除', list: 'タグ一覧' }

export default function TagPage() {
  const [mode, setMode] = useState('add'), [modeOpen, setModeOpen] = useState(false)
  const [categories, setCategories] = useState([]), [tags, setTags] = useState([])
  const [category, setCategory] = useState(''), [tag, setTag] = useState(''), [selectedTag, setSelectedTag] = useState('')
  const [filter, setFilter] = useState(''), [dialog, setDialog] = useState(null), [loading, setLoading] = useState(true)
  const loadData = async () => {
    setLoading(true)
    const [categoriesResult, tagsResult] = await Promise.all([supabase.from('image_prompt_categories').select('category').order('category'), supabase.from('image_prompt_tags').select('category, tag').order('category').order('tag')])
    if (categoriesResult.error || tagsResult.error) setDialog({ type: 'error', message: 'データの取得に失敗しました。' })
    else { setCategories(categoriesResult.data || []); setTags(tagsResult.data || []) }
    setLoading(false)
  }
  useEffect(() => { loadData() }, [])
  const addTag = async () => {
    const cleanTag = tag.trim()
    if (!category || !cleanTag || tags.some((item) => item.category === category && item.tag === cleanTag)) { setDialog({ type: 'invalid', message: 'タグ追加は無効です。' }); return }
    const { error } = await supabase.from('image_prompt_tags').insert({ category, tag: cleanTag })
    if (error) setDialog({ type: 'error', message: 'タグの追加に失敗しました。' })
    else { setTag(''); await loadData() }
  }
  const switchMode = (next) => { setMode(next); setModeOpen(false); setCategory(''); setSelectedTag('') }
  const deleteTag = async () => { const { error } = await supabase.from('image_prompt_tags').delete().eq('category', category).eq('tag', selectedTag); if (error) { setDialog({ type: 'error', message: 'タグの削除に失敗しました。' }); return }; window.location.reload() }
  const categoryOptions = categories.map(({ category: value }) => <option key={value} value={value}>{value}</option>)
  const tagsForCategory = tags.filter((item) => item.category === category)
  const shownTags = filter ? tags.filter((item) => item.category === filter) : tags
  return <main className="min-h-screen bg-gradient-to-br from-slate-100 to-purple-100 p-4 sm:p-6"><section className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-xl sm:p-8">
    <Link href="/setting/img-gen-setting" className="inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-800">← 画像生成の設定に戻る</Link><h1 className="mt-5 text-3xl font-bold text-slate-800">タグ管理</h1>
    <div className="relative mt-6"><button onClick={() => setModeOpen(!modeOpen)} className="flex w-full justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700">ページモード：{modes[mode]} <span>⌄</span></button>{modeOpen && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg">{Object.entries(modes).map(([key, label]) => <button key={key} onClick={() => switchMode(key)} className="block w-full px-4 py-3 text-left hover:bg-purple-50">{label}</button>)}</div>}</div>
    {mode === 'add' && <div className="mt-8 space-y-4"><Select label="カテゴリー" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="カテゴリーを選択">{categoryOptions}</Select><label className="block font-semibold text-slate-700">新しいタグ<input value={tag} onChange={(e) => setTag(e.target.value)} placeholder="新しいタグを入力" className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-purple-500" /></label><button onClick={addTag} className="w-full rounded-lg bg-purple-600 px-5 py-3 font-bold text-white hover:bg-purple-700">追加</button></div>}
    {mode === 'remove' && <div className="mt-8 space-y-4"><Select label="カテゴリー" value={category} onChange={(e) => { setCategory(e.target.value); setSelectedTag('') }} placeholder="カテゴリーを選択">{categoryOptions}</Select><Select label="タグ" value={selectedTag} onChange={(e) => setSelectedTag(e.target.value)} placeholder="タグを選択" disabled={!category}>{tagsForCategory.map((item) => <option key={item.tag} value={item.tag}>{item.tag}</option>)}</Select><button disabled={!category || !selectedTag} onClick={() => setDialog({ type: 'confirm', message: `「${selectedTag}」をタグから削除しますか？` })} className="w-full rounded-lg bg-rose-600 px-5 py-3 font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300">削除</button></div>}
    {mode === 'list' && <div className="mt-8"><Select label="categoryで絞り込み" value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="category">{categoryOptions}</Select><div className="mt-4 overflow-hidden rounded-lg border"><table className="w-full text-left"><thead className="bg-slate-100"><tr><th className="px-4 py-3">category</th><th className="px-4 py-3">tag</th></tr></thead><tbody>{loading ? <tr><td colSpan="2" className="px-4 py-3 text-slate-500">読み込み中...</td></tr> : shownTags.length ? shownTags.map((item) => <tr key={`${item.category}-${item.tag}`} className="border-t"><td className="px-4 py-3">{item.category}</td><td className="px-4 py-3">{item.tag}</td></tr>) : <tr><td colSpan="2" className="px-4 py-3 text-slate-500">タグはありません。</td></tr>}</tbody></table></div></div>}
  </section>{dialog && <Dialog dialog={dialog} onClose={() => setDialog(null)} onConfirm={deleteTag} />}</main>
}

function Select({ label, value, onChange, placeholder, disabled, children }) { return <label className="block font-semibold text-slate-700">{label}<select value={value} onChange={onChange} disabled={disabled} size={disabled ? 1 : undefined} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 disabled:cursor-not-allowed disabled:bg-slate-100"><option value="">{placeholder}</option>{children}</select></label> }
function Dialog({ dialog, onClose, onConfirm }) { return <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/50 p-4"><div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"><p className="text-lg font-semibold text-slate-800">{dialog.message}</p><div className="mt-6 flex justify-end gap-3">{dialog.type === 'confirm' && <button onClick={onClose} className="rounded-lg border px-4 py-2 font-semibold">キャンセル</button>}<button onClick={dialog.type === 'confirm' ? onConfirm : onClose} className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white">{dialog.type === 'confirm' ? '確定' : '閉じる'}</button></div></div></div> }
