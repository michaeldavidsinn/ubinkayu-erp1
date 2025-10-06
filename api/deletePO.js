// file: api/deletePO.js

import { openDoc, getSheet, extractGoogleDriveFileId, deleteGoogleDriveFile, processBatch } from './_helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'DELETE') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { poId } = req.query;

  if (!poId) {
    return res.status(400).json({ error: 'poId is required' });
  }

  // [FIX 1] Deklarasikan startTime di sini
  const startTime = Date.now();
  console.log(`🗑️ Memulai penghapusan lengkap PO ID: ${poId}`);

  try {
    const doc = await openDoc();

    // ... (Logika pengambilan data Anda dari sini sudah benar)
    const [poSheet, itemSheet, progressSheet] = await Promise.all([
      getSheet(doc, 'purchase_orders'),
      getSheet(doc, 'purchase_order_items'),
      getSheet(doc, 'progress_tracking')
    ]);

    const [poRows, itemRows, progressRows] = await Promise.all([
      poSheet.getRows(),
      itemSheet.getRows(),
      progressSheet.getRows()
    ]);

    const toDelHdr = poRows.filter((r) => String(r.get('id')).trim() === String(poId).trim());
    const toDelItems = itemRows.filter((r) => String(r.get('purchase_order_id')).trim() === String(poId).trim());
    const poProgressRows = progressRows.filter((r) => String(r.get('purchase_order_id')).trim() === String(poId).trim());

    const fileIds = new Set();
    toDelHdr.forEach((poRow) => {
      const pdfLink = poRow.get('pdf_link');
      if (pdfLink && !pdfLink.startsWith('ERROR:') && !pdfLink.includes('generating')) {
        const fileId = extractGoogleDriveFileId(pdfLink);
        if (fileId) fileIds.add(fileId);
      }
    });
    poProgressRows.forEach((progressRow) => {
      const photoUrl = progressRow.get('photo_url');
      if (photoUrl) {
        const fileId = extractGoogleDriveFileId(photoUrl);
        if (fileId) fileIds.add(fileId);
      }
    });

    const uniqueFileIds = Array.from(fileIds);
    let deletedFilesCount = 0;
    let failedFilesCount = 0;
    let failedFiles = [];

    if (uniqueFileIds.length > 0) {
      console.log(`🗂️ Menghapus ${uniqueFileIds.length} file dari Google Drive...`);
      // [FIX 2] Fungsi processBatch sekarang bisa dipanggil
      const deleteResults = await processBatch(uniqueFileIds, deleteGoogleDriveFile, 5);
      deleteResults.forEach((result) => {
        if (result.success) {
          deletedFilesCount++;
        } else {
          failedFilesCount++;
          failedFiles.push({ fileId: result.fileId, error: result.error });
        }
      });
    }

    console.log(`📄 Menghapus data dari spreadsheet...`);
    const sheetDeletions = [];
    poProgressRows.reverse().forEach((row) => sheetDeletions.push(row.delete()));
    toDelHdr.reverse().forEach((row) => sheetDeletions.push(row.delete()));
    toDelItems.reverse().forEach((row) => sheetDeletions.push(row.delete()));
    await Promise.allSettled(sheetDeletions);

    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);

    const summary = {
      deletedRevisions: toDelHdr.length,
      deletedItems: toDelItems.length,
      deletedProgressRecords: poProgressRows.length,
      deletedFiles: deletedFilesCount,
      failedFileDeletes: failedFilesCount,
      duration: `${duration}s`,
      failedFiles: failedFiles.length > 0 ? failedFiles : undefined
    };

    const message = `PO berhasil dihapus (${summary.deletedRevisions} revisi, ${summary.deletedItems} item, ${summary.deletedFiles} file).`;

    console.log(`✅ PO ${poId} berhasil dihapus lengkap dalam ${duration}s.`);

    // [FIX 3] Kirim respons JSON yang benar, bukan menggunakan 'return'
    res.status(200).json({ success: true, message, summary });

  } catch (err) {
    console.error(`❌ Gagal menghapus PO ID ${poId}:`, err.message);
    res.status(500).json({ success: false, error: err.message });
  }
}