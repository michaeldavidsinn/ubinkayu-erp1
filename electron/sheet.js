/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
// File: electron/sheet.js

import { GoogleSpreadsheet } from 'google-spreadsheet'
import { JWT } from 'google-auth-library'
import path from 'node:path'
import fs from 'node:fs'
import PDFDocument from 'pdfkit'
import { app, shell } from 'electron'

// ===============================
// AUTHENTICATION & HELPERS (Internal, tidak perlu di-export)
// ===============================
function getAuth() {
  const credPath = path.join(process.cwd(), 'electron', 'credentials.json')
  if (!fs.existsSync(credPath)) {
    throw new Error('File credentials.json tidak ditemukan di folder "electron".')
  }
  const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'))
  return new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  })
}

async function openDoc() {
  const spreadsheetId = '15Wj9b-2GKk5xH5ygfxBu7Q05GC7H_Rfkd-pEs-2MERE'
  const auth = getAuth()
  const doc = new GoogleSpreadsheet(spreadsheetId, auth)
  return doc
}

async function nextId(sheet) {
  const rows = await sheet.getRows()
  // Tambah 2 karena header (baris 1) dan array (mulai dari 0)
  return String(rows.length + 2)
}

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

// ===============================
// PDF GENERATOR (Hanya satu versi yang diekspor)
// ===============================
export async function generatePOPdf(poData, revisionNumber = 0) {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

      // [KODE UNTUK MENGISI KONTEN PDF DI SINI TETAP SAMA]
      // --- HEADER ---
      doc.fontSize(18).text('PURCHASE ORDER', { align: 'center', underline: true });
      doc.moveDown(1);
      doc.fontSize(11).font('Helvetica-Bold').text(`Nomor PO      : ${poData.po_number}`);
      doc.font('Helvetica-Bold').text(`Customer      : ${poData.project_name}`);
      doc.font('Helvetica').text(`Tanggal Input : ${new Date(poData.created_at).toLocaleDateString('id-ID')}`);
      doc.text(`Target Kirim  : ${poData.deadline ? new Date(poData.deadline).toLocaleDateString('id-ID') : '-'}`);
      doc.text(`Prioritas     : ${poData.priority}`);
      doc.text(`Revisi        : #${revisionNumber}`);
      doc.moveDown(1.5);
      // --- TABEL ITEM --- (Logika tabel tidak berubah, saya singkat untuk keringkasan)
      // ... (tempelkan logika pembuatan tabel Anda di sini)
      const table = {
        headers: ['No', 'Produk', 'Jenis Kayu', 'Profil', 'Warna', 'Finishing', 'Tebal', 'Lebar', 'Qty', 'Satuan', 'Catatan'],
        rows: poData.items.map((item, index) => [
          index + 1, item.product_name || '-', item.wood_type || '-',
          item.profile || '-', item.color || '-', item.finishing || '-',
          `${item.thickness_mm || 0} mm`, `${item.width_mm || 0} mm`,
          item.quantity || 0, item.satuan || '-', item.notes || '-'
        ]),
        colWidths: [30, 100, 80, 80, 80, 80, 50, 50, 40, 50, 120]
      };
      const startY = doc.y; const startX = doc.page.margins.left; const rowHeight = 25;
      doc.font('Helvetica-Bold').fontSize(9); let currentX = startX;
      table.headers.forEach((header, i) => { doc.rect(currentX, startY, table.colWidths[i], rowHeight).stroke(); doc.text(header, currentX + 3, startY + 8, { width: table.colWidths[i] - 6, align: 'center' }); currentX += table.colWidths[i]; });
      doc.font('Helvetica').fontSize(8); let currentY = startY + rowHeight;
      table.rows.forEach((row) => { currentX = startX; if (currentY + rowHeight > doc.page.height - doc.page.margins.bottom) { doc.addPage(); currentY = doc.page.margins.top; } row.forEach((cell, i) => { doc.rect(currentX, currentY, table.colWidths[i], rowHeight).stroke(); doc.text(cell.toString(), currentX + 3, currentY + 8, { width: table.colWidths[i] - 6, align: 'center' }); currentX += table.colWidths[i]; }); currentY += rowHeight; });
      // [AKHIR DARI KODE KONTEN PDF]


      // --- KONDISI BARU ---
      if (revisionNumber === 'preview') {
        // JIKA PREVIEW: Simpan ke folder temporer
        const tempDir = app.getPath('temp'); // Dapatkan folder temp sistem
        const fileName = `PO-PREVIEW-${Date.now()}.pdf`; // Buat nama file unik
        const filePath = path.join(tempDir, fileName);

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        stream.on('finish', () => {
          shell.openPath(filePath); // Buka file dengan aplikasi default
          resolve({ success: true, isPreview: true }); // Kirim status sukses
        });
        stream.on('error', reject);
      } else {
        // JIKA SIMPAN: Simpan ke folder permanen
        const baseDir = path.join(process.cwd(), 'generated_pdfs');
        ensureDirSync(baseDir);
        const revisionText = `Rev${revisionNumber}`;
        const fileName = `PO-${poData.po_number.replace(/[/\\?%*:|"<>]/g, '-')}-${revisionText}.pdf`;
        const filePath = path.join(baseDir, fileName);

        const stream = fs.createWriteStream(filePath);
        doc.pipe(stream);

        stream.on('finish', () => {
          shell.openPath(filePath); // Buka file
          resolve({ success: true, path: filePath });
        });
        stream.on('error', reject);
      }

      doc.end();

    } catch (error) {
      console.error('❌ Gagal saat generate PDF:', error);
      reject(error);
    }
  });
}

