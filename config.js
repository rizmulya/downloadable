import fs from 'fs';
import path from 'path';
import { app } from 'electron';

const configPath = path.join(app.getPath('userData'), 'config.json');

function loadConfig() {
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch (e) {
    console.error('Failed to read config:', e);
  }
  return {};
}

function saveConfig(data) {
  fs.writeFileSync(configPath, JSON.stringify(data, null, 2));
}

function getDownloadDir() {
  const config = loadConfig();
  return config.downloadDir || path.join(app.getPath('downloads'), 'Downloadable');
}

function setDownloadDir(dir) {
  const config = loadConfig();
  config.downloadDir = dir;
  saveConfig(config);
}

function getDownloadablesPath() {
  return path.join(app.getPath('userData'), 'downloadAbles.json');
}

export { getDownloadDir, setDownloadDir, getDownloadablesPath };
