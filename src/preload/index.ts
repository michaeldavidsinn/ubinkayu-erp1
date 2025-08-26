// File: src/preload/index.ts

import { contextBridge, ipcRenderer } from 'electron'


// Daftar semua fungsi yang ingin kita 'jembatani' dari backend ke frontend
const api = {

 ping: () => ipcRenderer.invoke('ping'),
  /**
   * Mengirim data PO baru untuk disimpan.
   * Ini akan memanggil ipcMain.handle('po:save', ...) di index.ts
   */
  saveNewPO: (data: any) => ipcRenderer.invoke('po:save', data),
  
  /**
   * Meminta daftar semua PO yang ada.
   * Ini akan memanggil ipcMain.handle('po:list', ...) di index.ts
   */
  listPOs: () => ipcRenderer.invoke('po:list'),
}

// Proses 'expose' atau pendaftaran API ke window object di UI
try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error(error)
}