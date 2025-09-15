/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

import { GoogleSpreadsheet } from 'google-spreadsheet'
import { JWT } from 'google-auth-library'
import path from 'node:path'
import fs from 'node:fs'
import PDFDocument from 'pdfkit'
import { app, shell } from 'electron'
import { google } from 'googleapis'

// ===============================
// KONFIGURASI
// ===============================
const SPREADSHEET_ID = '1Bp5rETvaAe9nT4DrNpm-WsQqQlPNaau4gIzw1nA5Khk';
const PO_ARCHIVE_FOLDER_ID = '1-1Gw1ay4iQoFNFe2KcKDgCwOIi353QEC';
const PROGRESS_PHOTOS_FOLDER_ID = '1UfUQoqNBSsth9KzGRUmjenwegmsA6hbK';

// ===============================
// AUTH & DOC
// ===============================
function getAuth() {
  const credPath = path.join(app.getAppPath(), 'electron', 'credentials.json')
  if (!fs.existsSync(credPath)) {
    const devCredPath = path.join(process.cwd(), 'electron', 'credentials.json')
    if (!fs.existsSync(devCredPath)) throw new Error('File credentials.json tidak ditemukan.')
    const creds = JSON.parse(fs.readFileSync(devCredPath, 'utf8'))
    return new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file']
    })
  }
  const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'))
  return new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets', 'https://www.googleapis.com/auth/drive.file']
  })
}

async function openDoc() {
  const auth = getAuth()
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth)
  await doc.loadInfo()
  return doc
}

// ===============================
// UTILS & HELPERS
// ===============================
function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) fs.mkdirSync(dirPath, { recursive: true })
}

const ALIASES = {
  purchase_orders: ['purchase_orders', 'purchase_order'],
  purchase_order_items: ['purchase_order_items', 'po_items'],
  product_master: ['product_master', 'products'],
  progress_tracking: ['purchase_order_items_progress', 'progress']
}

async function getSheet(doc, key) {
  const titles = ALIASES[key] || [key];
  for (const t of titles) {
    if (doc.sheetsByTitle[t]) return doc.sheetsByTitle[t];
  }
  throw new Error(`Sheet "${titles[0]}" tidak ditemukan. Pastikan nama sheet di Google Sheets sudah benar.`);
}

function toNum(v, def = 0) {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : def
}

async function getNextIdFromSheet(sheet) {
  await sheet.loadHeaderRow()
  const rows = await sheet.getRows()
  if (rows.length === 0) return '1';
  let maxId = 0
  rows.forEach(r => {
    const val = toNum(r.get('id'), NaN)
    if (!Number.isNaN(val)) maxId = Math.max(maxId, val)
  });
  return String(maxId + 1)
}

function scrubItemPayload(item) {
  const { id, purchase_order_id, revision_id, revision_number, ...rest } = item || {}
  return rest
}

async function latestRevisionNumberForPO(poId, doc) {
  const sh = await getSheet(doc, 'purchase_orders')
  const rows = await sh.getRows()
  const nums = rows
    .filter(r => String(r.get('id')).trim() === String(poId).trim())
    .map(r => toNum(r.get('revision_number'), -1))
  return nums.length ? Math.max(...nums) : -1
}

async function getHeaderForRevision(poId, rev, doc) {
  const sh = await getSheet(doc, 'purchase_orders')
  const rows = await sh.getRows()
  return rows.find(r => String(r.get('id')).trim() === String(poId).trim() && toNum(r.get('revision_number'), -1) === toNum(rev, -1)) || null
}

async function getItemsByRevision(poId, rev, doc) {
  const sh = await getSheet(doc, 'purchase_order_items');
  const rows = await sh.getRows();
  return rows
    .filter(
      (r) =>
        String(r.get('purchase_order_id')).trim() === String(poId).trim() &&
        toNum(r.get('revision_number'), -1) === toNum(rev, -1)
    )
    .map((r) => r.toObject());
}

async function getLivePOItems(poId, doc) {
  const latest = await latestRevisionNumberForPO(poId, doc);
  if (latest < 0) return [];
  return getItemsByRevision(poId, latest, doc);
}

