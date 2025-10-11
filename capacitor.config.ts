// file: capacitor.config.ts

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.ubinkayu.erp',
  appName: 'Ubinkayu ERP',
  webDir: 'out/renderer',
  server: {
    // --- TAMBAHKAN BARIS DI BAWAH INI ---
    url: 'https://ubinkayu-erp1.vercel.app',
    // ---------------------------------
    androidScheme: 'https',
    allowNavigation: [
      'ubinkayu-erp1-git-erp1-mobile-cea6e7-michaeldavidsinns-projects.vercel.app'
    ]
  }
};

export default config;