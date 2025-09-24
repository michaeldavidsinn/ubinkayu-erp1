/* eslint-disable prettier/prettier */
import { GoogleSpreadsheet } from 'google-spreadsheet'
import { JWT } from 'google-auth-library'
import path from 'node:path'
import fs from 'node:fs'
import PDFDocument from 'pdfkit'
import { app, shell } from 'electron'
import { google } from 'googleapis'
import { generatePOPdf } from './pdfGenerator.js' //

const SPREADSHEET_ID = '1Bp5rETvaAe9nT4DrNpm-WsQqQlPNaau4gIzw1nA5Khk'
const PO_ARCHIVE_FOLDER_ID = '1-1Gw1ay4iQoFNFe2KcKDgCwOIi353QEC'
const PROGRESS_PHOTOS_FOLDER_ID = '1UfUQoqNBSsth9KzGRUmjenwegmsA6hbK'

const PRODUCTION_STAGES = [
  'Cari Bahan Baku',
  'Sawmill',
  'KD',
  'Pembahanan',
  'Moulding',
  'Coating',
  'Siap Kirim'
]

function getAuth() {
  const credPath = path.join(app.getAppPath(), 'electron', 'credentials.json')
  if (!fs.existsSync(credPath)) {
    const devCredPath = path.join(process.cwd(), 'electron', 'credentials.json')
    if (!fs.existsSync(devCredPath)) throw new Error('File credentials.json tidak ditemukan.')
    const creds = JSON.parse(fs.readFileSync(devCredPath, 'utf8'))
    return new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
        'https://www.googleapis.com/auth/drive.file'
      ]
    })
  }
  const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'))
  return new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ]
  })
}

async function openDoc() {
  const auth = getAuth()
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth)
  await doc.loadInfo()
  return doc
}

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
  const titles = ALIASES[key] || [key]
  for (const t of titles) {
    if (doc.sheetsByTitle[t]) return doc.sheetsByTitle[t]
  }
  throw new Error(
    `Sheet "${titles[0]}" tidak ditemukan. Pastikan nama sheet di Google Sheets sudah benar.`
  )
}

function toNum(v, def = 0) {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : def
}

async function getNextIdFromSheet(sheet) {
  await sheet.loadHeaderRow()
  const rows = await sheet.getRows()
  if (rows.length === 0) return '1'
  let maxId = 0
  rows.forEach((r) => {
    const val = toNum(r.get('id'), NaN)
    if (!Number.isNaN(val)) maxId = Math.max(maxId, val)
  })
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
    .filter((r) => String(r.get('id')).trim() === String(poId).trim())
    .map((r) => toNum(r.get('revision_number'), -1))
  return nums.length ? Math.max(...nums) : -1
}

async function getHeaderForRevision(poId, rev, doc) {
  const sh = await getSheet(doc, 'purchase_orders')
  const rows = await sh.getRows()
  return (
    rows.find(
      (r) =>
        String(r.get('id')).trim() === String(poId).trim() &&
        toNum(r.get('revision_number'), -1) === toNum(rev, -1)
    ) || null
  )
}

async function getItemsByRevision(poId, rev, doc) {
  const sh = await getSheet(doc, 'purchase_order_items')
  const rows = await sh.getRows()
  return rows
    .filter(
      (r) =>
        String(r.get('purchase_order_id')).trim() === String(poId).trim() &&
        toNum(r.get('revision_number'), -1) === toNum(rev, -1)
    )
    .map((r) => r.toObject())
}

async function getLivePOItems(poId, doc) {
  const latest = await latestRevisionNumberForPO(poId, doc)
  if (latest < 0) return []
  return getItemsByRevision(poId, latest, doc)
}

async function generateAndUploadPO(poData, revisionNumber) {
  try {
    const pdfResult = await generatePOPdf(poData, revisionNumber, false)
    if (!pdfResult.success) throw new Error('Gagal membuat file PDF lokal.')
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })
    const fileName = path.basename(pdfResult.path)
    const response = await drive.files.create({
      requestBody: { name: fileName, mimeType: 'application/pdf', parents: [PO_ARCHIVE_FOLDER_ID] },
      media: { mimeType: 'application/pdf', body: fs.createReadStream(pdfResult.path) },
      fields: 'id, webViewLink',
      supportsAllDrives: true
    })
    fs.unlinkSync(pdfResult.path)
    return { success: true, link: response.data.webViewLink }
  } catch (error) {
    console.error('❌ Proses Generate & Upload PO Gagal:', error)
    return { success: false, error: error.message }
  }
}

// ===============================
// GOOGLE DRIVE FILE UTILITIES
// ===============================

/**
 * Extract Google Drive file ID from various Drive URL formats
 * @param {string} driveUrl - Google Drive URL
 * @returns {string|null} - File ID or null if not found
 */
