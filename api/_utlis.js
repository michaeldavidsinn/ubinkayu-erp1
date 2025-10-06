// File: /api/_utils.js

import { GoogleSpreadsheet } from 'google-spreadsheet'
import { JWT } from 'google-auth-library'
import { google } from 'googleapis'
import { createCanvas, loadImage } from 'canvas'
import stream from 'stream'

// --- KONFIGURASI DASAR ---
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

// --- FUNGSI AUTENTIKASI & SHEET HELPER ---

function getAuth() {
  const creds = {
    client_email: process.env.GOOGLE_CLIENT_EMAIL,
    private_key: (process.env.GOOGLE_PRIVATE_KEY || '').replace(/\\n/g, '\n')
  }
  if (!creds.client_email || !creds.private_key) {
    throw new Error('Credentials Google tidak ditemukan di environment variables.')
  }
  return new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: [
      'https://www.googleapis.com/auth/spreadsheets',
      'https://www.googleapis.com/auth/drive.file'
    ]
  })
}

export async function openDoc() {
  const auth = getAuth()
  const doc = new GoogleSpreadsheet(SPREADSHEET_ID, auth)
  await doc.loadInfo()
  return doc
}

const ALIASES = {
  purchase_orders: ['purchase_orders', 'purchase_order'],
  purchase_order_items: ['purchase_order_items', 'po_items'],
  product_master: ['product_master', 'products'],
  progress_tracking: ['purchase_order_items_progress', 'progress']
}

export async function getSheet(doc, key) {
  const titles = ALIASES[key] || [key]
  for (const t of titles) {
    if (doc.sheetsByTitle[t]) return doc.sheetsByTitle[t]
  }
  throw new Error(`Sheet "${titles[0]}" tidak ditemukan.`)
}

export function toNum(v, def = 0) {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : def
}

function scrubItemPayload(item) {
  const { id, purchase_order_id, revision_id, revision_number, ...rest } = item || {}
  return rest
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

// --- FUNGSI BANTUAN PO & REVISI ---

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

// --- FUNGSI GOOGLE DRIVE (Serverless Safe) ---

function extractGoogleDriveFileId(driveUrl) {
  if (!driveUrl || typeof driveUrl !== 'string') return null
  const patterns = [
    /\/d\/([a-zA-Z0-9-_]+)/,
    /id=([a-zA-Z0-9-_]+)/,
    /file\/d\/([a-zA-Z0-9-_]+)/,
    /open\?id=([a-zA-Z0-9-_]+)/
  ]
  for (const pattern of patterns) {
    const match = driveUrl.match(pattern)
    if (match && match[1]) return match[1]
  }
  return null
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = (text || '').split(' ')
  let line = ''
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' '
    const metrics = context.measureText(testLine)
    const testWidth = metrics.width
    if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, y)
      line = words[n] + ' '
      y += lineHeight
    } else {
      line = testLine
    }
  }
  context.fillText(line, x, y)
}

