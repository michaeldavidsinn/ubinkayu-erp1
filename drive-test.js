// File: drive-test.js

import { google } from 'googleapis'
import { join } from 'path'
import { existsSync, readFileSync } from 'fs'
import { JWT } from 'google-auth-library'

// --- KONFIGURASI ---
const FOLDER_ID_TO_TEST = '1aedVePLtDkLVJ1lRQOgqUkUW8wU8fkOM' // ID Folder "po"
const CREDENTIALS_PATH = join(process.cwd(), 'electron', 'credentials.json')
// -------------------

function getAuth() {
  if (!existsSync(CREDENTIALS_PATH)) {
    throw new Error('File credentials.json tidak ditemukan di folder electron.')
  }
  const creds = JSON.parse(readFileSync(CREDENTIALS_PATH, 'utf8'))
  return new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'] // Cukup scope drive
  })
}

async function runTest() {
  try {
    console.log('1. Memulai proses otentikasi Service Account...')
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })
    console.log('✅ Otentikasi berhasil untuk:', auth.email)

    console.log('\n2. Mencoba mengakses detail folder target...')
    console.log(`   - ID Folder: ${FOLDER_ID_TO_TEST}`)

    // Tes paling penting: Mencoba mendapatkan metadata folder
    await drive.files.get({
      fileId: FOLDER_ID_TO_TEST,
      supportsAllDrives: true,
      fields: 'id, name, parents'
    })

    console.log('✅ SUKSES! Service Account BISA menemukan dan mengakses folder target.')
    console.log('\n   Ini berarti masalahnya SANGAT ANEH dan mungkin terkait cache atau hal lain.')
  } catch (error) {
    console.error('\n❌ GAGAL! Terjadi error saat menjalankan tes:')
    if (error.code === 404) {
      console.error('   - KESIMPULAN: Error 404 (Not Found) terkonfirmasi.')
      console.error(
        '   - PENYEBAB: Ini membuktikan bahwa dari sudut pandang API, Service Account Anda TETAP TIDAK MEMILIKI IZIN untuk "melihat" folder ini, meskipun Anda sudah menambahkannya sebagai anggota.'
      )
      console.error(
        '   - SOLUSI: Masalah ini 100% ada pada perizinan di sisi Google Drive/Workspace. Coba buat Drive Bersama BARU dari awal dan berikan izin lagi.'
      )
    } else {
      console.error(error.message)
    }
  }
}

runTest()
