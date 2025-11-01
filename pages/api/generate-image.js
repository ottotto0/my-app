// pages/api/generate-image.js
import { Client } from "@gradio/client"

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" })
  }

  try {
    const { prompt, negative_prompt, width, height } = req.body

    // Hugging Face Spaceに接続
    const client = await Client.connect("frogleo/anime-ai-generator")

    // 修正版: より安定したパラメータで呼び出し
    const result = await client.predict("/generate", {
      prompt: prompt || "1girl, beautiful, detailed eyes, masterpiece, best quality",
      negative_prompt: negative_prompt || "low quality, blurry, bad anatomy",
      width: width || 512,
      height: height || 512,
      scheduler: "DPM++ 2M Karras",
      opt_strength: 0.65,
      opt_scale: 1,
      seed: 0,
      randomize_seed: true,
      guidance_scale: 7.5,
      num_inference_steps: 25,
    })

    console.log("✅ Hugging Face Response:", result.data)

    const imageData = result?.data?.[0] || null

    if (!imageData) {
      throw new Error("画像データが返ってきませんでした。")
    }

    res.status(200).json({ image: imageData })
  } catch (error) {
    console.error("❌ Error generating image:", error)
    res.status(500).json({ error: error.message })
  }
}