async function generatePOJpegBuffer(poData, revisionNumber = 0) {
  const width = 1200
  const dynamicHeight = 1000 + poData.items.length * 80 + (poData.notes ? 100 : 0)
  const height = Math.max(1800, dynamicHeight)
  const canvas = createCanvas(width, height)
  const ctx = canvas.getContext('2d')

  ctx.fillStyle = '#FFFFFF'
  ctx.fillRect(0, 0, width, height)

  const redColor = '#D92121',
    blueColor = '#0000FF',
    blackColor = '#000000',
    greenColor = '#006400'
  const headerBgColor = '#F0F0F0',
    totalBgColor = '#FFE6E6',
    borderColor = '#AAAAAA'

  ctx.font = 'bold 24px Arial'
  ctx.fillStyle = redColor
  const headerText = `${poData.po_number || 'N/A'} ${poData.project_name || 'N/A'}`
  ctx.textAlign = 'center'
  ctx.fillText(headerText, width / 2, 40)
  ctx.textAlign = 'left'
  ctx.font = 'bold 20px Arial'
  ctx.fillStyle = blackColor
  const sbyText = `SBY R: ${revisionNumber}`
  const dateText = poData.created_at
    ? new Date(poData.created_at).toLocaleDateString('id-ID')
    : new Date().toLocaleDateString('id-ID')
  const rightHeaderText = `${sbyText}  ${dateText}`
  ctx.textAlign = 'right'
  ctx.fillText(rightHeaderText, width - 30, 40)
  ctx.textAlign = 'left'
  const tableTop = 70
  const tableLeft = 30
  const tableWidth = width - 60
  const cols = {
    rencKirim: { x: 0, width: 100 },
    noPo: { x: 100, width: 150 },
    produk: { x: 250, width: 200 },
    finishing: { x: 450, width: 180 },
    ukuran: { x: 630, width: 150 },
    kuantiti: { x: 780, width: 100 },
    kubikasi: { x: 880, width: 100 },
    lokasi: { x: 980, width: 160 }
  }
  ctx.fillStyle = headerBgColor
  ctx.fillRect(tableLeft, tableTop, tableWidth, 60)
  ctx.strokeStyle = borderColor
  ctx.lineWidth = 1
  ctx.fillStyle = blackColor
  ctx.font = 'bold 10px Arial'
  ctx.textAlign = 'center'
  const drawHeader = (text, col, yOffset1, yOffset2) => {
    const lines = text.split('\n')
    ctx.fillText(lines[0], tableLeft + col.x + col.width / 2, tableTop + yOffset1)
    if (lines[1]) ctx.fillText(lines[1], tableLeft + col.x + col.width / 2, tableTop + yOffset2)
  }
  drawHeader('Renc Kirim\n/ TGL PO', cols.rencKirim, 25, 45)
  drawHeader('No PO\n/ Nama Proyek', cols.noPo, 25, 45)
  drawHeader('Produk / Kayu / Profil', cols.produk, 35, 0)
  drawHeader('Finishing / gloss / sample', cols.finishing, 35, 0)
  drawHeader('KUANTITI', cols.kuantiti, 35, 0)
  drawHeader('KUBIKASI', cols.kubikasi, 35, 0)
  drawHeader('Lokasi & Keterangan lain', cols.lokasi, 35, 0)
  const ukuranStartX = tableLeft + cols.ukuran.x
  const ukuranSubWidth = cols.ukuran.width / 3
  ctx.fillText('UKURAN', ukuranStartX + cols.ukuran.width / 2, tableTop + 20)
  ctx.beginPath()
  ctx.moveTo(ukuranStartX, tableTop + 30)
  ctx.lineTo(ukuranStartX + cols.ukuran.width, tableTop + 30)
  ctx.stroke()
  ctx.font = 'bold 9px Arial'
  ctx.fillText('tbl', ukuranStartX + ukuranSubWidth / 2, tableTop + 48)
  ctx.fillText('lebar', ukuranStartX + ukuranSubWidth + ukuranSubWidth / 2, tableTop + 48)
  ctx.fillText('panjang', ukuranStartX + ukuranSubWidth * 2 + ukuranSubWidth / 2, tableTop + 48)
  Object.values(cols).forEach((col) => ctx.strokeRect(tableLeft + col.x, tableTop, col.width, 60))
  ctx.strokeRect(ukuranStartX + ukuranSubWidth, tableTop + 30, 0, 30)
  ctx.strokeRect(ukuranStartX + ukuranSubWidth * 2, tableTop + 30, 0, 30)
  let rowTop = tableTop + 60
  const items = poData.items || []
  const rowPadding = 8
  const itemLineHeight = 12
  items.forEach((item) => {
    let maxLines = 1
    ctx.font = '10px Arial'
    ctx.textAlign = 'left'
    const produkLines = (item.product_name || '').split('\n').length
    const profilLines = (item.profile || '').split('\n').length
    const finishingLines = `${item.finishing || ''}\n${item.sample || ''}`.split('\n').length
    maxLines = Math.max(produkLines + profilLines, finishingLines, 2)
    const rowHeight = maxLines * itemLineHeight + rowPadding * 2
    ctx.strokeStyle = borderColor
    ctx.textAlign = 'center'
    const deadline = poData.deadline ? new Date(poData.deadline).toLocaleDateString('id-ID') : 'N/A'
    const poDate = poData.created_at
      ? new Date(poData.created_at).toLocaleDateString('id-ID')
      : 'N/A'
    ctx.fillStyle = blueColor
    ctx.fillText(
      deadline,
      tableLeft + cols.rencKirim.x + cols.rencKirim.width / 2,
      rowTop + rowPadding + 10
    )
    ctx.fillStyle = blackColor
    ctx.fillText(
      poDate,
      tableLeft + cols.rencKirim.x + cols.rencKirim.width / 2,
      rowTop + rowPadding + 25
    )
    ctx.textAlign = 'left'
    wrapText(
      ctx,
      poData.po_number || 'N/A',
      tableLeft + cols.noPo.x + rowPadding,
      rowTop + rowPadding + 10,
      cols.noPo.width - rowPadding * 2,
      itemLineHeight
    )
    wrapText(
      ctx,
      poData.project_name || 'N/A',
      tableLeft + cols.noPo.x + rowPadding,
      rowTop + rowPadding + 25,
      cols.noPo.width - rowPadding * 2,
      itemLineHeight
    )
    const produkText = `${item.product_name || ''}\n${item.wood_type || ''} ${item.profile || ''}`
    wrapText(
      ctx,
      produkText,
      tableLeft + cols.produk.x + rowPadding,
      rowTop + rowPadding + 10,
      cols.produk.width - rowPadding * 2,
      itemLineHeight
    )
    const finishingText = `${item.finishing || ''}\n${item.sample || ''}`
    wrapText(
      ctx,
      finishingText,
      tableLeft + cols.finishing.x + rowPadding,
      rowTop + rowPadding + 10,
      cols.finishing.width - rowPadding * 2,
      itemLineHeight
    )
    ctx.textAlign = 'center'
    ctx.fillText(
      (item.thickness_mm || '0').toString(),
      tableLeft + cols.ukuran.x + ukuranSubWidth / 2,
      rowTop + rowHeight / 2
    )
    ctx.fillText(
      (item.width_mm || '0').toString(),
      tableLeft + cols.ukuran.x + ukuranSubWidth + ukuranSubWidth / 2,
      rowTop + rowHeight / 2
    )
    ctx.fillText(
      (item.length_mm || '0').toString(),
      tableLeft + cols.ukuran.x + ukuranSubWidth * 2 + ukuranSubWidth / 2,
      rowTop + rowHeight / 2
    )
    const quantity = `${item.quantity || 0} ${item.satuan || 'pcs'}`
    ctx.fillText(
      quantity,
      tableLeft + cols.kuantiti.x + cols.kuantiti.width / 2,
      rowTop + rowHeight / 2
    )
    const kubikasi = item.kubikasi ? item.kubikasi.toFixed(4) : '0.0000'
    ctx.fillText(
      kubikasi,
      tableLeft + cols.kubikasi.x + cols.kubikasi.width / 2,
      rowTop + rowHeight / 2
    )
    ctx.textAlign = 'left'
    wrapText(
      ctx,
      item.location || '-',
      tableLeft + cols.lokasi.x + rowPadding,
      rowTop + rowPadding + 10,
      cols.lokasi.width - rowPadding * 2,
      itemLineHeight
    )
    Object.values(cols).forEach((col) =>
      ctx.strokeRect(tableLeft + col.x, rowTop, col.width, rowHeight)
    )
    ctx.strokeRect(ukuranStartX + ukuranSubWidth, rowTop, 0, rowHeight)
    ctx.strokeRect(ukuranStartX + ukuranSubWidth * 2, rowTop, 0, rowHeight)
    rowTop += rowHeight
  })
  ctx.fillStyle = totalBgColor
  ctx.fillRect(tableLeft, rowTop, tableWidth, 30)
  ctx.strokeRect(tableLeft, rowTop, tableWidth, 30)
  ctx.fillStyle = redColor
  ctx.font = 'bold 12px Arial'
  ctx.textAlign = 'center'
  ctx.fillText('TOTAL', tableLeft + cols.kuantiti.x - 30, rowTop + 20)
  const totalKubikasi = poData.kubikasi_total
    ? poData.kubikasi_total.toFixed(4) + ' m³'
    : '0.0000 m³'
  ctx.fillText(totalKubikasi, tableLeft + cols.kubikasi.x + cols.kubikasi.width / 2, rowTop + 20)
  rowTop += 30

  // NOTE: Kode untuk melampirkan foto referensi dari path lokal dihilangkan.
  // Ini karena di lingkungan serverless, tidak ada akses ke file sistem lokal.

  const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 })
  return buffer
}

