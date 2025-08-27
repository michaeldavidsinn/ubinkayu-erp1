// File: src/preload/index.ts

import { contextBridge, ipcRenderer } from 'electron'

// Daftar semua fungsi yang ingin kita 'jembatani' dari backend ke frontend
const api = {
  ping: () => ipcRenderer.invoke('ping'),

  saveNewPO: (data: any) => ipcRenderer.invoke('po:save', data),

  listPOs: () => ipcRenderer.invoke('po:list'),

  // ✨ Tambahkan baris ini untuk mendaftarkan fungsi deletePO
  deletePO: (poId: string) => ipcRenderer.invoke('po:delete', poId),
  updatePO: (data: any) => ipcRenderer.invoke('po:update', data)
}

// Proses 'expose' atau pendaftaran API ke window object di UI
try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error(error)
}