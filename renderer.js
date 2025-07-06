let contentTypes = new Set();
const shownPreviews = new Set();

async function fetchList() {
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

  li.innerHTML = `
    <div class="url">${item.url}</div>
    <small>${item.contentType}</small>
    <small>${formatTime(item.time)}</small>
    <div class="preview" id="preview-${i}"></div>
    <div class="actions">
      <button onclick="download(${i})">Download</button>
      <button id="preview-btn-${i}">Preview</button>
    </div>
  `;

  ul.appendChild(li);

  // Restore preview state if already shown
  if (shownPreviews.has(i)) {
    const previewBtn = document.getElementById(`preview-btn-${i}`);
    togglePreview(i, item.contentType, previewBtn);
  }

  // Add toggle handler
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
    // Hide preview
    container.innerHTML = '';
    shownPreviews.delete(id);
    button.textContent = 'Preview';
    return;
  }

  // Show preview
  const url = `http://localhost:12345/preview/${id}`;
  let preview = '';

  if (contentType.startsWith('image/')) {
    preview = `<img src="${url}" style="max-width:100%; max-height:200px; border-radius:8px;" />`;
  } else if (contentType.startsWith('video/')) {
    preview = `<video src="${url}" controls style="width:100%; max-height:200px; border-radius:8px;"></video>`;
  } else if (contentType.startsWith('audio/')) {
    preview = `<audio src="${url}" controls style="width:100%;"></audio>`;
  } else {
    preview = `<em>No preview available for this file type.</em>`;
  }

  container.innerHTML = preview;
  shownPreviews.add(id);
  button.textContent = 'Close Preview';
}



async function download(id) {
  const button = document.querySelectorAll('.card .actions button')[id];
  const originalText = button.textContent;

  button.disabled = true;
  button.textContent = 'Downloading...';
  button.style.backgroundColor = '#95a5a6';
  button.style.cursor = 'not-allowed';

  try {
    const res = await fetch(`http://localhost:12345/fetch/${id}`, {
      method: 'POST',
    });

    const text = await res.text();
    alert(text);

    if (!res.ok) throw new Error(text);
  } catch (err) {
    alert(err.message);
  } finally {
    button.disabled = false;
    button.textContent = originalText;
    button.style.backgroundColor = '#3498db';
    button.style.cursor = 'pointer';
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

setInterval(() => {
  if (shownPreviews.size === 0) {
    fetchList();
  }
}, 2000);