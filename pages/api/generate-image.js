// pages/api/generate-image.js
import { Client } from "@gradio/client"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { prompt, negative_prompt, width, height } = req.body

    // Hugging Faceのclientを接続
    const client = await Client.connect("frogleo/anime-ai-generator")

    // API呼び出し
    const result = await client.predict("/generate", {
      prompt: prompt || "anime girl",
      negative_prompt: negative_prompt || "",
      width: width || 512,
      height: height || 512,
      scheduler: "DPM++ 2M Karras",
      opt_strength: 0,
      opt_scale: 1,
      seed: 0,
      randomize_seed: true,
      guidance_scale: 1,
      num_inference_steps: 1,
    })

    // 結果データ（画像URL or base64）
    const imageData = result.data?.[0] || null

    res.status(200).json({ image: imageData })
  } catch (error) {
    console.error("❌ Error generating image:", error)
    res.status(500).json({ error: error.message })
  }
}
