import Link from 'next/link'

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-indigo-500 to-purple-600 p-6">
      <div className="bg-white/90 backdrop-blur-sm p-10 rounded-2xl shadow-2xl max-w-lg w-full text-center">
        <h1 className="text-4xl font-extrabold text-gray-800 mb-8 tracking-tight">
          キャラクター管理アプリ
        </h1>
        <ul className="space-y-4">
          <li>
            <Link href="/create" className="block w-full py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:-translate-y-1">
              キャラ作成ページへ
            </Link>
          </li>
          <li>
            <Link href="/characters" className="block w-full py-3 px-6 bg-white border-2 border-indigo-600 text-indigo-600 hover:bg-indigo-50 font-semibold rounded-lg shadow-md transition duration-300 ease-in-out transform hover:-translate-y-1">
              キャラ一覧ページへ
            </Link>
          </li>
        </ul>
      </div>
    </div>
  )
}
