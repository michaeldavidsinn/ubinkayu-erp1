/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-explicit-any */

interface ICustomAPI {
  getProducts: () => Promise<any[]>
  saveNewPO: (data: any) => Promise<{ success: boolean; poId?: string; error?: string }>
  listPOs: () => Promise<any[]>
  ping: () => Promise<string>
  deletePO: (poId: string) => Promise<any>
  updatePO: (data: any) => Promise<{ success: boolean; error?: string }>
  listPOItems: (poId: string) => Promise<any[]>
  listPORevisions: (poId: string) => Promise<any[]>
  listPOItemsByRevision: (revisionId: string) => Promise<any[]>
  previewPO: (data: any) => Promise<any>
  getRevisionHistory: (poId: string) => Promise<any[]>
  openExternalLink: (url: string) => Promise<{ success: boolean; error?: string }>

  // --- NAMA-NAMA FUNGSI INI SUDAH DIPERBAIKI ---
  getActivePOsWithProgress: () => Promise<any[]>
  getPOItemsWithDetails: (poId: string) => Promise<any[]>
  updateItemProgress: (data: any) => Promise<{ success: boolean; error?: string }>
  getRecentProgressUpdates: () => Promise<any[]>
  getAttentionData: () => Promise<any>
  getProductSalesAnalysis: () => Promise<any>
  getSalesItemData: () => Promise<any[]>

  // --- Fungsi File ---
  openFileDialog: () => Promise<string | null>
  readFileAsBase64: (filePath: string) => Promise<string | null>
}

declare global {
  interface Window {
    api: ICustomAPI
    electron: any
  }
}

export {}
