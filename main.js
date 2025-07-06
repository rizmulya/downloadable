import { app, BrowserWindow, Menu, dialog } from 'electron';
import './server.js';
import { setDownloadDir } from './config.js';


function createWindow() {
  const win = new BrowserWindow({
    width: 400,
    height: 600,
  });

  win.loadFile('renderer.html');

  const menu = Menu.buildFromTemplate([
    {
      label: 'Settings',
      submenu: [
        {
          label: 'Download Folder',
          click: async () => {
            const result = await dialog.showOpenDialog(win, {
              properties: ['openDirectory'],
              title: 'Select Download Folder',
            });

            if (!result.canceled && result.filePaths.length > 0) {
              setDownloadDir(result.filePaths[0]);

              dialog.showMessageBox(win, {
                type: 'info',
                message: `Download folder updated:\n${result.filePaths[0]}`,
              });
            }
          },
        },
      ],
    }
  ]);

  Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);
