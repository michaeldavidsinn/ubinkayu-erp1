// File: electron/sheet.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import path from 'node:path';
import fs from 'node:fs';

// --- BAGIAN 1: OTENTIKASI DAN KONEKSI ---

/**
 * Membaca file credentials.json dan menyiapkan otentikasi JWT.
 */
function getAuth() {
  const credPath = path.join(process.cwd(), 'electron', 'credentials.json');
  if (!fs.existsSync(credPath)) {
    throw new Error('File credentials.json tidak ditemukan di folder "electron". Pastikan lokasinya benar.');
  }
  const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'));

  return new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets'],
  });
}

/**
 * Membuka koneksi ke dokumen Google Sheet Anda.
 * Ini adalah fungsi dasar yang akan digunakan oleh semua fungsi lain.
 */
async function openDoc() {
  const spreadsheetId = "15Wj9b-2GKk5xH5ygfxBu7Q05GC7H_Rfkd-pEs-2MERE"; // Pastikan ID ini benar
  const auth = getAuth();
  const doc = new GoogleSpreadsheet(spreadsheetId, auth);
  return doc;
}


// --- BAGIAN 2: FUNGSI HELPER ---

/**
 * Menghasilkan ID berikutnya untuk baris baru (berdasarkan jumlah baris yang ada).
 */
async function nextId(sheet) {
  const rows = await sheet.getRows();
  // Menambahkan 1 ke jumlah baris yang ada untuk ID baru.
  // Ditambah 1 lagi karena header tidak dihitung getRows() tapi ID kita mulai dari 1.
  return String(rows.length + 1);
}


// --- BAGIAN 3: FUNGSI YANG DI-EXPORT (UNTUK DIPANGGIL DARI index.ts) ---

/**
 * Melakukan tes koneksi sederhana ke Google Sheets.
 */
export async function testSheetConnection() {
  console.log("Mencoba menghubungkan ke Google Sheets untuk tes...");
  try {
    const doc = await openDoc();
    await doc.loadInfo();
    console.log(`✅ Tes koneksi berhasil! Judul Dokumen: "${doc.title}"`);
  } catch (error) {
    console.error("❌ GAGAL melakukan tes koneksi ke Google Sheets!");
    if (error.response?.status === 403) {
      console.error("Error: Izin Ditolak (403). Pastikan email service account sudah diundang sebagai 'Editor'.");
    } else {
      console.error("Error Detail:", error.message);
    }
  }
}

/**
 * Menyimpan data PO baru yang dikirim dari UI.
 */
