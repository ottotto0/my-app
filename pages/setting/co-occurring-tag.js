import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'

const modes = {
  add: '付属タグ追加',
  remove: '付属タグ削除',
  list: '付属タグ一覧',
}

const emptySelection = { parent_category: '', parent_tag: '', child_tag: '' }
const emptyFilter = { parent_category: '', parent_tag: '', child_tag: '' }
const columns = ['parent_category', 'parent_tag', 'child_tag']

export default function CoOccurringTagPage() {
  const [mode, setMode] = useState('add')
  const [modeOpen, setModeOpen] = useState(false)
  const [categories, setCategories] = useState([])
  const [tags, setTags] = useState([])
  const [coOccurringRows, setCoOccurringRows] = useState([])
  const [selection, setSelection] = useState(emptySelection)
  const [filter, setFilter] = useState(emptyFilter)
  const [dialog, setDialog] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    const [categoriesResult, tagsResult, coOccurringResult] = await Promise.all([
      supabase.from('image_prompt_categories').select('category').order('category'),
      supabase.from('image_prompt_tags').select('category, tag').order('category').order('tag'),
      supabase
        .from('co_occurring_tags')
        .select('parent_category, parent_tag, child_tag')
        .order('parent_category')
        .order('parent_tag')
        .order('child_tag'),
    ])

    const error = categoriesResult.error || tagsResult.error || coOccurringResult.error
    if (error) {
      console.error('付属タグ設定データの取得に失敗しました:', error)
      setDialog({ type: 'error', message: `データの取得に失敗しました。${error.message}` })
    } else {
      setCategories(categoriesResult.data || [])
      setTags(tagsResult.data || [])
      setCoOccurringRows(coOccurringResult.data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const updateSelection = (field, value) => {
    setSelection((current) => ({
      ...current,
      [field]: value,
      ...(field === 'parent_category' ? { parent_tag: '', child_tag: '' } : {}),
      ...(field === 'parent_tag' ? { child_tag: '' } : {}),
    }))
  }

  const updateFilter = (field, value) => {
    setFilter((current) => ({
      ...current,
      [field]: value,
      ...(field === 'parent_category' ? { parent_tag: '' } : {}),
    }))
  }

  const addCoOccurringTag = async () => {
    const cleanChild = (selection.child_tag || '').trim()
    if (!selection.parent_category || !selection.parent_tag || !cleanChild) {
      setDialog({ type: 'invalid', message: 'すべての項目を入力・選択してください。' })
      return
    }

    const isDuplicate = coOccurringRows.some(
      (row) =>
        row.parent_category === selection.parent_category &&
        row.parent_tag === selection.parent_tag &&
        row.child_tag.toLowerCase() === cleanChild.toLowerCase()
    )
    if (isDuplicate) {
      setDialog({ type: 'invalid', message: 'この付属タグの組み合わせは既に登録されています。' })
      return
    }

    const { error } = await supabase.from('co_occurring_tags').insert({
      parent_category: selection.parent_category,
      parent_tag: selection.parent_tag,
      child_tag: cleanChild,
    })

    if (error) {
      setDialog({ type: 'error', message: `付属タグの追加に失敗しました。${error.message}` })
      return
    }

    // 登録後は、選択した category と tag はそのままにしておき、付属タグ入力欄のみ空白にする
    setSelection((current) => ({
      ...current,
      child_tag: '',
    }))
    await loadData()
    setDialog({ type: 'success', message: '付属タグを追加しました。' })
  }

  const deleteCoOccurringTag = async () => {
    const cleanChild = (selection.child_tag || '').trim()
    if (!selection.parent_category || !selection.parent_tag || !cleanChild) {
      setDialog({ type: 'invalid', message: '削除する付属タグを選択してください。' })
      return
    }

    const { error } = await supabase
      .from('co_occurring_tags')
      .delete()
      .eq('parent_category', selection.parent_category)
      .eq('parent_tag', selection.parent_tag)
      .eq('child_tag', cleanChild)

    if (error) {
      setDialog({ type: 'error', message: `付属タグの削除に失敗しました。${error.message}` })
      return
    }

    // 削除後も選択した category と tag はそのままにしておく
    setSelection((current) => ({
      ...current,
      child_tag: '',
    }))
    await loadData()
    setDialog({ type: 'success', message: '付属タグを削除しました。' })
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setModeOpen(false)
    setSelection(emptySelection)
  }

  const categoryOptions = categories.map(({ category }) => (
    <option key={category} value={category}>
      {category}
    </option>
  ))

  const tagsForCategory = (cat) => tags.filter((item) => item.category === cat)

  // 選択された parent_category と parent_tag に一致する co_occurring_tags の child_tag 候補一覧
  const availableChildTags = coOccurringRows.filter(
    (row) =>
      row.parent_category === selection.parent_category &&
      row.parent_tag === selection.parent_tag
  )

  const shownRows = coOccurringRows.filter((row) => {
    if (filter.parent_category && row.parent_category !== filter.parent_category) return false
    if (filter.parent_tag && row.parent_tag !== filter.parent_tag) return false
    if (filter.child_tag && !row.child_tag.toLowerCase().includes(filter.child_tag.toLowerCase())) return false
    return true
  })

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 to-emerald-100 p-4 sm:p-6">
      <section className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <Link
          href="/setting/img-gen-setting"
          className="inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          ← 画像生成の設定に戻る
        </Link>
        <h1 className="mt-5 text-3xl font-bold text-slate-800">付属タグ管理</h1>

        <div className="relative mt-6">
          <button
            onClick={() => setModeOpen(!modeOpen)}
            className="flex w-full justify-between rounded-lg border border-slate-300 bg-white px-4 py-3 font-semibold text-slate-700"
          >
            ページモード：{modes[mode]} <span>⌄</span>
          </button>
          {modeOpen && (
            <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border bg-white shadow-lg">
              {Object.entries(modes).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => switchMode(key)}
                  className="block w-full px-4 py-3 text-left hover:bg-emerald-50"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {mode === 'add' && (
          <div className="mt-8 space-y-4">
            <Select
              label="親カテゴリー (parent_category)"
              value={selection.parent_category}
              onChange={(e) => updateSelection('parent_category', e.target.value)}
              placeholder="カテゴリーを選択"
            >
              {categoryOptions}
            </Select>

            <Select
              label="親タグ (parent_tag)"
              value={selection.parent_tag}
              onChange={(e) => updateSelection('parent_tag', e.target.value)}
              placeholder="タグを選択"
              disabled={!selection.parent_category}
            >
              {tagsForCategory(selection.parent_category).map((item) => (
                <option key={item.tag} value={item.tag}>
                  {item.tag}
                </option>
              ))}
            </Select>

            <label className="block font-semibold text-slate-700">
              付属タグ (child_tag)
              <input
                type="text"
                value={selection.child_tag}
                onChange={(e) => updateSelection('child_tag', e.target.value)}
                placeholder="付属タグとして追加したいテキストを入力"
                disabled={!selection.parent_tag}
                className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500 disabled:cursor-not-allowed disabled:bg-slate-100"
              />
            </label>

            <button
              onClick={addCoOccurringTag}
              disabled={!selection.parent_category || !selection.parent_tag || !selection.child_tag.trim()}
              className="w-full rounded-lg bg-emerald-600 px-5 py-3 font-bold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              付属タグを追加
            </button>
          </div>
        )}

        {mode === 'remove' && (
          <div className="mt-8 space-y-4">
            <Select
              label="親カテゴリー (parent_category)"
              value={selection.parent_category}
              onChange={(e) => updateSelection('parent_category', e.target.value)}
              placeholder="カテゴリーを選択"
            >
              {categoryOptions}
            </Select>

            <Select
              label="親タグ (parent_tag)"
              value={selection.parent_tag}
              onChange={(e) => updateSelection('parent_tag', e.target.value)}
              placeholder="タグを選択"
              disabled={!selection.parent_category}
            >
              {tagsForCategory(selection.parent_category).map((item) => (
                <option key={item.tag} value={item.tag}>
                  {item.tag}
                </option>
              ))}
            </Select>

            <Select
              label="削除する付属タグ (child_tag)"
              value={selection.child_tag}
              onChange={(e) => updateSelection('child_tag', e.target.value)}
              placeholder="削除する付属タグを選択"
              disabled={!selection.parent_tag || availableChildTags.length === 0}
            >
              {availableChildTags.map((row) => (
                <option key={row.child_tag} value={row.child_tag}>
                  {row.child_tag}
                </option>
              ))}
            </Select>

            <button
              onClick={deleteCoOccurringTag}
              disabled={!selection.parent_category || !selection.parent_tag || !selection.child_tag}
              className="w-full rounded-lg bg-rose-600 px-5 py-3 font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              付属タグを削除
            </button>
          </div>
        )}

        {mode === 'list' && (
          <div className="mt-8">
            <div className="grid gap-4 sm:grid-cols-3">
              <Select
                label="parent_category で絞り込み"
                value={filter.parent_category}
                onChange={(e) => updateFilter('parent_category', e.target.value)}
                placeholder="すべて"
              >
                {categoryOptions}
              </Select>

              <Select
                label="parent_tag で絞り込み"
                value={filter.parent_tag}
                onChange={(e) => updateFilter('parent_tag', e.target.value)}
                placeholder="すべて"
                disabled={!filter.parent_category}
              >
                {tagsForCategory(filter.parent_category).map((item) => (
                  <option key={item.tag} value={item.tag}>
                    {item.tag}
                  </option>
                ))}
              </Select>

              <label className="block font-semibold text-slate-700">
                child_tag で検索
                <input
                  type="text"
                  value={filter.child_tag}
                  onChange={(e) => updateFilter('child_tag', e.target.value)}
                  placeholder="タグ名で絞り込み"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-emerald-500"
                />
              </label>
            </div>

            <div className="mt-5 overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[600px] text-left">
                <thead className="bg-slate-100">
                  <tr>
                    {columns.map((column) => (
                      <th key={column} className="px-4 py-3 font-semibold text-slate-700">
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="3" className="px-4 py-3 text-slate-500">
                        読み込み中...
                      </td>
                    </tr>
                  ) : shownRows.length ? (
                    shownRows.map((row) => (
                      <tr
                        key={`${row.parent_category}|${row.parent_tag}|${row.child_tag}`}
                        className="border-t hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 text-slate-800">{row.parent_category}</td>
                        <td className="px-4 py-3 text-slate-800">{row.parent_tag}</td>
                        <td className="px-4 py-3 text-slate-800">{row.child_tag}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="3" className="px-4 py-3 text-slate-500">
                        付属タグはありません。
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      {dialog && <Dialog dialog={dialog} onClose={() => setDialog(null)} />}
    </main>
  )
}

function Select({ label, value, onChange, placeholder, disabled, children }) {
  return (
    <label className="block font-semibold text-slate-700">
      {label}
      <select
        value={value}
        onChange={onChange}
        disabled={disabled}
        className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-4 py-3 disabled:cursor-not-allowed disabled:bg-slate-100"
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
    </label>
  )
}

function Dialog({ dialog, onClose }) {
  return (
    <div className="fixed inset-0 z-20 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <p className="text-lg font-semibold text-slate-800">{dialog.message}</p>
        <div className="mt-6 flex justify-end">
          <button
            onClick={onClose}
            className="rounded-lg bg-emerald-600 px-4 py-2 font-semibold text-white hover:bg-emerald-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