async function generateAndUploadPO(poData, revisionNumber) {
  try {
    const jpegBuffer = await generatePOJpegBuffer(poData, revisionNumber)
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })
    const fileName = `PO-${poData.po_number.replace(/[\/\\?%*:|"<>]/g, '-')}-Rev${revisionNumber}.jpeg`
    const bufferStream = new stream.PassThrough()
    bufferStream.end(jpegBuffer)
    const response = await drive.files.create({
      requestBody: { name: fileName, mimeType: 'image/jpeg', parents: [PO_ARCHIVE_FOLDER_ID] },
      media: { mimeType: 'image/jpeg', body: bufferStream },
      fields: 'id, webViewLink',
      supportsAllDrives: true
    })
    return { success: true, link: response.data.webViewLink }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function uploadProgressPhoto(photoBuffer, originalFilename, poNumber, itemId) {
  try {
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })
    const timestamp = new Date().toISOString().replace(/:/g, '-')
    const fileExtension = originalFilename.split('.').pop() || 'jpg'
    const fileName = `PO-${poNumber}_ITEM-${itemId}_${timestamp}.${fileExtension}`
    const bufferStream = new stream.PassThrough()
    bufferStream.end(photoBuffer)
    const response = await drive.files.create({
      requestBody: { name: fileName, mimeType: 'image/jpeg', parents: [PROGRESS_PHOTOS_FOLDER_ID] },
      media: { mimeType: 'image/jpeg', body: bufferStream },
      fields: 'id, webViewLink',
      supportsAllDrives: true
    })
    return { success: true, link: response.data.webViewLink }
  } catch (error) {
    return { success: false, error: error.message }
  }
}

