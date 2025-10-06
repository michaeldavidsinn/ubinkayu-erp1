// file: api/_controller.js

import {
  openDoc,
  getSheet,
  toNum,
  getNextIdFromSheet,
  scrubItemPayload,
  generateAndUploadPO,
  extractGoogleDriveFileId,
  deleteGoogleDriveFile,
  processBatch,
  PRODUCTION_STAGES,
  generatePOJpeg,
  getAuth,
  PROGRESS_PHOTOS_FOLDER_ID
} from './_helpers.js'
import { google } from 'googleapis'
import stream from 'stream'

// --- HELPERS KHUSUS UNTUK FUNGSI TERTENTU ---
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

// =================================================================
// KUMPULAN SEMUA LOGIKA API
// =================================================================

// --- LOGIC FOR: listPOs ---
export async function handleListPOs(req, res) {
  const doc = await openDoc()
  const poSheet = getSheet(doc, 'purchase_orders')
  const itemSheet = getSheet(doc, 'purchase_order_items')
  const progressSheet = getSheet(doc, 'progress_tracking')
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
    const poId = row.get('purchase_order_id'),
      itemId = row.get('purchase_order_item_id'),
      key = `${poId}-${itemId}`
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
    const poId = item.get('purchase_order_id'),
      rev = toNum(item.get('revision_number'), -1),
      current = latestItemRevisions.get(poId)
    if (!current || rev > current) latestItemRevisions.set(poId, rev)
  })
  const result = latestPoRows.map((po) => {
    const poObject = po.toObject(),
      poId = poObject.id,
      latestRev = latestItemRevisions.get(poId) ?? -1
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
  return res.status(200).json(result)
}

// --- LOGIC FOR: saveNewPO ---
export async function handleSaveNewPO(req, res) {
  const data = req.body
  const doc = await openDoc()
  const now = new Date().toISOString()
  const poSheet = getSheet(doc, 'purchase_orders')
  const itemSheet = getSheet(doc, 'purchase_order_items')
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
  const poDataForJpeg = {
    ...data,
    po_number: data.nomorPo,
    project_name: data.namaCustomer,
    items: itemsWithIds,
    created_at: now
  }
  const uploadResult = await generateAndUploadPO(poDataForJpeg, 0)
  newPoRow.set(
    'pdf_link',
    uploadResult.success ? uploadResult.link : `ERROR: ${uploadResult.error}`
  )
  await newPoRow.save()
  return res.status(200).json({ success: true, poId, revision_number: 0 })
}

// --- LOGIC FOR: updatePO ---
export async function handleUpdatePO(req, res) {
  const data = req.body
  const doc = await openDoc()
  const now = new Date().toISOString()
  const poSheet = getSheet(doc, 'purchase_orders')
  const itemSheet = getSheet(doc, 'purchase_order_items')
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
  const poDataForJpeg = {
    po_number: data.nomorPo ?? prev.po_number,
    project_name: data.namaCustomer ?? prev.project_name,
    deadline: data.tanggalKirim ?? prev.deadline,
    priority: data.prioritas ?? prev.priority,
    items: itemsWithIds,
    notes: data.catatan ?? prev.notes,
    created_at: now,
    kubikasi_total: data.kubikasi_total ?? prev.kubikasi_total ?? 0,
    poPhotoBase64: data.poPhotoBase64
  }
  const uploadResult = await generateAndUploadPO(poDataForJpeg, newRev)
  newRevisionRow.set(
    'pdf_link',
    uploadResult.success ? uploadResult.link : `ERROR: ${uploadResult.error}`
  )
  await newRevisionRow.save()
  return res.status(200).json({ success: true, revision_number: newRev })
}

// --- LOGIC FOR: deletePO ---
export async function handleDeletePO(req, res) {
  const { poId } = req.query
  const startTime = Date.now()
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
  let deletedFilesCount = 0,
    failedFilesCount = 0,
    failedFiles = []
  if (uniqueFileIds.length > 0) {
    const deleteResults = await processBatch(uniqueFileIds, deleteGoogleDriveFile, 5)
    deleteResults.forEach((result) => {
      if (result.success) deletedFilesCount++
      else {
        failedFilesCount++
        failedFiles.push({ fileId: result.fileId, error: result.error })
      }
    })
  }
  const sheetDeletions = []
  poProgressRows.reverse().forEach((row) => sheetDeletions.push(row.delete()))
  toDelHdr.reverse().forEach((row) => sheetDeletions.push(row.delete()))
  toDelItems.reverse().forEach((row) => sheetDeletions.push(row.delete()))
  await Promise.allSettled(sheetDeletions)
  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  const summary = {
    deletedRevisions: toDelHdr.length,
    deletedItems: toDelItems.length,
    deletedProgressRecords: poProgressRows.length,
    deletedFiles: deletedFilesCount,
    failedFileDeletes: failedFilesCount,
    duration: `${duration}s`,
    failedFiles: failedFiles.length > 0 ? failedFiles : undefined
  }
  const message = `PO berhasil dihapus (${summary.deletedRevisions} revisi, ${summary.deletedItems} item, ${summary.deletedFiles} file).`
  return res.status(200).json({ success: true, message, summary })
}

// --- LOGIC FOR: getProducts ---
export async function handleGetProducts(req, res) {
  const doc = await openDoc()
  const sheet = getSheet(doc, 'product_master')
  const rows = await sheet.getRows()
  const products = rows.map((r) => r.toObject())
  return res.status(200).json(products)
}

// --- LOGIC FOR: listPOItems ---
export async function handleListPOItems(req, res) {
  const { poId } = req.query
  const doc = await openDoc()
  const latestRev = await latestRevisionNumberForPO(String(poId), doc)
  if (latestRev < 0) return res.status(200).json([])
  const items = await getItemsByRevision(String(poId), latestRev, doc)
  return res.status(200).json(items)
}

// --- LOGIC FOR: getRevisionHistory ---
export async function handleGetRevisionHistory(req, res) {
  const { poId } = req.query
  const doc = await openDoc()
  const poSheet = await getSheet(doc, 'purchase_orders')
  const allPoRows = await poSheet.getRows()
  const metas = allPoRows
    .filter((r) => String(r.get('id')).trim() === String(poId).trim())
    .map((r) => r.toObject())
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
  history.sort((a, b) => b.revision.revision_number - a.revision.revision_number)
  return res.status(200).json(history)
}

// --- LOGIC FOR: previewPO ---
export async function handlePreviewPO(req, res) {
  const data = req.body
  const poData = { ...data, created_at: new Date().toISOString() }
  const result = await generatePOJpeg(poData, 'preview')
  if (result.success) {
    const base64Data = result.buffer.toString('base64')
    return res.status(200).json({ success: true, base64Data: base64Data })
  }
  throw new Error(result.error || 'Failed to generate JPEG buffer')
}

// --- LOGIC FOR: updateItemProgress ---
export async function handleUpdateItemProgress(req, res) {
  const { poId, itemId, poNumber, stage, notes, photoBase64 } = req.body
  let photoLink = null
  if (photoBase64) {
    const auth = getAuth()
    const drive = google.drive({ version: 'v3', auth })
    const timestamp = new Date().toISOString().replace(/:/g, '-')
    const fileName = `PO-${poNumber}_ITEM-${itemId}_${timestamp}.jpg`
    const imageBuffer = Buffer.from(photoBase64, 'base64')
    const bufferStream = new stream.PassThrough()
    bufferStream.end(imageBuffer)
    const response = await drive.files.create({
      requestBody: { name: fileName, mimeType: 'image/jpeg', parents: [PROGRESS_PHOTOS_FOLDER_ID] },
      media: { mimeType: 'image/jpeg', body: bufferStream },
      fields: 'id, webViewLink',
      supportsAllDrives: true
    })
    photoLink = response.data.webViewLink
  }
  const doc = await openDoc()
  const progressSheet = await getSheet(doc, 'progress_tracking')
  const nextId = await getNextIdFromSheet(progressSheet)
  await progressSheet.addRow({
    id: nextId,
    purchase_order_id: poId,
    purchase_order_item_id: itemId,
    stage: stage,
    notes: notes || '',
    photo_url: photoLink,
    created_at: new Date().toISOString()
  })
  return res.status(200).json({ success: true })
}

// --- LOGIC FOR: getActivePOsWithProgress ---
export async function handleGetActivePOsWithProgress(req, res) {
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
  const byId = new Map()
  poRows.forEach((r) => {
    const id = String(r.get('id')).trim(),
      rev = toNum(r.get('revision_number'), -1)
    if (!byId.has(id) || rev > (byId.get(id)?.rev ?? -1)) byId.set(id, { rev, row: r })
  })
  const activePOs = Array.from(byId.values())
    .map(({ row }) => row)
    .filter((r) => r.get('status') !== 'Completed' && r.get('status') !== 'Cancelled')
  const progressByCompositeKey = progressRows.reduce((acc, row) => {
    const key = `${row.get('purchase_order_id')}-${row.get('purchase_order_item_id')}`
    if (!acc[key]) acc[key] = []
    acc[key].push({ stage: row.get('stage'), created_at: row.get('created_at') })
    return acc
  }, {})
  const latestItemRevisions = itemRows.reduce((acc, item) => {
    const poId = item.get('purchase_order_id'),
      rev = toNum(item.get('revision_number'), -1)
    if (!acc.has(poId) || rev > acc.get(poId)) acc.set(poId, rev)
    return acc
  }, new Map())
  const result = activePOs.map((po) => {
    const poId = po.get('id'),
      latestRev = latestItemRevisions.get(poId) ?? -1
    const poItems = itemRows.filter(
      (item) =>
        item.get('purchase_order_id') === poId &&
        toNum(item.get('revision_number'), -1) === latestRev
    )
    if (poItems.length === 0) return { ...po.toObject(), progress: 0 }
    let totalPercentage = poItems.reduce((total, item) => {
      const itemId = item.get('id'),
        stages = PRODUCTION_STAGES
      const itemProgress = progressByCompositeKey[`${poId}-${itemId}`] || []
      let latestStageIndex = -1
      if (itemProgress.length > 0) {
        const latest = [...itemProgress].sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )[0]
        latestStageIndex = stages.indexOf(latest.stage)
      }
      return total + (latestStageIndex >= 0 ? ((latestStageIndex + 1) / stages.length) * 100 : 0)
    }, 0)
    return { ...po.toObject(), progress: Math.round(totalPercentage / poItems.length) }
  })
  return res.status(200).json(result)
}

