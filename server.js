import 'dotenv/config';
import express from 'express';
import { GoogleGenAI } from '@google/genai';
import { readFileSync, writeFileSync, appendFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

function logError(endpoint, message, extra = {}) {
  const entry = {
    timestamp: new Date().toISOString(),
    endpoint,
    message,
    ...extra,
  };
  const line = JSON.stringify(entry) + '\n';
  console.error(`[${endpoint}] ${message}`);
  try { appendFileSync(join(__dirname, 'errors.log'), line); } catch {}
}

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();

const CHARS_PATH = join(__dirname, 'public', 'characters.json');
function readChars() {
  try { return JSON.parse(readFileSync(CHARS_PATH, 'utf-8')); } catch { return {}; }
}
app.use(express.json({ limit: '20mb' }));
app.use(express.static(join(__dirname, 'public')));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Cost per image for gemini-2.5-flash-preview-04-17 (Nano Banana 2) in USD
const COST_PER_IMAGE = 0.04;

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
    (hasFace ? `One single manga-style character illustration drawn to resemble a specific person (facial features listed below). ` : `One single manga-style character illustration. `) +
    `Strictly one character only. No multiple people, no duplicates. ` +
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
      config: {
        thinkingLevel: 'low',
      },
    });
    const description = result.candidates?.[0]?.content?.parts?.find(p => p.text)?.text ?? '';
    console.log(`[describe] done in ${Date.now() - t}ms`);
    res.json({ description, latencyMs: Date.now() - t });
  } catch (err) {
    logError('describe', err.message);
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
      model: 'gemini-3.1-flash-image-preview',
      contents: [{ text: finalPrompt }],
      config: {
        responseModalities: ['IMAGE'],
        thinkingLevel: 'low',
        candidateCount: 1,
      },
    });

    const latencyMs = Date.now() - startTime;
    console.log(`[generate] done in ${latencyMs}ms`);

    const candidate = result.candidates?.[0];
    const imagePart = candidate?.content?.parts?.find((p) => p.inlineData);

    if (!imagePart) {
      const textPart = candidate?.content?.parts?.find((p) => p.text);
      logError('generate', 'No image returned', { text: textPart?.text });
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
    logError('generate', err.message, { latencyMs });
    res.status(500).json({ error: err.message, latencyMs });
  }
});

// Step 3: Generate a scene panel with character image and client-provided prompt
app.post('/panel', async (req, res) => {
  const { characterImageBase64, characterImageMimeType, prompt: scenePrompt, personality, secondaryCharacters, sceneId, sceneTitle } = req.body;
  const startTime = Date.now();
  console.log('[panel] generating scene panel...');

  if (!scenePrompt) {
    return res.status(400).json({ error: 'Missing prompt field.' });
  }

  const panelContents = [
    { text: `The protagonist in this scene has the following personality — use this to inform their expression and body language: ${personality}. ${scenePrompt} Manga panel, black and white.` +
      (secondaryCharacters?.length
        ? ` IMPORTANT: Multiple character references are attached. Image 1 = the PROTAGONIST. ${secondaryCharacters.map((c, i) => `Image ${i + 2} = ${c.name} (${c.description})`).join('. ')}. Keep every character visually distinct and consistent with their reference image.`
        : ' Strictly one character only.') },
    { inlineData: { mimeType: characterImageMimeType, data: characterImageBase64 } },
    ...(secondaryCharacters || []).map(c => ({ inlineData: { mimeType: c.imageMimeType, data: c.imageBase64 } })),
  ];

  const callPanel = () => ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: panelContents,
    config: { responseModalities: ['IMAGE'], thinkingLevel: 'low', candidateCount: 1 },
  });

  try {
    let result;
    try {
      result = await callPanel();
    } catch (err) {
      if (err.message?.includes('"code":500') || err.message?.includes('INTERNAL')) {
        logError('panel', '500 from API, retrying once', { sceneId, sceneTitle });
        result = await callPanel();
      } else {
        throw err;
      }
    }

    let candidate = result.candidates?.[0];
    let imagePart = candidate?.content?.parts?.find((p) => p.inlineData);

    // Retry once on NO_IMAGE (intermittent model refusal)
    if (!imagePart) {
      logError('panel', 'no image on first try, retrying', { sceneId, sceneTitle });
      result = await callPanel();
      candidate = result.candidates?.[0];
      imagePart = candidate?.content?.parts?.find((p) => p.inlineData);
    }

    const latencyMs = Date.now() - startTime;
    console.log(`[panel] done in ${latencyMs}ms`);

    if (!imagePart) {
      const textPart = candidate?.content?.parts?.find((p) => p.text);
      const finishReason = candidate?.finishReason;
      logError('panel', 'Model refused or failed text render', { sceneId, sceneTitle, finishReason, text: textPart?.text, latencyMs });
      return res.status(500).json({ error: 'Model refused or failed text render.', latencyMs });
    }

    res.json({
      image: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}`,
      latencyMs,
      costUsd: COST_PER_IMAGE,
    });
  } catch (err) {
    logError('panel', err.message, { sceneId, sceneTitle });
    res.status(500).json({ error: err.message });
  }
});

// ── Character routes ──────────────────────────────────────────

app.get('/api/characters', (req, res) => res.json(readChars()));

app.post('/api/character/:key/generate', async (req, res) => {
  const { key } = req.params;
  const { name, description } = req.body;
  if (!name || !description) return res.status(400).json({ error: 'name and description required' });
  const prompt = `Manga character reference sheet, black and white ink with screen tones. Full body, white background, single character only. ${description}`;
  try {
    const result = await ai.models.generateContent({
      model: 'gemini-3.1-flash-image-preview',
      contents: [{ text: prompt }],
      config: { responseModalities: ['IMAGE'], thinkingLevel: 'low', candidateCount: 1 },
    });
    const imagePart = result.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (!imagePart) return res.status(500).json({ error: 'Model refused to generate image.' });
    const chars = readChars();
    chars[key] = { name, description, imageBase64: imagePart.inlineData.data, imageMimeType: imagePart.inlineData.mimeType };
    res.json({ success: true, image: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}` });
    writeFileSync(CHARS_PATH, JSON.stringify(chars, null, 2));
    console.log(`[chars] generated "${key}"`);
  } catch (err) {
    logError('chars', err.message);
    res.status(500).json({ error: err.message });
  }
});