function extractGoogleDriveFileId(driveUrl) {
  if (!driveUrl || typeof driveUrl !== 'string') return null

  // Handle different Google Drive URL formats
  const patterns = [
    /\/d\/([a-zA-Z0-9-_]+)/, // /d/FILE_ID format
    /id=([a-zA-Z0-9-_]+)/, // id=FILE_ID format
    /file\/d\/([a-zA-Z0-9-_]+)/, // file/d/FILE_ID format
    /open\?id=([a-zA-Z0-9-_]+)/ // open?id=FILE_ID format
  ]

  for (const pattern of patterns) {
    const match = driveUrl.match(pattern)
    if (match && match[1]) {
      return match[1]
    }
  }

  return null
}

/**
 * Process items in batches to prevent API rate limiting
 * @param {Array} items - Items to process
 * @param {Function} processor - Function to process each item
 * @param {number} batchSize - Number of items to process simultaneously
 * @returns {Promise<Array>} - Array of results
 */
async function processBatch(items, processor, batchSize = 5) {
  const results = []
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize)
    const batchResults = await Promise.allSettled(batch.map(processor))
    results.push(
      ...batchResults.map((result) =>
        result.status === 'fulfilled'
          ? result.value
          : { success: false, error: result.reason?.message || 'Unknown error' }
      )
    )

    // Small delay between batches to be gentle on API
    if (i + batchSize < items.length) {
      await new Promise((resolve) => setTimeout(resolve, 100))
    }
  }
  return results
}

/**
 * Delete a file from Google Drive
 * @param {string} fileId - Google Drive file ID
 * @returns {Promise<{success: boolean, error?: string, fileId: string}>}
 */
async function deleteGoogleDriveFile(fileId) {
  try {
    if (!fileId) {
      return { success: false, error: 'File ID tidak valid', fileId }
    }

    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })

    await drive.files.delete({
      fileId: fileId,
      supportsAllDrives: true
    })

    console.log(`✅ File berhasil dihapus dari Google Drive: ${fileId}`)
    return { success: true, fileId }
  } catch (error) {
    console.error(`❌ Gagal menghapus file dari Google Drive (${fileId}):`, error.message)
    return { success: false, error: error.message, fileId }
  }
}

async function uploadProgressPhoto(photoPath, poNumber, itemId) {
  try {
    if (!fs.existsSync(photoPath)) throw new Error(`File foto tidak ditemukan: ${photoPath}`)
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })
    const timestamp = new Date().toISOString().replace(/:/g, '-')
    const fileName = `PO-${poNumber}_ITEM-${itemId}_${timestamp}.jpg`
    const response = await drive.files.create({
      requestBody: { name: fileName, mimeType: 'image/jpeg', parents: [PROGRESS_PHOTOS_FOLDER_ID] },
      media: { mimeType: 'image/jpeg', body: fs.createReadStream(photoPath) },
      fields: 'id, webViewLink',
      supportsAllDrives: true
    })
    return { success: true, link: response.data.webViewLink }
  } catch (error) {
    console.error('❌ Gagal unggah foto progress:', error)
    return { success: false, error: error.message }
  }
}

export async function testSheetConnection() {
  try {
    const doc = await openDoc()
    console.log(`✅ Tes koneksi OK: "${doc.title}"`)
  } catch (err) {
    console.error('❌ Gagal tes koneksi ke Google Sheets:', err.message)
  }
}

