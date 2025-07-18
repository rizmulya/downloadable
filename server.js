// server.js
import express from 'express';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';

import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';

import { getDownloadDir, getDownloadablesPath } from './config.js';
import { downloadM3U8, parseHeaders, getUniqueFilename } from './utils.js';

ffmpeg.setFfmpegPath(ffmpegPath);

const app = express();
const PORT = 12345;

let DOWNLOAD_DIR = getDownloadDir();
let DOWNLOADABLES_PATH = getDownloadablesPath();

app.use(express.json());

let downloadAbles = [];
if (fs.existsSync(DOWNLOADABLES_PATH)) {
  try {
    downloadAbles = JSON.parse(fs.readFileSync(DOWNLOADABLES_PATH, 'utf-8'));
  } catch (err) {
    console.error("Failed:", err);
  }
}
const progressMap = new Map();

function saveDownloadAbles() {
  fs.writeFileSync(DOWNLOADABLES_PATH, JSON.stringify(downloadAbles, null, 2));
}

// 
// routes
// 
app.post('/save', (req, res) => {
  const existingIndex = downloadAbles.findIndex(item => item.url === req.body.url);
  if (existingIndex !== -1) {
    downloadAbles.splice(existingIndex, 1);
  }
  downloadAbles.unshift(req.body);
  saveDownloadAbles();
  res.sendStatus(200);
});

app.get('/list', (req, res) => {
  res.json(downloadAbles);
});

app.get('/reset', (req, res) => {
  downloadAbles = [];
  fs.unlink(DOWNLOADABLES_PATH, () => {});
  res.send("OK");
});

// Download handler
app.post('/fetch/:id', async (req, res) => {
  const id = req.params.id;
  const file = downloadAbles[id];
  if (!file) return res.status(404).send("Not found");

  const nameFromDisposition = file.disposition?.match(/filename="?([^"\n]+)"?/)?.[1];
  const fallbackName = path.basename(file.url).split("?")[0] || `file_${Date.now()}`;
  const customName = req.body?.name?.trim() || null;
  const rawName = customName || nameFromDisposition || fallbackName;
  const ext = file.contentType?.includes('mpegurl') ? '.mp4' : path.extname(rawName);
  const baseName = path.parse(rawName).name;
  const outPath = getUniqueFilename(DOWNLOAD_DIR, baseName, ext);
  const filename = path.basename(outPath);

  try {
    progressMap.set(id, { progress: 0, done: false });

    if (file.url.includes(".m3u8") || file.contentType?.includes("mpegurl")) {
      await downloadM3U8(file.url, parseHeaders(file.headers), outPath, id);
    } else {
      const response = await fetch(file.url, { headers: parseHeaders(file.headers) });
      if (!response.ok) throw new Error("Failed to download");

      const total = parseInt(response.headers.get('content-length'));
      let loaded = 0;

      const fileStream = fs.createWriteStream(outPath);
      response.body.on("data", chunk => {
        loaded += chunk.length;
        if (total) {
          progressMap.set(id, { progress: Math.floor((loaded / total) * 100), done: false });
        }
      });

      await new Promise((resolve, reject) => {
        response.body.pipe(fileStream);
        response.body.on("error", reject);
        fileStream.on("finish", () => {
          progressMap.set(id, { progress: 100, done: true });
          resolve();
        });
      });
    }

    res.send("Downloaded to: " + filename);
  } catch (err) {
    console.error("Error downloading:", err);
    progressMap.delete(id);
    res.status(500).send("Download failed");
  }
});

app.get('/progress/:id', (req, res) => {
  const data = progressMap.get(req.params.id) || { progress: 0, done: false };
  res.json(data);
});

app.get('/preview/:id', async (req, res) => {
  const file = downloadAbles[req.params.id];
  if (!file) return res.status(404).send("Not found");

  try {
    const response = await fetch(file.url, {
      headers: parseHeaders(file.headers)
    });

    if (!response.ok) throw new Error("Failed to fetch preview");
    
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');
    const contentDisposition = response.headers.get('content-disposition');
    const acceptRanges = response.headers.get('accept-ranges');

    if (contentType) res.setHeader('Content-Type', contentType);
    if (contentLength) res.setHeader('Content-Length', contentLength);
    if (contentDisposition) res.setHeader('Content-Disposition', contentDisposition);
    if (acceptRanges) res.setHeader('Accept-Ranges', acceptRanges);
    
    response.body.pipe(res);
  } catch (err) {
    console.error("Preview error:", err);
    res.status(500).send("Preview failed");
  }
});

fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });

app.listen(PORT, () => {
  console.log(`Server listening at http://localhost:${PORT}`);
});
