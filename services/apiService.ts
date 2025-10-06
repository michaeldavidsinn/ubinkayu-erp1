// File: src/renderer/src/services/apiService.ts

// Cek apakah aplikasi berjalan di dalam Electron
const isElectron = !!window.api

// Tentukan URL dasar API. Saat development, kita panggil localhost.
// Saat production (di Vercel/Capacitor), kita panggil URL API Vercel.
const API_BASE_URL =
  process.env.NODE_ENV === 'development'
    ? 'http://localhost:5173/api' // Sesuaikan port jika berbeda
    : '/api' // Di Vercel, cukup panggil path relatif

/**
 * Mengambil daftar semua Purchase Orders.
 * Fungsi ini secara otomatis memilih antara Electron IPC atau Web API.
 */
export const listPOs = async () => {
  if (isElectron) {
    return window.api.listPOs()
  } else {
    const response = await fetch(`${API_BASE_URL}/listPOs`)
    if (!response.ok) {
      throw new Error('Gagal mengambil data PO dari server.')
    }
    return response.json()
  }
}

/**
 * Mengambil daftar semua Produk.
 */
export const getProducts = async () => {
  if (isElectron) {
    return window.api.getProducts()
  } else {
    const response = await fetch(`${API_BASE_URL}/getProducts`)
    if (!response.ok) throw new Error('Gagal mengambil data produk.')
    return response.json()
  }
}

// ... BUAT FUNGSI SEPERTI INI UNTUK SETIAP ENDPOINT API ANDA ...
// Contoh untuk fungsi yang mengirim data (POST)
export const saveNewPO = async (data: any) => {
  if (isElectron) {
    return window.api.saveNewPO(data)
  } else {
    const response = await fetch(`${API_BASE_URL}/savePO`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    })
    if (!response.ok) throw new Error('Gagal menyimpan PO.')
    return response.json()
  }
}