async function deleteGoogleDriveFile(fileId) {
  try {
    if (!fileId) return { success: false, error: 'File ID tidak valid', fileId }
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })
    await drive.files.delete({ fileId: fileId, supportsAllDrives: true })
    return { success: true, fileId }
  } catch (error) {
    return { success: false, error: error.message, fileId }
  }
}

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
    if (i + batchSize < items.length) await new Promise((resolve) => setTimeout(resolve, 100))
  }
  return results
}

// --- FUNGSI LOGIKA INTI APLIKASI ---

export async function listPOsLogic() {
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
    const poId = item.get('purchase_order_id')
    if (!acc[poId]) acc[poId] = []
    acc[poId].push(item.toObject())
    return acc
  }, {})

  const latestItemRevisions = new Map()
  itemRows.forEach((item) => {
    const poId = item.get('purchase_order_id')
    const rev = toNum(item.get('revision_number'), -1)
    const current = latestItemRevisions.get(poId)
    if (!current || rev > current) latestItemRevisions.set(poId, rev)
  })

  return latestPoRows.map((po) => {
    const poObject = po.toObject()
    const poId = poObject.id
    const latestRev = latestItemRevisions.get(poId) ?? -1
    const poItems = (itemsByPoId[poId] || []).filter(
      (item) => toNum(item.revision_number, -1) === latestRev
    )

    let poProgress = 0
    if (poItems.length > 0) {
      let totalPercentage = 0
      poItems.forEach((item) => {
        const itemId = item.id
        const stages = PRODUCTION_STAGES
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
      poProgress = totalPercentage / poItems.length
    }

    let finalStatus = poObject.status
    if (finalStatus !== 'Cancelled') {
      if (poProgress >= 100) finalStatus = 'Completed'
      else if (poProgress > 0) finalStatus = 'In Progress'
      else finalStatus = 'Open'
    }

    return {
      ...poObject,
      items: poItems,
      progress: Math.round(poProgress),
      status: finalStatus,
      pdf_link: po.get('pdf_link') || null
    }
  })
}

export async function saveNewPOLogic(data) {
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

  if (itemsToAdd.length > 0) await itemSheet.addRows(itemsToAdd)

  const poDataForPdf = {
    ...data,
    items: itemsWithIds,
    created_at: now,
    po_number: data.nomorPo,
    project_name: data.namaCustomer,
    kubikasi_total: data.kubikasi_total || 0
  }
  const uploadResult = await generateAndUploadPO(poDataForPdf, 0)

  if (uploadResult.success) newPoRow.set('pdf_link', uploadResult.link)
  else newPoRow.set('pdf_link', `ERROR: ${uploadResult.error}`)
  await newPoRow.save()

  return { success: true, poId, revision_number: 0 }
}

export async function updatePOLogic(data) {
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

  if (itemsToAdd.length > 0) await itemSheet.addRows(itemsToAdd)

  const poDataForPdf = {
    ...data,
    items: itemsWithIds,
    created_at: now,
    po_number: data.nomorPo ?? prev.po_number,
    project_name: data.namaCustomer ?? prev.project_name
  }
  const uploadResult = await generateAndUploadPO(poDataForPdf, newRev)

  if (uploadResult.success) newRevisionRow.set('pdf_link', uploadResult.link)
  else newRevisionRow.set('pdf_link', `ERROR: ${uploadResult.error}`)
  await newRevisionRow.save()

  return { success: true, revision_number: newRev }
}

export async function deletePOLogic(poId) {
  const doc = await openDoc()
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
  if (uniqueFileIds.length > 0) {
    await processBatch(uniqueFileIds, deleteGoogleDriveFile, 5)
  }

  const sheetDeletions = [...poProgressRows, ...toDelItems, ...toDelHdr].map((row) => row.delete())
  await Promise.allSettled(sheetDeletions.reverse())

  return { success: true, message: `PO ${poId} dan semua data terkait berhasil dihapus.` }
}

export async function listPOItemsLogic(poId) {
  const doc = await openDoc()
  return await getLivePOItems(String(poId), doc)
}

export async function listPORevisionsLogic(poId) {
  const doc = await openDoc()
  const poSheet = await getSheet(doc, 'purchase_orders')
  const rows = await poSheet.getRows()
  return rows
    .filter((r) => String(r.get('id')).trim() === String(poId).trim())
    .map((r) => r.toObject())
    .sort((a, b) => a.revision_number - b.revision_number)
}

export async function listPOItemsByRevisionLogic(poId, revisionNumber) {
  const doc = await openDoc()
  return await getItemsByRevision(String(poId), toNum(revisionNumber, 0), doc)
}

export async function getProductsLogic() {
  const doc = await openDoc()
  const sheet = await getSheet(doc, 'product_master')
  const rows = await sheet.getRows()
  return rows.map((r) => r.toObject())
}

export async function previewPOLogic(data) {
  const poDataForPreview = {
    ...data,
    created_at: new Date().toISOString()
  }
  const jpegBuffer = await generatePOJpegBuffer(poDataForPreview, 'preview')
  return { success: true, base64Data: jpegBuffer.toString('base64') }
}

export async function getRevisionHistoryLogic(poId) {
  const doc = await openDoc()
  const metas = await listPORevisionsLogic(String(poId))
  const itemSheet = await getSheet(doc, 'purchase_order_items')
  const allItemRows = await itemSheet.getRows()
  const history = metas.map((m) => ({
    revision: m,
    items: allItemRows
      .filter(
        (r) =>
          String(r.get('purchase_order_id')) === String(poId) &&
          toNum(r.get('revision_number'), -1) === toNum(m.revision_number, -1)
      )
      .map((r) => r.toObject())
  }))
  return history.sort((a, b) => b.revision.revision_number - a.revision.revision_number)
}

export async function updateItemProgressLogic(data) {
  const { poId, itemId, poNumber, stage, notes, photoBuffer, photoFilename } = data
  let photoLink = null
  if (photoBuffer && photoFilename) {
    const uploadResult = await uploadProgressPhoto(photoBuffer, photoFilename, poNumber, itemId)
    if (uploadResult.success) photoLink = uploadResult.link
  }
  const doc = await openDoc()
  const progressSheet = await getSheet(doc, 'progress_tracking')
  const nextId = await getNextIdFromSheet(progressSheet)
  await progressSheet.addRow({
    id: nextId,
    purchase_order_id: poId,
    purchase_order_item_id: itemId,
    stage,
    notes,
    photo_url: photoLink,
    created_at: new Date().toISOString()
  })
  return { success: true }
}

export async function getActivePOsWithProgressLogic() {
  const allPOs = await listPOsLogic()
  return allPOs.filter((po) => po.status !== 'Completed' && po.status !== 'Cancelled')
}

export async function getPOItemsWithDetailsLogic(poId) {
  const doc = await openDoc()
  const poSheet = await getSheet(doc, 'purchase_orders')
  const itemSheet = await getSheet(doc, 'purchase_order_items')
  const progressSheet = await getSheet(doc, 'progress_tracking')

  const [poRows, itemRows, progressRows] = await Promise.all([
    poSheet.getRows(),
    itemSheet.getRows(),
    progressSheet.getRows()
  ])

  const allRevisionsForPO = poRows.filter((r) => r.get('id') === poId)
  const latestPoRev = Math.max(-1, ...allRevisionsForPO.map((r) => toNum(r.get('revision_number'))))
  const poData = allRevisionsForPO.find((r) => toNum(r.get('revision_number')) === latestPoRev)
  if (!poData) throw new Error(`PO dengan ID ${poId} tidak ditemukan.`)

  const poStartDate = new Date(poData.get('created_at'))
  const poDeadline = new Date(poData.get('deadline'))
  let stageDeadlines = []
  if (poStartDate && poDeadline && poDeadline > poStartDate) {
    const totalDuration = poDeadline.getTime() - poStartDate.getTime()
    const durationPerStage = totalDuration / PRODUCTION_STAGES.length
    stageDeadlines = PRODUCTION_STAGES.map((stageName, index) => ({
      stageName,
      deadline: new Date(poStartDate.getTime() + durationPerStage * (index + 1)).toISOString()
    }))
  }

  const poItems = itemRows.filter(
    (item) =>
      item.get('purchase_order_id') === poId &&
      toNum(item.get('revision_number'), -1) === latestPoRev
  )
  const poProgressRows = progressRows.filter((row) => row.get('purchase_order_id') === poId)
  const progressByItemId = poProgressRows.reduce((acc, row) => {
    const itemId = row.get('purchase_order_item_id')
    if (!acc[itemId]) acc[itemId] = []
    acc[itemId].push(row.toObject())
    return acc
  }, {})

  return poItems.map((item) => {
    const itemObject = item.toObject()
    const itemId = String(itemObject.id)
    const history = (progressByItemId[itemId] || []).sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    )
    return { ...itemObject, progressHistory: history, stageDeadlines: stageDeadlines }
  })
}

