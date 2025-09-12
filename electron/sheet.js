/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/explicit-function-return-type */

// File: electron/sheet.js

import { GoogleSpreadsheet } from 'google-spreadsheet'
import { JWT } from 'google-auth-library'
import path from 'node:path'
import fs from 'node:fs'
import PDFDocument from 'pdfkit'
import { app, shell } from 'electron'
import crypto from 'node:crypto'

// ===============================
// AUTH & DOC
// ===============================
function getAuth() {
  // [PERBAIKAN] Menggunakan app.getAppPath() agar lebih andal di build Electron
  const credPath = path.join(app.getAppPath(), 'electron', 'credentials.json')
  if (!fs.existsSync(credPath)) {
    // Coba fallback ke process.cwd() untuk mode development
    const devCredPath = path.join(process.cwd(), 'electron', 'credentials.json')
    if (!fs.existsSync(devCredPath)) {
      throw new Error('File credentials.json tidak ditemukan.')
    }
    const creds = JSON.parse(fs.readFileSync(devCredPath, 'utf8'))
    return new JWT({
      email: creds.client_email,
      key: creds.private_key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets']
    })
  }
  const creds = JSON.parse(fs.readFileSync(credPath, 'utf8'))
  return new JWT({
    email: creds.client_email,
    key: creds.private_key,
    scopes: ['https://www.googleapis.com/auth/spreadsheets']
  })
}

async function openDoc() {
  const spreadsheetId = '1Bp5rETvaAe9nT4DrNpm-WsQqQlPNaau4gIzw1nA5Khk'
  const auth = getAuth()
  const doc = new GoogleSpreadsheet(spreadsheetId, auth)
  await doc.loadInfo()
  return doc
}

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

// ===============================
// SHEET RESOLUTION (NO *_revisions)
// ===============================
const ALIASES = {
  purchase_orders: ['purchase_orders', 'purchase_order'],
  purchase_order_items: ['purchase_order_items', 'po_items'],
  product_master: ['product_master', 'products']
}

const HEADERS = {
  purchase_orders: [
    'id',
    'revision_number',
    'po_number',
    'project_name',
    'deadline',
    'status',
    'priority',
    'notes',
    'kubikasi_total',
    'created_at'
  ],
  purchase_order_items: [
    'id',
    'purchase_order_id',
    'revision_id',
    'revision_number',
    'product_id',
    'product_name',
    'wood_type',
    'profile',
    'color',
    'finishing',
    'sample',
    'marketing',
    'thickness_mm',
    'width_mm',
    'length_mm',
    'length_type',
    'quantity',
    'satuan',
    'kubikasi',
    'location',
    'notes'
  ],
  product_master: [
    'product_name',
    'wood_type',
    'profile',
    'color',
    'finishing',
    'sample',
    'marketing',
    'satuan'
  ]
}

async function getSheet(doc, key, { createIfMissing = true } = {}) {
  const titles = ALIASES[key] || [key]
  for (const t of titles) {
    if (doc.sheetsByTitle[t]) return doc.sheetsByTitle[t]
  }
  // [PERBAIKAN] Menghapus karakter ilegal dari string error
  if (!createIfMissing) throw new Error(`Sheet "${titles[0]}" tidak ditemukan`)
  const headerValues = HEADERS[key] || []
  const sh = await doc.addSheet({ title: titles[0], headerValues })
  return sh
}

// ===============================
// UTILS
// ===============================
function toNum(v, def = 0) {
  const n = Number(String(v ?? '').trim())
  return Number.isFinite(n) ? n : def
}

async function getNextIdFromSheet(sheet) {
  await sheet.loadHeaderRow()
  const idKey = (sheet.headerValues || []).includes('id') ? 'id' : sheet.headerValues?.[0] || 'id'
  const rows = await sheet.getRows()
  let maxId = 0
  for (const r of rows) {
    const val = toNum(r.get(idKey), NaN)
    if (!Number.isNaN(val)) maxId = Math.max(maxId, val)
  }
  return String(maxId + 1)
}

