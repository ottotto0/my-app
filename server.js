import express from "express";
import { Client } from "@gradio/client";
import fetch from "node-fetch";  // 画像保存用

const app = express();
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

// トップページ（プロンプト入力フォーム）
app.get("/", (req, res) => {
  res.send(`
    <h2>プロンプトで画像生成</h2>
    <form action="/generate" method="POST">
      <input type="text" name="prompt" placeholder="プロンプトを入力" style="width:300px" />
      <button type="submit">生成</button>
    </form>
  `);
});

// 画像生成処理
app.post("/generate", async (req, res) => {
  const prompt = req.body.prompt || "Hello!";
  
  try {
    // Hugging Face Gradio モデルに接続
    const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");
    
    const result = await client.predict("/infer", { 		
      model: "v150",
      prompt: prompt,
      quality_prompt: prompt,
      negative_prompt: "bad quality, low resolution, blur",
      seed: 0,
      randomize_seed: true,
      width: 512,
      height: 512,
      guidance_scale: 7,
      num_inference_steps: 35,
      num_images: 1,
      use_quality: true,
    });

    // 結果のURLを取得
    const imageUrl = result.data[0];

    // 画像表示
    res.send(`
      <h2>生成完了！</h2>
      <img src="${imageUrl}" style="max-width:500px" />
      <br><br>
      <a href="/">戻る</a>
    `);

  } catch (err) {
    console.error(err);
    res.send("画像生成でエラーが発生しました");
  }
});

// サーバー起動
app.listen(3000, () => {
  console.log("http://localhost:3000 で起動中");
});
