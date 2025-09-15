/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-explicit-any */

interface ICustomAPI {
  getProducts: () => Promise<any[]>;
  saveNewPO: (data: any) => Promise<{ success: boolean; poId?: string; error?: string }>;
  listPOs: () => Promise<any[]>;
  ping: () => Promise<string>;
  deletePO: (poId: string) => Promise<void>;
  updatePO: (data: any) => Promise<{ success: boolean; error?: string }>;
  listPOItems: (poId: string) => Promise<any[]>;
  listPORevisions: (poId: string) => Promise<any[]>;
  listPOItemsByRevision: (revisionId: string) => Promise<any[]>;
  previewPO: (data: any) => Promise<any>;
  getRevisionHistory: (poId: string) => Promise<any[]>;
  openExternalLink: (url: string) => Promise<{ success: boolean; error?: string }>;

  // Definisi tipe untuk fungsi progress tracking
  getActivePOs: () => Promise<any[]>;
  getPOItemsDetails: (poId: string) => Promise<any[]>;
  updateItemProgress: (data: any) => Promise<{ success: boolean; error?: string }>;
  // [BARU] Tambahkan definisi tipe baru di sini
  getRecentUpdates: () => Promise<any[]>;
}

declare global {
  interface Window {
    api: ICustomAPI
  }
}

export {};