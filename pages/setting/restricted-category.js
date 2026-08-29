import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'

const modes = { add: '条件付き制限カテゴリー追加', remove: '条件付き制限カテゴリー削除', list: '条件付き制限カテゴリー一覧' }
const emptySelection = { tag1_category: '', tag1: '', tag2_category: '', tag2: '', restricted_category: '' }
const columns = ['tag1_category', 'tag1', 'tag2_category', 'tag2', 'restricted_category']
const pair = (value, index) => ({ category: value[`tag${index}_category`], tag: value[`tag${index}`] })
const pairKey = (value) => `${value.category}\u0000${value.tag}`
const samePair = (left, right) => left.category === right.category && left.tag === right.tag
const hasPairs = (value) => Boolean(value.tag1_category && value.tag1 && value.tag2_category && value.tag2)
const pairsMatchRegardlessOfOrder = (left, right) => hasPairs(left) && hasPairs(right) && ((samePair(pair(left, 1), pair(right, 1)) && samePair(pair(left, 2), pair(right, 2))) || (samePair(pair(left, 1), pair(right, 2)) && samePair(pair(left, 2), pair(right, 1))))
const canonicalize = (value) => pairKey(pair(value, 1)).localeCompare(pairKey(pair(value, 2))) <= 0 ? value : { ...value, tag1_category: value.tag2_category, tag1: value.tag2, tag2_category: value.tag1_category, tag2: value.tag1 }