// --- LOGIC FOR: getPOItemsWithDetails ---
export async function handleGetPOItemsWithDetails(req, res) {
  const { poId } = req.query
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
  const latestPoRev = Math.max(
    -1,
    ...poRows.filter((r) => r.get('id') === poId).map((r) => toNum(r.get('revision_number')))
  )
  const poData = poRows.find(
    (r) => r.get('id') === poId && toNum(r.get('revision_number')) === latestPoRev
  )
  if (!poData) throw new Error(`PO dengan ID ${poId} tidak ditemukan.`)
  const poStartDate = new Date(poData.get('created_at')),
    poDeadline = new Date(poData.get('deadline'))
  let stageDeadlines = []
  if (poStartDate && poDeadline && poDeadline > poStartDate) {
    const durationPerStage =
      (poDeadline.getTime() - poStartDate.getTime()) / PRODUCTION_STAGES.length
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
  const progressByItemId = progressRows
    .filter((row) => row.get('purchase_order_id') === poId)
    .reduce((acc, row) => {
      const itemId = row.get('purchase_order_item_id')
      if (!acc[itemId]) acc[itemId] = []
      acc[itemId].push(row.toObject())
      return acc
    }, {})
  const result = poItems.map((item) => {
    const itemObject = item.toObject(),
      itemId = String(itemObject.id)
    const history = (progressByItemId[itemId] || []).sort(
      (a, b) => new Date(a.created_at) - new Date(b.created_at)
    )
    return { ...itemObject, progressHistory: history, stageDeadlines }
  })
  return res.status(200).json(result)
}

// --- LOGIC FOR: getRecentProgressUpdates ---
export async function handleGetRecentProgressUpdates(req, res) {
  const doc = await openDoc()
  const [progressSheet, itemSheet, poSheet] = await Promise.all([
    getSheet(doc, 'progress_tracking'),
    getSheet(doc, 'purchase_order_items'),
    getSheet(doc, 'purchase_orders')
  ])
  const [progressRows, itemRows, poRows] = await Promise.all([
    progressSheet.getRows(),
    itemSheet.getRows(),
    poSheet.getRows()
  ])
  const itemMap = new Map(itemRows.map((r) => [r.get('id'), r.toObject()]))
  const poMap = poRows.reduce((acc, r) => {
    const poId = r.get('id'),
      rev = toNum(r.get('revision_number'))
    if (!acc.has(poId) || rev > acc.get(poId).revision_number) acc.set(poId, r.toObject())
    return acc
  }, new Map())
  const limit = req.query.limit ? parseInt(req.query.limit) : 10
  const enrichedUpdates = progressRows
    .map((r) => r.toObject())
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, limit)
    .map((update) => {
      const item = itemMap.get(update.purchase_order_item_id)
      if (!item) return null
      const po = poMap.get(item.purchase_order_id)
      if (!po) return null
      return { ...update, item_name: item.product_name, po_number: po.po_number }
    })
    .filter(Boolean)
  return res.status(200).json(enrichedUpdates)
}

