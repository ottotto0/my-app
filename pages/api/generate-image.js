import { Client } from "@gradio/client";

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { prompt, characterId } = req.body;

    if (!prompt || !characterId) {
        return res.status(400).json({ error: 'Prompt and character ID are required' });
    }

    try {
        console.log(`🎨 Generating image for prompt: ${prompt}`);

        const { createClient } = require('@supabase/supabase-js');
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
        const supabase = createClient(supabaseUrl, supabaseKey);

        const { data: tokens, error: fetchError } = await supabase
            .from('hf_tokens')
            .select('*')
            .eq('is_active', true)
            .order('id', { ascending: true });

        if (fetchError) {
            console.error("Error fetching tokens from Supabase:", fetchError);
        }

        let client;

        console.log(`Initializing Gradio Client for Nech-C/waiNSFWIllustrious_v140...`);

        if (tokens && tokens.length > 0) {
            const n = tokens.length;
            let lastUsedIndex = tokens.findIndex(t => t.is_last_used === true);
            let nextIndex = (lastUsedIndex === -1) ? 0 : (lastUsedIndex + 1) % n;
            const selected = tokens[nextIndex];
            const hfToken = selected.token;

            console.log(`Using token ${selected.name || selected.id} for authentication. Token length: ${hfToken ? hfToken.length : 0}`);

            // チャット生成で選んだトークンとは別のものを確定させてから画像を
            // 生成する。画像完了後の次回取得では、この次のトークンが選ばれる。
            await Promise.all([
                supabase.from('hf_tokens').update({ is_last_used: false }).neq('id', selected.id),
                supabase.from('hf_tokens').update({ is_last_used: true }).eq('id', selected.id)
            ]).then(results => {
                results.forEach(({ error }) => {
                    if (error) console.error("Error updating token status:", error);
                });
            });

            // Try passing token in both hf_token and headers to be safe
            client = await Client.connect("Nech-C/waiNSFWIllustrious_v140", {
                hf_token: hfToken,
                headers: { "Authorization": `Bearer ${hfToken}` }
            });
        } else {
            console.log("No active tokens found in Supabase, using anonymous access.");
            client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");
        }

        const result = await client.predict("/infer", [
            "v160",             // model
            prompt,             // prompt
            "masterpiece, best quality, fine details", // quality_prompt
            "blurry, low quality, watermark, monochrome, text", // negative_prompt
            0,                  // seed
            true,               // randomize_seed
            832,               // width
            1216,               // height
            6,                  // guidance_scale
            30,                 // num_inference_steps
            1,                  // num_images
            [],                 // history
            true,               // use_quality
            0,                  // language_warning_count
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

        // 生成元の URL は期限切れになるため、画像本体を Supabase Storage に保存する。
        const imageResponse = await fetch(imageUrl);
        if (!imageResponse.ok) {
            throw new Error(`Failed to download generated image: ${imageResponse.status}`);
        }

        const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());
        const contentType = imageResponse.headers.get('content-type') || 'image/png';
        const filePath = `characters/${characterId}/latest.png`;

        // キャラごとに固定パスを使うため、常に最新の 1 枚だけが Storage に残る。
        const { error: uploadError } = await supabase.storage
            .from('chat-images')
            .upload(filePath, imageBuffer, {
                contentType,
                upsert: true,
                cacheControl: '0',
            });

        if (uploadError) {
            throw new Error(`Failed to save generated image: ${uploadError.message}`);
        }

        const { data: publicUrlData } = supabase.storage
            .from('chat-images')
            .getPublicUrl(filePath);

        // 固定ファイル名のままでも、表示 URL を毎回変えてブラウザキャッシュを回避する。
        const savedImageUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

        console.log(`✅ Image saved to Supabase Storage: ${filePath}`);
        res.status(200).json({ image_url: savedImageUrl });

    } catch (error) {
        console.error('🔴 Image Generation Error:', error);
        res.status(500).json({ error: error.message || 'Image generation failed' });
    }
}
