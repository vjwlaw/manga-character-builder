// Chip selection — one active per group
document.querySelectorAll('.chips').forEach((group) => {
  group.addEventListener('click', (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    group.querySelectorAll('.chip').forEach((c) => c.classList.remove('active'));
    chip.classList.add('active');
  });
});

function getAttrs() {
  const attrs = {};
  document.querySelectorAll('.chips').forEach((group) => {
    const key = group.dataset.key;
    const active = group.querySelector('.chip.active');
    if (key && active) attrs[key] = active.dataset.value;
  });
  return attrs;
}

// Face upload state
let faceData = null; // { base64, mimeType }

const faceInput = document.getElementById('faceInput');
const faceDropZone = document.getElementById('faceDropZone');
const facePreview = document.getElementById('facePreview');
const faceThumb = document.getElementById('faceThumb');
const facePromptText = document.getElementById('facePromptText');
const faceClear = document.getElementById('faceClear');

function loadFaceFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const reader = new FileReader();
  reader.onload = (e) => {
    const dataUrl = e.target.result;
    const comma = dataUrl.indexOf(',');
    faceData = {
      base64: dataUrl.slice(comma + 1),
      mimeType: file.type,
    };
    faceThumb.src = dataUrl;
    facePreview.hidden = false;
    facePromptText.hidden = true;
  };
  reader.readAsDataURL(file);
}

// Click to open file picker
faceDropZone.addEventListener('click', (e) => {
  if (e.target === faceClear || faceClear.contains(e.target)) return;
  faceInput.click();
});

faceInput.addEventListener('change', () => {
  loadFaceFile(faceInput.files[0]);
});

// Drag and drop
faceDropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  faceDropZone.classList.add('drag-over');
});
faceDropZone.addEventListener('dragleave', () => faceDropZone.classList.remove('drag-over'));
faceDropZone.addEventListener('drop', (e) => {
  e.preventDefault();
  faceDropZone.classList.remove('drag-over');
  loadFaceFile(e.dataTransfer.files[0]);
});

faceClear.addEventListener('click', (e) => {
  e.stopPropagation();
  faceData = null;
  faceInput.value = '';
  faceThumb.src = '';
  facePreview.hidden = true;
  facePromptText.hidden = false;
});

// Generate
const btn = document.getElementById('generateBtn');
const resultPanel = document.getElementById('resultPanel');
const meta = document.getElementById('meta');
const latencyBadge = document.getElementById('latencyBadge');
const costBadge = document.getElementById('costBadge');
const promptText = document.getElementById('promptText');
const nextBtn = document.getElementById('nextBtn');
const panelView = document.getElementById('panelView');
const panelPanel = document.getElementById('panelPanel');
const panelMeta = document.getElementById('panelMeta');
const panelLatencyBadge = document.getElementById('panelLatencyBadge');
const panelCostBadge = document.getElementById('panelCostBadge');

// Holds the last generated character image for panel step
let lastCharacterImage = null; // { base64, mimeType }

function startJazzyTimer(panel, initialLabel) {
  const sfxWords = ['BZZZT!!', 'WHOOSH!', 'KRAK!!', 'ZAP!!', 'DOOM!!', 'FWOOOM!', 'SLASH!', 'BANG!!'];
  const phrases = ['Summoning ink…', 'Drawing destiny…', 'Channeling chi…', 'Inking shadows…', 'Applying screen tone…', 'Composing the scene…', 'Awakening the panel…'];
  let phraseIdx = 0, sfxIdx = 0;
  const timerStart = Date.now();

  panel.innerHTML = `
    <div class="timer">
      <div class="timer-sfx">${sfxWords[0]}</div>
      <div class="timer-display">00:00</div>
      <div class="timer-label">${initialLabel}</div>
    </div>`;

  const interval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - timerStart) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    const display = panel.querySelector('.timer-display');
    if (display) display.textContent = `${m}:${s}`;
    if (elapsed % 2 === 0) {
      const sfxEl = panel.querySelector('.timer-sfx');
      if (sfxEl) sfxEl.textContent = sfxWords[sfxIdx++ % sfxWords.length];
    }
    if (elapsed % 4 === 0 && elapsed > 0) {
      phraseIdx++;
      const labelEl = panel.querySelector('.timer-label');
      if (labelEl) labelEl.textContent = phrases[phraseIdx % phrases.length];
    }
  }, 500);

  return { interval, timerStart };
}

