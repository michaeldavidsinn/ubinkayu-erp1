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
  console.log("Mencoba mengambil dan menggabungkan data PO dari Google Sheets...");
  try {
    const doc = await openDoc();
    await doc.loadInfo();

    // Langkah 1: Ambil data dasar PO
    const poSheet = doc.sheetsByTitle['purchase_orders'];
    if (!poSheet) throw new Error("Sheet 'purchase_orders' tidak ditemukan!");
    const poRows = await poSheet.getRows();
    const poData = poRows.map(r => ({
      id: r.id,
      po_number: r.po_number,
      project_name: r.project_name,
      created_at: r.created_at,
    }));

    // Langkah 2: Ambil semua data revisi
    const revisionSheet = doc.sheetsByTitle['purchase_order_revisions'];
    if (!revisionSheet) throw new Error("Sheet 'purchase_order_revisions' tidak ditemukan!");
    const revisionRows = await revisionSheet.getRows();

    // Temukan revisi terakhir untuk setiap PO
    const latestRevisionsMap = {};
    for (const rev of revisionRows) {
        const poId = rev.purchase_order_id;
        const currentRevNum = parseInt(rev.revision_number);
        const existingRev = latestRevisionsMap[poId];

        // Jika revisi ini lebih baru dari yang sudah ada di map, atau belum ada, simpan.
        if (!existingRev || currentRevNum > parseInt(existingRev.revision_number)) {
            latestRevisionsMap[poId] = rev;
        }
    }

    // Langkah 3: Gabungkan data PO dengan revisi terakhir
    const combinedPOs = poData.map(po => {
      const latestRevision = latestRevisionsMap[po.id];
      return {
        ...po,
        status: latestRevision ? latestRevision.status : 'N/A',
        priority: latestRevision ? latestRevision.priority : 'Normal',
        deadline: latestRevision ? latestRevision.deadline : '',
      };
    });

    console.log(`✅ Berhasil mengambil dan menggabungkan ${combinedPOs.length} PO.`);
    return combinedPOs;

  } catch (error) {
    console.error('❌ Gagal mengambil daftar PO dari Google Sheets:', error);
    return [];
  }
}

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