export default function RestrictedCategoryPage() {
  const [mode, setMode] = useState('add')
  const [modeOpen, setModeOpen] = useState(false)
  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState([])
  const [restrictedRows, setRestrictedRows] = useState([])
  const [selection, setSelection] = useState(emptySelection)
  const [filter, setFilter] = useState(emptySelection)
  const [dialog, setDialog] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    const [categoriesResult, tagsResult, restrictedResult] = await Promise.all([
      supabase.from('image_prompt_categories').select('category').order('category'),
      supabase.from('image_prompt_tags').select('category, tag').order('category').order('tag'),
      supabase.from('image_restricted_categories').select('tag1_category, tag1, tag2_category, tag2, restricted_category').order('tag1_category').order('tag1').order('tag2_category').order('tag2').order('restricted_category'),
    ])
    const error = categoriesResult.error || tagsResult.error || restrictedResult.error
    if (error) {
      console.error('条件付き制限カテゴリー設定データの取得に失敗しました:', error)
      setDialog({ type: 'error', message: `データの取得に失敗しました。${error.message}` })
    } else {
      setCategories(categoriesResult.data || [])
      setTags(tagsResult.data || [])
      setRestrictedRows(restrictedResult.data || [])
    }
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const updateSelection = (field, value) => {
    setSelection((current) => ({
      ...current,
      [field]: value,
      ...(field === 'tag1_category' ? { tag1: '' } : {}),
      ...(field === 'tag2_category' ? { tag2: '' } : {}),
    }))
  }
  const updateFilter = (field, value) => {
    setFilter((current) => ({
      ...current,
      [field]: value,
      ...(field === 'tag1_category' ? { tag1: '' } : {}),
      ...(field === 'tag2_category' ? { tag2: '' } : {}),
    }))
  }
  const isComplete = (value) => columns.every((column) => value[column])
  const isDuplicate = restrictedRows.some((row) => row.restricted_category === selection.restricted_category && pairsMatchRegardlessOfOrder(row, selection))

  const addRestrictedCategory = async () => {
    if (!isComplete(selection) || isDuplicate) {
      setDialog({ type: 'invalid', message: '条件付き制限カテゴリー追加は無効です。' })
      return
    }
    const { error } = await supabase.from('image_restricted_categories').insert(canonicalize(selection))
    if (error) {
      setDialog({ type: 'error', message: `条件付き制限カテゴリーの追加に失敗しました。${error.message}` })
      return
    }
    setSelection((current) => ({ ...current, restricted_category: '' }))
    await loadData()
    setDialog({ type: 'success', message: '条件付き制限カテゴリーを追加しました。' })
  }

  const deleteRestrictedCategory = async () => {
    if (!isComplete(selection)) {
      setDialog({ type: 'invalid', message: '条件付き制限カテゴリー削除は無効です。' })
      return
    }
    const matchedRows = restrictedRows.filter((row) => row.restricted_category === selection.restricted_category && pairsMatchRegardlessOfOrder(row, selection))
    const results = await Promise.all(matchedRows.map((row) => supabase.from('image_restricted_categories').delete()
      .eq('tag1_category', row.tag1_category).eq('tag1', row.tag1)
      .eq('tag2_category', row.tag2_category).eq('tag2', row.tag2)
      .eq('restricted_category', row.restricted_category)))
    const error = results.find((result) => result.error)?.error
    if (error) {
      setDialog({ type: 'error', message: `条件付き制限カテゴリーの削除に失敗しました。${error.message}` })
      return
    }
    setSelection((current) => ({ ...current, restricted_category: '' }))
    await loadData()
    setDialog({ type: 'success', message: '条件付き制限カテゴリーを削除しました。' })
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setModeOpen(false)
    setSelection(emptySelection)
  }

  const categoryOptions = categories.map(({ category }) => <option key={category} value={category}>{category}</option>)
  const tagsFor = (category) => tags.filter((item) => item.category === category)
  const restrictedOptions = restrictedRows.filter((row) => pairsMatchRegardlessOfOrder(row, selection))
  const pairMatchesFilter = (rowPair, filterPair) => (!filterPair.category || rowPair.category === filterPair.category) && (!filterPair.tag || rowPair.tag === filterPair.tag)
  const shownRows = restrictedRows.filter((row) => {
    const pairsMatch = (pairMatchesFilter(pair(row, 1), pair(filter, 1)) && pairMatchesFilter(pair(row, 2), pair(filter, 2))) || (pairMatchesFilter(pair(row, 1), pair(filter, 2)) && pairMatchesFilter(pair(row, 2), pair(filter, 1)))
    return pairsMatch && (!filter.restricted_category || row.restricted_category === filter.restricted_category)
  })

  return <main className="min-h-screen bg-gradient-to-br from-slate-100 to-rose-100 p-4 sm:p-6"><section className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow-xl sm:p-8">
    <Link href="/setting/img-gen-setting" className="inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-800">← 画像生成の設定に戻る</Link>
    <h1 className="mt-5 text-3xl font-bold text-slate-800">条件付き制限カテゴリー管理</h1>
    <div className="relative mt-6"><button onClick={() => setModeOpen(!modeOpen)} className="flex w-full justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700">ページモード：{modes[mode]} <span>⌄</span></button>{modeOpen && <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg">{Object.entries(modes).map(([key, label]) => <button key={key} onClick={() => switchMode(key)} className="block w-full px-4 py-3 text-left hover:bg-rose-50">{label}</button>)}</div>}</div>
    {mode === 'add' && <SelectionForm selection={selection} onChange={updateSelection} categories={categoryOptions} tagsFor={tagsFor} buttonLabel="追加" onSubmit={addRestrictedCategory} />}
    {mode === 'remove' && <SelectionForm selection={selection} onChange={updateSelection} categories={categoryOptions} tagsFor={tagsFor} restrictedOptions={restrictedOptions} buttonLabel="削除" onSubmit={deleteRestrictedCategory} danger />}
    {mode === 'list' && <div className="mt-8"><FilterForm filter={filter} onChange={updateFilter} categories={categoryOptions} tagsFor={tagsFor} /><div className="mt-5 overflow-x-auto rounded-lg border"><table className="w-full min-w-[760px] text-left"><thead className="bg-slate-100"><tr>{columns.map((column) => <th key={column} className="px-4 py-3">{column}</th>)}</tr></thead><tbody>{loading ? <tr><td colSpan="5" className="px-4 py-3 text-slate-500">読み込み中...</td></tr> : shownRows.length ? shownRows.map((row) => <tr key={columns.map((column) => row[column]).join('|')} className="border-t">{columns.map((column) => <td key={column} className="px-4 py-3">{row[column]}</td>)}</tr>) : <tr><td colSpan="5" className="px-4 py-3 text-slate-500">条件付き制限カテゴリーはありません。</td></tr>}</tbody></table></div></div>}
  </section>{dialog && <Dialog dialog={dialog} onClose={() => setDialog(null)} />}</main>
}

function SelectionForm({ selection, onChange, categories, tagsFor, restrictedOptions, buttonLabel, onSubmit, danger }) {
  const isRemove = Boolean(restrictedOptions)
  return <div className="mt-8 space-y-4"><Select label="tag1_category" value={selection.tag1_category} onChange={(e) => onChange('tag1_category', e.target.value)} placeholder="カテゴリーを選択">{categories}</Select><Select label="tag1" value={selection.tag1} onChange={(e) => onChange('tag1', e.target.value)} placeholder="タグを選択" disabled={!selection.tag1_category}>{tagsFor(selection.tag1_category).map((item) => <option key={item.tag} value={item.tag}>{item.tag}</option>)}</Select><Select label="tag2_category" value={selection.tag2_category} onChange={(e) => onChange('tag2_category', e.target.value)} placeholder="カテゴリーを選択">{categories}</Select><Select label="tag2" value={selection.tag2} onChange={(e) => onChange('tag2', e.target.value)} placeholder="タグを選択" disabled={!selection.tag2_category}>{tagsFor(selection.tag2_category).map((item) => <option key={item.tag} value={item.tag}>{item.tag}</option>)}</Select><Select label="restricted_category" value={selection.restricted_category} onChange={(e) => onChange('restricted_category', e.target.value)} placeholder="制限カテゴリーを選択" disabled={isRemove && (!selection.tag1_category || !selection.tag1 || !selection.tag2_category || !selection.tag2)}>{isRemove ? restrictedOptions.map((item) => <option key={item.restricted_category} value={item.restricted_category}>{item.restricted_category}</option>) : categories}</Select><button onClick={onSubmit} className={`w-full rounded-lg px-5 py-3 font-bold text-white ${danger ? 'bg-rose-600 hover:bg-rose-700' : 'bg-purple-600 hover:bg-purple-700'}`}>{buttonLabel}</button></div>
}

function FilterForm({ filter, onChange, categories, tagsFor }) { return <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Select label="tag1_categoryで絞り込み" value={filter.tag1_category} onChange={(e) => onChange('tag1_category', e.target.value)} placeholder="すべて">{categories}</Select><Select label="tag1で絞り込み" value={filter.tag1} onChange={(e) => onChange('tag1', e.target.value)} placeholder="すべて" disabled={!filter.tag1_category}>{tagsFor(filter.tag1_category).map((item) => <option key={item.tag} value={item.tag}>{item.tag}</option>)}</Select><Select label="tag2_categoryで絞り込み" value={filter.tag2_category} onChange={(e) => onChange('tag2_category', e.target.value)} placeholder="すべて">{categories}</Select><Select label="tag2で絞り込み" value={filter.tag2} onChange={(e) => onChange('tag2', e.target.value)} placeholder="すべて" disabled={!filter.tag2_category}>{tagsFor(filter.tag2_category).map((item) => <option key={item.tag} value={item.tag}>{item.tag}</option>)}</Select><Select label="restricted_categoryで絞り込み" value={filter.restricted_category} onChange={(e) => onChange('restricted_category', e.target.value)} placeholder="すべて">{categories}</Select></div> }

function Select({ label, value, onChange, placeholder, disabled, children }) { return <label className="block font-semibold text-slate-700">{label}<select value={value} onChange={onChange} disabled={disabled} className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 disabled:cursor-not-allowed disabled:bg-slate-100"><option value="">{placeholder}</option>{children}</select></label> }
function Dialog({ dialog, onClose }) { return <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/50 p-4"><div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl"><p className="text-lg font-semibold text-slate-800">{dialog.message}</p><div className="mt-6 flex justify-end"><button onClick={onClose} className="rounded-lg bg-purple-600 px-4 py-2 font-semibold text-white">閉じる</button></div></div></div> }
