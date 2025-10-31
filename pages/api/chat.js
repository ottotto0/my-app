// pages/api/chat.js
import { supabase } from '../../lib/supabaseClient'   // 既に設定してあるSupabaseクライアント
import fetch from 'node-fetch'                         // Node環境で fetch を使う場合
// または axios を使いたい場合： import axios from 'axios'

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const { character, messages } = req.body
    if (!character || !character.id) {
      return res.status(400).json({ error: 'character info is required' })
    }
    // プロンプト生成
    const prompt = `
あなたはキャラクター「${character.name}」です。
設定：
${character.description}

これまでの会話：
${messages.map((m) => `${m.role === 'user' ? 'ユーザー' : 'キャラ'}: ${m.message}`).join('\n')}

次のユーザー発言に対して、キャラとして自然に返答してください。
`
    // Gemini API 呼び出し（REST形式）
    const apiKey = process.env.GEMINI_API_KEY
    const model = 'gemini-1.5-flash'   // モデル名は必要に応じて変更
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const body = {
      contents: [
        {
          role: 'user',
          parts: [
            { text: prompt }
          ]
        }
      ],
      // 必要に応じて generationConfig 等追加可能
    }

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      console.error('Gemini API non-ok status:', response.status, await response.text())
      return res.status(500).json({ reply: '(AIの返答が取得できませんでした)' })
    }

    const data = await response.json()
    console.log('Gemini API response:', JSON.stringify(data, null, 2))

    // レスポンス処理：返答取得
    const reply = data?.candidates?.[0]?.content?.parts?.[0]?.text
                  || data?.candidates?.[0]?.output_text
                  || '(AIの返答が取得できませんでした)'

    // 会話履歴を保存（Supabase更新）
    const newRecords = [
      ...messages,
      { role: 'character', message: reply }
    ]
    const { error: sbError } = await supabase
      .from('characters')
      .update({ records: JSON.stringify(newRecords) })
      .eq('id', character.id)

    if (sbError) {
      console.error('Supabase update error:', sbError)
      // ここは必ずしもユーザーに知らせず、ログに留めておく設計も可
    }

    // レスポンス返却
    return res.status(200).json({ reply })

  } catch (error) {
    console.error('API handler error:', error)
    return res.status(500).json({ reply: '(サーバーエラーが発生しました)' })
  }
}
