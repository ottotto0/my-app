import Link from 'next/link'

export default function ImageGenerationSetting() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 to-indigo-100 p-6">
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-xl">
        <Link href="/setting/setting" className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800">← 設定に戻る</Link>
        <h1 className="mt-6 text-3xl font-bold text-slate-800">画像生成の設定</h1>
        <p className="mt-2 text-slate-600">画像生成プロンプトで使うカテゴリーとタグを管理します。</p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <Link href="/setting/category" className="rounded-xl border-2 border-indigo-200 bg-indigo-50 p-6 font-bold text-indigo-800 transition hover:border-indigo-500 hover:bg-indigo-100">カテゴリーを管理 <span className="float-right">→</span></Link>
          <Link href="/setting/tag" className="rounded-xl border-2 border-purple-200 bg-purple-50 p-6 font-bold text-purple-800 transition hover:border-purple-500 hover:bg-purple-100">タグを管理 <span className="float-right">→</span></Link>
        </div>
      </section>
    </main>
  )
}
