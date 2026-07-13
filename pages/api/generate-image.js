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

            // Update database state asynchronously
            Promise.all([
                supabase.from('hf_tokens').update({ is_last_used: false }).neq('id', selected.id),
                supabase.from('hf_tokens').update({ is_last_used: true }).eq('id', selected.id)
            ]).catch(err => console.error("Error updating token status:", err));

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
            900,               // width
            1200,               // height
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