// ===============================
// CRUD FUNCTIONS (Semua diekspor)
// ===============================
export async function testSheetConnection() {
  try {
    const doc = await openDoc()
    await doc.loadInfo()
    console.log(`✅ Tes koneksi berhasil! Judul Dokumen: "${doc.title}"`)
  } catch (err) {
    console.error('❌ Gagal tes koneksi ke Google Sheets:', err.message)
  }
}

export async function listPOs() {
  try {
    const doc = await openDoc()
    await doc.loadInfo()
    const sheet = doc.sheetsByTitle['purchase_orders']
    if (!sheet) throw new Error("Sheet 'purchase_orders' tidak ditemukan!")
    const rows = await sheet.getRows()
    return rows.map((r) => r.toObject())
  } catch (err) {
    console.error('❌ listPOs error:', err.message)
    return []
  }
}

export async function saveNewPO(data) {
  // Menggunakan kode dari jawaban sebelumnya yang sudah benar
  try {
    const doc = await openDoc()
    await doc.loadInfo()
    const now = new Date().toISOString()

    const poSheet = doc.sheetsByTitle['purchase_orders']
    const revSheet = doc.sheetsByTitle['purchase_order_revisions']
    const itemSheet = doc.sheetsByTitle['purchase_order_items']
    const itemRevisionsSheet = doc.sheetsByTitle['purchase_order_items_revisions']

    const poId = await nextId(poSheet)
    await poSheet.addRow({
      id: poId,
      po_number: data.nomorPo,
      project_name: data.namaCustomer,
      created_at: now,
      deadline: data.tanggalKirim,
      status: 'Open',
      priority: data.prioritas,
      notes: data.catatan,
      kubikasi_total: data.kubikasi_total || 0
    })

    const revId = await nextId(revSheet)
    await revSheet.addRow({
      id: revId,
      purchase_order_id: poId,
      revision_number: 0,
      deadline: data.tanggalKirim,
      status: 'Open',
      priority: data.prioritas,
      notes: data.catatan,
      created_at: now
    })

    for (const item of data.items) {
      const { id, ...itemToSave } = item // Hapus id sementara dari frontend
      const basePayload = {
        purchase_order_id: poId,
        revision_id: revId,
        ...itemToSave
      }

      const liveItemId = await nextId(itemSheet)
      await itemSheet.addRow({ id: liveItemId, ...basePayload })

      const itemRevId = await nextId(itemRevisionsSheet)
      await itemRevisionsSheet.addRow({
        id: itemRevId,
        revision_number: 0,
        ...basePayload
      })
    }

    await generatePOPdf(
      {
        po_number: data.nomorPo,
        project_name: data.namaCustomer,
        created_at: now,
        deadline: data.tanggalKirim,
        priority: data.prioritas,
        items: data.items
      },
      0
    )

    return { success: true, poId }
  } catch (err) {
    console.error('❌ saveNewPO error:', err.message)
    return { success: false, error: err.message }
  }
}

