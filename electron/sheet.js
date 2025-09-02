/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable prettier/prettier */
// File: electron/sheet.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import path from 'node:path';
import fs from 'node:fs';

// --- BAGIAN 1: OTENTIKASI DAN KONEKSI ---
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

async function openDoc() {
  const spreadsheetId = "15Wj9b-2GKk5xH5ygfxBu7Q05GC7H_Rfkd-pEs-2MERE";
  const auth = getAuth();
  const doc = new GoogleSpreadsheet(spreadsheetId, auth);
  return doc;
}

// --- BAGIAN 2: FUNGSI HELPER ---
async function nextId(sheet) {
  const rows = await sheet.getRows();
  return String(rows.length + 1);
}

// --- BAGIAN 3: FUNGSI YANG DI-EXPORT ---

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

export async function listPOs() {
  console.log("Mencoba mengambil data PO dari Google Sheets...");
  try {
    const doc = await openDoc();
    await doc.loadInfo();
    const poSheet = doc.sheetsByTitle['purchase_orders'];
    if (!poSheet) throw new Error("Sheet 'purchase_orders' tidak ditemukan!");
    const poRows = await poSheet.getRows();
    const combinedPOs = poRows.map(r => ({
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

export async function saveNewPO(data) {
  try {
    const doc = await openDoc();
    await doc.loadInfo();
    const now = new Date().toISOString();
    const poSheet = doc.sheetsByTitle['purchase_orders'];
    if (!poSheet) throw new Error("Sheet 'purchase_orders' tidak ditemukan!");
    const poId = await nextId(poSheet);
    await poSheet.addRow({
      id: poId,
      po_number: data.nomorPo,
      project_name: data.namaCustomer,
      created_at: now,
      deadline: data.tanggalKirim,
      status: 'Open',
      priority: data.prioritas,
      notes: data.catatan,
    });
    console.log('Purchase Order header saved with ID:', poId);
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
    const itemSheet = doc.sheetsByTitle['purchase_order_items'];
    if (!itemSheet) throw new Error("Sheet 'purchase_order_items' tidak ditemukan!");
    for (const item of data.items) {
      const itemId = await nextId(itemSheet);
      await itemSheet.addRow({
        id: itemId,
  purchase_order_id: poId,
  revision_id: revId,
  product_id: item.product_id,
  product_name: item.product_name,
  wood_type: item.wood_type,
  profile: item.profile,
  color: item.color,
  finishing: item.finishing,
  sample: item.sample,
  marketing: item.marketing,
  thickness_mm: item.thickness_mm,
  width_mm: item.width_mm,
  length_mm: item.length_mm,
  length_type: item.length_type,
  quantity: item.quantity,
  satuan: item.satuan,
  location: item.location,
  notes: item.notes
      });
    }
    console.log('✅ Semua data PO berhasil disimpan!');
    return { success: true, poId };
  } catch (error) {
    console.error('❌ Gagal menyimpan PO ke Google Sheets:', error);
    return { success: false, error: error.message };
  }
}

export async function deletePO(poId) {
  console.log(`Mencoba menghapus PO dengan ID: ${poId}`);
  try {
    const doc = await openDoc();
    await doc.loadInfo();
    const poSheet = doc.sheetsByTitle['purchase_orders'];
    const poRows = await poSheet.getRows();
    const poToDelete = poRows.find(row => row._rawData[0] === poId);
    if (!poToDelete) {
      console.error(`❌ GAGAL: PO dengan ID ${poId} tidak ditemukan di sheet 'purchase_orders'.`);
    }
    if (poToDelete) {
      await poToDelete.delete();
      console.log(`✅ PO header dengan ID ${poId} berhasil dihapus.`);
    }
    const revSheet = doc.sheetsByTitle['purchase_order_revisions'];
    const revRows = await revSheet.getRows();
    const revsToDelete = revRows.filter(row => row._rawData[1] === poId);
    for (const rev of revsToDelete) {
      await rev.delete();
    }
    console.log(`✅ ${revsToDelete.length} revisi untuk PO ${poId} berhasil dihapus.`);
    const itemSheet = doc.sheetsByTitle['purchase_order_items'];
    const itemRows = await itemSheet.getRows();
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

// ✨ Tambahkan fungsi baru untuk mengambil item
export async function listPOItems(poId) {
  console.log(`Mencoba mengambil item PO untuk ID: ${poId}`);
  try {
    const doc = await openDoc();
    await doc.loadInfo();
    const itemSheet = doc.sheetsByTitle['purchase_order_items'];
    if (!itemSheet) throw new Error("Sheet 'purchase_order_items' tidak ditemukan!");

    const itemRows = await itemSheet.getRows();
    const items = itemRows.filter(r => r._rawData[1] === poId).map(r => ({
      // Perhatikan penggunaan indeks _rawData
      id: r._rawData[0],
    purchase_order_id: r._rawData[1],
    revision_id: r._rawData[2],
    product_id: r._rawData[3],
    product_name: r._rawData[4],
    wood_type: r._rawData[5],
    profile: r._rawData[6],
    color: r._rawData[7],
    finishing: r._rawData[8],
    sample: r._rawData[9],
    marketing: r._rawData[10],
    thickness_mm: Number(r._rawData[11]),
    width_mm: Number(r._rawData[12]),
    length_mm: Number(r._rawData[13]),
    length_type: r._rawData[14],
    quantity: Number(r._rawData[15]),
    satuan: r._rawData[16],
    location: r._rawData[17],
    notes: r._rawData[18],
    }));
    return items;
  } catch (error) {
    console.error(`Gagal mengambil item PO untuk ID ${poId}:`, error);
    return [];
  }
}

// ✨ Lengkapi fungsi updatePO dengan logika item
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
    const poToUpdate = poRows.find(row => row._rawData[0] === data.poId);

    if (!poToUpdate) {
      console.error(`❌ GAGAL: PO dengan ID ${data.poId} tidak ditemukan untuk diperbarui.`);
      return { success: false, error: `PO dengan ID ${data.poId} tidak ditemukan.` };
    }
    console.log(`✅ Baris PO berhasil ditemukan. Melakukan update...`);

    // Perbarui nilai di baris yang ditemukan
    poToUpdate._rawData[1] = data.nomorPo;
    poToUpdate._rawData[2] = data.namaCustomer;
    poToUpdate._rawData[3] = data.tanggalKirim;
    poToUpdate._rawData[4] = data.status;
    poToUpdate._rawData[5] = data.prioritas;
    poToUpdate._rawData[6] = data.catatan;

    await poToUpdate.save(); // Simpan perubahan ke Google Sheets
    console.log(`✅ PO header dengan ID ${data.poId} berhasil diperbarui.`);

    // === Langkah 2: Buat Revisi Baru di 'purchase_order_revisions' ===
    const revisionSheet = doc.sheetsByTitle['purchase_order_revisions'];
    if (!revisionSheet) throw new Error("Sheet 'purchase_order_revisions' tidak ditemukan!");

    const revRows = await revisionSheet.getRows();
    const currentMaxRev = revRows
      .filter(r => r._rawData[1] === data.poId)
      .reduce((max, r) => Math.max(max, parseInt(r._rawData[2])), -1);

    const newRevNumber = currentMaxRev + 1;
    const newRevId = await nextId(revisionSheet);

    await revisionSheet.addRow({
      id: newRevId,
      purchase_order_id: data.poId,
      revision_number: newRevNumber,
      deadline: data.tanggalKirim,
      status: data.status,
      priority: data.prioritas,
      notes: data.catatan,
      created_at: now,
    });
    console.log(`✅ Revisi baru (Rev #${newRevNumber}) berhasil ditambahkan.`);

    // === Langkah 3: Hapus Item Lama dan Tambahkan Item Baru ===
    const itemSheet = doc.sheetsByTitle['purchase_order_items'];
    if (!itemSheet) throw new Error("Sheet 'purchase_order_items' tidak ditemukan!");

    const existingItems = await itemSheet.getRows();
    const itemsToDelete = existingItems.filter(row => row._rawData[1] === data.poId);
    for (const item of itemsToDelete) {
        await item.delete();
    }
    console.log(`✅ ${itemsToDelete.length} item lama berhasil dihapus.`);

    for (const item of data.items) {
      const itemId = await nextId(itemSheet);
      await itemSheet.addRow({
        id: itemId,
        purchase_order_id: data.poId,
        revision_id: newRevId,
        product_id: item.productId,
        thickness_mm: item.thickness,
        width_mm: item.width,
        length_mm: item.length,
        quantity: item.qty,
        satuan: item.satuan,
        notes: item.notes
      });
    }
    console.log(`✅ ${data.items.length} item baru berhasil ditambahkan.`);

    return { success: true };

  } catch (error) {
    console.error('❌ Gagal memperbarui PO:', error);
    return { success: false, error: error.message };
  }
}