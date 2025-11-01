import { useState } from "react";
import { Client } from "@gradio/client";

export default function HuggingFacePage() {
  const [prompt, setPrompt] = useState("");
  const [negativePrompt, setNegativePrompt] = useState("");
  const [imageUrl, setImageUrl] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleGenerate = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setImageUrl(null);

    try {
      // Hugging Faceクライアントに接続
      const client = await Client.connect("frogleo/anime-ai-generator");

      // API呼び出し
      const result = await client.predict("/generate", {
        prompt: prompt || "anime girl",
        negative_prompt: negativePrompt || "",
        width: 512,
        height: 512,
        scheduler: "DPM++ 2M Karras",
        opt_strength: 0,
        opt_scale: 1,
        seed: 0,
        randomize_seed: true,
        guidance_scale: 1,
        num_inference_steps: 20,
      });

      console.log("✅ Hugging Face Response:", result);

      // 画像URLを取得
      const output = result?.data?.[0]?.url || result?.data?.[0];
      setImageUrl(output);
    } catch (err) {
      console.error("❌ Error generating image:", err);
      setError("画像生成に失敗しました。時間をおいて再試行してください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 32, maxWidth: 700, margin: "auto", textAlign: "center" }}>
      <h1>🎨 Anime AI Generator</h1>
      <p>Hugging Faceの「frogleo/anime-ai-generator」を利用して画像生成します。</p>

      <form onSubmit={handleGenerate} style={{ marginTop: 20 }}>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="プロンプト（例: cute anime girl, blue hair）"
            style={{ width: "100%", padding: 10 }}
          />
        </div>
        <div style={{ marginBottom: 12 }}>
          <input
            type="text"
            value={negativePrompt}
            onChange={(e) => setNegativePrompt(e.target.value)}
            placeholder="ネガティブプロンプト（例: low quality, blurry）"
            style={{ width: "100%", padding: 10 }}
          />
        </div>
        <button
          type="submit"
          style={{
            background: "#007bff",
            color: "white",
            padding: "10px 16px",
            borderRadius: 6,
            border: "none",
          }}
          disabled={loading}
        >
          {loading ? "生成中..." : "画像を生成"}
        </button>
      </form>

      {error && <p style={{ color: "red", marginTop: 20 }}>{error}</p>}

      {imageUrl && (
        <div style={{ marginTop: 24 }}>
          <h3>🖼️ 生成結果</h3>
          <img
            src={imageUrl}
            alt="生成画像"
            style={{
              maxWidth: "100%",
              borderRadius: 10,
              boxShadow: "0 0 10px rgba(0,0,0,0.2)",
            }}
          />
        </div>
      )}
    </div>
  );
}