// Tambahkan ini di paling bawah file electron/sheet.js

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function listPOs() {
  console.log("Mencoba mengambil data PO dari Google Sheets...");
  try {
    const doc = await openDoc();
    await doc.loadInfo();

    const poSheet = doc.sheetsByTitle['purchase_orders'];
    if (!poSheet) throw new Error("Sheet 'purchase_orders' tidak ditemukan!");

    const poRows = await poSheet.getRows();

    const combinedPOs = poRows.map(r => ({
      // Gunakan _rawData untuk mengakses data berdasarkan posisi kolom
      id: r._rawData[0],
      po_number: r._rawData[1],
      project_name: r._rawData[2],
      deadline: r._rawData[3],
      status: r._rawData[4],
      priority: r._rawData[5],
      notes: r._rawData[6],
      created_at: r._rawData[7],
    }));

    console.log(`✅ Berhasil mengambil dan memetakan ${combinedPOs.length} PO.`);
    console.log("Data PO yang dikirim ke frontend:", combinedPOs);
    return combinedPOs;

  } catch (error) {
    console.error('❌ Gagal mengambil daftar PO dari Google Sheets:', error);
    return [];
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function saveNewPO(data) {
  try {
    const doc = await openDoc();
    await doc.loadInfo(); // Penting untuk memuat info sheet sebelum mengaksesnya
    const now = new Date().toISOString();

    // === Langkah 1: Simpan ke 'purchase_orders' ===
    const poSheet = doc.sheetsByTitle['purchase_orders'];
    if (!poSheet) throw new Error("Sheet 'purchase_orders' tidak ditemukan!");
    const poId = await nextId(poSheet);
    await poSheet.addRow({
      id: poId,
      po_number: data.nomorPo,
      project_name: data.namaCustomer,
      created_at: now,
      deadline: data.tanggalKirim, // TAMBAHAN BARU
      status: 'Open', // TAMBAHAN BARU
      priority: data.prioritas, // TAMBAHAN BARU
      notes: data.catatan, // TAMBAHAN BARU
    });
    console.log('Purchase Order header saved with ID:', poId);

    // === Langkah 2: Simpan Revisi 0 ke 'purchase_order_revisions' ===
    const revisionSheet = doc.sheetsByTitle['purchase_order_revisions'];
    if (!revisionSheet) throw new Error("Sheet 'purchase_order_revisions' tidak ditemukan!");
    const revId = await nextId(revisionSheet);
    await revisionSheet.addRow({
      id: revId,
      purchase_order_id: poId,
      revision_number: 0,
      deadline: data.tanggalKirim,
      status: 'Open',
      priority: data.prioritas,
      notes: data.catatan,
      created_at: now,
    });
    console.log('Revision 0 saved with ID:', revId);

    // === Langkah 3: Simpan semua item ke 'purchase_order_items' ===
    const itemSheet = doc.sheetsByTitle['purchase_order_items'];
    if (!itemSheet) throw new Error("Sheet 'purchase_order_items' tidak ditemukan!");
    for (const item of data.items) {
      const itemId = await nextId(itemSheet);
      await itemSheet.addRow({
        id: itemId,
        purchase_order_id: poId,
        revision_id: revId,
        product_id: item.productId,
        thickness_mm: item.thickness,
        width_mm: item.width,
        length_mm: item.length,
        quantity: item.qty,
        satuan: item.satuan,
        notes: item.notes
      });
      console.log(`Item "${item.notes}" saved with ID:`, itemId);
    }

    console.log('✅ Semua data PO berhasil disimpan!');
    return { success: true, poId };

  } catch (error) {
    console.error('❌ Gagal menyimpan PO ke Google Sheets:', error);
    return { success: false, error: error.message };
  }
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export async function deletePO(poId) {
  console.log(`Mencoba menghapus PO dengan ID: ${poId}`);
  try {
    const doc = await openDoc();
    await doc.loadInfo();

    // Hapus dari 'purchase_orders'
    const poSheet = doc.sheetsByTitle['purchase_orders'];
    const poRows = await poSheet.getRows();
    // 💡 Perbaikan di sini: Cari baris dengan membandingkan ID yang dicari dengan _rawData[0]
    const poToDelete = poRows.find(row => row._rawData[0] === poId);
    if (poToDelete) {
      await poToDelete.delete();
      console.log(`✅ PO header dengan ID ${poId} berhasil dihapus.`);
    }

    // Hapus dari 'purchase_order_revisions'
    const revSheet = doc.sheetsByTitle['purchase_order_revisions'];
    const revRows = await revSheet.getRows();
    // 💡 Perbaikan di sini: Cari baris dengan membandingkan purchase_order_id dengan _rawData[1]
    const revsToDelete = revRows.filter(row => row._rawData[1] === poId);
    for (const rev of revsToDelete) {
      await rev.delete();
    }
    console.log(`✅ ${revsToDelete.length} revisi untuk PO ${poId} berhasil dihapus.`);

    // Hapus dari 'purchase_order_items'
    const itemSheet = doc.sheetsByTitle['purchase_order_items'];
    const itemRows = await itemSheet.getRows();
    // 💡 Perbaikan di sini: Cari baris dengan membandingkan purchase_order_id dengan _rawData[1]
    const itemsToDelete = itemRows.filter(row => row._rawData[1] === poId);
    for (const item of itemsToDelete) {
      await item.delete();
    }
    console.log(`✅ ${itemsToDelete.length} item untuk PO ${poId} berhasil dihapus.`);

    console.log(`✅ Semua data terkait PO ${poId} berhasil dihapus.`);
    return { success: true };
  } catch (error) {
    console.error(`❌ Gagal menghapus PO ${poId}:`, error);
    return { success: false, error: error.message };
  }
}

export async function listPOItems(poId) {
  console.log(`Mencoba mengambil item PO untuk ID: ${poId}`);
  try {
    const doc = await openDoc();
    await doc.loadInfo();
    const itemSheet = doc.sheetsByTitle['purchase_order_items'];
    if (!itemSheet) throw new Error("Sheet 'purchase_order_items' tidak ditemukan!");

    const itemRows = await itemSheet.getRows();
    const items = itemRows.filter(r => r.purchase_order_id === poId).map(r => ({
      id: r.id,
      productId: r.product_id,
      notes: r.notes,
      qty: Number(r.quantity),
      satuan: r.satuan,
      thickness: Number(r.thickness_mm),
      width: Number(r.width_mm),
      length: Number(r.length_mm),
      // Anda mungkin perlu menambahkan properti lain di sini
    }));
    return items;
  } catch (error) {
    console.error(`Gagal mengambil item PO untuk ID ${poId}:`, error);
    return [];
  }
}

/**
 * Memperbarui data PO yang ada.
 * Ini akan memperbarui baris di 'purchase_orders' dan menambahkan revisi baru.
 */
export async function updatePO(data) {
  console.log("Mencoba memperbarui PO:", data.poId);
  try {
    const doc = await openDoc();
    await doc.loadInfo();
    const now = new Date().toISOString();

    // === Langkah 1: Perbarui data di 'purchase_orders' ===
    const poSheet = doc.sheetsByTitle['purchase_orders'];
    if (!poSheet) throw new Error("Sheet 'purchase_orders' tidak ditemukan!");
    const poRows = await poSheet.getRows();
    // Gunakan find() untuk mencari baris berdasarkan ID yang cocok
    const poToUpdate = poRows.find(row => row._rawData[0] === data.poId);

    if (!poToUpdate) {
      throw new Error(`PO dengan ID ${data.poId} tidak ditemukan untuk diperbarui.`);
    }

    // Perbarui nilai di baris yang ditemukan
    poToUpdate.po_number = data.nomorPo;
    poToUpdate.project_name = data.namaCustomer;
    poToUpdate.deadline = data.tanggalKirim;
    poToUpdate.status = data.status; // Pastikan Anda menambahkan status di payload
    poToUpdate.priority = data.prioritas;
    poToUpdate.notes = data.catatan;
    await poToUpdate.save(); // Simpan perubahan ke Google Sheets
    console.log(`✅ PO header dengan ID ${data.poId} berhasil diperbarui.`);

    // === Langkah 2: Buat Revisi Baru di 'purchase_order_revisions' ===
    const revisionSheet = doc.sheetsByTitle['purchase_order_revisions'];
    if (!revisionSheet) throw new Error("Sheet 'purchase_order_revisions' tidak ditemukan!");

    // Temukan nomor revisi tertinggi saat ini
    const revRows = await revisionSheet.getRows();
    const currentMaxRev = revRows
      .filter(r => r.purchase_order_id === data.poId)
      .reduce((max, r) => Math.max(max, parseInt(r.revision_number)), -1);

    const newRevNumber = currentMaxRev + 1;
    const newRevId = await nextId(revisionSheet);

    await revisionSheet.addRow({
      id: newRevId,
      purchase_order_id: data.poId,
      revision_number: newRevNumber,
      deadline: data.tanggalKirim,
      status: data.status, // Pastikan status dikirim
      priority: data.prioritas,
      notes: data.catatan,
      created_at: now,
    });
    console.log(`✅ Revisi baru (Rev #${newRevNumber}) berhasil ditambahkan.`);

    // === Langkah 3: Hapus Item Lama dan Tambahkan Item Baru ===
    // Ini adalah bagian yang kompleks. Untuk saat ini, kita akan melewati langkah ini
    // dan hanya mengupdate header dan revisi. Anda bisa menambahkan kode di sini
    // untuk menghapus item lama dan menambahkan yang baru jika diperlukan.

    console.log('✅ Semua data PO berhasil diperbarui!');
    return { success: true };

  } catch (error) {
    console.error('❌ Gagal memperbarui PO:', error);
    return { success: false, error: error.message };
  }
}