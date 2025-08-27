/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/no-explicit-any */
// File: src/preload/index.d.ts

// Deklarasikan tipe untuk objek API kita
interface ICustomAPI {
  saveNewPO: (data: any) => Promise<{ success: boolean; poId?: string; error?: string }>;
  listPOs: () => Promise<any[]>;
  ping: () => Promise<string>;
  deletePO: (poId: string) => Promise<void>
  updatePO: (data: any) => Promise<{ success: boolean; error?: string }>
  listPOItems: (poId: string) => Promise<any[]>
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