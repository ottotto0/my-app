import { useState } from 'react'

export function categoryToColumnName(category) {
  return (category || '').trim().replace(/\s+/g, '_')
}

export function AppearanceSelector({
  categories = [],
  tagsByCategory = {},
  values = {},
  onChange,
  loading = false,
}) {
  const [isOpen, setIsOpen] = useState(true)

  const enabledCount = categories.filter((cat) => values[cat]?.enabled).length

  return (
    <div className="rounded-lg border border-gray-200 bg-white overflow-hidden shadow-sm">
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 hover:bg-gray-100 transition text-left select-none"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-gray-800">外見の特徴</span>
          <span className="text-xs text-gray-500 font-normal">
            ({enabledCount}件設定中)
          </span>
        </div>
        <span
          className={`text-gray-500 text-sm transition-transform duration-200 transform ${
            isOpen ? 'rotate-180' : ''
          }`}
        >
          ▼
        </span>
      </button>

      {isOpen && (
        <div className="p-4 border-t border-gray-200">
          {loading ? (
            <p className="text-sm text-gray-500 py-2 text-center">読み込み中...</p>
          ) : categories.length === 0 ? (
            <p className="text-sm text-gray-500 py-2 text-center">
              有効な外見カテゴリーがありません。
            </p>
          ) : (
            <div className="divide-y divide-gray-100 space-y-3">
              {categories.map((category) => {
                const isEnabled = !!values[category]?.enabled
                const selectedTag = values[category]?.tag || ''
                const availableTags = tagsByCategory[category] || []

                return (
                  <div
                    key={category}
                    className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 first:pt-0"
                  >
                    {/* ① カテゴリー名 */}
                    <div className="sm:w-1/3 min-w-[120px]">
                      <span className="text-sm font-medium text-gray-700 block truncate" title={category}>
                        {category}
                      </span>
                    </div>

                    {/* ② タグ選択（pages/setting/tag.js 準拠） */}
                    <div className="flex-1">
                      <select
                        value={selectedTag}
                        onChange={(e) => {
                          onChange(category, {
                            enabled: isEnabled,
                            tag: e.target.value,
                          })
                        }}
                        disabled={!isEnabled}
                        className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:bg-gray-100 disabled:text-gray-400"
                      >
                        <option value="">タグを選択</option>
                        {availableTags.map((item) => (
                          <option key={item} value={item}>
                            {item}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* ③ スイッチ */}
                    <div className="flex items-center justify-end gap-2 sm:w-auto">
                      <span className="text-xs text-gray-500 sm:hidden">
                        {isEnabled ? 'ON' : 'OFF'}
                      </span>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input
                          type="checkbox"
                          role="switch"
                          checked={isEnabled}
                          onChange={(e) => {
                            const nextEnabled = e.target.checked
                            onChange(category, {
                              enabled: nextEnabled,
                              tag: selectedTag,
                            })
                          }}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-gray-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                      </label>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Dialog({ dialog, onClose }) {
  if (!dialog) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <h3 className="text-base font-bold text-slate-900 mb-2">確認</h3>
        <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{dialog.message}</p>
        <div className="mt-6 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  )
}