// ===============================
// PDF & UPLOAD LOGIC
// ===============================
async function generatePOPdf(poData, revisionNumber = 0, isPreview = false) {
    return new Promise((resolve, reject) => {
        try {
            const docPdf = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' });

            docPdf.fontSize(18).text('PURCHASE ORDER', { align: 'center', underline: true });
            docPdf.moveDown(1);
            docPdf.fontSize(11).font('Helvetica-Bold').text(`Nomor PO      : ${poData.po_number || '-'}`);
            docPdf.font('Helvetica-Bold').text(`Customer      : ${poData.project_name || '-'}`);
            docPdf.font('Helvetica').text(`Tanggal Input : ${poData.created_at ? new Date(poData.created_at).toLocaleDateString('id-ID') : '-'}`);
            docPdf.text(`Target Kirim  : ${poData.deadline ? new Date(poData.deadline).toLocaleDateString('id-ID') : '-'}`);
            docPdf.text(`Prioritas     : ${poData.priority || '-'}`);
            docPdf.text(`Revisi        : #${revisionNumber}`);
            docPdf.moveDown(1.5);

            if (poData.notes) {
                docPdf.font('Helvetica-Oblique').fontSize(10).text(`Catatan: ${poData.notes}`, { width: 500 });
                docPdf.moveDown(1);
            }

            const table = {
                headers: ['No', 'Produk', 'Jenis Kayu', 'Profil', 'Warna', 'Finishing', 'Tebal', 'Lebar', 'Qty', 'Satuan', 'Catatan'],
                rows: (poData.items || []).map((item, i) => [
                  i + 1, item.product_name || '-', item.wood_type || '-', item.profile || '-', item.color || '-', item.finishing || '-',
                  `${item.thickness_mm || 0} mm`, `${item.width_mm || 0} mm`,
                  item.quantity || 0, item.satuan || '-', item.notes || '-'
                ]),
                colWidths: [30, 100, 80, 80, 80, 80, 50, 50, 40, 50, 120]
            };

            const startY = docPdf.y; const startX = docPdf.page.margins.left; const rowH = 25;
            docPdf.font('Helvetica-Bold').fontSize(9);
            let cx = startX;
            table.headers.forEach((h, i) => {
                docPdf.rect(cx, startY, table.colWidths[i], rowH).stroke(); docPdf.text(h, cx + 3, startY + 8, { width: table.colWidths[i] - 6, align: 'center' }); cx += table.colWidths[i];
            });
            docPdf.font('Helvetica').fontSize(8); let cy = startY + rowH;
            table.rows.forEach((row) => {
                cx = startX;
                if (cy + rowH > docPdf.page.height - docPdf.page.margins.bottom) { docPdf.addPage(); cy = docPdf.page.margins.top; }
                row.forEach((cell, i) => {
                    docPdf.rect(cx, cy, table.colWidths[i], rowH).stroke(); docPdf.text(String(cell), cx + 3, cy + 8, { width: table.colWidths[i] - 6, align: 'center' }); cx += table.colWidths[i];
                });
                cy += rowH;
            });

            const tempDir = app.getPath(isPreview ? 'temp' : 'documents');
            const subDir = isPreview ? '' : path.join('UbinkayuERP', 'PO-Archive');
            const baseDir = path.join(tempDir, subDir);
            ensureDirSync(baseDir);
            const revText = isPreview ? `PREVIEW-${Date.now()}` : `Rev${revisionNumber}`;
            const fileName = `PO-${String(poData.po_number || '').replace(/[/\\?%*:|"<>]/g, '-')}-${revText}.pdf`;
            const filePath = path.join(baseDir, fileName);
            const stream = fs.createWriteStream(filePath);
            docPdf.pipe(stream);
            docPdf.end();
            stream.on('finish', () => {
                if (isPreview) shell.openPath(filePath);
                resolve({ success: true, path: filePath });
            });
            stream.on('error', (err) => reject({ success: false, error: err.message }));
        } catch (error) {
            reject(error);
        }
    });
}

async function generateAndUploadPO(poData, revisionNumber) {
  try {
    const pdfResult = await generatePOPdf(poData, revisionNumber, false)
    if (!pdfResult.success) throw new Error("Gagal membuat file PDF lokal.")
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })
    const fileName = path.basename(pdfResult.path)
    const response = await drive.files.create({
      requestBody: { name: fileName, mimeType: 'application/pdf', parents: [PO_ARCHIVE_FOLDER_ID] },
      media: { mimeType: 'application/pdf', body: fs.createReadStream(pdfResult.path) },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    })
    fs.unlinkSync(pdfResult.path);
    return { success: true, link: response.data.webViewLink }
  } catch (error) {
    console.error('❌ Proses Generate & Upload PO Gagal:', error)
    return { success: false, error: error.message }
  }
}