export async function listPOs() {
  try {
    const doc = await openDoc()
    const poSheet = await getSheet(doc, 'purchase_orders')
    const itemSheet = await getSheet(doc, 'purchase_order_items')
    const progressSheet = await getSheet(doc, 'progress_tracking')

    const [poRows, itemRows, progressRows] = await Promise.all([
      poSheet.getRows(),
      itemSheet.getRows(),
      progressSheet.getRows()
    ])

    const byId = new Map()
    for (const r of poRows) {
      const id = String(r.get('id')).trim()
      const rev = toNum(r.get('revision_number'), -1)
      const keep = byId.get(id)
      if (!keep || rev > keep.rev) byId.set(id, { rev, row: r })
    }
    const latestPoRows = Array.from(byId.values()).map(({ row }) => row)

    const progressByCompositeKey = progressRows.reduce((acc, row) => {
      const poId = row.get('purchase_order_id')
      const itemId = row.get('purchase_order_item_id')
      const key = `${poId}-${itemId}`
      if (!acc[key]) acc[key] = []
      acc[key].push({ stage: row.get('stage'), created_at: row.get('created_at') })
      return acc
    }, {})

    const itemsByPoId = itemRows.reduce((acc, item) => {
      const poId = item.get('purchase_order_id');
      if (!acc[poId]) acc[poId] = [];
      acc[poId].push(item.toObject());
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

    const result = latestPoRows.map((po) => {
      const poObject = po.toObject()
      const poId = poObject.id

      const latestRev = latestItemRevisions.get(poId) ?? -1;
      const poItems = (itemsByPoId[poId] || []).filter(
        item => toNum(item.revision_number, -1) === latestRev
      );

      let poProgress = 0;
      if (poItems.length > 0) {
        let totalPercentage = 0;
        poItems.forEach(item => {
          const itemId = item.id;
          const needsSample = item.sample === 'Ada sample';
          const stages = ['Pembahanan'];
          if (needsSample) stages.push('Kasih Sample');
          stages.push('Start Produksi', 'Kirim');
          const compositeKey = `${poId}-${itemId}`;
          const itemProgressHistory = progressByCompositeKey[compositeKey] || [];
          let latestStageIndex = -1;
          if (itemProgressHistory.length > 0) {
            const latestProgress = itemProgressHistory.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
            latestStageIndex = stages.indexOf(latestProgress.stage);
          }
          const itemPercentage = latestStageIndex >= 0 ? ((latestStageIndex + 1) / stages.length) * 100 : 0;
          totalPercentage += itemPercentage;
        });
        poProgress = totalPercentage / poItems.length;
      }

      let finalStatus = poObject.status;
      if (finalStatus !== 'Cancelled') {
        if (poProgress >= 100) finalStatus = 'Completed';
        else if (poProgress > 0) finalStatus = 'In Progress';
        else finalStatus = 'Open';
      }

      return {
        ...poObject,
        items: poItems,
        progress: Math.round(poProgress),
        status: finalStatus,
        pdf_link: po.get('pdf_link') || null
      }
    })

    return result
  } catch (err) {
    console.error('❌ listPOs error:', err.message)
    return []
  }
}

export async function saveNewPO(data) {
  console.log('TITIK B (Backend): Menerima data:', data)
  try {
    const doc = await openDoc()
    const now = new Date().toISOString()
    const poSheet = await getSheet(doc, 'purchase_orders')
    const itemSheet = await getSheet(doc, 'purchase_order_items')

    const poId = await getNextIdFromSheet(poSheet)

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
    })

    const itemsWithIds = []
    let nextItemId = parseInt(await getNextIdFromSheet(itemSheet), 10)
    const itemsToAdd = (data.items || []).map((raw) => {
      const clean = scrubItemPayload(raw)
      const newItem = {
        id: nextItemId,
        purchase_order_id: poId,
        ...clean,
        revision_id: 0,
        revision_number: 0,
        kubikasi: raw.kubikasi || 0
      }
      itemsWithIds.push({ ...raw, id: nextItemId })
      nextItemId++
      return newItem
    })

    if (itemsToAdd.length > 0) {
      await itemSheet.addRows(itemsToAdd)
    }

    const poDataForPdf = {
      po_number: data.nomorPo,
      project_name: data.namaCustomer,
      deadline: data.tanggalKirim,
      priority: data.prioritas,
      items: itemsWithIds,
      notes: data.catatan,
      created_at: now,
      kubikasi_total: data.kubikasi_total || 0,
      poPhotoPath: data.poPhotoPath
    }
    console.log('TITIK C (Backend): Meneruskan ke PDF:', poDataForPdf)
    const uploadResult = await generateAndUploadPO(poDataForPdf, 0)

    if (uploadResult.success) {
      newPoRow.set('pdf_link', uploadResult.link)
      await newPoRow.save()
    } else {
      newPoRow.set('pdf_link', `ERROR: ${uploadResult.error}`)
      await newPoRow.save()
    }

    return { success: true, poId, revision_number: 0 }
  } catch (err) {
    console.error('❌ saveNewPO error:', err.message)
    return { success: false, error: err.message }
  }
}

export async function updatePO(data) {
  console.log('TITIK B (Backend): Menerima data:', data)
  try {
    const doc = await openDoc()
    const now = new Date().toISOString()
    const poSheet = await getSheet(doc, 'purchase_orders')
    const itemSheet = await getSheet(doc, 'purchase_order_items')

    const latest = await latestRevisionNumberForPO(String(data.poId), doc)
    const prevRow = latest >= 0 ? await getHeaderForRevision(String(data.poId), latest, doc) : null
    const prev = prevRow ? prevRow.toObject() : {}
    const newRev = latest >= 0 ? latest + 1 : 0

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
    })

    const itemsWithIds = []
    let nextItemId = parseInt(await getNextIdFromSheet(itemSheet), 10)
    const itemsToAdd = (data.items || []).map((raw) => {
      const clean = scrubItemPayload(raw)
      const newItem = {
        id: nextItemId,
        purchase_order_id: String(data.poId),
        ...clean,
        revision_id: newRev,
        revision_number: newRev,
        kubikasi: raw.kubikasi || 0
      }
      itemsWithIds.push({ ...raw, id: nextItemId })
      nextItemId++
      return newItem
    })

    if (itemsToAdd.length > 0) {
      await itemSheet.addRows(itemsToAdd)
    }

    const poDataForPdf = {
      po_number: data.nomorPo ?? prev.po_number,
      project_name: data.namaCustomer ?? prev.project_name,
      deadline: data.tanggalKirim ?? prev.deadline,
      priority: data.prioritas ?? prev.priority,
      items: itemsWithIds,
      notes: data.catatan ?? prev.notes,
      created_at: now,
      poPhotoPath: data.poPhotoPath
    }

    const uploadResult = await generateAndUploadPO(poDataForPdf, newRev)

    if (uploadResult.success) {
      newRevisionRow.set('pdf_link', uploadResult.link)
      await newRevisionRow.save()
    } else {
      newRevisionRow.set('pdf_link', `ERROR: ${uploadResult.error}`)
      await newRevisionRow.save()
    }

    return { success: true, revision_number: newRev }
  } catch (err) {
    console.error('❌ updatePO error:', err.message)
    return { success: false, error: err.message }
  }
}

