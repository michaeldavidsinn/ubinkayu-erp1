// electron/pdfGenerator.js
import PDFDocument from 'pdfkit'
import fs from 'fs'
import path from 'path'
import { app, shell } from 'electron'

// Helper bikin folder kalau belum ada
function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

/**
 * Generate PDF Purchase Order
 * @param {Object} poData - Data dari PO
 * @param {number} revisionNumber - Nomor revisi
 */
export async function generatePOPdf(poData, revisionNumber = 0) {
  try {
    // Pastikan app Electron sudah siap
    if (!app.isReady()) {
      await app.whenReady()
    }

    // Ambil folder Documents user
    const baseDir = path.resolve(app.getPath('documents'), 'UbinkayuERP', 'PO')

    // Buat folder per PO
    const poFolderName = `${poData.po_number}-${poData.project_name}`
    const poDir = path.join(baseDir, poFolderName)
    ensureDirSync(poDir)

    // Path PDF
    const fileName = `PO-${poData.po_number}-Rev${revisionNumber}.pdf`
    const filePath = path.join(poDir, fileName)

    // Setup PDF
    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    // Set font default
    doc.font('Helvetica')

    // --- HEADER ---
    doc.fontSize(18).font('Helvetica-Bold').text(`PURCHASE ORDER`, { align: 'center' })
    doc.moveDown(1)

    doc.fontSize(12).font('Helvetica')
    doc.text(`Nomor PO    : ${poData.po_number}`)
    doc.text(`Customer     : ${poData.project_name}`)
    doc.text(`Tanggal Input: ${new Date(poData.created_at).toLocaleDateString('id-ID')}`)
    doc.text(`Deadline     : ${poData.deadline ? new Date(poData.deadline).toLocaleDateString('id-ID') : '-'}`)
    doc.text(`Prioritas    : ${poData.priority}`)
    doc.text(`Revisi       : ${revisionNumber}`)
    doc.moveDown(1.5)

    // --- TABEL ITEM ---
    const colWidths = [40, 100, 80, 80, 60, 60, 60]
    const headers = ['No', 'Produk', 'Profil', 'Warna', 'Tebal', 'Lebar', 'Qty']

    let tableTop = doc.y + 10

    // Header tabel
    let x = doc.x
    headers.forEach((h, i) => {
      doc.font('Helvetica-Bold').fontSize(10).text(h, x, tableTop, {
        width: colWidths[i],
        align: 'center'
      })
      x += colWidths[i]
    })

    // Garis pemisah header
    doc.moveTo(40, tableTop + 15).lineTo(550, tableTop + 15).stroke()
    doc.moveDown(1.5)

    // Isi tabel
    poData.items.forEach((item, idx) => {
      let x = doc.x
      const rowTop = doc.y
      const row = [
        idx + 1,
        item.product_name || '-',
        item.profile || '-',
        item.color || '-',
        item.thickness_mm ? `${item.thickness_mm} mm` : '-',
        item.width_mm ? `${item.width_mm} mm` : '-',
        `${item.quantity} ${item.satuan || ''}`
      ]

      row.forEach((val, i) => {
        doc.font('Helvetica').fontSize(9).text(val, x, rowTop, {
          width: colWidths[i],
          align: 'center'
        })
        x += colWidths[i]
      })
      doc.moveDown(1.2)
    })

    doc.moveDown(3)

    // --- FOOTER ---
    doc.font('Helvetica')
    doc.text('ACC MKT: ...................', { continued: true })
      .text('   ACC SPV: ...................', { continued: true })
      .text('   ACC MNGR: ...................')
    doc.moveDown(2)
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, { align: 'right' })

    doc.end()

    // Auto-open setelah selesai
    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        shell.openPath(filePath)
        resolve({ success: true, path: filePath })
      })
      stream.on('error', (err) => {
        console.error('❌ Gagal tulis stream PDF:', err)
        reject({ success: false, error: err.message })
      })
    })
  } catch (error) {
    console.error('❌ Gagal generate PDF:', error)
    return { success: false, error: error.message }
  }
}
