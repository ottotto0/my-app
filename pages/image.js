"use client";
import React, { useState } from "react";
import { Client } from "@gradio/client";

export default function ImageGenerator() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageUrl, setImageUrl] = useState(null);
  const [log, setLog] = useState([]);

  const generateImage = async () => {
    setLoading(true);
    setImageUrl(null);
    setLog([]);

    try {
      // ✅ Hugging Face トークンを使って接続（Renderの環境変数から）
      const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140", {
        hf_token: process.env.NEXT_PUBLIC_HF_TOKEN || process.env.HF_TOKEN,
      });
      setLog((prev) => [...prev, "🔑 Connected to Hugging Face Space"]);

      // 1️⃣ プリセット適用
      let result = await client.predict("/_apply_preset_ui", {
        preset: "768×768 (square)",
      });
      setLog((prev) => [...prev, "✅ Preset applied"]);

      // 2️⃣ リスケール設定
      result = await client.predict("/toggle_rescale", {
        no_rescale: true,
      });
      setLog((prev) => [...prev, "✅ Rescale toggled"]);

      // 3️⃣ 翻訳ON
      result = await client.predict("/toggle_translate", {
        on: true,
      });
      setLog((prev) => [...prev, "✅ Translation enabled"]);

      // 4️⃣ 画像生成（main inference）
      result = await client.predict("/infer", {
        model: "v150",
        prompt: prompt,
        quality_prompt: "masterpiece, best quality, fine details",
        negative_prompt: "low quality, bad anatomy",
        seed: 0,
        randomize_seed: true,
        width: 512,
        height: 512,
        guidance_scale: 7,
        num_inference_steps: 25,
        num_images: 1,
        use_quality: true,
      });

      setLog((prev) => [...prev, "✅ Inference complete"]);

      // 5️⃣ 結果画像の取得（URL or Base64）
      let imageData = null;

      // Gradioが返す形式を両対応
      if (Array.isArray(result.data)) {
        const possibleImage = result.data.find((d) => typeof d === "string" && (d.startsWith("http") || d.startsWith("data:image")));
        imageData = possibleImage || result.data?.[0]?.url || result.data?.[0];
      } else if (typeof result.data === "string") {
        imageData = result.data;
      }

      if (imageData) {
        setImageUrl(imageData);
        setLog((prev) => [...prev, "🖼️ Image loaded successfully"]);
      } else {
        setLog((prev) => [...prev, "⚠️ No image data found in response"]);
      }
    } catch (err) {
      console.error(err);
      setLog((prev) => [...prev, `❌ Error: ${err.message}`]);
    }

    setLoading(false);
  };

  return (
    <div className="p-6 flex flex-col items-center gap-4">
      <h1 className="text-2xl font-bold mb-4">🪄 Hugging Face Image Generator</h1>

      <input
        type="text"
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="プロンプトを入力してください（例：1girl, detailed eyes, fantasy light）"
        className="border p-2 w-80 rounded text-center"
      />

      <button
        onClick={generateImage}
        disabled={loading}
        className="px-4 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600 disabled:opacity-50"
      >
        {loading ? "生成中..." : "画像を生成する"}
      </button>

      {imageUrl && (
        <div className="mt-6">
          <h2 className="font-semibold mb-2">🖼️ 生成結果：</h2>
          <img
            src={imageUrl}
            alt="Generated"
            className="rounded-lg shadow-md border w-[512px] h-[512px] object-cover"
          />
          <a
            href={imageUrl}
            download="generated_image.png"
            className="block mt-3 text-blue-600 hover:underline text-sm"
          >
            💾 画像をダウンロード
          </a>
        </div>
      )}

      <div className="mt-6 w-full max-w-lg text-left bg-gray-100 p-3 rounded text-sm overflow-auto max-h-64">
        <h3 className="font-semibold mb-2">📜 実行ログ：</h3>
        {log.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  );
}
