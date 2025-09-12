/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable prettier/prettier */
import { app, BrowserWindow, ipcMain,shell } from 'electron';
import path from 'node:path';

import {
  testSheetConnection, saveNewPO, listPOs, deletePO, updatePO,
  listPOItems, getProducts, listPORevisions, listPOItemsByRevision,
  previewPO, getRevisionHistory, generateAndUploadPO  // <-- Tambahkan getRevisionHistory
} from '../../electron/sheet.js';

// ... (sisa kode createWindow dan app.whenReady() bagian atas)
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disk-cache-dir', 'C:/temp/electron-cache');
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200, height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true, nodeIntegration: false,
    },
  });

  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
    win.webContents.openDevTools();
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

app.whenReady().then(() => {
  testSheetConnection();

  // IPC Handlers
  ipcMain.handle('ping', () => 'pong');
  ipcMain.handle('po:list', () => listPOs());
  ipcMain.handle('po:save', async (_event, data) => saveNewPO(data));
  ipcMain.handle('po:delete', async (_event, poId) => deletePO(poId));
  ipcMain.handle('po:update', async (_event, data) => updatePO(data));
  ipcMain.handle('po:preview', async (_event, data) => previewPO(data));
  ipcMain.handle('po:listItems', async (_event, poId) => listPOItems(poId));
  ipcMain.handle('po:listRevisions', async (_event, poId) => listPORevisions(poId));
  ipcMain.handle('po:listItemsByRevision', async (_event, poId, revisionNumber) => listPOItemsByRevision(poId, revisionNumber));
  ipcMain.handle('product:get', () => getProducts());

  // [BARU] Daftarkan handler untuk fungsi super kita
  ipcMain.handle('po:getRevisionHistory', async (_event, poId) => getRevisionHistory(poId));

   ipcMain.handle('po:generate-upload', async (event, poData, revNum) => {
    // Fungsi 'onAuthUrl' ini akan dikirim sebagai callback ke backend
    const onAuthUrl = (authUrl: string): void => {
      // Buka URL otorisasi di browser default pengguna
      shell.openExternal(authUrl);
      console.log('--- [BACKEND]: Mengirim event "gdrive:auth-started" ke UI ---');
      // Kirim event kembali ke UI untuk memberitahu pengguna
      event.sender.send('gdrive:auth-started');
    };
     ipcMain.on('gdrive:send-code', (event, code) => {
    // Teruskan kode ini ke proses otentikasi yang sedang menunggu di sheet.js
    ipcMain.emit('gdrive:receive-code', event, code);
  });
    
    return generateAndUploadPO(poData, revNum, onAuthUrl);
  });
  createWindow();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });