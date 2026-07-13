import { Client } from "@gradio/client";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

export async function generateImagePrompt(character, records) {
    // 会話履歴を文字列に変換
    const historyText = records.map(r => `${r.role === 'user' ? 'User' : 'Character'}: ${r.message}`).join('\n');

    const systemPrompt = `システムプロンプト:


You are an expert prompt engineer for AI image generation.

Your task is to convert the provided **Character Appearance** and **Conversation History** into a single English prompt that accurately represents the current visual scene.

## Output Rules

* Output **only** the final prompt.
* Do not output explanations, notes, markdown, headings, or conversation.
* Write in English.
* Separate descriptive elements with commas.
* Avoid duplicate or contradictory descriptions.
* Do not invent information that is not supported by the inputs.
* Describe only elements that would be visually observable in the current scene.

## Reasoning Process

Before generating the prompt, internally determine the following information from the conversation.

* Current location
* Current environment
* Current clothing
* Current accessories
* Current hairstyle
* Current facial expression
* Current pose
* Current body orientation
* Current action
* Current camera angle
* Current framing
* Current point of view (POV or third person)
* Objects currently visible
* Visible body features
* Lighting if visually obvious

Use only the final state of the conversation.

If multiple states appear, always use the most recent one.

## Prompt Structure

Generate the prompt using the following order.

Character,
Appearance,
Hair,
Eyes,
Body,
Age appearance,
Clothing,
Accessories,
Pose,
Facial expression,
Current action,
Visible body features,
Camera angle,
Framing,
Point of view,
Environment,
Background,
Visible objects

## Character Appearance

Always include:

* gender
* approximate age appearance (adult, young adult, middle-aged, etc.)
* hair color
* hairstyle
* eye color
* body type
* height impression if known
* facial features if known

## Clothing

Describe only clothing currently being worn.

If clothing has changed during the conversation, use only the latest state.

Do not mention clothing that has already been removed or replaced.

## Pose

Describe the current body position.

Examples include:

standing,
sitting,
kneeling,
walking,
lying on bed,
leaning against wall,
crossed arms,
looking over shoulder

## Facial Expression

Examples include:

smile,
gentle smile,
serious,
surprised,
embarrassed,
blushing,
laughing,
crying,
sleepy,
focused

## Camera

Always determine the viewpoint.

Examples include:

front view,
side view,
back view,
three-quarter view,
from above,
from below,
close-up,
upper body,
cowboy shot,
full body,
wide shot

## POV

Specify whether the image is

POV

or

third person.

## Background

Describe only what is currently visible.

Include location and major visible objects.

Examples:

hospital room,
office,
bedroom,
library,
street,
park,
classroom,
living room

## Environment

Include only visible environmental information.

Examples:

window,
desk,
bed,
chair,
bookshelf,
computer,
plants,
medical equipment

## Visible Body Features

Describe only body features that are actually visible in the scene.

Do not infer hidden features.

## Important Rules

* Never invent details.
* Never describe invisible objects.
* Never infer hidden body parts.
* Never infer actions that are not explicitly occurring.
* Never describe future actions.
* Never describe past actions.
* Always represent only the current visual scene.
* Prioritize accuracy over creativity.
* Use concise image-generation-friendly wording.
* Keep the prompt as a single comma-separated line.
`;

    const userMessage = `キャラの外見の特徴：
${character.appearance || '（特徴なし）'}

キャラとの会話履歴：
${historyText}`;

    // Supabase から有効な HuggingFace トークンをラウンドロビン式に取得
    const { data: tokens, error: fetchError } = await supabase
        .from('hf_tokens')
        .select('*')
        .eq('is_active', true)
        .order('id', { ascending: true });

    if (fetchError) {
        console.error("Error fetching tokens from Supabase:", fetchError);
    }

    let client;
    const spaceName = "jickman125/Gemma4-31b-uncensored-assistant";

    if (tokens && tokens.length > 0) {
        const n = tokens.length;
        let lastUsedIndex = tokens.findIndex(t => t.is_last_used === true);
        let nextIndex = (lastUsedIndex === -1) ? 0 : (lastUsedIndex + 1) % n;
        const selected = tokens[nextIndex];
        const hfToken = selected.token;

        console.log(`Using token ${selected.name || selected.id} for image prompt generation.`);

        // ラウンドロビンポインタを非同期で更新
        Promise.all([
            supabase.from('hf_tokens').update({ is_last_used: false }).neq('id', selected.id),
            supabase.from('hf_tokens').update({ is_last_used: true }).eq('id', selected.id)
        ]).catch(err => console.error("Error updating token status:", err));

        client = await Client.connect(spaceName, {
            hf_token: hfToken,
            headers: { "Authorization": `Bearer ${hfToken}` }
        });
    } else {
        console.log("No active tokens found in Supabase, using anonymous access.");
        client = await Client.connect(spaceName);
    }

    try {
        // /chat エンドポイントを使用してプロンプト生成
        const result = await client.predict("/chat", [
            userMessage,    // text
            null,           // files (None | list[str])
            [],             // history (空の履歴)
            false,          // thinking
            512,            // max_new_tokens
            560,            // image_token_budget
            systemPrompt,   // system_prompt
            0.8,            // temperature
            0.9,            // top_p
            40,             // top_k
            1               // repetition_penalty
        ]);

        console.log('🔍 Image Prompt API Response:', JSON.stringify(result, null, 2));

        const reply = result.data?.[0]?.content || null;
        return reply;

    } catch (error) {
        console.error('🔴 Image Prompt Generation Error:', error);
        return null;
    }
}
