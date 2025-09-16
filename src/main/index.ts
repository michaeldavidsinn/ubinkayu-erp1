/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
import { app, BrowserWindow, ipcMain, shell,dialog } from 'electron'
import path from 'node:path'

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
  // [BARU] Impor fungsi-fungsi progress tracking
  getActivePOsWithProgress,
  getPOItemsWithDetails,
  updateItemProgress,
  getRecentProgressUpdates,
  
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

  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL)
    win.webContents.openDevTools()
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  testSheetConnection()

  // --- IPC Handlers LAMA ---
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
 ipcMain.handle('open-external-link', (_event, url) => {
  if (url && (url.startsWith('http:') || url.startsWith('https:'))) {
    shell.openExternal(url);
  }
})
ipcMain.handle('dialog:open-file', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog({
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'png', 'gif'] }]
    });
    if (!canceled) {
      return filePaths[0];
    }
    return null;
  });

  // --- [BARU] IPC Handlers untuk Progress Tracking ---
  ipcMain.handle('progress:getActivePOs', () => getActivePOsWithProgress());
  ipcMain.handle('progress:getPOItems', (_event, poId) => getPOItemsWithDetails(poId));
   ipcMain.handle('progress:updateItem', async (_event, data) => {
    return updateItemProgress(data);
  });
  ipcMain.handle('progress:getRecentUpdates', () => getRecentProgressUpdates());


  createWindow()
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})