async function uploadProgressPhoto(photoPath, poNumber, itemId) {
  try {
    if (!fs.existsSync(photoPath)) throw new Error(`File foto tidak ditemukan: ${photoPath}`);
    const auth = getAuth();
    const drive = google.drive({ version: 'v3', auth });
    const timestamp = new Date().toISOString().replace(/:/g, '-');
    const fileName = `PO-${poNumber}_ITEM-${itemId}_${timestamp}.jpg`;
    const response = await drive.files.create({
      requestBody: { name: fileName, mimeType: 'image/jpeg', parents: [PROGRESS_PHOTOS_FOLDER_ID] },
      media: { mimeType: 'image/jpeg', body: fs.createReadStream(photoPath) },
      fields: 'id, webViewLink',
      supportsAllDrives: true,
    });
    return { success: true, link: response.data.webViewLink };
  } catch (error) {
    console.error('❌ Gagal unggah foto progress:', error);
    return { success: false, error: error.message };
  }
}

// ===============================
// PUBLIC API
// ===============================
export async function testSheetConnection() {
  try {
    const doc = await openDoc();
    console.log(`✅ Tes koneksi OK: "${doc.title}"`);
  } catch (err) {
    console.error('❌ Gagal tes koneksi ke Google Sheets:', err.message);
  }
}

export async function listPOs() {
  try {
    const doc = await openDoc();
    const poSheet = await getSheet(doc, 'purchase_orders');
    const rows = await poSheet.getRows();
    const byId = new Map();
    for (const r of rows) {
      const id = String(r.get('id')).trim();
      const rev = toNum(r.get('revision_number'), -1);
      const keep = byId.get(id);
      if (!keep || rev > keep.rev) byId.set(id, { rev, row: r });
    }
    return Array.from(byId.values()).map(({ row }) => ({
      ...row.toObject(),
      pdf_link: row.get('pdf_link') || null,
    }));
  } catch (err) {
    console.error('❌ listPOs error:', err.message);
    return [];
  }
}

export async function saveNewPO(data) {
    try {
        const doc = await openDoc();
        const now = new Date().toISOString();
        const poSheet = await getSheet(doc, 'purchase_orders');
        const itemSheet = await getSheet(doc, 'purchase_order_items');

        const poId = await getNextIdFromSheet(poSheet);

        const newPoRow = await poSheet.addRow({
            id: poId,
            revision_number: 0,
            po_number: data.nomorPo,
            project_name: data.namaCustomer,
            deadline: data.tanggalKirim || '',
            status: 'Open',
            priority: data.prioritas || '',
            notes: data.catatan || '',
            kubikasi_total: data.kubikasi_total || 0,
            created_at: now,
            pdf_link: 'generating...'
        });

        const itemsWithIds = [];
        let nextItemId = parseInt(await getNextIdFromSheet(itemSheet), 10);
        const itemsToAdd = (data.items || []).map(raw => {
            const clean = scrubItemPayload(raw);
            const newItem = {
                id: nextItemId,
                purchase_order_id: poId,
                ...clean,
                revision_id: 0,
                revision_number: 0,
                kubikasi: raw.kubikasi || 0
            };
            itemsWithIds.push({...raw, id: nextItemId });
            nextItemId++;
            return newItem;
        });

        if (itemsToAdd.length > 0) {
            await itemSheet.addRows(itemsToAdd);
        }

        const poDataForPdf = {
            po_number: data.nomorPo,
            project_name: data.namaCustomer,
            deadline: data.tanggalKirim,
            priority: data.prioritas,
            items: itemsWithIds,
            notes: data.catatan,
            created_at: now
        };

        const uploadResult = await generateAndUploadPO(poDataForPdf, 0);

        if (uploadResult.success) {
            newPoRow.set('pdf_link', uploadResult.link);
            await newPoRow.save();
        } else {
            newPoRow.set('pdf_link', `ERROR: ${uploadResult.error}`);
            await newPoRow.save();
        }

        return { success: true, poId, revision_number: 0 };
    } catch (err) {
        console.error('❌ saveNewPO error:', err.message);
        return { success: false, error: err.message };
    }
}

