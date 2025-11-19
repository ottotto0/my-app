// /pages/api/generate.js
import { generateImage } from "../../lib/seaart";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST only" });
  }

  const { prompt } = req.body;

  try {
    const url = await generateImage(prompt);
    res.status(200).json({ imageUrl: url });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "画像生成に失敗しました" });
  }
}
