/* eslint-disable @typescript-eslint/no-require-imports */
// File: src/preload/index.js
const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('api', {
  // ===== PO CRUD =====
  saveNewPO: (data) => ipcRenderer.invoke('po:save', data),
  listPOs: () => ipcRenderer.invoke('po:list'),
  updatePO: (data) => ipcRenderer.invoke('po:update', data),
  deletePO: (poId) => ipcRenderer.invoke('po:delete', poId),
  listPOItems: (poId) => ipcRenderer.invoke('po:listItems', poId),
  listPORevisions: (poId) => ipcRenderer.invoke('po:listRevisions', poId),
  listPOItemsByRevision: (revId) => ipcRenderer.invoke('po:listItemsByRevision', revId),

  // ===== PRODUCTS =====
  getProducts: () => ipcRenderer.invoke('product:get'),

  // ===== PDF PREVIEW =====
  previewPO: (data) => ipcRenderer.invoke('po:preview', data),

  // ===== TESTING =====
  ping: () => ipcRenderer.invoke('ping'),
})
