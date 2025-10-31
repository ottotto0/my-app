// pages/api/chat.js
import { supabase } from '../../lib/supabaseClient'   // あなたのSupabase設定に合わせてパス調整
// ❌ import fetch from 'node-fetch' ←これは不要です！

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const { character, messages } = req.body
    if (!character || !character.id) {
      return res.status(400).json({ error: 'character info is required' })
    }

    // キャラと会話履歴をもとにプロンプトを生成
    const prompt = `
あなたはキャラクター「${character.name}」です。
設定：
${character.description}

これまでの会話：
${messages.map((m) => `${m.role === 'user' ? 'ユーザー' : 'キャラ'}: ${m.message}`).join('\n')}

次のユーザー発言に対して、キャラとして自然に返答してください。
`

    // Gemini API 呼び出し
    const apiKey = process.env.GEMINI_API_KEY
    const model = 'gemini-1.5-flash'
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

    const body = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    }

    // ✅ Node18以降ではfetch標準サポート
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })

    if (!response.ok) {
      console.error('Ge
