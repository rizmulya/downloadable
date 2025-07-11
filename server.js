import express from 'express';
import fs from 'fs';
import fetch from 'node-fetch';
import path from 'path';
import { Parser } from 'm3u8-parser';
import os from 'os';
import ffmpegPath from 'ffmpeg-static';
import ffmpeg from 'fluent-ffmpeg';
import { getDownloadDir, getDownloadablesPath } from './config.js';

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

function saveDownloadAbles() {
  fs.writeFileSync(DOWNLOADABLES_PATH, JSON.stringify(downloadAbles, null, 2));
}

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

async function downloadM3U8(m3u8Url, headers, outputPath) {
  console.log("Start M3U8 download:", m3u8Url);

  const res = await fetch(m3u8Url, { headers });
  const m3u8Text = await res.text();

  const parser = new Parser();
  parser.push(m3u8Text);
  parser.end();

  const baseUrl = m3u8Url.substring(0, m3u8Url.lastIndexOf("/") + 1);
  const segments = parser.manifest.segments;

  if (!segments || segments.length === 0) {
    throw new Error("No segments found in m3u8");
  }

  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'segments-'));
  const listPath = path.join(tmpDir, 'input.txt');
  const segmentPaths = [];

  for (let i = 0; i < segments.length; i++) {
    const segmentUrl = new URL(segments[i].uri, baseUrl).toString();
    const segPath = path.join(tmpDir, `seg_${i}.m4s`);

    console.log(`Segment ${i + 1}/${segments.length}: ${segmentUrl}`);
    const segRes = await fetch(segmentUrl, { headers });
    if (!segRes.ok) throw new Error(`Failed segment ${i}: ${segmentUrl}`);
    const segBuffer = await segRes.buffer();
    fs.writeFileSync(segPath, segBuffer);
    segmentPaths.push(segPath);
  }

  fs.writeFileSync(listPath, segmentPaths.map(p => `file '${p}'`).join('\n'));

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy'])
      .output(outputPath)
      .on('end', resolve)
      .on('error', reject)
      .run();
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });

  console.log(`Video saved to ${outputPath}`);
}

// Download handler
app.post('/fetch/:id', async (req, res) => {
  const file = downloadAbles[req.params.id];
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
    if (file.url.includes(".m3u8") || file.contentType?.includes("mpegurl")) {
      await downloadM3U8(file.url, file.headers, outPath);
    } else {
      const response = await fetch(file.url, { headers: file.headers });
      if (!response.ok) throw new Error("Failed to download");

      const fileStream = fs.createWriteStream(outPath);
      await new Promise((resolve, reject) => {
        response.body.pipe(fileStream);
        response.body.on("error", reject);
        fileStream.on("finish", resolve);
      });
    }

    res.send("Downloaded to: " + filename);
  } catch (err) {
    console.error("Error downloading:", err);
    res.status(500).send("Download failed");
  }
});

function getUniqueFilename(dir, base, ext) {
  let filename = `${base}${ext}`;
  let fullPath = path.join(dir, filename);
  let counter = 1;

  while (fs.existsSync(fullPath)) {
    filename = `${base} (${counter})${ext}`;
    fullPath = path.join(dir, filename);
    counter++;
  }

  return fullPath;
}

app.get('/preview/:id', async (req, res) => {
  const file = downloadAbles[req.params.id];
  if (!file) return res.status(404).send("Not found");

  try {
    const response = await fetch(file.url, {
      headers: file.headers
    });

    if (!response.ok) throw new Error("Failed to fetch preview");
    res.setHeader('Content-Type', response.headers.get('content-type'));
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
