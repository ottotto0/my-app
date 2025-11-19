import { Client } from "@gradio/client";

document.body.innerHTML = `
  <div style="width:100%; max-width:480px; margin:40px auto; font-family:sans-serif;">
    <h2>画像生成テスト</h2>

    <input id="prompt" type="text" placeholder="プロンプトを入力" 
      style="width:100%; padding:10px; font-size:16px;" />

    <button id="gen" 
      style="margin-top:10px; padding:10px 20px; font-size:16px; cursor:pointer;">
      生成
    </button>

    <div id="status" style="margin-top:20px; font-size:14px;"></div>
    <img id="result" style="margin-top:20px; width:100%; display:none;" />
  </div>
`;

async function runGenerate() {
    const prompt = document.getElementById("prompt").value;
    const status = document.getElementById("status");
    const resultImg = document.getElementById("result");

    if (!prompt) {
        status.innerText = "プロンプトを入力してください。";
        return;
    }

    status.innerText = "生成中…少しお待ちください。";

    try {
        const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");

        const result = await client.predict("/infer", {
            model: "v150",
            prompt: prompt,
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

        resultImg.src = url;
        resultImg.style.display = "block";
        status.innerText = "生成完了！";

    } catch (err) {
        console.error(err);
        status.innerText = "エラーが発生しました。コンソールを確認してください。";
    }
}

document.getElementById("gen").addEventListener("click", runGenerate);