export async function updatePO(data) {
  // Menggunakan kode dari jawaban sebelumnya yang sudah benar
  try {
    const doc = await openDoc()
    await doc.loadInfo()
    const now = new Date().toISOString()

    const poSheet = doc.sheetsByTitle['purchase_orders']
    const revSheet = doc.sheetsByTitle['purchase_order_revisions']
    const itemSheet = doc.sheetsByTitle['purchase_order_items']
    const itemRevisionsSheet = doc.sheetsByTitle['purchase_order_items_revisions']

    const poRows = await poSheet.getRows()
    const poToUpdate = poRows.find((r) => r.get('id') === data.poId)
    if (!poToUpdate) throw new Error(`PO dengan ID ${data.poId} tidak ditemukan`)

    poToUpdate.set('project_name', data.namaCustomer)
    poToUpdate.set('deadline', data.tanggalKirim)
    poToUpdate.set('priority', data.prioritas)
    poToUpdate.set('notes', data.catatan)
    poToUpdate.set('kubikasi_total', data.kubikasi_total || 0)
    await poToUpdate.save()

    const revRows = await revSheet.getRows()
    const currentMaxRev = revRows
      .filter((r) => r.get('purchase_order_id') === data.poId)
      .reduce((max, r) => Math.max(max, parseInt(r.get('revision_number'))), -1)

    const newRevNumber = currentMaxRev + 1
    const newRevId = await nextId(revSheet)

    await revSheet.addRow({
      id: newRevId,
      purchase_order_id: data.poId,
      revision_number: newRevNumber,
      deadline: data.tanggalKirim,
      status: poToUpdate.get('status'),
      priority: data.prioritas,
      notes: data.catatan,
      created_at: now
    })

    const existingItems = await itemSheet.getRows()
    const itemsToDelete = existingItems.filter((r) => r.get('purchase_order_id') === data.poId)
    for (let i = itemsToDelete.length - 1; i >= 0; i--) {
      await itemsToDelete[i].delete()
    }

    for (const item of data.items) {
      const { id, ...itemToSave } = item
      const basePayload = {
        purchase_order_id: data.poId,
        revision_id: newRevId,
        ...itemToSave
      }

      const liveItemId = await nextId(itemSheet)
      await itemSheet.addRow({ id: liveItemId, ...basePayload })

      const itemRevId = await nextId(itemRevisionsSheet)
      await itemRevisionsSheet.addRow({
        id: itemRevId,
        revision_number: newRevNumber,
        ...basePayload
      })
    }

    await generatePOPdf({ ...poToUpdate.toObject(), items: data.items }, newRevNumber)

    return { success: true }
  } catch (err) {
    console.error('❌ updatePO error:', err.message)
    return { success: false, error: err.message }
  }
}

export async function deletePO(poId) {
  // Menggunakan kode dari jawaban sebelumnya yang sudah benar
  try {
    const doc = await openDoc()
    await doc.loadInfo()

    const poSheet = doc.sheetsByTitle['purchase_orders']
    const revSheet = doc.sheetsByTitle['purchase_order_revisions']
    const itemSheet = doc.sheetsByTitle['purchase_order_items']
    const itemRevisionsSheet = doc.sheetsByTitle['purchase_order_items_revisions']

    const poRows = await poSheet.getRows()
    const poToDelete = poRows.find((r) => r.get('id') === poId)
    if (poToDelete) await poToDelete.delete()

    const revRows = await revSheet.getRows()
    const revsToDelete = revRows.filter((r) => r.get('purchase_order_id') === poId)
    for (let i = revsToDelete.length - 1; i >= 0; i--) await revsToDelete[i].delete()

    const itemRows = await itemSheet.getRows()
    const itemsToDelete = itemRows.filter((r) => r.get('purchase_order_id') === poId)
    for (let i = itemsToDelete.length - 1; i >= 0; i--) await itemsToDelete[i].delete()

    if (itemRevisionsSheet) {
      const itemRevisionRows = await itemRevisionsSheet.getRows()
      const itemRevsToDelete = itemRevisionRows.filter((r) => r.get('purchase_order_id') === poId)
      for (let i = itemRevsToDelete.length - 1; i >= 0; i--) await itemRevsToDelete[i].delete()
    }

    return { success: true }
  } catch (err) {
    console.error(`❌ Gagal menghapus PO ID ${poId}:`, err.message)
    return { success: false, error: err.message }
  }
}

