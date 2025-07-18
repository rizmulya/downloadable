// renderer.js
let contentTypes = new Set();
const shownPreviews = new Set();
let isDownloading = false;

async function fetchList() {
  if (isDownloading) return;

  const res = await fetch('http://localhost:12345/list');
  const items = await res.json();

  const filter = document.getElementById('filter').value;
  const ul = document.getElementById('list');
  ul.innerHTML = '';

  const filtered = items.filter(item =>
    !filter || item.contentType?.toLowerCase() === filter.toLowerCase()
  );

  filtered.forEach((item, i) => {
    const li = document.createElement('li');
    li.className = 'card';

  const fileName = item.disposition?.match(/filename="?([^"\n]+)"?/)?.[1] ||
                 item.url.split('/').pop().split('?')[0];

    li.innerHTML = `
      <div class="url">${item.url}</div>
      <small>${item.contentType}</small>
      <small>${formatTime(item.time)}</small>
      <div class="preview" id="preview-${i}"></div>
      <div class="actions">
        <button id="preview-btn-${i}" style="margin-right: 5px;">Preview</button>
        <button id="download-btn-${i}" onclick="download(${i}, '${fileName}')">Download</button>
      </div>
      <progress id="progress-${i}" max="100" value="0" style="width: 100%; margin-top: 10px; display: none;"></progress>
    `;

    ul.appendChild(li);

    if (shownPreviews.has(i)) {
      const previewBtn = document.getElementById(`preview-btn-${i}`);
      togglePreview(i, item.contentType, previewBtn);
    }

    document.getElementById(`preview-btn-${i}`).onclick = function () {
      togglePreview(i, item.contentType, this);
    };
  });

  if (contentTypes.size === 0) {
    const select = document.getElementById('filter');
    items.forEach(item => {
      const type = item.contentType || 'unknown';
      if (!contentTypes.has(type)) {
        contentTypes.add(type);
        const opt = document.createElement('option');
        opt.value = type;
        opt.textContent = type;
        select.appendChild(opt);
      }
    });
  }
}

function togglePreview(id, contentType, button) {
  const container = document.getElementById(`preview-${id}`);

  if (shownPreviews.has(id)) {
    container.innerHTML = '';
    shownPreviews.delete(id);
    button.textContent = 'Preview';
    return;
  }

  const url = `http://localhost:12345/preview/${id}`;
  let preview = '';

  if (contentType.startsWith('image/')) {
    preview = `<img src="${url}" style="max-width:100%; border-radius:8px;" />`;
  } else if (contentType.startsWith('video/')) {
    preview = `<video src="${url}" controls style="width:100%; border-radius:8px;"></video>`;
  } else if (contentType.startsWith('audio/')) {
    preview = `<audio src="${url}" controls style="width:100%;"></audio>`;
  } else {
    preview = `<em>No preview available for this file type.</em>`;
  }

  container.innerHTML = preview;
  shownPreviews.add(id);
  button.textContent = 'Close Preview';
}

async function download(id, fileName) {
  if (isDownloading) return;
  isDownloading = true;

  try {
    fileName = await showPrompt(fileName);
    if (!fileName) throw new Error("Download canceled.");
  } catch (err) {
    isDownloading = false;
    return;
  }

  const button = document.getElementById(`download-btn-${id}`);
  const progressBar = document.getElementById(`progress-${id}`);
  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = 'Downloading...';
  button.style.backgroundColor = '#95a5a6';
  button.style.cursor = 'not-allowed';
  progressBar.style.display = 'block';

  let polling = setInterval(async () => {
    try {
      const res = await fetch(`http://localhost:12345/progress/${id}`);
      const json = await res.json();
      progressBar.value = json.progress || 0;
    } catch {}
  }, 500);

  try {
    const res = await fetch(`http://localhost:12345/fetch/${id}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ name: fileName || null })
    });

    const text = await res.text();
    alert(text);

    if (!res.ok) throw new Error(text);
  } catch (err) {
    alert(err.message);
  } finally {
    clearInterval(polling);
    button.disabled = false;
    button.textContent = originalText;
    button.style.backgroundColor = '#3498db';
    button.style.cursor = 'pointer';
    progressBar.style.display = 'none';
    progressBar.value = 0;
    isDownloading = false;
  }
}

async function reset() {
  const res = await fetch('http://localhost:12345/reset');
  if (res.ok) {
    contentTypes.clear();
    document.getElementById('filter').innerHTML = '<option value="">All Types</option>';
    fetchList();
  }
}

function formatTime(isoString) {
  const date = new Date(isoString);
  return date.toLocaleString('id-ID', {
    dateStyle: 'medium',
    timeStyle: 'medium',
  });
}

function showPrompt(defaultValue) {
  return new Promise(resolve => {
    const modal = document.getElementById('prompt-modal');
    const input = document.getElementById('prompt-input');
    modal.style.display = 'block';
    input.value = defaultValue || '';
    input.focus();

    window.closePrompt = (confirmed) => {
      modal.style.display = 'none';
      resolve(confirmed ? input.value : null);
    };
  });
}

setInterval(() => {
  if (shownPreviews.size === 0 && !isDownloading) {
    fetchList();
  }
}, 2000);
