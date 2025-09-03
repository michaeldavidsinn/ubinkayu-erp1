/* eslint-disable @typescript-eslint/no-explicit-any */
// File: src/preload/index.ts

import { contextBridge, ipcRenderer } from 'electron'

// Daftar semua fungsi yang ingin kita 'jembatani' dari backend ke frontend
const api = {
  ping: () => ipcRenderer.invoke('ping'),

  saveNewPO: (data: any) => ipcRenderer.invoke('po:save', data),
  listPOs: () => ipcRenderer.invoke('po:list'),
  deletePO: (poId: string) => ipcRenderer.invoke('po:delete', poId),
  updatePO: (data: any) => ipcRenderer.invoke('po:update', data),
  listPOItems: (poId: string) => ipcRenderer.invoke('po:listItems', poId),
  getProducts: () => ipcRenderer.invoke('product:get')
}

// Proses 'expose' atau pendaftaran API ke window object di UI
try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error(error)
}