export async function listPOItems(poId) {
  try {
    const doc = await openDoc()
    await doc.loadInfo()
    const sheet = doc.sheetsByTitle['purchase_order_items']
    const rows = await sheet.getRows()
    return rows.filter((r) => r.get('purchase_order_id') === poId).map((r) => r.toObject())
  } catch (err) {
    console.error('❌ listPOItems error:', err.message)
    return []
  }
}

export async function listPORevisions(poId) {
  console.log(`\n\n-=-=-=-=-=-=-= 🕵️‍♂️ [DEBUG REVISI] MEMULAI 🕵️‍♂️ -=-=-=-=-=-=-=`)
  console.log(`[DEBUG REVISI] Mencari revisi untuk PO ID: "${poId}"`)
  try {
    const doc = await openDoc()
    await doc.loadInfo(true)
    const sheet = doc.sheetsByTitle['purchase_order_revisions']
    if (!sheet) {
      console.error('[DEBUG REVISI] ERROR: Sheet "purchase_order_revisions" tidak ditemukan!')
      return []
    }
    console.log(`[DEBUG REVISI] Sheet "purchase_order_revisions" ditemukan.`)

    // Memaksa library membaca header
    await sheet.loadHeaderRow()
    const headers = sheet.headerValues
    console.log(`[DEBUG REVISI] Header yang terdeteksi oleh library:`, headers)

    const rows = await sheet.getRows()
    console.log(`[DEBUG REVISI] Ditemukan total ${rows.length} baris revisi.`)

    if (rows.length === 0) return []

    const revisions = rows
      .filter((r) => String(r.get('purchase_order_id')) === String(poId))
      .map((r, index) => {
        // Log detail HANYA untuk baris pertama yang cocok
        if (index === 0) {
          console.log(`\n[DEBUG REVISI] Menganalisa baris revisi pertama yang cocok...`)
          console.log(`  - Raw data baris via .toObject():`, r.toObject())
          console.log(`  - Mencoba ambil 'revision_number' via .get():`, r.get('revision_number'))
          console.log(`  - Tipe datanya adalah:`, typeof r.get('revision_number'))
        }

        // Membuat objek secara manual
        const revisionObject = {
          id: r.get('id'),
          purchase_order_id: r.get('purchase_order_id'),
          revision_number: r.get('revision_number'),
          deadline: r.get('deadline'),
          status: r.get('status'),
          priority: r.get('priority'),
          notes: r.get('notes'),
          created_at: r.get('created_at')
        }
        return revisionObject
      })

    console.log(`\n[DEBUG REVISI] Ditemukan ${revisions.length} revisi yang cocok dengan PO ID.`)
    if (revisions.length > 0) {
      // Urutkan sebelum mengambil yang pertama
      revisions.sort((a, b) => Number(b.revision_number) - Number(a.revision_number))
      console.log(
        `[DEBUG REVISI] Objek revisi PERTAMA yang akan dikirim ke frontend:`,
        revisions[0]
      )
    }

    console.log(`-=-=-=-=-=-=-=-= 🏁 [DEBUG REVISI] SELESAI 🏁 -=-=-=-=-=-=-=-=\n\n`)
    return revisions
  } catch (err) {
    console.error('❌ listPORevisions error:', err.message)
    return []
  }
}

