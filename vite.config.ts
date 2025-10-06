// File: vite.config.ts

import { defineConfig } from 'vite'
import path from 'path'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Tentukan "akar" dari aplikasi frontend Anda
  root: path.resolve(__dirname, 'src/renderer'),

  plugins: [react()],

  resolve: {
    alias: {
      // Alias ini penting agar import seperti '@renderer/...' tetap berfungsi
      '@renderer': path.resolve(__dirname, 'src/renderer/src')
    }
  },

  build: {
    // Tentukan folder output relatif terhadap root proyek
    outDir: path.resolve(__dirname, 'dist'),
    // Kosongkan folder output sebelum build
    emptyOutDir: true,
  }
})