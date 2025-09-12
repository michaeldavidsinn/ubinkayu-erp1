/* eslint-disable @typescript-eslint/no-explicit-any */
import { contextBridge, ipcRenderer } from 'electron'

// INI ADALAH VERSI LENGKAP YANG MENGGABUNGKAN SEMUANYA
const api = {
  // --- Fungsi Dasar & Test ---
  ping: () => ipcRenderer.invoke('ping'),

  // --- Fungsi untuk Products ---
  getProducts: () => ipcRenderer.invoke('product:get'),

  // --- Fungsi CRUD untuk Purchase Order (PO) ---
  saveNewPO: (data: any) => ipcRenderer.invoke('po:save', data),
  listPOs: () => ipcRenderer.invoke('po:list'),
  updatePO: (data: any) => ipcRenderer.invoke('po:update', data),
  deletePO: (poId: string) => ipcRenderer.invoke('po:delete', poId),
  listPOItems: (poId: string) => ipcRenderer.invoke('po:listItems', poId),

  // --- Fungsi untuk Revisi & Histori ---
  listPORevisions: (poId: string) => ipcRenderer.invoke('po:listRevisions', poId),
  listPOItemsByRevision: (revisionId: string) => ipcRenderer.invoke('po:listItemsByRevision', revisionId),
  getRevisionHistory: (poId: string) => ipcRenderer.invoke('po:getRevisionHistory', poId),

  // --- Fungsi untuk PDF ---
  previewPO: (data: any) => ipcRenderer.invoke('po:preview', data),

  // --- Fungsi untuk Progress Tracking ---
  getActivePOWithProgress: () => ipcRenderer.invoke('progress:getActivePOs'),
  updateItemProgress: (data: any) => ipcRenderer.invoke('progress:updateItem', data)
};

// Proses 'expose' atau pendaftaran API ke window object di UI
try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error(error)
}