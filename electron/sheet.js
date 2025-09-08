/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
// File: electron/sheet.js

import { GoogleSpreadsheet } from 'google-spreadsheet'
import { JWT } from 'google-auth-library'
import path from 'node:path'
import fs from 'node:fs'
import PDFDocument from 'pdfkit'
import { shell } from 'electron'

// ===============================
// AUTHENTICATION
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
  return String(rows.length + 1)
}

// ===============================
// PDF GENERATOR
// ===============================
async function generatePOPDF(poHeader, items, revisionNumber = 0) {
  return new Promise((resolve, reject) => {
    try {
      const dir = path.join(process.cwd(), 'generated_pdfs')
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })

      const filename = `PO_${poHeader.po_number}_Rev${revisionNumber}.pdf`
      const filePath = path.join(dir, filename)

      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 })
      const stream = fs.createWriteStream(filePath)
      doc.pipe(stream)

      // --- HEADER ---
      doc.fontSize(18).text('PURCHASE ORDER', { align: 'center', underline: true })
      doc.moveDown(1)
      doc.fontSize(12).text(`Nomor PO: ${poHeader.po_number}`)
      doc.text(`Customer: ${poHeader.project_name}`)
      doc.text(
        `Tanggal Input: ${
          poHeader.created_at ? new Date(poHeader.created_at).toLocaleDateString('id-ID') : '-'
        }`
      )
      doc.text(
        `Target Kirim: ${
          poHeader.deadline ? new Date(poHeader.deadline).toLocaleDateString('id-ID') : '-'
        }`
      )
      doc.text(`Prioritas: ${poHeader.priority || 'Normal'}`)
      doc.text(`Status: ${poHeader.status || 'Open'}`)
      doc.text(`Revisi: ${revisionNumber}`)
      if (poHeader.notes) {
        doc.moveDown(0.5).text(`Catatan: ${poHeader.notes}`)
      }

      doc.moveDown(1)

      // --- TABLE STRUCTURE ---
      const tableTop = doc.y
      const startX = 40
      const rowHeight = 22
      const colWidths = [35, 70, 110, 70, 70, 70, 70, 60, 60, 50, 50, 120]

      const headers = [
        'No',
        'Product ID',
        'Nama Produk',
        'Kayu',
        'Profil',
        'Warna',
        'Finishing',
        'Sample',
        'Marketing',
        'Qty',
        'Satuan',
        'Notes'
      ]

      // --- DRAW HEADER ROW ---
      let x = startX
      headers.forEach((h, i) => {
        doc.rect(x, tableTop, colWidths[i], rowHeight).stroke()
        doc.font('Helvetica-Bold').fontSize(9).text(h, x + 2, tableTop + 6, {
          width: colWidths[i] - 4,
          align: 'center'
        })
        x += colWidths[i]
      })

      // --- DRAW ITEM ROWS ---
      let y = tableTop + rowHeight
      items.forEach((item, idx) => {
        const row = [
          String(idx + 1),
          item.product_id || '-',
          item.product_name || '-',
          item.wood_type || '-',
          item.profile || '-',
          item.color || '-',
          item.finishing || '-',
          item.sample || '-',
          item.marketing || '-',
          String(item.quantity || 0),
          item.satuan || '-',
          item.notes || '-'
        ]
        x = startX
        row.forEach((val, i) => {
          doc.rect(x, y, colWidths[i], rowHeight).stroke()
          doc.font('Helvetica').fontSize(8).text(val, x + 2, y + 6, {
            width: colWidths[i] - 4,
            align: 'center'
          })
          x += colWidths[i]
        })
        y += rowHeight
      })

      doc.end()

      stream.on('finish', () => {
        const pdfBuffer = fs.readFileSync(filePath)
        const base64Data = pdfBuffer.toString('base64')

        shell.openPath(filePath) // buka otomatis di sistem
        resolve({ filePath, base64Data })
      })
      stream.on('error', reject)
    } catch (err) {
      reject(err)
    }
  })
}

// ===============================
// CRUD FUNCTIONS
// ===============================
async function testSheetConnection() {
  try {
    const doc = await openDoc()
    await doc.loadInfo()
    console.log(`✅ Tes koneksi berhasil! Judul Dokumen: "${doc.title}"`)
  } catch (err) {
    console.error('❌ Gagal tes koneksi ke Google Sheets:', err.message)
  }
}

