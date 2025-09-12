/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-explicit-any */
// File: src/preload/index.d.ts

// Deklarasikan tipe untuk objek API kita
interface ICustomAPI {
  getProducts: () => Promise<any[]>
  saveNewPO: (data: any) => Promise<{ success: boolean; poId?: string; error?: string }>;
  listPOs: () => Promise<any[]>;
  ping: () => Promise<string>;
  deletePO: (poId: string) => Promise<void>
  updatePO: (data: any) => Promise<{ success: boolean; error?: string }>
  listPOItems: (poId: string) => Promise<any[]>
  listPORevisions: (poId: string) => Promise<any[]>;
  listPOItemsByRevision: (revisionId: string) => Promise<any[]>;
  previewPO: (data: any) => Promise<any>;

  // ▼▼▼ TAMBAHKAN TIPE UNTUK FUNGSI BARU DI SINI ▼▼▼
  getRevisionHistory: (poId: string) => Promise<any[]>;
  generateAndUploadPO: (poData: any, revNum: number) => Promise<{ success: boolean; link?: string; error?: string }>;
  onAuthStarted: (callback: () => void) => void;
  sendAuthCode: (code: string) => void;

}

// Perluas tipe 'Window' global
declare global {
  interface Window {
    // electron: ElectronAPI // Baris ini mungkin ada dari template, biarkan saja
    api: ICustomAPI
  }
}

// Baris export kosong ini penting agar file dianggap sebagai module
export {};