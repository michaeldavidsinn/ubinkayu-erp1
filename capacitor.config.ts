// file: capacitor.config.ts

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.ubinkayu.erp',
  appName: 'Ubinkayu ERP',
  webDir: 'out/renderer',
  server: {
    androidScheme: 'https',
    // --- TAMBAHKAN BLOK DI BAWAH INI ---
    allowNavigation: ['ubinkayu-erp1-git-erp1-mobile-cea6e7-michaeldavidsinns-projects.vercel.app']
    // ---------------------------------
  }
}

export default config
