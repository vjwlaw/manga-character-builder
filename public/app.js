// ========================================
// IMAGE COMPRESSION UTILITIES
// ========================================

function compressDataUrl(dataUrl, maxSize = 1024, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        const scale = maxSize / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const out = canvas.toDataURL('image/jpeg', quality);
      const comma = out.indexOf(',');
      resolve({ base64: out.slice(comma + 1), mimeType: 'image/jpeg' });
    };
    img.src = dataUrl;
  });
}

function compressImage(file, maxSize = 1024, quality = 0.8) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let w = img.width, h = img.height;
      if (w > maxSize || h > maxSize) {
        const scale = maxSize / Math.max(w, h);
        w = Math.round(w * scale);
        h = Math.round(h * scale);
      }
      canvas.width = w;
      canvas.height = h;
      canvas.getContext('2d').drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL('image/jpeg', quality);
      const comma = dataUrl.indexOf(',');
      resolve({
        base64: dataUrl.slice(comma + 1),
        mimeType: 'image/jpeg',
        dataUrl,
      });
    };
    img.src = URL.createObjectURL(file);
  });
}

// ========================================
// CHIP SELECTION
// ========================================

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

// ========================================
// FACE UPLOAD
// ========================================

let faceData = null;

const faceInput = document.getElementById('faceInput');
const faceDropZone = document.getElementById('faceDropZone');
const facePreview = document.getElementById('facePreview');
const faceThumb = document.getElementById('faceThumb');
const facePromptText = document.getElementById('facePromptText');
const faceClear = document.getElementById('faceClear');

async function loadFaceFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  const compressed = await compressImage(file, 1024, 0.8);
  faceData = {
    base64: compressed.base64,
    mimeType: compressed.mimeType,
  };
  faceThumb.src = compressed.dataUrl;
  facePreview.hidden = false;
  facePromptText.hidden = true;
}

faceDropZone.addEventListener('click', (e) => {
  if (e.target === faceClear || faceClear.contains(e.target)) return;
  faceInput.click();
});

faceInput.addEventListener('change', () => { loadFaceFile(faceInput.files[0]); });

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

// ========================================
// JAZZY TIMER
// ========================================

const sfxWords = ['BZZZT!!', 'WHOOSH!', 'KRAK!!', 'ZAP!!', 'DOOM!!', 'FWOOOM!', 'SLASH!', 'BANG!!'];
const drawPhrases = ['Summoning ink...', 'Drawing destiny...', 'Channeling chi...', 'Inking shadows...', 'Applying screen tone...', 'Sharpening lines...', 'Awakening character...'];
const scanPhrases = ['Scanning face...', 'Reading features...', 'Mapping likeness...', 'Analyzing soul...'];

function startJazzyTimer(container, initialLabel) {
  let phraseIdx = 0, sfxIdx = 0;
  const timerStart = Date.now();
  const phrases = drawPhrases;

  container.innerHTML = `
    <div class="timer">
      <div class="timer-sfx">${sfxWords[0]}</div>
      <div class="timer-display">00:00</div>
      <div class="timer-label">${initialLabel || phrases[0]}</div>
    </div>`;

  const interval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - timerStart) / 1000);
    const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
    const s = String(elapsed % 60).padStart(2, '0');
    const display = container.querySelector('.timer-display');
    if (display) display.textContent = `${m}:${s}`;
    if (elapsed % 2 === 0) {
      const sfxEl = container.querySelector('.timer-sfx');
      if (sfxEl) sfxEl.textContent = sfxWords[sfxIdx++ % sfxWords.length];
    }
    if (elapsed % 4 === 0 && elapsed > 0) {
      phraseIdx++;
      const labelEl = container.querySelector('.timer-label');
      if (labelEl) labelEl.textContent = phrases[phraseIdx % phrases.length];
    }
  }, 500);

  return interval;
}

// ========================================
// CHARACTER GENERATION (Creator Mode)
// ========================================

const btn = document.getElementById('generateBtn');
const resultPanel = document.getElementById('resultPanel');
const meta = document.getElementById('meta');
const adventureBtn = document.getElementById('adventureBtn');

let lastCharacterImage = null;
let characterPortraitDataUrl = null;

