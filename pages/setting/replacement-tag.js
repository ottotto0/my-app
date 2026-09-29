import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '../../lib/supabaseClient'

const modes = {
  add: '置き換えタグ追加',
  remove: '置き換えタグ削除',
  list: '置き換えタグ一覧',
}

const emptySelection = {
  before_category: '',
  before_tag: '',
  after_category: '',
  after_tag: '',
}

const emptyFilter = {
  before_category: '',
  before_tag: '',
  after_category: '',
  after_tag: '',
}

const columns = [
  { key: 'before_category', label: '置き換え前カテゴリー' },
  { key: 'before_tag', label: '置き換え前タグ' },
  { key: 'after_category', label: '置き換え後カテゴリー' },
  { key: 'after_tag', label: '置き換え後タグ' },
]

export default function ReplacementTagPage() {
  const [mode, setMode] = useState('add')
  const [modeOpen, setModeOpen] = useState(false)
  const [tags, setTags] = useState([])
  const [replacementRows, setReplacementRows] = useState([])
  const [addSelection, setAddSelection] = useState(emptySelection)
  const [deleteSelection, setDeleteSelection] = useState(emptySelection)
  const [filter, setFilter] = useState(emptyFilter)
  const [dialog, setDialog] = useState(null)
  const [loading, setLoading] = useState(true)

  const loadData = async () => {
    setLoading(true)
    const [tagsResult, replacementResult] = await Promise.all([
      supabase.from('image_prompt_tags').select('category, tag').order('category').order('tag'),
      supabase
        .from('replacement_tags')
        .select('before_category, before_tag, after_category, after_tag')
        .order('before_category')
        .order('before_tag')
        .order('after_category')
        .order('after_tag'),
    ])

    const error = tagsResult.error || replacementResult.error
    if (error) {
      console.error('置き換えタグ設定データの取得に失敗しました:', error)
      setDialog({ type: 'error', message: `データの取得に失敗しました。${error.message}` })
    } else {
      setTags(tagsResult.data || [])
      setReplacementRows(replacementResult.data || [])
    }
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  // 追加フォーム用の選択ハンドラ
  const updateAddSelection = (field, value) => {
    setAddSelection((current) => ({
      ...current,
      [field]: value,
      ...(field === 'before_category' ? { before_tag: '' } : {}),
      ...(field === 'after_category' ? { after_tag: '' } : {}),
    }))
  }

  // 削除フォーム用の選択ハンドラ（カスケードリセット）
  const updateDeleteSelection = (field, value) => {
    setDeleteSelection((current) => ({
      ...current,
      [field]: value,
      ...(field === 'before_category' ? { before_tag: '', after_category: '', after_tag: '' } : {}),
      ...(field === 'before_tag' ? { after_category: '', after_tag: '' } : {}),
      ...(field === 'after_category' ? { after_tag: '' } : {}),
    }))
  }

  // 一覧フィルター用のハンドラ
  const updateFilter = (field, value) => {
    setFilter((current) => ({
      ...current,
      [field]: value,
    }))
  }

  const switchMode = (nextMode) => {
    setMode(nextMode)
    setModeOpen(false)
    setAddSelection(emptySelection)
    setDeleteSelection(emptySelection)
  }

  // 追加用: image_prompt_tags から一意なカテゴリーリスト
  const availableCategories = Array.from(new Set(tags.map((item) => item.category))).filter(Boolean)

  const tagsForAddBeforeCategory = tags.filter((item) => item.category === addSelection.before_category)
  const tagsForAddAfterCategory = tags.filter((item) => item.category === addSelection.after_category)

  // 削除用: replacement_tags テーブル内のカスケード候補
  const deleteBeforeCategories = Array.from(
    new Set(replacementRows.map((row) => row.before_category))
  ).filter(Boolean)

  const deleteBeforeTags = Array.from(
    new Set(
      replacementRows
        .filter((row) => row.before_category === deleteSelection.before_category)
        .map((row) => row.before_tag)
    )
  ).filter(Boolean)

  const deleteAfterCategories = Array.from(
    new Set(
      replacementRows
        .filter(
          (row) =>
            row.before_category === deleteSelection.before_category &&
            row.before_tag === deleteSelection.before_tag
        )
        .map((row) => row.after_category)
    )
  ).filter(Boolean)

  const deleteAfterTags = Array.from(
    new Set(
      replacementRows
        .filter(
          (row) =>
            row.before_category === deleteSelection.before_category &&
            row.before_tag === deleteSelection.before_tag &&
            row.after_category === deleteSelection.after_category
        )
        .map((row) => row.after_tag)
    )
  ).filter(Boolean)

  // 追加処理
  const addReplacementTag = async () => {
    const { before_category, before_tag, after_category, after_tag } = addSelection
    if (!before_category || !before_tag || !after_category || !after_tag) {
      setDialog({ type: 'invalid', message: 'すべての項目を選択してください。' })
      return
    }

    const isDuplicate = replacementRows.some(
      (row) =>
        row.before_category === before_category &&
        row.before_tag === before_tag &&
        row.after_category === after_category &&
        row.after_tag === after_tag
    )
    if (isDuplicate) {
      setDialog({ type: 'invalid', message: 'この置き換えタグの組み合わせは既に登録されています。' })
      return
    }

    const { error } = await supabase.from('replacement_tags').insert({
      before_category,
      before_tag,
      after_category,
      after_tag,
    })

    if (error) {
      setDialog({ type: 'error', message: `置き換えタグの追加に失敗しました。${error.message}` })
      return
    }

    setAddSelection(emptySelection)
    await loadData()
    setDialog({ type: 'success', message: '置き換えタグを追加しました。' })
  }

  // 削除処理
  const deleteReplacementTag = async () => {
    const { before_category, before_tag, after_category, after_tag } = deleteSelection
    if (!before_category || !before_tag || !after_category || !after_tag) {
      setDialog({ type: 'invalid', message: '削除する置き換えタグの項目をすべて選択してください。' })
      return
    }

    const { error } = await supabase
      .from('replacement_tags')
      .delete()
      .eq('before_category', before_category)
      .eq('before_tag', before_tag)
      .eq('after_category', after_category)
      .eq('after_tag', after_tag)

    if (error) {
      setDialog({ type: 'error', message: `置き換えタグの削除に失敗しました。${error.message}` })
      return
    }

    setDeleteSelection(emptySelection)
    await loadData()
    setDialog({ type: 'success', message: '置き換えタグを削除しました。' })
  }

  // 一覧フィルター処理
  const shownRows = replacementRows.filter((row) => {
    if (filter.before_category && row.before_category !== filter.before_category) return false
    if (
      filter.before_tag &&
      !row.before_tag.toLowerCase().includes(filter.before_tag.toLowerCase().trim())
    )
      return false
    if (filter.after_category && row.after_category !== filter.after_category) return false
    if (
      filter.after_tag &&
      !row.after_tag.toLowerCase().includes(filter.after_tag.toLowerCase().trim())
    )
      return false
    return true
  })

  // フィルター用のユニークカテゴリー候補（登録データから抽出）
  const filterBeforeCategories = Array.from(
    new Set(replacementRows.map((row) => row.before_category))
  ).filter(Boolean)
  const filterAfterCategories = Array.from(
    new Set(replacementRows.map((row) => row.after_category))
  ).filter(Boolean)

  const isAddDisabled =
    !addSelection.before_category ||
    !addSelection.before_tag ||
    !addSelection.after_category ||
    !addSelection.after_tag

  const isDeleteDisabled =
    !deleteSelection.before_category ||
    !deleteSelection.before_tag ||
    !deleteSelection.after_category ||
    !deleteSelection.after_tag

  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 to-amber-100 p-4 sm:p-6">
      <section className="mx-auto max-w-5xl rounded-2xl bg-white p-6 shadow-xl sm:p-8">
        <Link
          href="/setting/img-gen-setting"
          className="inline-flex text-sm font-semibold text-indigo-600 hover:text-indigo-800"
        >
          ← 画像生成の設定に戻る
        </Link>
        <h1 className="mt-5 text-3xl font-bold text-slate-800">置き換えタグ管理</h1>

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
                  className="block w-full px-4 py-3 text-left hover:bg-amber-50"
                >
                  {label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* 追加モード */}
        {mode === 'add' && (
          <div className="mt-8 space-y-4">
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <h2 className="mb-3 text-base font-bold text-amber-900">置き換え前</h2>
              <div className="space-y-4">
                <Select
                  label="置き換え前のカテゴリー (before_category)"
                  value={addSelection.before_category}
                  onChange={(e) => updateAddSelection('before_category', e.target.value)}
                  placeholder="カテゴリーを選択"
                >
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Select>

                <Select
                  label="置き換え前のタグ (before_tag)"
                  value={addSelection.before_tag}
                  onChange={(e) => updateAddSelection('before_tag', e.target.value)}
                  placeholder="タグを選択"
                  disabled={!addSelection.before_category}
                >
                  {tagsForAddBeforeCategory.map((item) => (
                    <option key={item.tag} value={item.tag}>
                      {item.tag}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <div className="rounded-lg border border-amber-200 bg-amber-50/50 p-4">
              <h2 className="mb-3 text-base font-bold text-amber-900">置き換え後</h2>
              <div className="space-y-4">
                <Select
                  label="置き換え後のカテゴリー (after_category)"
                  value={addSelection.after_category}
                  onChange={(e) => updateAddSelection('after_category', e.target.value)}
                  placeholder="カテゴリーを選択"
                >
                  {availableCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </Select>

                <Select
                  label="置き換え後のタグ (after_tag)"
                  value={addSelection.after_tag}
                  onChange={(e) => updateAddSelection('after_tag', e.target.value)}
                  placeholder="タグを選択"
                  disabled={!addSelection.after_category}
                >
                  {tagsForAddAfterCategory.map((item) => (
                    <option key={item.tag} value={item.tag}>
                      {item.tag}
                    </option>
                  ))}
                </Select>
              </div>
            </div>

            <button
              onClick={addReplacementTag}
              disabled={isAddDisabled}
              className="w-full rounded-lg bg-amber-600 px-5 py-3 font-bold text-white hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              置き換えタグを追加
            </button>
          </div>
        )}

        {/* 削除モード */}
        {mode === 'remove' && (
          <div className="mt-8 space-y-4">
            <Select
              label="1. 置き換え前のカテゴリー (before_category)"
              value={deleteSelection.before_category}
              onChange={(e) => updateDeleteSelection('before_category', e.target.value)}
              placeholder="置き換え前カテゴリーを選択"
            >
              {deleteBeforeCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>

            <Select
              label="2. 置き換え前のタグ (before_tag)"
              value={deleteSelection.before_tag}
              onChange={(e) => updateDeleteSelection('before_tag', e.target.value)}
              placeholder="置き換え前タグを選択"
              disabled={!deleteSelection.before_category}
            >
              {deleteBeforeTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </Select>

            <Select
              label="3. 置き換え後のカテゴリー (after_category)"
              value={deleteSelection.after_category}
              onChange={(e) => updateDeleteSelection('after_category', e.target.value)}
              placeholder="置き換え後カテゴリーを選択"
              disabled={!deleteSelection.before_tag}
            >
              {deleteAfterCategories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </Select>

            <Select
              label="4. 置き換え後のタグ (after_tag)"
              value={deleteSelection.after_tag}
              onChange={(e) => updateDeleteSelection('after_tag', e.target.value)}
              placeholder="置き換え後タグを選択"
              disabled={!deleteSelection.after_category}
            >
              {deleteAfterTags.map((tag) => (
                <option key={tag} value={tag}>
                  {tag}
                </option>
              ))}
            </Select>

            <button
              onClick={deleteReplacementTag}
              disabled={isDeleteDisabled}
              className="w-full rounded-lg bg-rose-600 px-5 py-3 font-bold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:bg-slate-300"
            >
              置き換えタグを削除
            </button>
          </div>
        )}

        {/* 一覧モード */}
        {mode === 'list' && (
          <div className="mt-8">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Select
                label="before_category で絞り込み"
                value={filter.before_category}
                onChange={(e) => updateFilter('before_category', e.target.value)}
                placeholder="すべて"
              >
                {filterBeforeCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>

              <label className="block font-semibold text-slate-700">
                before_tag で検索
                <input
                  type="text"
                  value={filter.before_tag}
                  onChange={(e) => updateFilter('before_tag', e.target.value)}
                  placeholder="タグ名で検索"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500"
                />
              </label>

              <Select
                label="after_category で絞り込み"
                value={filter.after_category}
                onChange={(e) => updateFilter('after_category', e.target.value)}
                placeholder="すべて"
              >
                {filterAfterCategories.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </Select>

              <label className="block font-semibold text-slate-700">
                after_tag で検索
                <input
                  type="text"
                  value={filter.after_tag}
                  onChange={(e) => updateFilter('after_tag', e.target.value)}
                  placeholder="タグ名で検索"
                  className="mt-2 w-full rounded-lg border border-slate-300 px-4 py-3 outline-none focus:border-amber-500"
                />
              </label>
            </div>

            <div className="mt-5 overflow-x-auto rounded-lg border">
              <table className="w-full min-w-[700px] text-left">
                <thead className="bg-slate-100">
                  <tr>
                    {columns.map((column) => (
                      <th key={column.key} className="px-4 py-3 font-semibold text-slate-700">
                        {column.label}
                        <span className="block text-xs font-normal text-slate-500">{column.key}</span>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="4" className="px-4 py-3 text-slate-500">
                        読み込み中...
                      </td>
                    </tr>
                  ) : shownRows.length ? (
                    shownRows.map((row, idx) => (
                      <tr
                        key={`${row.before_category}|${row.before_tag}|${row.after_category}|${row.after_tag}|${idx}`}
                        className="border-t hover:bg-slate-50"
                      >
                        <td className="px-4 py-3 text-slate-800">{row.before_category}</td>
                        <td className="px-4 py-3 text-slate-800">{row.before_tag}</td>
                        <td className="px-4 py-3 text-slate-800">{row.after_category}</td>
                        <td className="px-4 py-3 text-slate-800">{row.after_tag}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="4" className="px-4 py-3 text-slate-500">
                        置き換えタグはありません。
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
            className="rounded-lg bg-amber-600 px-4 py-2 font-semibold text-white hover:bg-amber-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
