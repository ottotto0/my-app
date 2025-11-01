// image.js
import { Client } from "@gradio/client";

/**
 * waiNSFWIllustrious_v140 の Gradio API に接続して
 * 一連のテスト呼び出しを実行するスクリプト
 */
async function main() {
  try {
    console.log("🔗 Connecting to Gradio client...");
    const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");
    console.log("✅ Connected!\n");

    // 1️⃣ apply preset
    console.log("▶ Applying preset...");
    let result = await client.predict("/_apply_preset_ui", {
      preset: "768×768 (square)",
    });
    console.log("✅ Preset applied:", result.data, "\n");

    // 2️⃣ toggle rescale
    console.log("▶ Toggling rescale...");
    result = await client.predict("/toggle_rescale", { no_rescale: true });
    console.log("✅ Rescale toggled:", result.data, "\n");

    // 3️⃣ toggle translate
    console.log("▶ Enabling translation...");
    result = await client.predict("/toggle_translate", { on: true });
    console.log("✅ Translation enabled:", result.data, "\n");

    // 4️⃣ move prompt
    console.log("▶ Moving prompt...");
    result = await client.predict("/move_prompt_to_non_english", {
      prompt_text: "Hello!!",
    });
    console.log("✅ Prompt moved:", result.data, "\n");

    // 5️⃣ compute token count
    console.log("▶ Computing token count...");
    result = await client.predict("/compute_token_count", {
      prompt: "Hello!!",
      quality_prompt: "Hello!!",
      use_quality: true,
    });
    console.log("✅ Token count computed:", result.data, "\n");

    // 6️⃣ 最後に生成（例）
    console.log("▶ Generating image...");
    result = await client.predict("/generate", {
      prompt: "a cute anime girl with blonde hair and blue eyes, detailed lighting",
      negative_prompt: "low quality, blurry",
      width: 768,
      height: 768,
      steps: 20,
      cfg_scale: 7,
      sampler: "Euler a",
      seed: 42,
    });

    // 画像データを取得
    const output = result?.data?.[0]?.url || null;
    console.log("✅ Image generated!\n🖼️ URL:", output);

  } catch (err) {
    console.error("❌ Error during Gradio call:", err);
  }
}

// Node.js または Next.js edge runtime 対応
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export default main;
