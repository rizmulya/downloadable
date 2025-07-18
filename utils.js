// utils.js
import { Parser } from 'm3u8-parser';
import fetch from 'node-fetch';
import os from 'os';
import path from 'path';
import fs from 'fs';

function parseHeaders(headers = {}) {
  const normalized = { ...headers };
  for (const key in normalized) {
    if (key.toLowerCase() === 'range') {
      normalized[key] = 'bytes=0-';
    }
  }
  return normalized;
}

async function downloadM3U8(m3u8Url, headers, outputPath, id) {
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

    // console.log(`Segment ${i + 1}/${segments.length}: ${segmentUrl}`);
    const segRes = await fetch(segmentUrl, { headers });
    if (!segRes.ok) throw new Error(`Failed segment ${i}: ${segmentUrl}`);
    const segBuffer = await segRes.buffer();
    fs.writeFileSync(segPath, segBuffer);
    segmentPaths.push(segPath);

    progressMap.set(id, { progress: Math.floor(((i + 1) / segments.length) * 100), done: false });
  }

  fs.writeFileSync(listPath, segmentPaths.map(p => `file '${p}'`).join('\n'));

  await new Promise((resolve, reject) => {
    ffmpeg()
      .input(listPath)
      .inputOptions(['-f', 'concat', '-safe', '0'])
      .outputOptions(['-c', 'copy'])
      .output(outputPath)
      .on('end', () => {
        progressMap.set(id, { progress: 100, done: true });
        resolve();
      })
      .on('error', reject)
      .run();
  });

  fs.rmSync(tmpDir, { recursive: true, force: true });
}

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

export { downloadM3U8, parseHeaders, getUniqueFilename };