import { Client } from "@gradio/client";
import readline from "readline";

// CLI でプロンプト入力
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

rl.question("生成したいプロンプトを入力してください：", async function(promptText) {
  try {
    const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");

    const result = await client.predict("/infer", { 		
      model: "v150",
      prompt: promptText,
      quality_prompt: promptText,
      negative_prompt: "bad quality, low resolution, blur",
      seed: 0,
      randomize_seed: true,
      width: 512,
      height: 768,
      guidance_scale: 7,
      num_inference_steps: 35,
      num_images: 1,
      use_quality: true,
    });

    console.log("\n🎉 画像生成完了！画像URL ↓");
    console.log(result.data);  // 画像URLなどが表示される
  } catch (error) {
    console.error("\n❌ エラー発生:", error);
  }

  rl.close();
});
