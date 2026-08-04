import Link from 'next/link'

export default function Setting() {
  return (
    <main className="min-h-screen bg-gradient-to-br from-slate-100 to-indigo-100 p-6">
      <section className="mx-auto max-w-2xl rounded-2xl bg-white p-8 shadow-xl">
        <Link href="/" className="inline-flex items-center text-sm font-semibold text-indigo-600 hover:text-indigo-800">← トップに戻る</Link>
        <h1 className="mt-6 text-3xl font-bold text-slate-800">設定</h1>
        <p className="mt-2 text-slate-600">アプリの各種設定を管理します。</p>
        <Link href="/setting/img-gen-setting" className="mt-8 block rounded-xl bg-indigo-600 p-6 text-lg font-bold text-white shadow-md transition hover:bg-indigo-700">
          画像生成の設定 <span className="float-right">→</span>
        </Link>
      </section>
    </main>
  )
}