export async function getRecentProgressUpdatesLogic(limit = 10) {
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

  return recentUpdates
    .map((update) => {
      const item = itemMap.get(update.purchase_order_item_id)
      if (!item) return null
      const po = poMap.get(item.purchase_order_id)
      if (!po) return null
      return { ...update, item_name: item.product_name, po_number: po.po_number }
    })
    .filter(Boolean)
}

export async function getAttentionDataLogic() {
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
    if (!byId.has(id) || rev > byId.get(id).rev) byId.set(id, { rev, row: r })
  })
  const latestPoMap = new Map(
    Array.from(byId.values()).map((item) => [item.row.get('id'), item.row])
  )

  const latestItemRevisions = new Map()
  itemRows.forEach((item) => {
    const poId = item.get('purchase_order_id')
    const rev = toNum(item.get('revision_number'), -1)
    const current = latestItemRevisions.get(poId)
    if (!current || rev > current) latestItemRevisions.set(poId, rev)
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

  const nearingDeadline = [],
    stuckItems = [],
    urgentItems = []
  const today = new Date(),
    sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000),
    fiveDaysAgo = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)

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

    if (po.get('priority') === 'Urgent') urgentItems.push(attentionItem)

    const deadline = new Date(po.get('deadline'))
    if (deadline <= sevenDaysFromNow && deadline >= today && currentStage !== 'Siap Kirim') {
      nearingDeadline.push({ ...attentionItem, deadline: po.get('deadline') })
    }

    if (
      latestProgress &&
      new Date(latestProgress.created_at) < fiveDaysAgo &&
      currentStage !== 'Siap Kirim'
    ) {
      stuckItems.push({ ...attentionItem, last_update: latestProgress.created_at })
    }
  })

  return { nearingDeadline, stuckItems, urgentItems }
}

