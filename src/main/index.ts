// File: src/main/index.ts

import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';
// Pastikan path ini benar sesuai struktur folder Anda
import { testSheetConnection, saveNewPO, listPOs, deletePO, updatePO } from '../../electron/sheet.js';


// FIX UNTUK MASALAH CACHE: Diletakkan di paling atas, sebelum app ready.
// Ini akan menyimpan cache di folder C:\temp\electron-cache yang biasanya tidak ada masalah izin.
// Pastikan folder C:\temp ada di komputer Anda atau ganti path lain.
if (process.platform === 'win32') {
  app.commandLine.appendSwitch('disk-cache-dir', 'C:/temp/electron-cache');
  app.commandLine.appendSwitch('disable-gpu-shader-disk-cache');
}

async function createWindow() {
  const win = new BrowserWindow({
    width: 1200, // Lebarkan sedikit untuk UI yang lebih kompleks
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      // Pengaturan keamanan yang direkomendasikan untuk memisahkan UI dan backend
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // Memuat URL dari Vite dev server saat development, atau file HTML saat production
  if (process.env.VITE_DEV_SERVER_URL) {
    await win.loadURL(process.env.VITE_DEV_SERVER_URL);
    // Buka DevTools (F12) secara otomatis untuk debugging
    win.webContents.openDevTools();
  } else {
    await win.loadFile(path.join(__dirname, '../renderer/index.html'));
  }
}

// Blok ini akan berjalan saat Electron sudah siap
app.whenReady().then(() => {
  // 1. (Opsional) Lakukan tes koneksi ke Google Sheet saat aplikasi dimulai
  testSheetConnection();
  // Tambahkan ini di dalam app.whenReady() di src/main/index.ts

ipcMain.handle('ping', () => {
  console.log('--- ✅ PING DITERIMA DARI UI ---');
  return 'pong';
});
  // 2. Daftarkan semua 'jembatan' komunikasi (IPC Handler) di sini
  ipcMain.handle('po:list', async () => {
    return listPOs();
  });

  ipcMain.handle('po:save', async (_event, data) => {
    console.log('Menerima data PO dari UI untuk disimpan:', data);
    const result = await saveNewPO(data);
    return result
  })

  ipcMain.handle('po:delete', async (_event, poId) => {
    const result = await deletePO(poId);
    return result
  })

  ipcMain.handle('po:update', async (_event, data) => {
    const result = await updatePO(data)
    return result
  })

  // 3. Setelah semua persiapan selesai, buat dan tampilkan jendela aplikasi
  createWindow()

  // Handler untuk macOS
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

// Handler untuk menutup aplikasi saat semua jendela ditutup (kecuali di macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});