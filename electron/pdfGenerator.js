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
  console.log('\n--- TITIK D (PDF Generator) ---');
  console.log('Path foto yang diterima:', poData.poPhotoPath);
  try {
    if (!app.isReady()) {
      await app.whenReady()
    }

    const baseDir = path.resolve(app.getPath('documents'), 'UbinkayuERP', 'PO')
    const poFolderName = `${poData.po_number}-${poData.project_name}`.replace(/[/\\?%*:|"<>]/g, '-')
    const poDir = path.join(baseDir, poFolderName)
    ensureDirSync(poDir)

    const fileName = `PO-${poData.po_number.replace(/[/\\?%*:|"<>]/g, '-')}-Rev${revisionNumber}.pdf`
    const filePath = path.join(poDir, fileName)

    const doc = new PDFDocument({ margin: 40, size: 'A4' })
    const stream = fs.createWriteStream(filePath)
    doc.pipe(stream)

    doc.font('Helvetica')

    // --- HEADER ---
    doc.fontSize(18).font('Helvetica-Bold').text(`PURCHASE ORDER`, { align: 'center' })
    doc.moveDown(1)
    doc.fontSize(12).font('Helvetica')
    doc.text(`Nomor PO         : ${poData.po_number}`)
    doc.text(`Customer         : ${poData.project_name}`)
    doc.text(`Tanggal Input    : ${new Date(poData.created_at || Date.now()).toLocaleDateString('id-ID')}`)
    doc.text(`Deadline         : ${poData.deadline ? new Date(poData.deadline).toLocaleDateString('id-ID') : '-'}`)
    doc.text(`Prioritas        : ${poData.priority}`)
    doc.text(`Revisi           : ${revisionNumber}`)
    doc.moveDown(1.5)
    
    // --- TABEL ITEM ---
    const colWidths = [40, 100, 80, 80, 60, 60, 60]
    const headers = ['No', 'Produk', 'Profil', 'Warna', 'Tebal', 'Lebar', 'Qty']
    let tableTop = doc.y

    // Gambar Header tabel
    let x = 40
    headers.forEach((h, i) => {
      doc.font('Helvetica-Bold').fontSize(10).text(h, x, tableTop, {
        width: colWidths[i],
        align: 'center'
      })
      x += colWidths[i]
    })

    doc.moveTo(40, tableTop + 15).lineTo(550, tableTop + 15).stroke()
    doc.y = tableTop + 20;

    // Isi tabel
    (poData.items || []).forEach((item, idx) => {
      if (doc.y > doc.page.height - doc.page.margins.bottom - 40) {
        doc.addPage();
        tableTop = doc.y;
        let headerX = 40;
        headers.forEach((h, i) => {
            doc.font('Helvetica-Bold').fontSize(10).text(h, headerX, tableTop, { width: colWidths[i], align: 'center' });
            headerX += colWidths[i];
        });
        doc.moveTo(40, tableTop + 15).lineTo(550, tableTop + 15).stroke();
        doc.y = tableTop + 20;
      }

      let rowX = 40
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
        doc.font('Helvetica').fontSize(9).text(val, rowX, rowTop, {
          width: colWidths[i],
          align: 'center'
        })
        rowX += colWidths[i]
      })
      doc.moveDown(1.5)
    })

    doc.moveDown(3)

    // --- FOOTER ---
    doc.font('Helvetica')
    doc.text('ACC MKT: ...................', { continued: true })
      .text('   ACC SPV: ...................', { continued: true })
      .text('   ACC MNGR: ...................')
    doc.moveDown(2)
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, { align: 'right' })

    // --- [MODIFIKASI] BAGIAN FOTO REFERENSI DIPINDAHKAN KE AKHIR ---
    // Cek apakah path foto ada dan file-nya benar-benar ada di komputer
    if (poData.poPhotoPath && fs.existsSync(poData.poPhotoPath)) {
      // Selalu buat halaman baru untuk foto agar menjadi lampiran
      doc.addPage();
      
      doc.font('Helvetica-Bold').fontSize(14).text('Lampiran: Foto Referensi', { align: 'center', underline: true })
      doc.moveDown(2)
      
      // Sisipkan gambar dan atur ukurannya
      doc.image(poData.poPhotoPath, {
        fit: [520, 600], // Beri ruang lebih besar karena satu halaman penuh
        align: 'center',
        valign: 'center'
      });
    }

    doc.end()

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