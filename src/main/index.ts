/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { app, BrowserWindow, ipcMain, shell, dialog } from 'electron'
import path from 'node:path'
import fs from 'fs'

import {
  testSheetConnection,
  saveNewPO,
  listPOs,
  deletePO,
  updatePO,
  listPOItems,
  getProducts,
  listPORevisions,
  listPOItemsByRevision,
  previewPO,
  getRevisionHistory,
  getActivePOsWithProgress,
  getPOItemsWithDetails,
  updateItemProgress,
  getRecentProgressUpdates,
  // [BARU] Impor fungsi baru
  getAttentionData,
  getProductSalesAnalysis,
  getSalesItemData
} from '../../electron/sheet.js'

if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disk-cache-dir', 'C:/temp/electron-cache')
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache')
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  })

  if (process.env['ELECTRON_RENDERER_URL']) { // <-- GUNAKAN NAMA YANG BARU
    win.loadURL(process.env['ELECTRON_RENDERER_URL'])
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  testSheetConnection()

  // --- IPC Handlers ---
  ipcMain.handle('ping', () => 'pong')
  ipcMain.handle('po:list', () => listPOs())
  ipcMain.handle('po:save', async (_event, data) => saveNewPO(data))
  ipcMain.handle('po:delete', async (_event, poId) => deletePO(poId))
  ipcMain.handle('po:update', async (_event, data) => updatePO(data))
  ipcMain.handle('po:preview', async (_event, data) => previewPO(data))
  ipcMain.handle('po:listItems', async (_event, poId) => listPOItems(poId))
  ipcMain.handle('po:listRevisions', async (_event, poId) => listPORevisions(poId))
  ipcMain.handle('po:listItemsByRevision', async (_event, poId, revisionNumber) => listPOItemsByRevision(poId, revisionNumber))
  ipcMain.handle('po:getRevisionHistory', async (_event, poId) => getRevisionHistory(poId))
  ipcMain.handle('product:get', () => getProducts())
  ipcMain.handle('app:open-external-link', (_event, url) => {
    if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
      shell.openExternal(url);
      return { success: true };
    }
    return { success: false, error: 'Invalid URL' };
  });

  // --- IPC Handler untuk File Dialog ---
  ipcMain.handle('app:open-file-dialog', async () => {
    const result = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
        { name: 'All Files', extensions: ['*'] }
      ]
    });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0];
  });

  // --- IPC Handlers untuk Progress Tracking ---
  ipcMain.handle('progress:getActivePOs', () => getActivePOsWithProgress());
  ipcMain.handle('progress:getPOItems', (_event, poId) => getPOItemsWithDetails(poId));
  ipcMain.handle('progress:updateItem', (_event, data) => updateItemProgress(data));
  ipcMain.handle('progress:getRecentUpdates', () => getRecentProgressUpdates());
  // [BARU] Daftarkan handler untuk data atensi
  ipcMain.handle('progress:getAttentionData', () => getAttentionData());
  ipcMain.handle('analysis:getProductSales', () => getProductSalesAnalysis());
  ipcMain.handle('analysis:getSalesItemData', () => getSalesItemData());

  ipcMain.handle('app:read-file-base64', async (_event, filePath) => {
    try {
      const buffer = await fs.promises.readFile(filePath);
      return buffer.toString('base64');
    } catch (error) {
      console.error('Failed to read file as base64:', error);
      return null;
    }
  });


  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})