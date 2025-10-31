// lib/geminiClient.js
import fetch from 'node-fetch';  // or built-in fetch in newer node

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const GEMINI_API_URL = 'https://genai.googleapis.com/v1/models/gemini-pro:generateContent';  // 例／モデル名は適宜

export async function askGemini(prompt, conversationHistory = []) {
  // 会話履歴 +新プロンプトを使ってジェミニへ
  const fullPrompt = [
    ...conversationHistory,
    { role: 'user', content: prompt }
  ];
  
  const body = {
    prompt: {
      messages: fullPrompt
    },
    model: 'gemini-pro',  // 実際のモデル名やバージョンを確認してね
    maxTokens: 512
  };
  
  const response = await fetch(GEMINI_API_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': GEMINI_API_KEY
    },
    body: JSON.stringify(body)
  });
  
  const json = await response.json();
  // レスポンス構造は API リファレンスに要確認 :contentReference[oaicite:2]{index=2}
  const content = json.choices?.[0]?.message?.content;
  return content;
}