export async function deletePO(poId) {
  const startTime = Date.now()
  console.log(`🗑️ Memulai penghapusan lengkap PO ID: ${poId}`)

  try {
    const doc = await openDoc()

    console.log(`📄 Mengambil data dari 3 sheet...`)
    const [poSheet, itemSheet, progressSheet] = await Promise.all([
      getSheet(doc, 'purchase_orders'),
      getSheet(doc, 'purchase_order_items'),
      getSheet(doc, 'progress_tracking')
    ])

    const [poRows, itemRows, progressRows] = await Promise.all([
      poSheet.getRows(),
      itemSheet.getRows(),
      progressSheet.getRows()
    ])

    const toDelHdr = poRows.filter((r) => String(r.get('id')).trim() === String(poId).trim())
    const toDelItems = itemRows.filter(
      (r) => String(r.get('purchase_order_id')).trim() === String(poId).trim()
    )
    const poProgressRows = progressRows.filter(
      (r) => String(r.get('purchase_order_id')).trim() === String(poId).trim()
    )

    const fileIds = new Set()

    toDelHdr.forEach((poRow) => {
      const pdfLink = poRow.get('pdf_link')
      if (pdfLink && !pdfLink.startsWith('ERROR:') && !pdfLink.includes('generating')) {
        const fileId = extractGoogleDriveFileId(pdfLink)
        if (fileId) fileIds.add(fileId)
      }
    })

    poProgressRows.forEach((progressRow) => {
      const photoUrl = progressRow.get('photo_url')
      if (photoUrl) {
        const fileId = extractGoogleDriveFileId(photoUrl)
        if (fileId) fileIds.add(fileId)
      }
    })

    const uniqueFileIds = Array.from(fileIds)

    let deletedFilesCount = 0
    let failedFilesCount = 0
    let failedFiles = []

    if (uniqueFileIds.length > 0) {
      console.log(`🗂️ Menghapus ${uniqueFileIds.length} file dari Google Drive dalam batch...`)

      const deleteResults = await processBatch(
        uniqueFileIds,
        deleteGoogleDriveFile,
        5
      )

      deleteResults.forEach((result) => {
        if (result.success) {
          deletedFilesCount++
        } else {
          failedFilesCount++
          failedFiles.push({ fileId: result.fileId, error: result.error })
          console.warn(`⚠️ Gagal menghapus file ${result.fileId}: ${result.error}`)
        }
      })
    }

    console.log(`📄 Menghapus data dari spreadsheet...`)

    // Step 6: Delete spreadsheet data in parallel where possible (OPTIMIZATION)
    const sheetDeletions = []

    // Add progress row deletions
    poProgressRows.reverse().forEach((row) => {
      sheetDeletions.push(row.delete())
    })

    // Add PO header deletions
    toDelHdr.reverse().forEach((row) => {
      sheetDeletions.push(row.delete())
    })

    // Add item deletions
    toDelItems.reverse().forEach((row) => {
      sheetDeletions.push(row.delete())
    })

    // Execute all sheet deletions in parallel (MAJOR OPTIMIZATION)
    await Promise.allSettled(sheetDeletions)

    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(1)

    // Step 7: Prepare summary report
    const summary = {
      deletedRevisions: toDelHdr.length,
      deletedItems: toDelItems.length,
      deletedProgressRecords: poProgressRows.length,
      deletedFiles: deletedFilesCount,
      failedFileDeletes: failedFilesCount,
      duration: `${duration}s`,
      failedFiles: failedFiles.length > 0 ? failedFiles : undefined
    }

    console.log(`✅ PO ${poId} berhasil dihapus lengkap dalam ${duration}s:`, summary)

    const message =
      failedFilesCount > 0
        ? `PO berhasil dihapus: ${summary.deletedRevisions} revisi, ${summary.deletedItems} item, ${summary.deletedProgressRecords} progress record, ${summary.deletedFiles} file dari Drive (${failedFilesCount} file gagal dihapus)`
        : `PO berhasil dihapus: ${summary.deletedRevisions} revisi, ${summary.deletedItems} item, ${summary.deletedProgressRecords} progress record, ${summary.deletedFiles} file dari Drive`

    return {
      success: true,
      message,
      summary
    }
  } catch (err) {
    const endTime = Date.now()
    const duration = ((endTime - startTime) / 1000).toFixed(1)
    console.error(`❌ Gagal menghapus PO ID ${poId} setelah ${duration}s:`, err.message)
    return { success: false, error: err.message, duration: `${duration}s` }
  }
}

export async function listPOItems(poId) {
  try {
    const doc = await openDoc()
    return await getLivePOItems(String(poId), doc)
  } catch (err) {
    console.error('❌ listPOItems error:', err.message)
    return []
  }
}

