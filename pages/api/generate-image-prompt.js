import { generateImagePrompt } from '../../lib/imagePromptClient'

export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' })
    }

    const { character, records } = req.body

    if (!character || !records) {
        return res.status(400).json({ error: 'Missing character or records' })
    }

    try {
        const prompt = await generateImagePrompt(character, records)
        res.status(200).json({ prompt })
    } catch (error) {
        console.error(error)
        res.status(500).json({ error: 'Internal Server Error' })
    }
}