export async function listPOItemsByRevision(poId, revisionNumber) {
  console.log(`\n\n-=-=-=-=-=-=-= 🕵️‍♂️ MEMULAI DEBUG 🕵️‍♂️ -=-=-=-=-=-=-=`)
  console.log(`Mencari item untuk PO ID: "${poId}" (Tipe: ${typeof poId})`)
  console.log(`DAN Nomor Revisi: "${revisionNumber}" (Tipe: ${typeof revisionNumber})`)
  console.log(`--------------------------------------------------`)

  try {
    const doc = await openDoc()
    await doc.loadInfo()
    const sheet = doc.sheetsByTitle['purchase_order_items_revisions']
    if (!sheet) throw new Error("Sheet 'purchase_order_items_revisions' tidak ditemukan!")

    const rows = await sheet.getRows()
    console.log(`Ditemukan total ${rows.length} baris di sheet histori.`)

    if (rows.length === 0) {
      console.log(`-=-=-=-=-=-=-=-= 🏁 DEBUG SELESAI 🏁 -=-=-=-=-=-=-=-=\n\n`)
      return []
    }

    console.log(`\nMenganalisa beberapa baris pertama dari Google Sheet...`)
    const filteredItems = rows
      .filter((r, index) => {
        // Ambil data mentah dari sheet
        const sheet_poId = r.get('purchase_order_id')
        const sheet_revNum = r.get('revision_number')

        // Lakukan perbandingan (dengan .trim() untuk jaga-jaga)
        const poIdMatch = String(sheet_poId).trim() === String(poId).trim()
        const revNumMatch = String(sheet_revNum).trim() === String(revisionNumber).trim()

        // Tampilkan laporan hanya untuk 5 baris pertama agar tidak spam
        if (index < 5) {
          console.log(`\n[Analisa Baris di Sheet #${index + 2}]`)
          console.log(
            `  - Data 'purchase_order_id' di sheet: "${sheet_poId}" (Tipe: ${typeof sheet_poId})`
          )
          console.log(
            `  - Data 'revision_number' di sheet:   "${sheet_revNum}" (Tipe: ${typeof sheet_revNum})`
          )
          console.log(
            `  - Cek PO ID: "${String(sheet_poId).trim()}" === "${String(poId).trim()}"  --> ${poIdMatch}`
          )
          console.log(
            `  - Cek Rev Num: "${String(sheet_revNum).trim()}" === "${String(revisionNumber).trim()}" --> ${revNumMatch}`
          )
          console.log(`  --> Hasil Gabungan: Lolos Filter? ${poIdMatch && revNumMatch}`)
        }

        return poIdMatch && revNumMatch
      })
      .map((r) => r.toObject())

    console.log(`\n--------------------------------------------------`)
    console.log(`HASIL AKHIR: Ditemukan ${filteredItems.length} item yang cocok setelah filtering.`)
    console.log(`-=-=-=-=-=-=-=-= 🏁 DEBUG SELESAI 🏁 -=-=-=-=-=-=-=-=\n\n`)
    return filteredItems
  } catch (err) {
    console.error(`❌ Error dalam listPOItemsByRevision:`, err.message)
    console.log(`-=-=-=-=-=-=-=-= 🏁 DEBUG SELESAI (DENGAN ERROR) 🏁 -=-=-=-=-=-=-=-=\n\n`)
    return []
  }
}

export async function getProducts() {
  try {
    const doc = await openDoc()
    await doc.loadInfo()
    const sheet = doc.sheetsByTitle['product_master']
    const rows = await sheet.getRows()
    return rows.map((r) => r.toObject())
  } catch (err) {
    console.error('❌ getProducts error:', err.message)
    return []
  }
}

export async function previewPO(data) {
  try {
    const pdfResult = await generatePOPdf(
      {
        po_number: data.nomorPo,
        project_name: data.namaCustomer,
        created_at: new Date().toISOString(),
        deadline: data.tanggalKirim,
        priority: data.prioritas,
        items: data.items
      },
      'preview'
    )
    return { success: true, ...pdfResult }
  } catch (err) {
    console.error('❌ previewPO error:', err.message)
    return { success: false, error: err.message }
  }
}

export async function getRevisionHistory(poId) {
  try {
    const doc = await openDoc();
    await doc.loadInfo(true);

    const revisionsSheet = doc.sheetsByTitle['purchase_order_revisions'];
    const itemsRevisionsSheet = doc.sheetsByTitle['purchase_order_items_revisions'];

    // 1. Ambil semua baris dari kedua sheet
    const allRevisionsRows = await revisionsSheet.getRows();
    const allItemsRows = await itemsRevisionsSheet.getRows();

    // 2. Filter hanya revisi untuk PO yang dipilih
    const poRevisions = allRevisionsRows
      .filter(r => String(r.get('purchase_order_id')) === String(poId))
      .map(r => r.toObject());

    // 3. Filter hanya item untuk PO yang dipilih
    const poItems = allItemsRows
      .filter(r => String(r.get('purchase_order_id')) === String(poId))
      .map(r => r.toObject());

    // 4. Gabungkan data di backend
    const historyData = poRevisions.map(revision => {
      const itemsForThisRevision = poItems.filter(item =>
        String(item.revision_number) === String(revision.revision_number)
      );
      return {
        revision: revision,
        items: itemsForThisRevision
      };
    });

    // 5. Urutkan dari revisi terbaru ke terlama
    historyData.sort((a, b) => Number(b.revision.revision_number) - Number(a.revision.revision_number));

    return historyData;

  } catch (error) {
    console.error(`Gagal total mengambil riwayat untuk PO ID ${poId}:`, error);
    return [];
  }
}