export async function updatePO(data) {
    try {
        const doc = await openDoc();
        const now = new Date().toISOString();
        const poSheet = await getSheet(doc, 'purchase_orders');
        const itemSheet = await getSheet(doc, 'purchase_order_items');

        const latest = await latestRevisionNumberForPO(String(data.poId), doc);
        const prevRow = latest >= 0 ? await getHeaderForRevision(String(data.poId), latest, doc) : null;
        const prev = prevRow ? prevRow.toObject() : {};
        const newRev = latest >= 0 ? latest + 1 : 0;

        const newRevisionRow = await poSheet.addRow({
            id: String(data.poId),
            revision_number: newRev,
            po_number: data.nomorPo ?? prev.po_number ?? '',
            project_name: data.namaCustomer ?? prev.project_name ?? '',
            deadline: data.tanggalKirim ?? prev.deadline ?? '',
            status: data.status ?? prev.status ?? 'Open',
            priority: data.prioritas ?? prev.priority ?? '',
            notes: data.catatan ?? prev.notes ?? '',
            kubikasi_total: data.kubikasi_total ?? prev.kubikasi_total ?? 0,
            created_at: now,
            pdf_link: 'generating...'
        });

        const itemsWithIds = [];
        let nextItemId = parseInt(await getNextIdFromSheet(itemSheet), 10);
        const itemsToAdd = (data.items || []).map(raw => {
            const clean = scrubItemPayload(raw);
             const newItem = {
                id: nextItemId,
                purchase_order_id: String(data.poId),
                ...clean,
                revision_id: newRev,
                revision_number: newRev,
                kubikasi: raw.kubikasi || 0
            };
            itemsWithIds.push({...raw, id: nextItemId });
            nextItemId++;
            return newItem;
        });

        if (itemsToAdd.length > 0) {
            await itemSheet.addRows(itemsToAdd);
        }

        const poDataForPdf = {
            po_number: data.nomorPo ?? prev.po_number,
            project_name: data.namaCustomer ?? prev.project_name,
            deadline: data.tanggalKirim ?? prev.deadline,
            priority: data.prioritas ?? prev.priority,
            items: itemsWithIds,
            notes: data.catatan ?? prev.notes,
            created_at: now
        };

        const uploadResult = await generateAndUploadPO(poDataForPdf, newRev);

        if (uploadResult.success) {
            newRevisionRow.set('pdf_link', uploadResult.link);
            await newRevisionRow.save();
        } else {
            newRevisionRow.set('pdf_link', `ERROR: ${uploadResult.error}`);
            await newRevisionRow.save();
        }

        return { success: true, revision_number: newRev };
    } catch (err) {
        console.error('❌ updatePO error:', err.message);
        return { success: false, error: err.message };
    }
}

export async function deletePO(poId) {
  try {
    const doc = await openDoc();
    const poSheet = await getSheet(doc, 'purchase_orders');
    const itemSheet = await getSheet(doc, 'purchase_order_items');

    const poRows = await poSheet.getRows();
    const toDelHdr = poRows.filter(r => String(r.get('id')).trim() === String(poId).trim());
    for (let i = toDelHdr.length - 1; i >= 0; i--) await toDelHdr[i].delete();

    const itemRows = await itemSheet.getRows();
    const toDelItems = itemRows.filter(r => String(r.get('purchase_order_id')).trim() === String(poId).trim());
    for (let i = toDelItems.length - 1; i >= 0; i--) await toDelItems[i].delete();

    return { success: true };
  } catch (err) {
    console.error(`❌ Gagal menghapus PO ID ${poId}:`, err.message);
    return { success: false, error: err.message };
  }
}

export async function listPOItems(poId) {
  try {
    const doc = await openDoc();
    return await getLivePOItems(String(poId), doc);
  } catch (err) {
    console.error('❌ listPOItems error:', err.message);
    return [];
  }
}

export async function listPORevisions(poId) {
  try {
    const doc = await openDoc();
    const poSheet = await getSheet(doc, 'purchase_orders');
    const rows = await poSheet.getRows();
    return rows
      .filter(r => String(r.get('id')).trim() === String(poId).trim())
      .map(r => (r.toObject()))
      .sort((a, b) => a.revision_number - b.revision_number);
  } catch (err) {
    console.error('❌ listPORevisions error:', err.message);
    return [];
  }
}

export async function listPOItemsByRevision(poId, revisionNumber) {
  try {
    const doc = await openDoc();
    return await getItemsByRevision(String(poId), toNum(revisionNumber, 0), doc);
  } catch (err) {
    console.error('❌ listPOItemsByRevision error:', err.message);
    return [];
  }
}