// --- LOGIC FOR: getAttentionData ---
export async function handleGetAttentionData(req, res) {
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
  const latestPoMap = poRows.reduce((map, r) => {
    const id = r.get('id'),
      rev = toNum(r.get('revision_number'))
    if (!map.has(id) || rev > map.get(id).rev) map.set(id, { rev, row: r })
    return map
  }, new Map())
  const latestItemRevisions = itemRows.reduce((map, item) => {
    const poId = item.get('purchase_order_id'),
      rev = toNum(item.get('revision_number'), -1)
    if (!map.has(poId) || rev > map.get(poId)) map.set(poId, rev)
    return map
  }, new Map())
  const activeItems = itemRows.filter((item) => {
    const poData = latestPoMap.get(item.get('purchase_order_id'))
    if (!poData) return false
    const po = poData.row
    const latestRev = latestItemRevisions.get(item.get('purchase_order_id')) ?? -1
    return (
      po.get('status') !== 'Completed' &&
      po.get('status') !== 'Cancelled' &&
      toNum(item.get('revision_number')) === latestRev
    )
  })
  const progressByCompositeKey = progressRows.reduce((acc, row) => {
    const key = `${row.get('purchase_order_id')}-${row.get('purchase_order_item_id')}`
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
    const po = latestPoMap.get(item.get('purchase_order_id')).row
    const itemProgress = progressByCompositeKey[`${po.get('id')}-${item.get('id')}`] || []
    const latestProgress = [...itemProgress].sort(
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
  return res.status(200).json({ nearingDeadline, stuckItems, urgentItems })
}

// --- LOGIC FOR: getProductSalesAnalysis ---
export async function handleGetProductSalesAnalysis(req, res) {
  const doc = await openDoc()
  const [itemSheet, poSheet, productSheet] = await Promise.all([
    getSheet(doc, 'purchase_order_items'),
    getSheet(doc, 'purchase_orders'),
    getSheet(doc, 'product_master')
  ])
  const [itemRows, poRows, productRows] = await Promise.all([
    itemSheet.getRows(),
    poSheet.getRows(),
    productSheet.getRows()
  ])
  const poMap = poRows.reduce((map, r) => {
    const poId = r.get('id'),
      rev = toNum(r.get('revision_number'))
    if (!map.has(poId) || rev > map.get(poId).revision_number) map.set(poId, r.toObject())
    return map
  }, new Map())
  const salesData = {},
    salesByDate = [],
    woodTypeData = {},
    customerData = {}
  itemRows.forEach((item) => {
    const po = poMap.get(item.get('purchase_order_id'))
    if (!po) return
    const productName = item.get('product_name'),
      quantity = toNum(item.get('quantity'), 0),
      woodType = item.get('wood_type'),
      kubikasi = toNum(item.get('kubikasi'), 0)
    salesData[productName] = salesData[productName] || { totalQuantity: 0, name: productName }
    salesData[productName].totalQuantity += quantity
    salesByDate.push({ date: new Date(po.created_at), name: productName, quantity })
    if (woodType) woodTypeData[woodType] = (woodTypeData[woodType] || 0) + quantity
    if (po.project_name)
      customerData[po.project_name] = (customerData[po.project_name] || 0) + kubikasi
  })
  const topSellingProducts = Object.values(salesData)
    .sort((a, b) => b.totalQuantity - a.totalQuantity)
    .slice(0, 10)
  const woodTypeDistribution = Object.entries(woodTypeData)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
  const topCustomers = Object.entries(customerData)
    .map(([name, totalKubikasi]) => ({ name, totalKubikasi }))
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
  const soldProductNames = new Set(Object.keys(salesData))
  const neverSoldProducts = productRows
    .map((r) => r.get('product_name'))
    .filter((name) => !soldProductNames.has(name))
  return res.status(200).json({
    topSellingProducts,
    woodTypeDistribution,
    topCustomers,
    trendingProducts,
    slowMovingProducts: neverSoldProducts
  })
}

// --- LOGIC FOR: getSalesItemData ---
export async function handleGetSalesItemData(req, res) {
  const doc = await openDoc()
  const [itemSheet, poSheet] = await Promise.all([
    getSheet(doc, 'purchase_order_items'),
    getSheet(doc, 'purchase_orders')
  ])
  const [itemRows, poRows] = await Promise.all([itemSheet.getRows(), poSheet.getRows()])
  const poMap = poRows.reduce((map, r) => {
    const poId = r.get('id'),
      rev = toNum(r.get('revision_number'))
    if (!map.has(poId) || rev > map.get(poId).revision_number) map.set(poId, r.toObject())
    return map
  }, new Map())
  const combinedData = itemRows
    .map((item) => {
      const po = poMap.get(item.get('purchase_order_id'))
      if (!po) return null
      return { ...item.toObject(), customer_name: po.project_name, po_date: po.created_at }
    })
    .filter(Boolean)
  return res.status(200).json(combinedData)
}
