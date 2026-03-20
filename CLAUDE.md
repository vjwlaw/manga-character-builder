# Manga Character Builder - Project Memory

## Stack
- Node.js/Express server (ESM), vanilla JS frontend, no framework/build step
- Google Gemini API (`@google/genai`): `gemini-2.5-flash` for text, `gemini-2.5-flash-image` for image gen
- Static files served from `public/`

## Key Files
- `server.js` — Express server with 3 endpoints: `/describe`, `/generate`, `/panel`
- `public/index.html` — Single page with creator mode + adventure mode
- `public/app.js` — All client logic (chip selection, face upload, adventure game)
- `public/style.css` — Styling
- `public/story.json` — Branching story tree (12 scenes, Demon Slayer style)

## Architecture
- Two-step face mapping: upload photo -> describe via text model -> inject description into image prompt
- Adventure mode: loads story.json, each scene generates a manga panel via `/panel` endpoint
- Images compressed client-side before sending to panel endpoint
- Cost: $0.039 per generated image