function scrubItemPayload(item) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { id, purchase_order_id, revision_id, revision_number, ...rest } = item || {}
  return rest
}

function stableHash(obj) {
  const s = JSON.stringify(obj, Object.keys(obj ?? {}).sort())
  return crypto.createHash('sha256').update(s).digest('hex')
}

// ===============================
// CORE READS (2 tabel)
// ===============================
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
  const r = rows
    .filter((x) => String(x.get('id')).trim() === String(poId).trim())
    .find((x) => toNum(x.get('revision_number'), -1) === toNum(rev, -1))
  return r || null
}

async function getLivePO(poId, doc) {
  const latest = await latestRevisionNumberForPO(poId, doc)
  const row = await getHeaderForRevision(poId, latest, doc)
  if (!row) throw new Error('PO not found')
  return {
    id: row.get('id'),
    revision_number: toNum(row.get('revision_number'), 0),
    po_number: row.get('po_number') || '',
    project_name: row.get('project_name') || '',
    deadline: row.get('deadline') || '',
    status: row.get('status') || 'Open',
    priority: row.get('priority') || '',
    notes: row.get('notes') || '',
    kubikasi_total: row.get('kubikasi_total') || 0,
    created_at: row.get('created_at') || new Date().toISOString()
  }
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

// ===============================
// HASH (opsional; dipakai autoVersion)
// ===============================
async function hashSnapshot(poId, rev, doc) {
  const headerRow = await getHeaderForRevision(poId, rev, doc)
  if (!headerRow) return null
  const items = await getItemsByRevision(poId, rev, doc)
  const h = {
    header: {
      deadline: headerRow.get('deadline') || '',
      status: headerRow.get('status') || '',
      priority: headerRow.get('priority') || '',
      notes: headerRow.get('notes') || ''
    },
    items: items.map((i) => ({
      product_name: i.product_name || '',
      wood_type: i.wood_type || '',
      profile: i.profile || '',
      color: i.color || '',
      finishing: i.finishing || '',
      thickness_mm: i.thickness_mm || '',
      width_mm: i.width_mm || '',
      length_mm: i.length_mm || '',
      length_type: i.length_type || '',
      quantity: toNum(i.quantity, 0),
      satuan: i.satuan || '',
      kubikasi: i.kubikasi || '',
      location: i.location || '',
      notes: i.notes || '',
      sample: i.sample || '',
      marketing: i.marketing || ''
    }))
  }
  return stableHash(h)
}

async function hashLive(poId, doc) {
  const header = await getLivePO(poId, doc)
  const items = await getLivePOItems(poId, doc)
  const h = {
    header: {
      deadline: header.deadline || '',
      status: header.status || '',
      priority: header.priority || '',
      notes: header.notes || ''
    },
    items: items.map((i) => ({
      product_name: i.product_name || '',
      wood_type: i.wood_type || '',
      profile: i.profile || '',
      color: i.color || '',
      finishing: i.finishing || '',
      thickness_mm: i.thickness_mm || '',
      width_mm: i.width_mm || '',
      length_mm: i.length_mm || '',
      length_type: i.length_type || '',
      quantity: toNum(i.quantity, 0),
      satuan: i.satuan || '',
      kubikasi: i.kubikasi || '',
      location: i.location || '',
      notes: i.notes || '',
      sample: i.sample || '',
      marketing: i.marketing || ''
    }))
  }
  return stableHash(h)
}

// ===============================
// PDF GENERATOR (support 'preview')
// ===============================
export async function generatePOPdf(poData, revisionNumber = 0) {
  return new Promise((resolve, reject) => {
    try {
      const docPdf = new PDFDocument({ margin: 40, size: 'A4', layout: 'landscape' })

      // ... (Bagian atas untuk mengisi konten PDF tetap sama)
      docPdf.fontSize(18).text('PURCHASE ORDER', { align: 'center', underline: true })
      docPdf.moveDown(1)
      docPdf
        .fontSize(11)
        .font('Helvetica-Bold')
        .text(`Nomor PO      : ${poData.po_number || '-'}`)
      docPdf.font('Helvetica-Bold').text(`Customer      : ${poData.project_name || '-'}`)
      docPdf
        .font('Helvetica')
        .text(
          `Tanggal Input : ${poData.created_at ? new Date(poData.created_at).toLocaleDateString('id-ID') : '-'}`
        )
      docPdf.text(
        `Target Kirim  : ${poData.deadline ? new Date(poData.deadline).toLocaleDateString('id-ID') : '-'}`
      )
      docPdf.text(`Prioritas     : ${poData.priority || '-'}`)
      docPdf.text(`Revisi        : #${revisionNumber}`)
      docPdf.moveDown(1.5)

      if (poData.notes) {
        docPdf
          .font('Helvetica')
          .fontSize(10)
          .text(`Catatan: ${poData.notes}`, { width: 500, oblique: true })
        docPdf.moveDown(1)
      }

      const table = {
        headers: [
          'No',
          'Produk',
          'Jenis Kayu',
          'Profil',
          'Warna',
          'Finishing',
          'Tebal',
          'Lebar',
          'Qty',
          'Satuan',
          'Catatan'
        ],
        rows: (poData.items || []).map((item, i) => [
          i + 1,
          item.product_name || '-',
          item.wood_type || '-',
          item.profile || '-',
          item.color || '-',
          item.finishing || '-',
          `${item.thickness_mm || 0} mm`,
          `${item.width_mm || 0} mm`,
          item.quantity || 0,
          item.satuan || '-',
          item.notes || '-'
        ]),
        colWidths: [30, 100, 80, 80, 80, 80, 50, 50, 40, 50, 120]
      }

      const startY = docPdf.y
      const startX = docPdf.page.margins.left
      const rowH = 25
      docPdf.font('Helvetica-Bold').fontSize(9)
      let cx = startX
      table.headers.forEach((h, i) => {
        docPdf.rect(cx, startY, table.colWidths[i], rowH).stroke()
        docPdf.text(h, cx + 3, startY + 8, { width: table.colWidths[i] - 6, align: 'center' })
        cx += table.colWidths[i]
      })
      docPdf.font('Helvetica').fontSize(8)
      let cy = startY + rowH
      table.rows.forEach((row) => {
        cx = startX
        if (cy + rowH > docPdf.page.height - docPdf.page.margins.bottom) {
          docPdf.addPage()
          cy = docPdf.page.margins.top
        }
        row.forEach((cell, i) => {
          docPdf.rect(cx, cy, table.colWidths[i], rowH).stroke()
          docPdf.text(String(cell), cx + 3, cy + 8, {
            width: table.colWidths[i] - 6,
            align: 'center'
          })
          cx += table.colWidths[i]
        })
        cy += rowH
      })

      // ---- AWAL PERUBAHAN ----
      if (revisionNumber === 'preview') {
        const tempDir = app.getPath('temp')
        const fileName = `PO-PREVIEW-${Date.now()}.pdf`
        const filePath = path.join(tempDir, fileName)
        const stream = fs.createWriteStream(filePath)
        docPdf.pipe(stream)
        stream.on('finish', () => {
          shell.openPath(filePath)
          resolve({ success: true, isPreview: true, path: filePath })
        })
        stream.on('error', reject)
        docPdf.end()
      } else {
        // [MODIFIKASI] Mengubah baseDir ke folder proyek
        const baseDir = path.join(app.getAppPath(), 'generated_pdfs')
        ensureDirSync(baseDir)

        // Format nama file sudah sesuai dengan yang Anda minta
        const revText = `Rev${revisionNumber}`
        const fileName = `PO-${String(poData.po_number || '').replace(/[/\\?%*:|"<>]/g, '-')}-${revText}.pdf`

        const filePath = path.join(baseDir, fileName)
        const stream = fs.createWriteStream(filePath)

        // Logika di bawah ini diubah sedikit agar tidak otomatis membuka file, tapi tetap resolve path
        docPdf.pipe(stream)
        stream.on('finish', () => {
          console.log(`✅ PDF berhasil disimpan di: ${filePath}`)
          shell.openPath(filePath) // Baris ini diaktifkan kembali
          resolve({ success: true, path: filePath })
        })
        stream.on('error', reject)
        docPdf.end()
      }
      // ---- AKHIR PERUBAHAN ----
    } catch (error) {
      console.error('❌ Gagal generate PDF:', error)
      reject(error)
    }
  })
}

// ===============================
// PUBLIC API
// ===============================
export async function testSheetConnection() {
  try {
    const doc = await openDoc()
    // [PERBAIKAN] Menghapus karakter ilegal
    console.log(`✅ Tes koneksi OK: "${doc.title}"`)
  } catch (err) {
    console.error('❌ Gagal tes koneksi ke Google Sheets:', err.message)
  }
}

export async function listPOs() {
  try {
    const doc = await openDoc()
    const poSheet = await getSheet(doc, 'purchase_orders')
    const rows = await poSheet.getRows()
    const byId = new Map()
    for (const r of rows) {
      const id = String(r.get('id')).trim()
      const rev = toNum(r.get('revision_number'), -1)
      const keep = byId.get(id)
      if (!keep || rev > keep.rev) byId.set(id, { rev, row: r })
    }
    return Array.from(byId.values()).map(({ row }) => row.toObject())
  } catch (err) {
    console.error('❌ listPOs error:', err.message)
    return []
  }
}

export async function saveNewPO(data) {
  try {
    const doc = await openDoc()
    const now = new Date().toISOString()
    const poSheet = await getSheet(doc, 'purchase_orders')
    const itemSheet = await getSheet(doc, 'purchase_order_items')

    const poId = await getNextIdFromSheet(poSheet)

    await poSheet.addRow({
      id: poId,
      revision_number: 0,
      po_number: data.nomorPo,
      project_name: data.namaCustomer,
      deadline: data.tanggalKirim || '',
      status: 'Open',
      priority: data.prioritas || '',
      notes: data.catatan || '',
      kubikasi_total: data.kubikasi_total || 0,
      created_at: now
    })

    // [PERBAIKAN PERFORMA] Ambil ID Awal SATU KALI sebelum loop
    let nextItemId = parseInt(await getNextIdFromSheet(itemSheet), 10)

    for (const raw of data.items || []) {
      const clean = scrubItemPayload(raw)
      await itemSheet.addRow({
        id: nextItemId, // Gunakan ID dari variabel
        purchase_order_id: poId,
        ...clean,
        revision_id: 0,
        revision_number: 0,
        kubikasi: raw.kubikasi || 0
      })
      nextItemId++ // Increment ID untuk item berikutnya
    }

    await generatePOPdf(
      {
        po_number: data.nomorPo,
        project_name: data.namaCustomer,
        deadline: data.tanggalKirim,
        priority: data.prioritas,
        items: data.items,
        notes: data.catatan,
        created_at: now
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
  try {
    const doc = await openDoc()
    const now = new Date().toISOString()
    const poSheet = await getSheet(doc, 'purchase_orders')
    const itemSheet = await getSheet(doc, 'purchase_order_items')

    const latest = await latestRevisionNumberForPO(String(data.poId), doc)
    const prevRow = latest >= 0 ? await getHeaderForRevision(String(data.poId), latest, doc) : null
    const prev = prevRow ? prevRow.toObject() : {}
    const newRev = latest >= 0 ? latest + 1 : 0

    await poSheet.addRow({
      id: String(data.poId),
      revision_number: newRev,
      po_number: data.nomorPo ?? prev.po_number ?? '',
      project_name: data.namaCustomer ?? prev.project_name ?? '',
      deadline: data.tanggalKirim ?? prev.deadline ?? '',
      status: data.status ?? prev.status ?? 'Open',
      priority: data.prioritas ?? prev.priority ?? '',
      notes: data.catatan ?? prev.notes ?? '',
      kubikasi_total: data.kubikasi_total ?? prev.kubikasi_total ?? 0,
      created_at: now
    })

    // [PERBAIKAN PERFORMA] Ambil ID Awal SATU KALI sebelum loop
    let nextItemId = parseInt(await getNextIdFromSheet(itemSheet), 10)

    for (const raw of data.items || []) {
      const clean = scrubItemPayload(raw)
      await itemSheet.addRow({
        id: nextItemId, // Gunakan ID dari variabel
        purchase_order_id: String(data.poId),
        ...clean,
        revision_id: newRev,
        revision_number: newRev,
        kubikasi: raw.kubikasi || 0
      })
      nextItemId++ // Increment ID untuk item berikutnya
    }

    await generatePOPdf(
      {
        po_number: data.nomorPo ?? prev.po_number,
        project_name: data.namaCustomer ?? prev.project_name,
        deadline: data.tanggalKirim ?? prev.deadline,
        priority: data.prioritas ?? prev.priority,
        items: data.items,
        notes: data.catatan ?? prev.notes,
        created_at: now
      },
      newRev
    )

    return { success: true, revision_number: newRev }
  } catch (err) {
    console.error('❌ updatePO error:', err.message)
    return { success: false, error: err.message }
  }
}

export async function deletePO(poId) {
  try {
    const doc = await openDoc()
    const poSheet = await getSheet(doc, 'purchase_orders')
    const itemSheet = await getSheet(doc, 'purchase_order_items')

    const poRows = await poSheet.getRows()
    const toDelHdr = poRows.filter((r) => String(r.get('id')).trim() === String(poId).trim())
    for (let i = toDelHdr.length - 1; i >= 0; i--) await toDelHdr[i].delete()

    const itemRows = await itemSheet.getRows()
    const toDelItems = itemRows.filter(
      (r) => String(r.get('purchase_order_id')).trim() === String(poId).trim()
    )
    for (let i = toDelItems.length - 1; i >= 0; i--) await toDelItems[i].delete()

    return { success: true }
  } catch (err) {
    // [PERBAIKAN] Menghapus karakter ilegal
    console.error(`❌ Gagal menghapus PO ID ${poId}:`, err.message)
    return { success: false, error: err.message }
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
    console.log('\n\n================ ULTIMATE DEBUG START ================')
    console.log(`[1] Memulai 'listPORevisions' untuk poId: "${poId}" (Tipe data: ${typeof poId})`)

    const doc = await openDoc()
    const poSheet = await getSheet(doc, 'purchase_orders')
    const rows = await poSheet.getRows()

    console.log(
      `[2] Berhasil mendapatkan sheet 'purchase_orders'. Total baris yang dibaca dari sheet: ${rows.length}`
    )

    if (rows.length === 0) {
      console.log(
        '[!] Peringatan: Tidak ada baris data yang terbaca dari sheet. Periksa permission service account.'
      )
      return []
    }

    const metas = rows
      .filter((r, index) => {
        const headerName = poSheet.headerValues[0] // -> Seharusnya 'id'
        const rowId = r.get(headerName)

        // Log paling penting: Tampilkan apa yang sedang dibandingkan
        console.log(`\n--- Memeriksa Baris ke-${index} ---`)
        console.log(
          `  - Nilai mentah dari kolom '${headerName}': "${rowId}" (Tipe data: ${typeof rowId})`
        )
        console.log(`  - Membandingkan dengan poId: "${poId}" (Tipe data: ${typeof poId})`)

        const isMatch = String(rowId).trim() == String(poId).trim() // Gunakan == untuk perbandingan yg lebih longgar

        console.log(`  - HASIL PERBANDINGAN: ${isMatch ? '✅ COCOK' : '❌ TIDAK COCOK'}`)

        return isMatch
      })
      .map((r) => {
        // ... (bagian map tetap sama)
        return {
          id: `${poId}:${toNum(r.get('revision_number'), 0)}`,
          purchase_order_id: String(poId),
          revision_number: toNum(r.get('revision_number'), 0),
          // ▼▼▼ TAMBAHKAN/PASTIKAN BARIS INI ADA ▼▼▼
          project_name: r.get('project_name') || '', // Tambahkan ini
          priority: r.get('priority') || null, // Pastikan ini ada
          // ▲▲▲ SELESAI ▲▲▲
          deadline: r.get('deadline') || null,
          status: r.get('status') || null,
          notes: r.get('notes') || null,
          created_at: r.get('created_at') || ''
        }
      })
      .sort((a, b) => a.revision_number - b.revision_number)

    console.log(`\n[3] Proses filter selesai. Total revisi yang cocok: ${metas.length}`)
    console.log('================ ULTIMATE DEBUG END ==================\n\n')

    return metas
  } catch (err) {
    console.error('❌ FATAL ERROR di listPORevisions:', err.message)
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
    const pdfResult = await generatePOPdf(
      {
        po_number: data.nomorPo,
        project_name: data.namaCustomer,
        created_at: new Date().toISOString(),
        deadline: data.tanggalKirim || '',
        priority: data.prioritas || '',
        items: data.items || [],
        notes: data.catatan || '' // [PERBAIKAN] Mengirim 'catatan' dari data PO utama
      },
      'preview' // Menggunakan 'preview' secara eksplisit
    )
    return { success: true, ...pdfResult }
  } catch (err) {
    console.error('❌ previewPO error:', err.message)
    return { success: false, error: err.message }
  }
}

export async function autoVersion(poId) {
  try {
    const doc = await openDoc()
    const poSheet = await getSheet(doc, 'purchase_orders')
    const itemSheet = await getSheet(doc, 'purchase_order_items')

    const latest = await latestRevisionNumberForPO(String(poId), doc)
    const liveHdr = await getLivePO(String(poId), doc)
    const liveItems = await getLivePOItems(String(poId), doc)
    const newRev = latest >= 0 ? latest + 1 : 0
    const now = new Date().toISOString()

    const liveHash = await hashLive(String(poId), doc)
    const lastHash = latest >= 0 ? await hashSnapshot(String(poId), latest, doc) : null
    if (lastHash && liveHash === lastHash) {
      return { success: true, created: false, revision_number: latest }
    }

    await poSheet.addRow({
      id: String(poId),
      revision_number: newRev,
      po_number: liveHdr.po_number,
      project_name: liveHdr.project_name,
      deadline: liveHdr.deadline || '',
      status: liveHdr.status || 'Open',
      priority: liveHdr.priority || '',
      notes: liveHdr.notes || '',
      kubikasi_total: liveHdr.kubikasi_total || 0,
      created_at: now
    })

    // [PERBAIKAN PERFORMA] Ambil ID Awal SATU KALI sebelum loop
    let nextItemId = parseInt(await getNextIdFromSheet(itemSheet), 10)

    for (const it of liveItems) {
      const clean = scrubItemPayload(it)
      await itemSheet.addRow({
        id: nextItemId, // Gunakan ID dari variabel
        purchase_order_id: String(poId),
        ...clean,
        revision_id: newRev,
        revision_number: newRev
      })
      nextItemId++ // Increment ID untuk item berikutnya
    }

    return { success: true, created: true, revision_number: newRev }
  } catch (err) {
    console.error('❌ autoVersion error:', err.message)
    return { success: false, error: err.message }
  }
}

export async function getRevisionHistory(poId) {
  try {
    const doc = await openDoc()
    const metas = await listPORevisions(String(poId))
    const itemSheet = await getSheet(doc, 'purchase_order_items')
    const all = await itemSheet.getRows()

    const history = metas.map((m) => ({
      revision: m,
      items: all
        .filter(
          (r) =>
            String(r.get('purchase_order_id')) === String(poId) &&
            toNum(r.get('revision_number'), -1) === m.revision_number
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
