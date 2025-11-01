import { useState } from "react"

export default function HuggingFacePage() {
  const [prompt, setPrompt] = useState("")
  const [negativePrompt, setNegativePrompt] = useState("")
  const [image, setImage] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleGenerate = async (e) => {
    e.preventDefault()
    setLoading(true)
    setImage(null)

    try {
      const res = await fetch("/api/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          negative_prompt: negativePrompt,
          width: 512,
          height: 512,
        }),
      })

      const data = await res.json()
      if (data.image) setImage(data.image)
      else alert("画像を取得できませんでした。")
    } catch (err) {
      console.error(err)
      alert("エラーが発生しました。")
    }

    setLoading(false)
  }

  return (
    <div style={{ padding: 24, maxWidth: 600, margin: "auto" }}>
      <h1>🧠 Hugging Face AI画像生成</h1>

      <form onSubmit={handleGenerate} style={{ marginBottom: 20 }}>
        <div>
          <label>🎨 プロンプト：</label>
          <input
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="例：beautiful anime girl with blue hair"
            style={{ width: "100%", padding: 8, marginTop: 4 }}
            required
          />
        </div>

        <div style={{ marginTop: 10 }}>
          <label>🚫 ネガティブプロンプト：</label>
          <input
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="例：low quality, blurry"
            style={{ width: "100%", padding: 8, marginTop: 4 }}
          />
        </div>

        <button
          type="submit"
          style={{
            marginTop: 16,
            padding: "10px 16px",
            backgroundColor: "#4b9ce2",
            color: "white",
            border: "none",
            borderRadius: 6,
          }}
        >
          {loading ? "生成中..." : "画像を生成する"}
        </button>
      </form>

      {loading && <p>🕒 AIが画像を生成しています...</p>}

      {image && (
        <div>
          <h3>🖼️ 生成結果：</h3>
          <img
            src={image}
            alt="生成画像"
            style={{ width: "100%", borderRadius: 8, marginTop: 8 }}
          />
        </div>
      )}
    </div>
  )
}