export async function getProductSalesAnalysisLogic() {
  const doc = await openDoc()
  const itemSheet = await getSheet(doc, 'purchase_order_items')
  const poSheet = await getSheet(doc, 'purchase_orders')
  const productSheet = await getSheet(doc, 'product_master')

  const [itemRows, poRows, productRows] = await Promise.all([
    itemSheet.getRows(),
    poSheet.getRows(),
    productSheet.getRows()
  ])

  const poMap = new Map()
  poRows.forEach((r) => {
    const poId = r.get('id')
    const rev = toNum(r.get('revision_number'))
    if (!poMap.has(poId) || rev > poMap.get(poId).revision_number) {
      poMap.set(poId, r.toObject())
    }
  })

  const salesData = {},
    salesByDate = [],
    woodTypeData = {},
    customerData = {}

  itemRows.forEach((item) => {
    const productName = item.get('product_name'),
      quantity = toNum(item.get('quantity'), 0),
      woodType = item.get('wood_type'),
      kubikasi = toNum(item.get('kubikasi'), 0),
      poId = item.get('purchase_order_id'),
      po = poMap.get(poId)
    if (!productName || !po) return

    if (!salesData[productName]) salesData[productName] = { totalQuantity: 0, name: productName }
    salesData[productName].totalQuantity += quantity
    salesByDate.push({ date: new Date(po.created_at), name: productName, quantity })
    if (woodType) woodTypeData[woodType] = (woodTypeData[woodType] || 0) + quantity
    const customerName = po.project_name
    if (customerName) customerData[customerName] = (customerData[customerName] || 0) + kubikasi
  })

  const topSellingProducts = Object.values(salesData)
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 10)
  const woodTypeDistribution = Object.keys(woodTypeData)
    .map((name) => ({ name, value: woodTypeData[name] }))
    .sort((a, b) => b.value - a.value)
  const topCustomers = Object.keys(customerData)
    .map((name) => ({ name, totalKubikasi: customerData[name] }))
    .sort((a, b) => b.totalKubikasi - a.totalKubikasi)
    .slice(0, 5)

  const today = new Date(),
    thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30)),
    sixtyDaysAgo = new Date(new Date().setDate(today.getDate() - 60))
  const salesLast30 = {},
    salesPrev30 = {}
  salesByDate.forEach((sale) => {
    if (sale.date >= thirtyDaysAgo)
      salesLast30[sale.name] = (salesLast30[sale.name] || 0) + sale.quantity
    else if (sale.date >= sixtyDaysAgo)
      salesPrev30[sale.name] = (salesPrev30[sale.name] || 0) + sale.quantity
  })

  const trendingProducts = Object.keys(salesLast30)
    .map((name) => {
      const last30 = salesLast30[name],
        prev30 = salesPrev30[name] || 0
      const change = prev30 === 0 && last30 > 0 ? 100 : ((last30 - prev30) / (prev30 || 1)) * 100
      return { name, last30, prev30, change }
    })
    .filter((p) => p.change > 20 && p.last30 > p.prev30)
    .sort((a, b) => b.change - a.change)

  const allProductNames = productRows.map((r) => r.get('product_name'))
  const soldProductNames = new Set(Object.keys(salesData))
  const neverSoldProducts = allProductNames.filter((name) => !soldProductNames.has(name))

  return {
    topSellingProducts,
    woodTypeDistribution,
    topCustomers,
    trendingProducts,
    slowMovingProducts: neverSoldProducts
  }
}

export async function getSalesItemDataLogic() {
  const doc = await openDoc()
  const itemSheet = await getSheet(doc, 'purchase_order_items')
  const poSheet = await getSheet(doc, 'purchase_orders')

  const [itemRows, poRows] = await Promise.all([itemSheet.getRows(), poSheet.getRows()])

  const poMap = new Map()
  poRows.forEach((r) => {
    const poId = r.get('id')
    const rev = toNum(r.get('revision_number'))
    if (!poMap.has(poId) || rev > poMap.get(poId).revision_number) {
      poMap.set(poId, r.toObject())
    }
  })

  return itemRows
    .map((item) => {
      const itemObject = item.toObject()
      const po = poMap.get(itemObject.purchase_order_id)
      if (!po) return null
      return { ...itemObject, customer_name: po.project_name, po_date: po.created_at }
    })
    .filter(Boolean)
}
