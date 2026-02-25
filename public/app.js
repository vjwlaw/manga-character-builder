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

const btn = document.getElementById('generateBtn');
const resultPanel = document.getElementById('resultPanel');
const meta = document.getElementById('meta');
const latencyBadge = document.getElementById('latencyBadge');
const promptText = document.getElementById('promptText');

btn.addEventListener('click', async () => {
  btn.disabled = true;
  btn.textContent = 'Generating…';

  // Show spinner
  resultPanel.innerHTML = '<div class="spinner"></div>';
  meta.hidden = true;

  try {
    const res = await fetch('/generate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(getAttrs()),
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

      latencyBadge.textContent = `Latency: ${data.latencyMs.toLocaleString()} ms`;
      promptText.textContent = data.prompt;
      meta.hidden = false;
    }
  } catch (err) {
    resultPanel.innerHTML = `<p style="color:red;padding:1rem">Network error: ${err.message}</p>`;
  } finally {
    btn.disabled = false;
    btn.textContent = 'Generate Character';
  }
});