async function listPOs() {
  try {
    const doc = await openDoc()
    await doc.loadInfo()
    const sheet = doc.sheetsByTitle['purchase_orders']
    if (!sheet) throw new Error("Sheet 'purchase_orders' tidak ditemukan!")
    const rows = await sheet.getRows()
    return rows.map(r => ({
      id: r._rawData[0],
      po_number: r._rawData[1],
      project_name: r._rawData[2],
      deadline: r._rawData[3],
      status: r._rawData[4],
      priority: r._rawData[5],
      notes: r._rawData[6],
      created_at: r._rawData[7],
      kubikasi_total: Number(r._rawData[8]) || 0
    }))
  } catch (err) {
    console.error('❌ listPOs error:', err.message)
    return []
  }
}

async function saveNewPO(data) {
  try {
    const doc = await openDoc()
    await doc.loadInfo()
    const now = new Date().toISOString()

    const poSheet = doc.sheetsByTitle['purchase_orders']
    const revSheet = doc.sheetsByTitle['purchase_order_revisions']
    const itemSheet = doc.sheetsByTitle['purchase_order_items']

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
      const itemId = await nextId(itemSheet)
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
        notes: item.notes,
        kubikasi: item.kubikasi || 0
      })
    }

    const pdf = await generatePOPDF(
      { po_number: data.nomorPo, project_name: data.namaCustomer, created_at: now, deadline: data.tanggalKirim, priority: data.prioritas, status: 'Open', notes: data.catatan },
      data.items,
      0
    )

    return { success: true, poId, pdf }
  } catch (err) {
    console.error('❌ saveNewPO error:', err.message)
    return { success: false, error: err.message }
  }
}

async function updatePO(data) {
  try {
    const doc = await openDoc()
    await doc.loadInfo()
    const now = new Date().toISOString()

    const poSheet = doc.sheetsByTitle['purchase_orders']
    const revSheet = doc.sheetsByTitle['purchase_order_revisions']
    const itemSheet = doc.sheetsByTitle['purchase_order_items']

    const poRows = await poSheet.getRows()
    const poToUpdate = poRows.find(r => r._rawData[0] === data.poId)
    if (!poToUpdate) throw new Error(`PO ${data.poId} tidak ditemukan`)

    poToUpdate.set('po_number', data.nomorPo)
    poToUpdate.set('project_name', data.namaCustomer)
    poToUpdate.set('deadline', data.tanggalKirim)
    poToUpdate.set('priority', data.prioritas)
    poToUpdate.set('notes', data.catatan)
    poToUpdate.set('kubikasi_total', data.kubikasi_total || 0)
    await poToUpdate.save()

    const revRows = await revSheet.getRows()
    const currentMaxRev = revRows.filter(r => r.get('purchase_order_id') === data.poId)
      .reduce((max, r) => Math.max(max, parseInt(r.get('revision_number'))), -1)
    const newRev = currentMaxRev + 1
    const newRevId = await nextId(revSheet)
    await revSheet.addRow({
      id: newRevId,
      purchase_order_id: data.poId,
      revision_number: newRev,
      deadline: data.tanggalKirim,
      status: poToUpdate.get('status'),
      priority: data.prioritas,
      notes: data.catatan,
      created_at: now
    })

    const existingItems = await itemSheet.getRows()
    const itemsToDelete = existingItems.filter(r => r.get('purchase_order_id') === data.poId)
    for (const it of itemsToDelete) await it.delete()

    for (const item of data.items) {
      const itemId = await nextId(itemSheet)
      await itemSheet.addRow({
        id: itemId,
        purchase_order_id: data.poId,
        revision_id: newRevId,
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
        notes: item.notes,
        kubikasi: item.kubikasi || 0
      })
    }

    const pdf = await generatePOPDF(
      { po_number: data.nomorPo, project_name: data.namaCustomer, created_at: now, deadline: data.tanggalKirim, priority: data.prioritas, status: poToUpdate.get('status'), notes: data.catatan },
      data.items,
      newRev
    )

    return { success: true, pdf }
  } catch (err) {
    console.error('❌ updatePO error:', err.message)
    return { success: false, error: err.message }
  }
}

