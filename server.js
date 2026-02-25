import 'dotenv/config';
import express from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
app.use(express.json());
app.use(express.static(join(__dirname, 'public')));

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Build a manga-style prompt from character attributes
function buildPrompt(attrs) {
  const {
    gender = 'neutral',
    hairStyle = 'short',
    hairColor = 'black',
    eyeColor = 'brown',
    personality = 'calm',
    outfit = 'school uniform',
    weapon = 'none',
    background = 'city',
  } = attrs;

  return (
    `Manga-style character portrait, high detail, black and white ink with screen tone shading. ` +
    `${gender} character, ${hairStyle} ${hairColor} hair, ${eyeColor} eyes, ` +
    `${personality} expression, wearing ${outfit}` +
    (weapon !== 'none' ? `, holding ${weapon}` : '') +
    `, ${background} background. ` +
    `Anime/manga art style, clean linework, dramatic lighting.`
  );
}

app.post('/generate', async (req, res) => {
  const startTime = Date.now();

  try {
    const prompt = buildPrompt(req.body);

    const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-image-generation' });

    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseModalities: ['IMAGE', 'TEXT'] },
    });

    const latencyMs = Date.now() - startTime;
    const candidate = result.response.candidates?.[0];

    // Find the image part
    const imagePart = candidate?.content?.parts?.find((p) => p.inlineData);

    if (!imagePart) {
      return res.status(500).json({ error: 'No image returned', latencyMs });
    }

    res.json({
      image: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
      prompt,
      latencyMs,
    });
  } catch (err) {
    const latencyMs = Date.now() - startTime;
    console.error(err);
    res.status(500).json({ error: err.message, latencyMs });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Manga builder running at http://localhost:${PORT}`));
