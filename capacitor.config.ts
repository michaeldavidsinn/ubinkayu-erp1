// file: capacitor.config.ts

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ubinkayu.erp',
  appName: 'Ubinkayu ERP',

  // [-] HAPUS ATAU UBAH BARIS INI:
  // webDir: 'www',

  // [+] GANTI DENGAN INI:
  webDir: 'out/renderer', // Arahkan ke folder output build Anda

  server: {
    androidScheme: 'https'
  }
};

export default config;