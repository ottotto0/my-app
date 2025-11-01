import { Client } from "@gradio/client";
	
	const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");
	const result = await client.predict("/_apply_preset_ui", { 		
			preset: "768×768 (square)", 
	});

	console.log(result.data);

import { Client } from "@gradio/client";
	
	const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");
	const result = await client.predict("/toggle_rescale", { 		
			no_rescale: true, 
	});

	console.log(result.data);

import { Client } from "@gradio/client";
	
	const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");
	const result = await client.predict("/toggle_translate", { 		
			on: true, 
	});

	console.log(result.data);

import { Client } from "@gradio/client";
	
	const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");
	const result = await client.predict("/move_prompt_to_non_english", { 		
			prompt_text: "Hello!!", 
	});

	console.log(result.data);

import { Client } from "@gradio/client";
	
	const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");
	const result = await client.predict("/translate_text", { 		
			text: "Hello!!", 
	});

	console.log(result.data);

import { Client } from "@gradio/client";
	
	const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");
	const result = await client.predict("/toggle_controls", { 		
			hide: true, 
	});

	console.log(result.data);

import { Client } from "@gradio/client";
	
	const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");
	const result = await client.predict("/clear_history", { 
	});

	console.log(result.data);

import { Client } from "@gradio/client";
	
	const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");
	const result = await client.predict("/download_all", { 
	});

	console.log(result.data);

import { Client } from "@gradio/client";
	
	const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");
	const result = await client.predict("/toggle_quality_prompt", { 		
			enabled: true, 
	});

	console.log(result.data);

import { Client } from "@gradio/client";
	
	const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");
	const result = await client.predict("/compute_token_count", { 		
			prompt: "Hello!!", 		
			quality_prompt: "Hello!!", 		
			use_quality: true, 
	});

	console.log(result.data);

import { Client } from "@gradio/client";
	
	const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");
	const result = await client.predict("/compute_token_count_1", { 		
			prompt: "Hello!!", 		
			quality_prompt: "Hello!!", 		
			use_quality: true, 
	});

	console.log(result.data);

import { Client } from "@gradio/client";
	
	const client = await Client.connect("Nech-C/waiNSFWIllustrious_v140");
	const result = await client.predict("/infer", { 		
			model: "v150", 		
			prompt: "Hello!!", 		
			quality_prompt: "Hello!!", 		
			negative_prompt: "Hello!!", 		
			seed: 0, 		
			randomize_seed: true, 		
			width: 256, 		
			height: 256, 		
			guidance_scale: 0, 		
			num_inference_steps: 1, 		
			num_images: 1, 		
			use_quality: true, 
	});

	console.log(result.data);