btn.addEventListener('click', async () => {
  btn.disabled = true;
  btn.textContent = 'Generating...';
  meta.hidden = true;
  lastCharacterImage = null;

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

  try {
    let faceDescription = null;

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
    }

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

      const compImg = await compressDataUrl(data.image, 1024, 0.8);
      lastCharacterImage = { base64: compImg.base64, mimeType: compImg.mimeType };
      characterPortraitDataUrl = data.image;

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

// ========================================
// ADVENTURE MODE
// ========================================

const creatorMode = document.getElementById('creatorMode');
const adventureMode = document.getElementById('adventureMode');
const mangaStrip = document.getElementById('mangaStrip');
const gameOverArea = document.getElementById('gameOverArea');
const portraitImg = document.getElementById('portraitImg');
const restartBtn = document.getElementById('restartBtn');
const gameOverRestartBtn = document.getElementById('gameOverRestartBtn');

let storyData = null;

fetch('/story.json')
  .then((r) => r.json())
  .then((data) => { storyData = data; })
  .catch((err) => console.error('Failed to load story:', err));

adventureBtn.addEventListener('click', () => {
  if (!lastCharacterImage || !storyData) return;
  enterAdventureMode();
});

function enterAdventureMode() {
  creatorMode.hidden = true;
  adventureMode.hidden = false;
  document.querySelector('.app').classList.add('in-adventure');
  mangaStrip.innerHTML = '';
  gameOverArea.hidden = true;

  portraitImg.src = characterPortraitDataUrl;
  window.scrollTo({ top: 0, behavior: 'smooth' });

  playScene(storyData.start);
}

async function playScene(sceneId) {
  const scene = storyData.scenes[sceneId];
  if (!scene) {
    console.error('Scene not found:', sceneId);
    return;
  }

  gameOverArea.hidden = true;

  // Create scene row: panel image on left, choices on right
  const row = document.createElement('div');
  row.className = 'scene-row' + (scene.gameOver ? ' game-over-row' : '');

  // Panel card (left side)
  const card = document.createElement('div');
  card.className = 'manga-panel-card' + (scene.gameOver ? ' game-over-card' : '');

  const title = document.createElement('div');
  title.className = 'panel-card-title';
  title.textContent = scene.title;
  card.appendChild(title);

  const imageContainer = document.createElement('div');
  imageContainer.className = 'panel-card-image';
  card.appendChild(imageContainer);

  row.appendChild(card);

  // Choices sidebar (right side) — added after image loads
  const choicesSidebar = document.createElement('div');
  choicesSidebar.className = 'choices-sidebar';
  choicesSidebar.hidden = true;
  row.appendChild(choicesSidebar);

  mangaStrip.appendChild(row);

  // Scroll to the new row
  row.scrollIntoView({ behavior: 'smooth', block: 'start' });

  // Start loading timer
  const timerInterval = startJazzyTimer(imageContainer, 'Composing scene...');

  try {
    const res = await fetch('/panel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        characterImageBase64: lastCharacterImage.base64,
        characterImageMimeType: lastCharacterImage.mimeType,
        prompt: scene.prompt,
      }),
    });

    const data = await res.json();
    clearInterval(timerInterval);

    if (data.error) {
      imageContainer.innerHTML = `<p style="color:red;padding:1rem">Error: ${data.error}</p>`;
      return;
    }

    const img = document.createElement('img');
    img.src = data.image;
    img.alt = scene.title;
    imageContainer.innerHTML = '';
    imageContainer.appendChild(img);

    row.scrollIntoView({ behavior: 'smooth', block: 'start' });

    if (scene.gameOver) {
      // Show game over in the sidebar
      choicesSidebar.innerHTML = `
        <div class="game-over-sidebar">
          <h3 class="game-over-text">GAME OVER</h3>
          <button class="restart-btn restart-btn-large" id="sidebarRestartBtn">Try Again</button>
        </div>`;
      choicesSidebar.hidden = false;
      choicesSidebar.querySelector('#sidebarRestartBtn').addEventListener('click', restart);
    } else if (scene.choices && scene.choices.length > 0) {
      // Show choices in the sidebar
      const label = document.createElement('h3');
      label.className = 'choices-label';
      label.textContent = 'What do you do?';
      choicesSidebar.appendChild(label);

      const choicesDiv = document.createElement('div');
      choicesDiv.className = 'choices';

      scene.choices.forEach((choice) => {
        const choiceBtn = document.createElement('button');
        choiceBtn.className = 'choice-btn';
        choiceBtn.textContent = choice.label;
        choiceBtn.addEventListener('click', () => {
          choicesDiv.querySelectorAll('.choice-btn').forEach((b) => { b.disabled = true; });
          playScene(choice.next);
        });
        choicesDiv.appendChild(choiceBtn);
      });

      choicesSidebar.appendChild(choicesDiv);
      choicesSidebar.hidden = false;
    }
  } catch (err) {
    clearInterval(timerInterval);
    imageContainer.innerHTML = `<p style="color:red;padding:1rem">Network error: ${err.message}</p>`;
  }
}

function restart() {
  adventureMode.hidden = true;
  creatorMode.hidden = false;
  document.querySelector('.app').classList.remove('in-adventure');
  mangaStrip.innerHTML = '';
  gameOverArea.hidden = true;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

restartBtn.addEventListener('click', restart);
gameOverRestartBtn.addEventListener('click', restart);
