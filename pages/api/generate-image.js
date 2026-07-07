import { Client } from "@gradio/client";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt } = req.body;

    if (!prompt) {
        return res.status(400).json({ error: 'No prompt provided' });
    }

    try {
        console.log(`🎨 Generating image for prompt: ${prompt}`);

        const hfToken1 = process.env.HF_TOKEN;
        const hfToken2 = process.env.HF_TOKEN2;

        // Create array of available tokens
        const availableTokens = [];
        if (hfToken1) availableTokens.push({ token: hfToken1, name: "HF_TOKEN" });
        if (hfToken2) availableTokens.push({ token: hfToken2, name: "HF_TOKEN2" });

        let client;

        console.log(`Initializing Gradio Client for Nech-C/waiNSFWIllustrious_v140...`);

        if (availableTokens.length > 0) {
            // Randomly select a token
            const selected = availableTokens[Math.floor(Math.random() * availableTokens.length)];
            const hfToken = selected.token;

            console.log(`Using ${selected.name} for authentication. Token length: ${hfToken.length}`);

            // Try passing token in both hf_token and headers to be safe
            client = await Client.connect("Nech-C/waiNSFWIllustrious_v140", {
                hf_token: hfToken,
                headers: { "Authorization": `Bearer ${hfToken}` }
            });
        } else {
            console.log("No HF_TOKEN or HF_TOKEN2 found, using anonymous access.");
            client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");
        }

        const result = await client.predict("/infer", [
            "v140",             // model
            prompt,             // prompt
            "masterpiece, best quality, fine details", // quality_prompt
            "blurry, low quality, watermark, monochrome, text", // negative_prompt
            0,                  // seed
            true,               // randomize_seed
            1024,               // width
            1024,               // height
            6,                  // guidance_scale
            30,                 // num_inference_steps
            1,                  // num_images
            true,               // use_quality
        ]);

        // result.data is an array of outputs. The first output is the image.
        // The image object usually has a 'url' property.
        const imageResult = result.data[0];

        let imageUrl = null;
        if (imageResult && imageResult.url) {
            imageUrl = imageResult.url;
        } else if (typeof imageResult === 'string') {
            imageUrl = imageResult;
        }

        if (!imageUrl) {
            throw new Error('No image URL returned from Gradio API');
        }

        console.log(`✅ Image generated: ${imageUrl}`);
        res.status(200).json({ image_url: imageUrl });

    } catch (error) {
        console.error('🔴 Image Generation Error:', error);
        res.status(500).json({ error: error.message || 'Image generation failed' });
    }
}
