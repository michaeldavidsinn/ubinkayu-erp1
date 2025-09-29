import { createCanvas, loadImage } from 'canvas'
import fs from 'fs'
import path from 'path'
import { app, shell } from 'electron'

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true })
  }
}

function wrapText(context, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ')
  let line = ''
  let lineCount = 1
  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' '
    const metrics = context.measureText(testLine)
    const testWidth = metrics.width
    if (testWidth > maxWidth && n > 0) {
      context.fillText(line, x, y)
      line = words[n] + ' '
      y += lineHeight
      lineCount++
    } else {
      line = testLine
    }
  }
  context.fillText(line, x, y)
  return lineCount
}

export async function generatePOJpeg(poData, revisionNumber = 0) {
  try {
    if (!app.isReady()) {
      await app.whenReady()
    }
    const baseDir = path.resolve(app.getPath('documents'), 'UbinkayuERP', 'PO')
    const poFolderName = `${poData.po_number}-${poData.project_name}`.replace(/[/\\?%*:|"<>]/g, '-')
    const poDir = path.join(baseDir, poFolderName)
    ensureDirSync(poDir)
    const fileName = `PO-${poData.po_number.replace(
      /[/\\?%*:|"<>]/g,
      '-'
    )}-Rev${revisionNumber}.jpeg`
    const filePath = path.join(poDir, fileName)

    const width = 1200
    const height = 1800
    const canvas = createCanvas(width, height)
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, width, height)

    const redColor = '#D92121'
    const blueColor = '#0000FF'
    const blackColor = '#000000'
    const greenColor = '#006400'
    const headerBgColor = '#F0F0F0'
    const totalBgColor = '#FFE6E6'
    const borderColor = '#AAAAAA'

    ctx.font = 'bold 24px Arial'
    ctx.fillStyle = redColor
    const headerText = `${poData.po_number || 'N/A'} ${poData.project_name || 'N/A'}`
    ctx.textAlign = 'center'
    ctx.fillText(headerText, width / 2, 40)
    ctx.textAlign = 'left'
    ctx.font = 'bold 20px Arial'
    ctx.fillStyle = blackColor
    const sbyText = `SBY R: ${revisionNumber}`
    const dateText = poData.created_at ? new Date(poData.created_at).toLocaleDateString('id-ID') : new Date().toLocaleDateString('id-ID')
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
    function drawHeader(text, col, yOffset1, yOffset2) {
      const lines = text.split('\n')
      ctx.fillText(lines[0], tableLeft + col.x + col.width / 2, tableTop + yOffset1)
      if (lines[1]) {
        ctx.fillText(lines[1], tableLeft + col.x + col.width / 2, tableTop + yOffset2)
      }
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
    Object.values(cols).forEach((col) => {
      ctx.strokeRect(tableLeft + col.x, tableTop, col.width, 60)
    })
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
      const finishingLines = (`${item.finishing || ''}\n${item.sample || ''}`).split('\n').length
      maxLines = Math.max(produkLines + profilLines, finishingLines, 2)
      const rowHeight = maxLines * itemLineHeight + rowPadding * 2
      ctx.strokeStyle = borderColor
      ctx.textAlign = 'center'
      const deadline = poData.deadline ? new Date(poData.deadline).toLocaleDateString('id-ID') : 'N/A'
      const poDate = poData.created_at ? new Date(poData.created_at).toLocaleDateString('id-ID') : 'N/A'
      ctx.fillStyle = blueColor
      ctx.fillText(deadline, tableLeft + cols.rencKirim.x + cols.rencKirim.width / 2, rowTop + rowPadding + 10)
      ctx.fillStyle = blackColor
      ctx.fillText(poDate, tableLeft + cols.rencKirim.x + cols.rencKirim.width / 2, rowTop + rowPadding + 25)
      ctx.textAlign = 'left'
      wrapText(ctx, poData.po_number || 'N/A', tableLeft + cols.noPo.x + rowPadding, rowTop + rowPadding + 10, cols.noPo.width - rowPadding * 2, itemLineHeight)
      wrapText(ctx, poData.project_name || 'N/A', tableLeft + cols.noPo.x + rowPadding, rowTop + rowPadding + 25, cols.noPo.width - rowPadding * 2, itemLineHeight)
      const produkText = `${item.product_name || ''}\n${item.wood_type || ''} ${item.profile || ''}`
      wrapText(ctx, produkText, tableLeft + cols.produk.x + rowPadding, rowTop + rowPadding + 10, cols.produk.width - rowPadding * 2, itemLineHeight)
      const finishingText = `${item.finishing || ''}\n${item.sample || ''}`
      wrapText(ctx, finishingText, tableLeft + cols.finishing.x + rowPadding, rowTop + rowPadding + 10, cols.finishing.width - rowPadding * 2, itemLineHeight)
      ctx.textAlign = 'center'
      ctx.fillText((item.thickness_mm || '0').toString(), tableLeft + cols.ukuran.x + ukuranSubWidth / 2, rowTop + rowHeight / 2)
      ctx.fillText((item.width_mm || '0').toString(), tableLeft + cols.ukuran.x + ukuranSubWidth + ukuranSubWidth / 2, rowTop + rowHeight / 2)
      ctx.fillText((item.length_mm || '0').toString(), tableLeft + cols.ukuran.x + ukuranSubWidth * 2 + ukuranSubWidth / 2, rowTop + rowHeight / 2)
      const quantity = `${item.quantity || 0} ${item.satuan || 'pcs'}`
      ctx.fillText(quantity, tableLeft + cols.kuantiti.x + cols.kuantiti.width / 2, rowTop + rowHeight / 2)
      const kubikasi = item.kubikasi ? item.kubikasi.toFixed(4) : '0.0000'
      ctx.fillText(kubikasi, tableLeft + cols.kubikasi.x + cols.kubikasi.width / 2, rowTop + rowHeight / 2)
      ctx.textAlign = 'left'
      wrapText(ctx, item.location || '-', tableLeft + cols.lokasi.x + rowPadding, rowTop + rowPadding + 10, cols.lokasi.width - rowPadding * 2, itemLineHeight)
      Object.values(cols).forEach((col) => {
        ctx.strokeRect(tableLeft + col.x, rowTop, col.width, rowHeight)
      })
      ctx.strokeRect(ukuranStartX + ukuranSubWidth, rowTop, 0, rowHeight)
      ctx.strokeRect(ukuranStartX + ukuranSubWidth * 2, rowTop, 0, rowHeight)
      rowTop += rowHeight
    })

    // Baris Total
    ctx.fillStyle = totalBgColor
    ctx.fillRect(tableLeft, rowTop, tableWidth, 30)
    ctx.strokeRect(tableLeft, rowTop, tableWidth, 30)
    ctx.fillStyle = redColor
    ctx.font = 'bold 12px Arial'
    ctx.textAlign = 'center'
    ctx.fillText('TOTAL', tableLeft + cols.kuantiti.x - 30, rowTop + 20)
    const totalKubikasi = poData.kubikasi_total ? poData.kubikasi_total.toFixed(4) + ' m³' : '0.0000 m³'
    ctx.fillText(totalKubikasi, tableLeft + cols.kubikasi.x + cols.kubikasi.width / 2, rowTop + 20)
    rowTop += 30

    // Bagian Catatan
    const notesLineHeight = 15
    const notesPadding = notesLineHeight * 2
    const notesText = poData.notes || '-'
    ctx.fillStyle = greenColor
    ctx.font = 'bold 10px Arial'
    ctx.textAlign = 'left'
    ctx.fillText('Cara kerja / request klien / detail lainnya:', tableLeft + 10, rowTop + notesPadding)
    ctx.fillStyle = blackColor
    ctx.font = '10px Arial'
    const noteLineCount = wrapText(ctx, notesText, tableLeft + 10, rowTop + notesPadding + 20, tableWidth - 20, notesLineHeight)
    const notesBoxHeight = (noteLineCount * notesLineHeight) + (notesPadding * 2) + 20
    ctx.strokeStyle = borderColor
    ctx.beginPath()
    ctx.moveTo(tableLeft, rowTop + notesBoxHeight)
    ctx.lineTo(tableLeft + tableWidth, rowTop + notesBoxHeight)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(tableLeft, rowTop)
    ctx.lineTo(tableLeft, rowTop + notesBoxHeight)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(tableLeft + tableWidth, rowTop)
    ctx.lineTo(tableLeft + tableWidth, rowTop + notesBoxHeight)
    ctx.stroke()

    rowTop += notesBoxHeight

    // [PERUBAHAN] Menggambar Tabel Approval dan Tanggal Cetak dalam satu baris
    const approvalMarginTop = 10
    rowTop += approvalMarginTop
    const approvalTableHeight = 80
    const approvalCols = [
      'Gambar MKT', 'Gambar Pengawas', 'Gambar Kerja',
      'Foto Lokasi', 'ACC Mrktng', 'ACC SPV', 'ACC MNGR'
    ]

    // Perkecil lebar tabel approval agar ada ruang untuk tanggal
    const approvalTableWidth = tableWidth * 0.8
    const approvalColWidth = approvalTableWidth / approvalCols.length

    ctx.font = 'bold 9px Arial'
    ctx.textAlign = 'center'

    // Gambar 7 kolom approval di sisi kiri
    approvalCols.forEach((title, index) => {
      const colX = tableLeft + (index * approvalColWidth)
      ctx.strokeStyle = borderColor
      ctx.strokeRect(colX, rowTop, approvalColWidth, approvalTableHeight)
      ctx.fillStyle = greenColor
      ctx.fillText(title, colX + approvalColWidth / 2, rowTop + 15)
      ctx.beginPath()
      ctx.moveTo(colX, rowTop + 25)
      ctx.lineTo(colX + approvalColWidth, rowTop + 25)
      ctx.stroke()
    })

    // Gambar tanggal cetak di sisi kanan pada baris yang sama
    ctx.fillStyle = greenColor
    ctx.font = '10px Arial'
    ctx.textAlign = 'right'
    ctx.fillText('Tanggal cetak:', width - 30, rowTop + 30)
    ctx.fillText(new Date().toLocaleDateString('id-ID'), width - 30, rowTop + 45)

    // Pindahkan kursor ke bawah berdasarkan elemen tertinggi di baris ini (yaitu tabel approval)
    rowTop += approvalTableHeight

    // Lampiran Foto Referensi
    const imageMarginTop = 20
    rowTop += imageMarginTop
    ctx.fillStyle = blackColor
    ctx.font = 'bold 14px Arial'
    ctx.textAlign = 'left'
    ctx.fillText('Lampiran: Foto Referensi', tableLeft, rowTop)
    rowTop += 30
    console.log('[JPEG Generator] Mencari path foto:', poData.poPhotoPath)
    if (poData.poPhotoPath && fs.existsSync(poData.poPhotoPath)) {
      console.log('[JPEG Generator] Path ditemukan. Memuat gambar...')
      try {
        const userImage = await loadImage(poData.poPhotoPath)
        console.log(`[JPEG Generator] Gambar berhasil dimuat (${userImage.width}x${userImage.height}).`)
        const aspectRatio = userImage.height / userImage.width
        const drawWidth = tableWidth
        const drawHeight = tableWidth * aspectRatio
        console.log(`[JPEG Generator] Menggambar di: {x: ${tableLeft}, y: ${rowTop}, w: ${drawWidth}, h: ${drawHeight}}`)
        ctx.drawImage(userImage, tableLeft, rowTop, drawWidth, drawHeight)
      } catch (imgError) {
        console.error('Gagal memuat gambar referensi:', imgError)
        ctx.fillStyle = redColor
        ctx.font = '12px Arial'
        ctx.textAlign = 'left'
        ctx.fillText(`Gagal memuat file gambar: ${poData.poPhotoPath}`, tableLeft, rowTop)
      }
    } else {
      console.log('[JPEG Generator] Path foto tidak ditemukan atau file tidak ada.')
      ctx.font = '12px Arial'
      ctx.fillStyle = '#888'
      ctx.textAlign = 'left'
      ctx.fillText('Tidak ada foto referensi yang dilampirkan.', tableLeft, rowTop)
    }

    // Simpan file
    const buffer = canvas.toBuffer('image/jpeg', { quality: 0.95 })
    fs.writeFileSync(filePath, buffer)
    shell.openPath(filePath)
    return { success: true, path: filePath }
  } catch (error) {
    console.error('❌ Gagal generate JPEG:', error)
    return { success: false, error: error.message }
  }
}