app.delete('/api/character/:key', (req, res) => {
  const { key } = req.params;
  const chars = readChars();
  if (!chars[key]) return res.status(404).json({ error: 'Character not found.' });
  delete chars[key];
  res.json({ success: true });
  writeFileSync(CHARS_PATH, JSON.stringify(chars, null, 2));
  console.log(`[chars] deleted "${key}"`);
});

// Update an existing scene
app.put('/api/story/scene/:key', (req, res) => {
  const { key } = req.params;
  const { scene } = req.body;
  if (!scene?.title || !scene?.prompt) {
    return res.status(400).json({ error: 'title and prompt are required.' });
  }
  const storyPath = join(__dirname, 'public', 'story.json');
  const story = JSON.parse(readFileSync(storyPath, 'utf-8'));
  if (!story.scenes[key]) {
    return res.status(404).json({ error: `Scene "${key}" not found.` });
  }
  res.json({ success: true });
  story.scenes[key] = scene;
  writeFileSync(storyPath, JSON.stringify(story, null, 2));
  console.log(`[story] updated scene "${key}"`);
});

// Delete a scene
app.delete('/api/story/scene/:key', (req, res) => {
  const { key } = req.params;
  const storyPath = join(__dirname, 'public', 'story.json');
  const story = JSON.parse(readFileSync(storyPath, 'utf-8'));
  if (!story.scenes[key]) return res.status(404).json({ error: `Scene "${key}" not found.` });
  if (key === story.start) return res.status(400).json({ error: 'Cannot delete the start scene.' });
  delete story.scenes[key];
  // Remove any choices pointing to the deleted scene
  for (const scene of Object.values(story.scenes)) {
    if (scene.choices) scene.choices = scene.choices.filter(c => c.next !== key);
  }
  res.json({ success: true });
  writeFileSync(storyPath, JSON.stringify(story, null, 2));
  console.log(`[story] deleted scene "${key}"`);
});

// Story map page
app.get('/story', (req, res) => {
  res.sendFile(join(__dirname, 'public', 'story.html'));
});

// Return story.json as JSON
app.get('/api/story', (req, res) => {
  const story = JSON.parse(readFileSync(join(__dirname, 'public', 'story.json'), 'utf-8'));
  res.json(story);
});

// Add a new scene to story.json
app.post('/api/story/scene', (req, res) => {
  const { key, scene, parentKey, choiceLabel } = req.body;
  if (!key || !scene?.title || !scene?.prompt) {
    return res.status(400).json({ error: 'key, title, and prompt are required.' });
  }
  const storyPath = join(__dirname, 'public', 'story.json');
  const story = JSON.parse(readFileSync(storyPath, 'utf-8'));
  if (story.scenes[key]) {
    return res.status(400).json({ error: `Scene key "${key}" already exists.` });
  }
  story.scenes[key] = scene;
  if (parentKey && choiceLabel && story.scenes[parentKey]) {
    if (!story.scenes[parentKey].choices) story.scenes[parentKey].choices = [];
    story.scenes[parentKey].choices.push({ label: choiceLabel, next: key });
  }
  // Respond before writing so node --watch restart doesn't drop the response
  res.json({ success: true });
  writeFileSync(storyPath, JSON.stringify(story, null, 2));
  console.log(`[story] added scene "${key}"${parentKey ? ` (from ${parentKey})` : ''}`);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Manga builder running at http://localhost:${PORT}`));
