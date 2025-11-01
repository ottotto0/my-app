// pages/api/generate-image.js
import { Client } from "@gradio/client"

export default async function handler(req, res) {
  try {
    const { prompt, negative_prompt, width, height } = req.body

    // ✅ 認証付きで接続
    const client = await Client.connect("frogleo/anime-ai-generator", {
      hf_token: process.env.HF_TOKEN
    })

    const result = await client.predict("/generate", {
      prompt: prompt || "1girl, best quality, masterpiece",
      negative_prompt: negative_prompt || "lowres, blurry, bad anatomy",
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

    res.status(200).json({ image: result?.data?.[0] || null })
  } catch (error) {
    console.error("❌ Error generating image:", error)
    res.status(500).json({ error: error.message })
  }
}