export async function getProducts() {
  try {
    const doc = await openDoc();
    const sheet = await getSheet(doc, 'product_master');
    const rows = await sheet.getRows();
    return rows.map(r => r.toObject());
  } catch (err) {
    console.error('❌ getProducts error:', err.message);
    return [];
  }
}

export async function previewPO(data) {
  try {
    const poData = {
      po_number: data.nomorPo,
      project_name: data.namaCustomer,
      created_at: new Date().toISOString(),
      deadline: data.tanggalKirim || '',
      priority: data.prioritas || '',
      items: data.items || [],
      notes: data.catatan || '',
    };
    return await generatePOPdf(poData, 'preview', true);
  } catch (err) {
    console.error('❌ previewPO error:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getRevisionHistory(poId) {
  try {
    const doc = await openDoc();
    const metas = await listPORevisions(String(poId));
    const itemSheet = await getSheet(doc, 'purchase_order_items');
    const allItemRows = await itemSheet.getRows();

    const history = metas.map(m => ({
      revision: m,
      items: allItemRows
        .filter(
          r =>
            String(r.get('purchase_order_id')) === String(poId) &&
            // [MODIFIKASI] Pastikan kedua sisi perbandingan adalah ANGKA
            toNum(r.get('revision_number'), -1) === toNum(m.revision_number, -1)
        )
        .map(r => r.toObject()),
    }));
    history.sort((a, b) => b.revision.revision_number - a.revision.revision_number);
    return history;
  } catch (err) {
    console.error('❌ getRevisionHistory error:', err.message);
    return [];
  }
}

export async function updateItemProgress(data) {
  try {
    const { poId, itemId, poNumber, stage, notes, photoPath } = data;
    let photoLink = null;
    if (photoPath) {
      const uploadResult = await uploadProgressPhoto(photoPath, poNumber, itemId);
      if (!uploadResult.success) {
        throw new Error(uploadResult.error);
      }
      photoLink = uploadResult.link;
    }

    const doc = await openDoc();
    const progressSheet = await getSheet(doc, 'progress_tracking');
    const nextId = await getNextIdFromSheet(progressSheet);

    await progressSheet.addRow({
      id: nextId,
      purchase_order_id: poId,
      purchase_order_item_id: itemId,
      stage: stage,
      notes: notes,
      photo_url: photoLink,
      created_at: new Date().toISOString(),
    });

    return { success: true };
  } catch (err) {
    console.error('❌ Gagal update item progress:', err.message);
    return { success: false, error: err.message };
  }
}

export async function getActivePOsWithProgress() {
  try {
    const doc = await openDoc();
    const poSheet = await getSheet(doc, 'purchase_orders');
    const itemSheet = await getSheet(doc, 'purchase_order_items');
    const progressSheet = await getSheet(doc, 'progress_tracking');

    const [poRows, itemRows, progressRows] = await Promise.all([
      poSheet.getRows(),
      itemSheet.getRows(),
      progressSheet.getRows()
    ]);

    const byId = new Map();
    for (const r of poRows) {
      const id = String(r.get('id')).trim();
      const rev = toNum(r.get('revision_number'), -1);
      const keep = byId.get(id);
      if (!keep || rev > keep.rev) byId.set(id, { rev, row: r });
    }
    const latestPoRows = Array.from(byId.values()).map(({ row }) => row);

    const activePOs = latestPoRows.filter(r => r.get('status') !== 'Completed' && r.get('status') !== 'Cancelled');

    const progressByCompositeKey = progressRows.reduce((acc, row) => {
      const poId = row.get('purchase_order_id');
      const itemId = row.get('purchase_order_item_id');
      const key = `${poId}-${itemId}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push({ stage: row.get('stage'), created_at: row.get('created_at') });
      return acc;
    }, {});

    const latestItemRevisions = new Map();
    itemRows.forEach(item => {
        const poId = item.get('purchase_order_id');
        const rev = toNum(item.get('revision_number'), -1);
        const current = latestItemRevisions.get(poId);
        if (!current || rev > current) {
            latestItemRevisions.set(poId, rev);
        }
    });

    const result = activePOs.map(po => {
      const poId = po.get('id');
      const latestRev = latestItemRevisions.get(poId) ?? -1;
      const poItems = itemRows.filter(item => item.get('purchase_order_id') === poId && toNum(item.get('revision_number'), -1) === latestRev);

      if (poItems.length === 0) {
        return { ...po.toObject(), progress: 0 };
      }

      let totalPercentage = 0;
      poItems.forEach(item => {
        const itemId = item.get('id');
        const needsSample = item.get('sample') === 'Ada sample';

        const stages = ['Pembahanan'];
        if (needsSample) {
            stages.push('Kasih Sample');
        }
        stages.push('Start Produksi');
        stages.push('Kirim');

        const compositeKey = `${poId}-${itemId}`;
        const itemProgressHistory = progressByCompositeKey[compositeKey] || [];

        let latestStageIndex = -1;
        if (itemProgressHistory.length > 0) {
          const latestProgress = itemProgressHistory.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
          latestStageIndex = stages.indexOf(latestProgress.stage);
        }

        const itemPercentage = latestStageIndex >= 0 ? ((latestStageIndex + 1) / stages.length) * 100 : 0;
        totalPercentage += itemPercentage;
      });

      const poProgress = totalPercentage / poItems.length;
      return { ...po.toObject(), progress: Math.round(poProgress) };
    });
    return result;
  } catch (err) {
    console.error('❌ Gagal get active POs with progress:', err.message);
    return [];
  }
}

export async function getPOItemsWithDetails(poId) {
    try {
        const doc = await openDoc();
        const itemSheet = await getSheet(doc, 'purchase_order_items');
        const progressSheet = await getSheet(doc, 'progress_tracking');

        const [itemRows, progressRows] = await Promise.all([
            itemSheet.getRows(),
            progressSheet.getRows()
        ]);

        const latestRev = Math.max(-1, ...itemRows.filter(i => i.get('purchase_order_id') === poId).map(i => toNum(i.get('revision_number'), -1)));

        const poItems = itemRows.filter(item => item.get('purchase_order_id') === poId && toNum(item.get('revision_number'), -1) === latestRev);

        const poProgressRows = progressRows.filter(row => row.get('purchase_order_id') === poId);

        const progressByItemId = poProgressRows.reduce((acc, row) => {
            const itemId = row.get('purchase_order_item_id');
            if (!acc[itemId]) acc[itemId] = [];
            acc[itemId].push(row.toObject());
            return acc;
        }, {});

        const result = poItems.map(item => {
            const itemObject = {};
            itemSheet.headerValues.forEach(header => {
                itemObject[header] = item.get(header);
            });

            const itemId = String(itemObject.id);

            const history = (progressByItemId[itemId] || []).sort((a,b) => new Date(a.created_at) - new Date(b.created_at));

            return {
                ...itemObject,
                progressHistory: history,
            };
        });
        return result;
    } catch (err) {
        console.error(`❌ Gagal get PO items with details for PO ID ${poId}:`, err.message);
        return [];
    }
}


export async function getRecentProgressUpdates(limit = 10) {
  try {
    const doc = await openDoc();
    const progressSheet = await getSheet(doc, 'progress_tracking');
    const itemSheet = await getSheet(doc, 'purchase_order_items');
    const poSheet = await getSheet(doc, 'purchase_orders');

    const [progressRows, itemRows, poRows] = await Promise.all([
      progressSheet.getRows(),
      itemSheet.getRows(),
      poSheet.getRows()
    ]);

    // Buat Peta (Map) untuk pencarian data yang cepat
    const itemMap = new Map(itemRows.map(r => [r.get('id'), r.toObject()]));
    const poMap = new Map();
    poRows.forEach(r => {
        // Simpan hanya revisi terakhir untuk setiap po id
        const poId = r.get('id');
        const rev = toNum(r.get('revision_number'));
        if (!poMap.has(poId) || rev > poMap.get(poId).revision_number) {
            poMap.set(poId, r.toObject());
        }
    });

    // 1. Urutkan semua progress dari yang paling baru
    const sortedUpdates = progressRows
      .map(r => r.toObject())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    // 2. Ambil beberapa saja sesuai limit (misal: 10 terbaru)
    const recentUpdates = sortedUpdates.slice(0, limit);

    // 3. Lengkapi datanya dengan nama item dan nomor PO
    const enrichedUpdates = recentUpdates.map(update => {
      const item = itemMap.get(update.purchase_order_item_id);
      if (!item) return null; // Jika item tidak ditemukan, lewati

      const po = poMap.get(item.purchase_order_id);
      if (!po) return null; // Jika PO tidak ditemukan, lewati

      return {
        ...update,
        item_name: item.product_name,
        po_number: po.po_number,
      };
    }).filter(Boolean); // Hapus entri yang null

    return enrichedUpdates;
  } catch (err) {
    console.error('❌ Gagal get recent progress updates:', err.message);
    return [];
  }
}