/* eslint-disable @typescript-eslint/no-explicit-any */
import { contextBridge, ipcRenderer } from 'electron'

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
  getActivePOs: () => ipcRenderer.invoke('progress:getActivePOs'),
  getPOItemsDetails: (poId) => ipcRenderer.invoke('progress:getPOItems', poId),
  updateItemProgress: (data) => ipcRenderer.invoke('progress:updateItem', data),
  getRecentUpdates: () => ipcRenderer.invoke('progress:getRecentUpdates'),
  // [BARU] Tambahkan fungsi baru di sini
  getAttentionData: () => ipcRenderer.invoke('progress:getAttentionData'),

  openFileDialog: () => ipcRenderer.invoke('app:open-file-dialog'),
  getProductSalesAnalysis: () => ipcRenderer.invoke('analysis:getProductSales'),
  getSalesItemData: () => ipcRenderer.invoke('analysis:getSalesItemData'),
  readFileAsBase64: (filePath) => ipcRenderer.invoke('app:read-file-base64', filePath)
};

try {
  contextBridge.exposeInMainWorld('api', api)
} catch (error) {
  console.error(error)
}