async function deletePO(poId) {
  try {
    const doc = await openDoc()
    await doc.loadInfo()
    const poSheet = doc.sheetsByTitle['purchase_orders']
    const revSheet = doc.sheetsByTitle['purchase_order_revisions']
    const itemSheet = doc.sheetsByTitle['purchase_order_items']

    const poRows = await poSheet.getRows()
    const po = poRows.find(r => r._rawData[0] === poId)
    if (po) await po.delete()

    const revRows = await revSheet.getRows()
    for (const r of revRows.filter(x => x._rawData[1] === poId)) await r.delete()

    const itemRows = await itemSheet.getRows()
    for (const it of itemRows.filter(x => x._rawData[1] === poId)) await it.delete()

    return { success: true }
  } catch (err) {
    console.error('❌ deletePO error:', err.message)
    return { success: false, error: err.message }
  }
}

async function listPOItems(poId) {
  try {
    const doc = await openDoc()
    await doc.loadInfo()
    const sheet = doc.sheetsByTitle['purchase_order_items']
    const rows = await sheet.getRows()
    return rows.filter(r => r._rawData[1] === poId).map(r => ({
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
      kubikasi: Number(r._rawData[19]) || 0
    }))
  } catch (err) {
    console.error('❌ listPOItems error:', err.message)
    return []
  }
}

async function listPORevisions(poId) {
  try {
    const doc = await openDoc()
    await doc.loadInfo()
    const sheet = doc.sheetsByTitle['purchase_order_revisions']
    const rows = await sheet.getRows()
    return rows.filter(r => r.get('purchase_order_id') === poId).map(r => ({
      id: r.get('id'),
      purchase_order_id: r.get('purchase_order_id'),
      revision_number: r.get('revision_number'),
      deadline: r.get('deadline'),
      status: r.get('status'),
      priority: r.get('priority'),
      notes: r.get('notes'),
      created_at: r.get('created_at')
    }))
  } catch (err) {
    console.error('❌ listPORevisions error:', err.message)
    return []
  }
}

async function listPOItemsByRevision(revisionId) {
  try {
    const doc = await openDoc()
    await doc.loadInfo()
    const sheet = doc.sheetsByTitle['purchase_order_items']
    const rows = await sheet.getRows()
    return rows.filter(r => r.get('revision_id') === revisionId).map(r => ({
      id: r.get('id'),
      purchase_order_id: r.get('purchase_order_id'),
      revision_id: r.get('revision_id'),
      product_id: r.get('product_id'),
      product_name: r.get('product_name'),
      wood_type: r.get('wood_type'),
      profile: r.get('profile'),
      color: r.get('color'),
      finishing: r.get('finishing'),
      sample: r.get('sample'),
      marketing: r.get('marketing'),
      thickness_mm: Number(r.get('thickness_mm')),
      width_mm: Number(r.get('width_mm')),
      length_mm: Number(r.get('length_mm')),
      length_type: r.get('length_type'),
      quantity: Number(r.get('quantity')),
      satuan: r.get('satuan'),
      location: r.get('location'),
      notes: r.get('notes'),
      kubikasi: Number(r.get('kubikasi')) || 0
    }))
  } catch (err) {
    console.error('❌ listPOItemsByRevision error:', err.message)
    return []
  }
}

async function getProducts() {
  try {
    const doc = await openDoc()
    await doc.loadInfo()
    const sheet = doc.sheetsByTitle['product_master']
    const rows = await sheet.getRows()
    return rows.map(r => ({
      product_name: r._rawData[0],
      wood_type: r._rawData[1],
      profile: r._rawData[2],
      color: r._rawData[3],
      finishing: r._rawData[4],
      sample: r._rawData[5],
      marketing: r._rawData[6],
      satuan: r._rawData[7]
    }))
  } catch (err) {
    console.error('❌ getProducts error:', err.message)
    return []
  }
}

// ===============================
// PREVIEW FUNCTION
// ===============================
export async function previewPO(data) {
  try {
    const pdf = await generatePOPDF(
      {
        po_number: data.nomorPo,
        project_name: data.namaCustomer,
        created_at: new Date().toISOString(),
        deadline: data.tanggalKirim,
        priority: data.prioritas,
        status: 'Preview',
        notes: data.catatan,
      },
      data.items,
      'preview'
    )
    return { success: true, ...pdf }
  } catch (err) {
    console.error('❌ previewPO error:', err.message)
    return { success: false, error: err.message }
  }
}

// ===============================
// EXPORT ALL FUNCTIONS
// ===============================
export {
  testSheetConnection,
  listPOs,
  saveNewPO,
  updatePO,
  deletePO,
  listPOItems,
  listPORevisions,
  listPOItemsByRevision,
  getProducts,
  generatePOPDF
}
