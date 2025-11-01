import { Client } from "@gradio/client";

async function runAll() {
  const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");

  // 1️⃣ Apply preset
  let result = await client.predict("/_apply_preset_ui", { preset: "768×768 (square)" });
  console.log("preset:", result.data);

  // 2️⃣ Toggle rescale
  result = await client.predict("/toggle_rescale", { no_rescale: true });
  console.log("toggle_rescale:", result.data);

  // 3️⃣ Toggle translate
  result = await client.predict("/toggle_translate", { on: true });
  console.log("toggle_translate:", result.data);

  // 4️⃣ Move prompt
  result = await client.predict("/move_prompt_to_non_english", { prompt_text: "Hello!!" });
  console.log("move_prompt:", result.data);

  // 5️⃣ Translate text
  result = await client.predict("/translate_text", { text: "Hello!!" });
  console.log("translate_text:", result.data);

  // 6️⃣ Toggle controls
  result = await client.predict("/toggle_controls", { hide: true });
  console.log("toggle_controls:", result.data);

  // 7️⃣ Clear history
  result = await client.predict("/clear_history", {});
  console.log("clear_history:", result.data);

  // 8️⃣ Download all
  result = await client.predict("/download_all", {});
  console.log("download_all:", result.data);

  // 9️⃣ Toggle quality prompt
  result = await client.predict("/toggle_quality_prompt", { enabled: true });
  console.log("toggle_quality_prompt:", result.data);

  // 🔟 Compute token count
  result = await client.predict("/compute_token_count", {
    prompt: "Hello!!",
    quality_prompt: "Hello!!",
    use_quality: true,
  });
  console.log("compute_token_count:", result.data);

  // 11️⃣ Compute token count 1
  result = await client.predict("/compute_token_count_1", {
    prompt: "Hello!!",
    quality_prompt: "Hello!!",
    use_quality: true,
  });
  console.log("compute_token_count_1:", result.data);

  // 12️⃣ Infer
  result = await client.predict("/infer", {
    model: "v150",
    prompt: "girl",
    quality_prompt: "high quality",
    negative_prompt: "low quality",
    seed: 0,
    randomize_seed: true,
    width: 256,
    height: 256,
    guidance_scale: 0,
    num_inference_steps: 1,
    num_images: 1,
    use_quality: true,
  });
  console.log("infer:", result.data);
}

// 実行
runAll();
