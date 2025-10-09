/* eslint-disable @typescript-eslint/no-explicit-any */
import { contextBridge, ipcRenderer } from 'electron'

console.log('✅ --- PRELOAD SCRIPT STARTED ---')

const api = {
  // --- Fungsi Dasar & Test ---
  ping: () => ipcRenderer.invoke('ping'),

  // --- Fungsi untuk Products ---
  getProducts: () => ipcRenderer.invoke('product:get'),

  // --- Fungsi CRUD untuk Purchase Order (PO) ---
  saveNewPO: (data) => ipcRenderer.invoke('po:save', data),
  listPOs: () => ipcRenderer.invoke('po:list'),
  updatePO: (data) => ipcRenderer.invoke('po:update', data),
  deletePO: (poId) => ipcRenderer.invoke('po:delete', poId),
  listPOItems: (poId) => ipcRenderer.invoke('po:listItems', poId),

  // --- Fungsi untuk Revisi & Histori ---
  listPORevisions: (poId) => ipcRenderer.invoke('po:listRevisions', poId),
  listPOItemsByRevision: (revId) => ipcRenderer.invoke('po:listItemsByRevision', revId),
  getRevisionHistory: (poId) => ipcRenderer.invoke('po:getRevisionHistory', poId),

  // --- Fungsi untuk PDF & Link ---
  previewPO: (data) => ipcRenderer.invoke('po:preview', data),
  openExternalLink: (url) => ipcRenderer.invoke('app:open-external-link', url),

  // --- Fungsi untuk Progress Tracking ---
  updateItemProgress: (data) => ipcRenderer.invoke('progress:updateItem', data),
  getActivePOsWithProgress: () => ipcRenderer.invoke('progress:getActivePOs'), // Ganti dari getActivePOs
  getPOItemsWithDetails: (poId) => ipcRenderer.invoke('progress:getPOItems', poId), // Ganti dari getPOItemsDetails
  getRecentProgressUpdates: () => ipcRenderer.invoke('progress:getRecentUpdates'), // Ganti dari getRecentUpdates
  // [BARU] Tambahkan fungsi baru di sini
  getAttentionData: () => ipcRenderer.invoke('progress:getAttentionData'),

  openFileDialog: () => ipcRenderer.invoke('app:open-file-dialog'),
  getProductSalesAnalysis: () => ipcRenderer.invoke('analysis:getProductSales'),
  getSalesItemData: () => ipcRenderer.invoke('analysis:getSalesItemData'),
  readFileAsBase64: (filePath) => ipcRenderer.invoke('app:read-file-base64', filePath)
};

try {
  console.log(' bridjinggg....') // <-- TAMBAHKAN INI
  contextBridge.exposeInMainWorld('api', api)
  console.log('✅ --- API EXPOSED TO WINDOW SUCCESSFULLY ---')
} catch (error) {
  console.error('❌ --- FAILED TO EXPOSE API ---', error)
}