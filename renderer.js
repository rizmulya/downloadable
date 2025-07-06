let contentTypes = new Set();

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
      <div class="actions">
        <button onclick="download(${i})">Download</button>
      </div>
    `;
    ul.appendChild(li);
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
    const msg = await res.text();
    alert(msg);
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

setInterval(fetchList, 2000);
