import 'dotenv/config';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json({ limit: '20mb' }));
app.use(express.static(join(__dirname, 'public')));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Cost per image for gemini-2.5-flash-image (USD)
const COST_PER_IMAGE = 0.039;

// Build a manga-style prompt from character attributes
function buildPrompt(attrs, hasFace) {
  const {
    gender = 'neutral',
    hairStyle = 'short',
    hairColor = 'black',
    personality = 'calm',
    outfit = 'school uniform',
    weapon = 'none',
  } = attrs;

  return (
    (hasFace ? `Full body manga-style illustration drawn to resemble a specific person (facial features listed below). ` : `Full body manga-style illustration. `) +
    `High detail, black and white ink with screen tone shading. ` +
    `${gender} character, ${hairStyle} ${hairColor} hair, ` +
    `${personality} expression, wearing ${outfit}` +
    (weapon !== 'none' ? `, holding ${weapon}` : '') +
    `. Full body visible from head to toe, standing pose. Pure white background, no environment, no scenery, character only. ` +
    `Anime/manga art style, clean linework, dramatic lighting, isolated figure.`
  );
}

// Step 1: describe face from uploaded photo
app.post('/describe', async (req, res) => {
  const { faceImageBase64, faceImageMimeType } = req.body;
  const t = Date.now();
  console.log('[describe] extracting face description...');
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        { text: 'Describe this person\'s facial features in precise detail — face shape, eyes, nose, jawline, cheekbones, lips, distinctive features — as if briefing a manga artist who needs to draw them accurately. Be concise but specific.' },
        { inlineData: { mimeType: faceImageMimeType, data: faceImageBase64 } },
      ],
    });
    const description = result.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? '';
    console.log(`[describe] done in ${Date.now() - t}ms`);
    res.json({ description, latencyMs: Date.now() - t });
  } catch (err) {
    console.error('[describe] ERROR:', err.message);
    res.status(500).json({ error: err.message });
  }
});

// Step 2: generate character image (accepts optional pre-computed face description)
app.post('/generate', async (req, res) => {
  const startTime = Date.now();
  try {
    const { faceDescription, ...attrs } = req.body;
    const hasFace = !!faceDescription;
    const prompt = buildPrompt(attrs, hasFace);
    const finalPrompt = hasFace ? `${prompt} Facial features to replicate: ${faceDescription}` : prompt;

    console.log(`[generate] hasFace=${hasFace}`);
    console.log('[generate] calling image generation API...');

    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ text: finalPrompt }],
      config: { responseModalities: ['IMAGE'] },
    });

    const latencyMs = Date.now() - startTime;
    console.log(`[generate] done in ${latencyMs}ms`);

    const candidate = result.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((p) => p.inlineData);

    if (!imagePart) {
      const textPart = candidate?.content?.parts?.find((p) => p.text);
      console.error('[generate] no image returned. text:', textPart?.text);
      return res.status(500).json({ error: 'No image returned — model may have refused.', latencyMs });
    }

    res.json({
      image: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
      prompt: finalPrompt,
      latencyMs,
      costUsd: COST_PER_IMAGE,
    });
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    console.error(`[generate] ERROR after ${latencyMs}ms:`, err.message);
    res.status(500).json({ error: err.message, latencyMs });
  }
});

// Step 3: Optimized placement in manga panel
app.post('/panel', async (req, res) => {
  const { characterImageBase64, characterImageMimeType } = req.body;
  const startTime = Date.now();
  console.log('[panel] generating classroom panel with text rendering...');

  const prompt =
    `Manga panel, Demon Slayer style. Place this character in a Japanese classroom, sitting at a desk. ` +
    `High-contrast ink, screen tones. ` +
    `Include a clear white thought bubble with the EXACT English text: "I need to go to the bathroom". ` +
    `Ensure the text is legible and centered in the bubble. No Japanese characters.`;

  try {
    const result = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [
        { text: prompt },
        { inlineData: { mimeType: characterImageMimeType, data: characterImageBase64 } },
      ],
      config: {
        responseModalities: ['IMAGE'],
        mediaResolution: 'low',
        thinkingLevel: 'low',
        candidateCount: 1,
        aspectRatio: '1:1',
      },
    });

    const latencyMs = Date.now() - startTime;
    console.log(`[panel] done in ${latencyMs}ms`);

    const candidate = result.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((p) => p.inlineData);

    if (!imagePart) {
      return res.status(500).json({ error: 'Model refused or failed text render.', latencyMs });
    }

    res.json({
      image: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
      latencyMs,
      costUsd: COST_PER_IMAGE,
    });
  } catch (err) {
    console.error(`[panel] ERROR:`, err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Manga builder running at http://localhost:${PORT}`));