export async function listPORevisions(poId) {
  try {
    const doc = await openDoc()
    const poSheet = await getSheet(doc, 'purchase_orders')
    const rows = await poSheet.getRows()
    return rows
      .filter((r) => String(r.get('id')).trim() === String(poId).trim())
      .map((r) => r.toObject())
      .sort((a, b) => a.revision_number - b.revision_number)
  } catch (err) {
    console.error('❌ listPORevisions error:', err.message)
    return []
  }
}

export async function listPOItemsByRevision(poId, revisionNumber) {
  try {
    const doc = await openDoc()
    return await getItemsByRevision(String(poId), toNum(revisionNumber, 0), doc)
  } catch (err) {
    console.error('❌ listPOItemsByRevision error:', err.message)
    return []
  }
}

export async function getProducts() {
  try {
    const doc = await openDoc()
    const sheet = await getSheet(doc, 'product_master')
    const rows = await sheet.getRows()
    return rows.map((r) => r.toObject())
  } catch (err) {
    console.error('❌ getProducts error:', err.message)
    return []
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
      notes: data.catatan || ''
    }
    return await generatePOPdf(poData, 'preview', true)
  } catch (err) {
    console.error('❌ previewPO error:', err.message)
    return { success: false, error: err.message }
  }
}

export async function getRevisionHistory(poId) {
  try {
    const doc = await openDoc()
    const metas = await listPORevisions(String(poId))
    const itemSheet = await getSheet(doc, 'purchase_order_items')
    const allItemRows = await itemSheet.getRows()

    const history = metas.map((m) => ({
      revision: m,
      items: allItemRows
        .filter(
          (r) =>
            String(r.get('purchase_order_id')) === String(poId) &&
            // [MODIFIKASI] Pastikan kedua sisi perbandingan adalah ANGKA
            toNum(r.get('revision_number'), -1) === toNum(m.revision_number, -1)
        )
        .map((r) => r.toObject())
    }))
    history.sort((a, b) => b.revision.revision_number - a.revision.revision_number)
    return history
  } catch (err) {
    console.error('❌ getRevisionHistory error:', err.message)
    return []
  }
}

export async function updateItemProgress(data) {
  try {
    const { poId, itemId, poNumber, stage, notes, photoPath } = data
    let photoLink = null
    if (photoPath) {
      if (!fs.existsSync(photoPath)) throw new Error(`File foto tidak ditemukan: ${photoPath}`)

      const auth = getAuth()
      const drive = google.drive({ version: 'v3', auth })
      const timestamp = new Date().toISOString().replace(/:/g, '-')
      const fileName = `PO-${poNumber}_ITEM-${itemId}_${timestamp}.jpg` // Nama file yang unik

      console.log(`Mengunggah foto progress: ${fileName}`)
      const response = await drive.files.create({
        requestBody: {
          name: fileName,
          mimeType: 'image/jpeg',
          parents: [PROGRESS_PHOTOS_FOLDER_ID] // ID Folder dari konstanta di atas
        },
        media: {
          mimeType: 'image/jpeg',
          body: fs.createReadStream(photoPath)
        },
        fields: 'id, webViewLink',
        supportsAllDrives: true
      })

      photoLink = response.data.webViewLink
      console.log(`✅ Foto progress berhasil diunggah. Link: ${photoLink}`)
    }

    const doc = await openDoc()
    const progressSheet = await getSheet(doc, 'progress_tracking')
    const nextId = await getNextIdFromSheet(progressSheet)

    await progressSheet.addRow({
      id: nextId,
      purchase_order_id: poId,
      purchase_order_item_id: itemId,
      stage: stage,
      notes: notes,
      photo_url: photoLink, // Simpan link foto dari Drive
      created_at: new Date().toISOString()
    })
    console.log(`✅ Log progress untuk item ID ${itemId} berhasil disimpan.`)

    return { success: true }
  } catch (err) {
    console.error('❌ Gagal update item progress:', err.message)
    return { success: false, error: err.message }
  }
}

