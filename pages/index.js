import Link from 'next/link'

export default function Home() {
  return (
    <div style={{ padding: 24 }}>
      <h1>キャラクター管理アプリ</h1>
      <ul>
        <li><Link href="/create">キャラ作成ページへ</Link></li>
        <li><Link href="/characters">キャラ一覧ページへ</Link></li>
      </ul>
    </div>
  )
}