btn.addEventListener('click', async () => {
  btn.disabled = true;
  btn.textContent = 'Generating…';
  meta.hidden = true;
  panelView.hidden = true;
  lastCharacterImage = null;

  // Start jazzy timer for face scan phase
  const sfxWords = ['BZZZT!!', 'WHOOSH!', 'KRAK!!', 'ZAP!!', 'DOOM!!', 'FWOOOM!', 'SLASH!', 'BANG!!'];
  const scanPhrases = ['Scanning face…', 'Reading features…', 'Mapping likeness…', 'Analyzing soul…'];
  const drawPhrases = ['Summoning ink…', 'Drawing destiny…', 'Channeling chi…', 'Inking shadows…', 'Applying screen tone…', 'Sharpening lines…', 'Awakening character…'];
  let currentPhrases = faceData ? scanPhrases : drawPhrases;
  let phraseIdx = 0, sfxIdx = 0;
  const timerStart = Date.now();

  resultPanel.innerHTML = `
    <div class="timer">
      <div class="timer-sfx">${sfxWords[0]}</div>
      <div class="timer-display">00:00</div>
      <div class="timer-label">${currentPhrases[0]}</div>
    </div>`;

  let timerInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - timerStart) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    const display = resultPanel.querySelector('.timer-display');
    if (display) display.textContent = `${m}:${s}`;
    if (elapsed % 2 === 0) {
      const sfxEl = resultPanel.querySelector('.timer-sfx');
      if (sfxEl) sfxEl.textContent = sfxWords[sfxIdx++ % sfxWords.length];
    }
    if (elapsed % 4 === 0 && elapsed > 0) {
      phraseIdx++;
      const labelEl = resultPanel.querySelector('.timer-label');
      if (labelEl) labelEl.textContent = currentPhrases[phraseIdx % currentPhrases.length];
    }
  }, 500);

  meta.hidden = true;

  try {
    let faceDescription = null;

    // Step 1: describe face if uploaded
    if (faceData) {
      const descRes = await fetch('/describe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ faceImageBase64: faceData.base64, faceImageMimeType: faceData.mimeType }),
      });
      const descData = await descRes.json();
      if (descData.error) throw new Error(descData.error);
      faceDescription = descData.description;

      currentPhrases = drawPhrases;
      phraseIdx = 0;
    } else {
      currentPhrases = drawPhrases;
      phraseIdx = 0;
    }

    // Step 2: generate image
    const body = { ...getAttrs() };
    if (faceDescription) body.faceDescription = faceDescription;

    const res = await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const data = await res.json();

    if (data.error) {
      resultPanel.innerHTML = `<p style="color:red;padding:1rem">Error: ${data.error}</p>`;
    } else {
      const img = document.createElement('img');
      img.src = data.image;
      img.alt = 'Generated manga character';
      resultPanel.innerHTML = '';
      resultPanel.appendChild(img);

      // Store character image for panel step
      const comma = data.image.indexOf(',');
      const mime = data.image.slice(5, data.image.indexOf(';'));
      lastCharacterImage = { base64: data.image.slice(comma + 1), mimeType: mime };

      latencyBadge.textContent = `${data.latencyMs.toLocaleString()} ms`;
      costBadge.textContent = `$${data.costUsd.toFixed(4)}`;
      promptText.textContent = data.prompt;
      meta.hidden = false;
    }
  } catch (err) {
    resultPanel.innerHTML = `<p style="color:red;padding:1rem">Network error: ${err.message}</p>`;
  } finally {
    clearInterval(timerInterval);
    btn.disabled = false;
    btn.textContent = 'Generate Character';
  }
});

// Next → panel scene
nextBtn.addEventListener('click', async () => {
  if (!lastCharacterImage) return;

  nextBtn.disabled = true;
  panelView.hidden = false;
  panelMeta.hidden = true;
  panelView.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const { interval } = startJazzyTimer(panelPanel, 'Composing scene…');

  try {
    const res = await fetch('/panel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterImageBase64: lastCharacterImage.base64,
        characterImageMimeType: lastCharacterImage.mimeType,
      }),
    });

    const data = await res.json();

    if (data.error) {
      panelPanel.innerHTML = `<p style="color:red;padding:1rem">Error: ${data.error}</p>`;
    } else {
      const img = document.createElement('img');
      img.src = data.image;
      img.alt = 'Manga panel';
      panelPanel.innerHTML = '';
      panelPanel.appendChild(img);

      panelLatencyBadge.textContent = `${data.latencyMs.toLocaleString()} ms`;
      panelCostBadge.textContent = `$${data.costUsd.toFixed(4)}`;
      panelMeta.hidden = false;
    }
  } catch (err) {
    panelPanel.innerHTML = `<p style="color:red;padding:1rem">Network error: ${err.message}</p>`;
  } finally {
    clearInterval(interval);
    nextBtn.disabled = false;
  }
});