export async function getActivePOsWithProgress() {
  try {
    const doc = await openDoc()
    const poSheet = await getSheet(doc, 'purchase_orders')
    const itemSheet = await getSheet(doc, 'purchase_order_items')
    const progressSheet = await getSheet(doc, 'progress_tracking')

    const [poRows, itemRows, progressRows] = await Promise.all([
      poSheet.getRows(),
      itemSheet.getRows(),
      progressSheet.getRows()
    ])

    const byId = new Map()
    for (const r of poRows) {
      const id = String(r.get('id')).trim()
      const rev = toNum(r.get('revision_number'), -1)
      const keep = byId.get(id)
      if (!keep || rev > keep.rev) byId.set(id, { rev, row: r })
    }
    const latestPoRows = Array.from(byId.values()).map(({ row }) => row)

    const activePOs = latestPoRows.filter(
      (r) => r.get('status') !== 'Completed' && r.get('status') !== 'Cancelled'
    )

    const progressByCompositeKey = progressRows.reduce((acc, row) => {
      const poId = row.get('purchase_order_id')
      const itemId = row.get('purchase_order_item_id')
      const key = `${poId}-${itemId}`
      if (!acc[key]) acc[key] = []
      acc[key].push({ stage: row.get('stage'), created_at: row.get('created_at') })
      return acc
    }, {})

    const latestItemRevisions = new Map()
    itemRows.forEach((item) => {
      const poId = item.get('purchase_order_id')
      const rev = toNum(item.get('revision_number'), -1)
      const current = latestItemRevisions.get(poId)
      if (!current || rev > current) {
        latestItemRevisions.set(poId, rev)
      }
    })

    const result = activePOs.map((po) => {
      const poId = po.get('id')
      const latestRev = latestItemRevisions.get(poId) ?? -1
      const poItems = itemRows.filter(
        (item) =>
          item.get('purchase_order_id') === poId &&
          toNum(item.get('revision_number'), -1) === latestRev
      )

      if (poItems.length === 0) {
        return { ...po.toObject(), progress: 0 }
      }

      let totalPercentage = 0
      poItems.forEach((item) => {
        const itemId = item.get('id')

        const stages = PRODUCTION_STAGES
        // const stages = ['Pembahanan'];
        // if (needsSample) {
        //   stages.push('Kasih Sample');
        // }
        // stages.push('Start Produksi');
        // stages.push('Kirim');

        const compositeKey = `${poId}-${itemId}`
        const itemProgressHistory = progressByCompositeKey[compositeKey] || []

        let latestStageIndex = -1
        if (itemProgressHistory.length > 0) {
          const latestProgress = itemProgressHistory.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]
          latestStageIndex = stages.indexOf(latestProgress.stage)
        }

        const itemPercentage =
          latestStageIndex >= 0 ? ((latestStageIndex + 1) / stages.length) * 100 : 0
        totalPercentage += itemPercentage
      })

      const poProgress = totalPercentage / poItems.length
      return { ...po.toObject(), progress: Math.round(poProgress) }
    })
    return result
  } catch (err) {
    console.error('❌ Gagal get active POs with progress:', err.message)
    return []
  }
}

export async function getPOItemsWithDetails(poId) {
  console.log(`\n--- [DEBUG] Memulai getPOItemsWithDetails untuk PO ID: ${poId} ---`);
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

    const allRevisionsForPO = poRows.filter(r => r.get('id') === poId);
    console.log(`[DEBUG] Ditemukan ${allRevisionsForPO.length} baris revisi untuk PO ID ${poId}`);

    const latestPoRev = Math.max(-1, ...allRevisionsForPO.map(r => toNum(r.get('revision_number'))));
    console.log(`[DEBUG] Revisi terbaru adalah: #${latestPoRev}`);

    const poData = allRevisionsForPO.find(r => toNum(r.get('revision_number')) === latestPoRev);

    if (!poData) {
      console.error(`[DEBUG] ERROR: Tidak ada data PO ditemukan untuk revisi #${latestPoRev}`);
      throw new Error(`PO dengan ID ${poId} tidak ditemukan.`);
    }
    console.log(`[DEBUG] Data PO ditemukan.`);

    const createdAtRaw = poData.get('created_at');
    const deadlineRaw = poData.get('deadline');
    console.log(`[DEBUG] created_at (mentah): ${createdAtRaw} | Tipe: ${typeof createdAtRaw}`);
    console.log(`[DEBUG] deadline (mentah): ${deadlineRaw} | Tipe: ${typeof deadlineRaw}`);

    const poStartDate = new Date(createdAtRaw);
    const poDeadline = new Date(deadlineRaw);
    console.log(`[DEBUG] poStartDate (setelah new Date): ${poStartDate.toISOString()}`);
    console.log(`[DEBUG] poDeadline (setelah new Date): ${poDeadline.toISOString()}`);

    let stageDeadlines = [];

    if (poStartDate && poDeadline && poDeadline > poStartDate) {
      console.log('[DEBUG] Kondisi IF untuk kalkulasi deadline TERPENUHI.');
      const totalDuration = poDeadline.getTime() - poStartDate.getTime();
      const durationPerStage = totalDuration / PRODUCTION_STAGES.length;
      console.log(`[DEBUG] Total Durasi: ${totalDuration} ms, Durasi per Tahap: ${durationPerStage} ms`);

      stageDeadlines = PRODUCTION_STAGES.map((stageName, index) => {
        const deadlineTime = poStartDate.getTime() + (durationPerStage * (index + 1));
        return {
          stageName,
          deadline: new Date(deadlineTime).toISOString()
        };
      });
      console.log('[DEBUG] stageDeadlines berhasil dihitung:', stageDeadlines);
    } else {
      console.warn('[DEBUG] Kondisi IF untuk kalkulasi deadline TIDAK TERPENUHI.');
    }

    const poItems = itemRows.filter(item => item.get('purchase_order_id') === poId && toNum(item.get('revision_number'), -1) === latestPoRev);

    // ... sisa fungsi tidak berubah ...
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
      const history = (progressByItemId[itemId] || []).sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

      return {
        ...itemObject,
        progressHistory: history,
        stageDeadlines: stageDeadlines,
      };
    });
    console.log('--- [DEBUG] Proses Selesai ---');
    return result;
  } catch (err) {
    console.error(`❌ Gagal get PO items with details for PO ID ${poId}:`, err.message);
    return [];
  }
}

