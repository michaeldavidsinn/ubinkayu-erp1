// File: src/renderer/src/global.d.ts

// Deklarasikan tipe untuk objek API kita
interface ICustomAPI {
  saveNewPO: (data: any) => Promise<{ success: boolean; poId?: string; error?: string }>;
  listPOs: () => Promise<any[]>;
}

// Perluas tipe 'Window' global
declare global {
  interface Window {
    api: ICustomAPI
  }
}