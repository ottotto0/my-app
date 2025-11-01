import { useState } from 'react'
import { Client } from '@gradio/client'

export default function AnimeGenerator() {
  const [prompt, setPrompt] = useState('')
  const [negativePrompt, setNegativePrompt] = useState('')
  const [imageUrl, setImageUrl] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)

  const handleGenerate = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    setImageUrl(null)

    try {
      // Hugging Face API へ接続
      const client = await Client.connect("frogleo/anime-ai-generator", {
        token: process.env.HUGGINGFACE_TOKEN, 
      })

      // 推論リクエスト
      const result = await client.predict("/generate", {
        prompt,
        negative_prompt: negativePrompt,
        width: 512,
        height: 512,
        scheduler: "DPM++ 2M Karras",
        opt_strength: 0,
        opt_scale: 1,
        seed: 0,
        randomize_seed: true,
        guidance_scale: 1,
        num_inference_steps: 30,
      })

      console.log("🔍 Response:", result)

      // 出力画像URLを取得
      const output = result.data[0]
      if (output && output.url) {
        setImageUrl(output.url)
      } else if (typeof output === "string") {
        // stringの場合も想定
        setImageUrl(output)
      } else {
        setError("画像が取得できませんでした。")
      }
    } catch (err) {
      console.error(err)
      setError("画像生成に失敗しました。")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ maxWidth: 700, margin: '40px auto', textAlign: 'center' }}>
      <h2>🎨 アニメAI画像ジェネレーター</h2>

      <form onSubmit={handleGenerate} style={{ marginBottom: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="生成したい内容を入力（例：青髪の少女、桜の下で笑う）"
            style={{ width: '90%', padding: 10 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="除外したい内容（例：ぼやけ、歪みなど）"
            style={{ width: '90%', padding: 10 }}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '10px 20px',
            backgroundColor: '#4CAF50',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          {loading ? '生成中...' : '画像を生成'}
        </button>
      </form>

      {error && <div style={{ color: 'red' }}>{error}</div>}

      {imageUrl && (
        <div style={{ marginTop: 20 }}>
          <img
            src={imageUrl}
            alt="生成画像"
            style={{ maxWidth: '100%', borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' }}
          />
          <p style={{ fontSize: 12, color: '#555' }}>生成プロンプト：{prompt}</p>
        </div>
      )}
    </div>
  )
}