export async function getRecentProgressUpdates(limit = 10) {
  try {
    const doc = await openDoc()
    const progressSheet = await getSheet(doc, 'progress_tracking')
    const itemSheet = await getSheet(doc, 'purchase_order_items')
    const poSheet = await getSheet(doc, 'purchase_orders')

    const [progressRows, itemRows, poRows] = await Promise.all([
      progressSheet.getRows(),
      itemSheet.getRows(),
      poSheet.getRows()
    ])

    const itemMap = new Map(itemRows.map((r) => [r.get('id'), r.toObject()]))
    const poMap = new Map()
    poRows.forEach((r) => {
      const poId = r.get('id')
      const rev = toNum(r.get('revision_number'))
      if (!poMap.has(poId) || rev > poMap.get(poId).revision_number) {
        poMap.set(poId, r.toObject())
      }
    })

    const sortedUpdates = progressRows
      .map((r) => r.toObject())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

    const recentUpdates = sortedUpdates.slice(0, limit)

    const enrichedUpdates = recentUpdates
      .map((update) => {
        const item = itemMap.get(update.purchase_order_item_id)
        if (!item) return null

        const po = poMap.get(item.purchase_order_id)
        if (!po) return null

        return {
          ...update,
          item_name: item.product_name,
          po_number: po.po_number
        }
      })
      .filter(Boolean)

    return enrichedUpdates
  } catch (err) {
    console.error('❌ Gagal get recent progress updates:', err.message)
    return []
  }
}

export async function getAttentionData() {
  try {
    const doc = await openDoc()
    const poSheet = await getSheet(doc, 'purchase_orders')
    const itemSheet = await getSheet(doc, 'purchase_order_items')
    const progressSheet = await getSheet(doc, 'progress_tracking')

    const [poRows, itemRows, progressRows] = await Promise.all([
      poSheet.getRows(),
      itemSheet.getRows(),
      progressSheet.getRows()
    ])

    const byId = new Map()
    poRows.forEach((r) => {
      const id = r.get('id')
      const rev = toNum(r.get('revision_number'))
      if (!byId.has(id) || rev > byId.get(id).rev) {
        byId.set(id, { rev, row: r })
      }
    })
    const latestPoMap = new Map(
      Array.from(byId.values()).map((item) => [item.row.get('id'), item.row])
    )

    const latestItemRevisions = new Map()
    itemRows.forEach((item) => {
      const poId = item.get('purchase_order_id')
      const rev = toNum(item.get('revision_number'), -1)
      const current = latestItemRevisions.get(poId)
      if (!current || rev > current) {
        latestItemRevisions.set(poId, rev)
      }
    })

    const activeItems = itemRows.filter((item) => {
      const po = latestPoMap.get(item.get('purchase_order_id'))
      if (!po) return false
      const latestRev = latestItemRevisions.get(item.get('purchase_order_id')) ?? -1
      return (
        po.get('status') !== 'Completed' &&
        po.get('status') !== 'Cancelled' &&
        toNum(item.get('revision_number')) === latestRev
      )
    })

    const progressByCompositeKey = progressRows.reduce((acc, row) => {
      const poId = row.get('purchase_order_id')
      const itemId = row.get('purchase_order_item_id')
      const key = `${poId}-${itemId}`
      if (!acc[key]) acc[key] = []
      acc[key].push({ stage: row.get('stage'), created_at: row.get('created_at') })
      return acc
    }, {})

    const nearingDeadline = []
    const stuckItems = []
    const urgentItems = []
    const today = new Date()
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    const fiveDaysAgo = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)

    activeItems.forEach((item) => {
      const po = latestPoMap.get(item.get('purchase_order_id'))
      const poId = po.get('id')
      const itemId = item.get('id')
      const compositeKey = `${poId}-${itemId}`
      const itemProgressHistory = progressByCompositeKey[compositeKey] || []
      const latestProgress = itemProgressHistory.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
      const currentStage = latestProgress ? latestProgress.stage : 'Belum Mulai'

      const attentionItem = {
        po_number: po.get('po_number'),
        item_name: item.get('product_name'),
        current_stage: currentStage
      }

      if (po.get('priority') === 'Urgent') {
        urgentItems.push(attentionItem)
      }

      const deadline = new Date(po.get('deadline'))
      if (deadline <= sevenDaysFromNow && deadline >= today && currentStage !== 'Kirim') {
        nearingDeadline.push({ ...attentionItem, deadline: po.get('deadline') })
      }

      if (
        latestProgress &&
        new Date(latestProgress.created_at) < fiveDaysAgo &&
        currentStage !== 'Kirim'
      ) {
        stuckItems.push({ ...attentionItem, last_update: latestProgress.created_at })
      }
    })

    return { nearingDeadline, stuckItems, urgentItems }
  } catch (err) {
    console.error('❌ Gagal get attention data:', err.message)
    return { nearingDeadline: [], stuckItems: [], urgentItems: [] }
  }
}

