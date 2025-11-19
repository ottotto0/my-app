"use client";

import { useState } from "react";
import { Client } from "@gradio/client";

export default function TestClient() {
  const [prompt, setPrompt] = useState("");
  const [status, setStatus] = useState("");
  const [imgUrl, setImgUrl] = useState("");

  async function runGenerate() {
    if (!prompt) {
      setStatus("プロンプトを入力してください。");
      return;
    }

    setStatus("生成中…");

    try {
      const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");

      const result = await client.predict("/infer", {
        model: "v150",
        prompt,
        quality_prompt: prompt,
        negative_prompt: "",
        seed: 0,
        randomize_seed: true,
        width: 512,
        height: 512,
        guidance_scale: 5,
        num_inference_steps: 20,
        num_images: 1,
        use_quality: true,
      });

      const blob = result.data[0];
      const url = URL.createObjectURL(blob);
      setImgUrl(url);
      setStatus("生成完了！");

    } catch (err) {
      console.error(err);
      setStatus("エラー：詳しくはコンソールへ");
    }
  }

  return (
    <div style={{ width: "100%", maxWidth: "480px", margin: "40px auto" }}>
      <h2>画像生成テスト</h2>

      <input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder="プロンプト"
        style={{ width: "100%", padding: "10px", fontSize: "16px" }}
      />

      <button
        onClick={runGenerate}
        style={{
          marginTop: "10px",
          padding: "10px 20px",
          fontSize: "16px",
          cursor: "pointer",
        }}
      >
        生成
      </button>

      <p>{status}</p>

      {imgUrl && (
        <img
          src={imgUrl}
          style={{ marginTop: "20px", width: "100%" }}
        />
      )}
    </div>
  );
}
