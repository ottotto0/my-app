// /pages/index.js
import { useState } from "react";

export default function Home() {
  const [prompt, setPrompt] = useState("");
  const [image, setImage] = useState("");
  const [loading, setLoading] = useState(false);

  async function generate() {
    setLoading(true);
    setImage("");

    const res = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt })
    });

    const data = await res.json();
    setLoading(false);

    if (data.imageUrl) {
      setImage(data.imageUrl);
    }
  }

  return (
    <div style={{ padding: "40px" }}>
      <h1>SeaArt 自動生成</h1>

      <textarea
        rows={4}
        style={{ width: "100%", fontSize: "16px" }}
        placeholder="プロンプトを入力..."
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />

      <button
        onClick={generate}
        style={{ marginTop: "10px", padding: "10px 20px", fontSize: "16px" }}
      >
        生成開始
      </button>

      {loading && <p>生成中…（40〜110秒ほど）</p>}

      {image && (
        <div style={{ marginTop: "20px" }}>
          <h2>生成結果</h2>
          <img src={image} style={{ maxWidth: "100%" }} />
        </div>
      )}
    </div>
  );
}