// Di dalam file: electron/sheet.js

export async function getProductSalesAnalysis() {
  try {
    const doc = await openDoc();
    const itemSheet = await getSheet(doc, 'purchase_order_items');
    const poSheet = await getSheet(doc, 'purchase_orders');
    const productSheet = await getSheet(doc, 'product_master');

    const [itemRows, poRows, productRows] = await Promise.all([
      itemSheet.getRows(),
      poSheet.getRows(),
      productSheet.getRows(),
    ]);

    const poMap = new Map();
    poRows.forEach(r => {
        const poId = r.get('id');
        const rev = toNum(r.get('revision_number'));
        if (!poMap.has(poId) || rev > poMap.get(poId).revision_number) {
            poMap.set(poId, r.toObject());
        }
    });

    const salesData = {};
    const salesByDate = [];
    const woodTypeData = {};
    const customerData = {};

    itemRows.forEach(item => {
      const productName = item.get('product_name');
      const quantity = toNum(item.get('quantity'), 0);
      const woodType = item.get('wood_type');
      const kubikasi = toNum(item.get('kubikasi'), 0);
      const poId = item.get('purchase_order_id');
      const po = poMap.get(poId);

      if (!productName || !po) return;

      if (!salesData[productName]) {
        salesData[productName] = { totalQuantity: 0, name: productName };
      }
      salesData[productName].totalQuantity += quantity;

      salesByDate.push({
        date: new Date(po.created_at),
        name: productName,
        quantity: quantity
      });

      if (woodType) {
          woodTypeData[woodType] = (woodTypeData[woodType] || 0) + quantity;
      }

      const customerName = po.project_name
      if (customerName) {
          customerData[customerName] = (customerData[customerName] || 0) + kubikasi;
      }
    });

    const topSellingProducts = Object.values(salesData)
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 10);

    const woodTypeDistribution = Object.keys(woodTypeData)
      .map((name) => ({
        name,
        value: woodTypeData[name]
    })).sort((a,b) => b.value - a.value);

    const topCustomers = Object.keys(customerData)
      .map((name) => ({
        name,
        totalKubikasi: customerData[name]
    })).sort((a,b) => b.totalKubikasi - a.totalKubikasi).slice(0, 5);

    const today = new Date()
    const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30))
    const sixtyDaysAgo = new Date(new Date().setDate(today.getDate() - 60))

    const salesLast30 = {}
    const salesPrev30 = {}

    salesByDate.forEach((sale) => {
      if (sale.date >= thirtyDaysAgo) {
        salesLast30[sale.name] = (salesLast30[sale.name] || 0) + sale.quantity;
      } else if (sale.date >= sixtyDaysAgo) {
        salesPrev30[sale.name] = (salesPrev30[sale.name] || 0) + sale.quantity;
      }
    });

    const trendingProducts = Object.keys(salesLast30)
      .map(name => {
        const last30 = salesLast30[name];
        const prev30 = salesPrev30[name] || 0;
        const change = prev30 === 0 && last30 > 0 ? 100 : ((last30 - prev30) / (prev30 || 1)) * 100;
        return { name, last30, prev30, change };
      })
      .filter(p => p.change > 20 && p.last30 > p.prev30)
      .sort((a, b) => b.change - a.change);

    const allProductNames = productRows.map(r => r.get('product_name'));
    const soldProductNames = new Set(Object.keys(salesData));
    const neverSoldProducts = allProductNames.filter(name => !soldProductNames.has(name));

    return {
        topSellingProducts,
        woodTypeDistribution,
        topCustomers,
        trendingProducts,
        slowMovingProducts: neverSoldProducts,
    };

  } catch (err) {
    console.error('❌ Gagal melakukan analisis penjualan produk:', err.message);
    return { topSellingProducts: [], woodTypeDistribution: [], topCustomers: [], trendingProducts: [], slowMovingProducts: [] };
  }
}

export async function getSalesItemData() {
  try {
    const doc = await openDoc();
    const itemSheet = await getSheet(doc, 'purchase_order_items');
    const poSheet = await getSheet(doc, 'purchase_orders');

    const [itemRows, poRows] = await Promise.all([
      itemSheet.getRows(),
      poSheet.getRows()
    ]);

    const poMap = new Map();
    poRows.forEach(r => {
        const poId = r.get('id');
        const rev = toNum(r.get('revision_number'));
        if (!poMap.has(poId) || rev > poMap.get(poId).revision_number) {
            poMap.set(poId, r.toObject());
        }
    });

    const combinedData = itemRows.map(item => {
      const itemObject = item.toObject();
      const po = poMap.get(itemObject.purchase_order_id);

      if (!po) return null;

      return {
        ...itemObject,
        customer_name: po.project_name,
        po_date: po.created_at,
      };
    }).filter(Boolean);

    return combinedData;
  } catch (err) {
    console.error('❌ Gagal mengambil data item penjualan:', err.message);
    return [];
  }
}
