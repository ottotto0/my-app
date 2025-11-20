import express from "express";
import bodyParser from "body-parser";
import { Client } from "@gradio/client";

const app = express();
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// 静的ファイル（HTML）を公開
app.use(express.static("public"));

// POST でプロンプトを受け取って生成
app.post("/generate", async (req, res) => {
    try {
        const { prompt } = req.body;

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
            guidance_scale: 7.5,
            num_inference_steps: 50,
            num_images: 1,
            use_quality: true,
        });

        // 生成結果をブラウザに返す
        res.json(result.data);

    } catch (err) {
        console.error(err);
        res.status(500).send("Error generating image");
    }
});

app.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
