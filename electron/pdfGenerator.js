import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { app, shell } from 'electron';

function ensureDirSync(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Generate PDF Purchase Order
 * @param {Object} poData - Data dari PO
 * @param {number} revisionNumber - Nomor revisi
 */
export async function generatePOPdf(poData, revisionNumber = 0) {
  try {
    if (!app.isReady()) {
      await app.whenReady();
    }

    const baseDir = path.resolve(app.getPath('documents'), 'UbinkayuERP', 'PO');
    const poFolderName = `${poData.po_number}-${poData.project_name}`.replace(/[/\\?%*:|"<>]/g, '-');
    const poDir = path.join(baseDir, poFolderName);
    ensureDirSync(poDir);

    const fileName = `PO-${poData.po_number.replace(/[/\\?%*:|"<>]/g, '-')}-Rev${revisionNumber}.pdf`;
    const filePath = path.join(poDir, fileName);

    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 30,
    });

    const stream = fs.createWriteStream(filePath);
    doc.pipe(stream);

    doc.font('Helvetica');
    const pageW = doc.page.width;
    const pageH = doc.page.height;
    const margin = 30;

    // --- HEADER ---
    const headerY = margin;

    const mainTitle = `${poData.po_number || ''} ${poData.project_name || ''}`;
    const sbyText = 'SBY';
    const revisionText = `R: ${revisionNumber}`;
    const createdAtDate = poData.created_at ? new Date(poData.created_at).toLocaleDateString('en-GB') : '-';
    const spacer = '   ';

    let totalWidth = 0;
    doc.font('Helvetica-Bold').fontSize(16);
    totalWidth += doc.widthOfString(mainTitle);
    doc.font('Helvetica-Bold').fontSize(12);
    totalWidth += doc.widthOfString(sbyText);
    totalWidth += doc.widthOfString(revisionText);
    doc.font('Helvetica').fontSize(12);
    totalWidth += doc.widthOfString(createdAtDate);
    totalWidth += doc.widthOfString(spacer) * 3;

    const startX = (pageW / 2) - (totalWidth / 2);

    doc.font('Helvetica-Bold').fontSize(16).fillColor('#D92121');
    doc.text(mainTitle, startX, headerY, { continued: true });

    const yPosAdjust = headerY + 3;

    doc.font('Helvetica-Bold').fontSize(12);
    doc.text(spacer, { continued: true, baseline: 'middle' });
    doc.text(sbyText, startX + doc.widthOfString(mainTitle) + doc.widthOfString(spacer), yPosAdjust, { continued: true });

    doc.text(spacer, { continued: true });
    doc.text(revisionText, { continued: true });

    doc.font('Helvetica').fontSize(12).fillColor('#2E8B8B');
    doc.text(spacer, { continued: true });
    doc.text(createdAtDate);

    doc.fillColor('black');
    doc.moveTo(margin, headerY + 25).lineTo(pageW - margin, headerY + 25).stroke();


    // --- TABEL ITEM ---
    let tableTop = headerY + 40;
    const colWidths = [80, 110, 120, 100, 120, 60, 60, 111];
    const colStarts = [margin];
    for (let i = 0; i < colWidths.length - 1; i++) {
      colStarts.push(colStarts[i] + colWidths[i]);
    }

    const drawTableHeader = (y) => {
      doc.font('Helvetica-Bold').fontSize(8);
      const headerTopY = y;
      const headerBottomY = y + 24;
      doc.fillColor('#008000');
      doc.text('Renc Kirim\n/ TGL PO', colStarts[0], headerTopY + 4, { width: colWidths[0], align: 'center' });
      doc.text('No PO\n/ Nama Proyek', colStarts[1], headerTopY + 4, { width: colWidths[1], align: 'center' });
      doc.text('Produk / Kayu / Profil', colStarts[2], headerTopY + 4, { width: colWidths[2], align: 'center' });
      doc.text('Finishing / gloss / sample', colStarts[3], headerTopY + 4, { width: colWidths[3], align: 'center' });
      doc.text('UKURAN', colStarts[4], headerTopY + 2, { width: colWidths[4], align: 'center' });
      doc.font('Helvetica').fontSize(7);
      doc.text('tbl', colStarts[4], headerTopY + 12, { width: 40, align: 'center' });
      doc.text('lebar', colStarts[4] + 40, headerTopY + 12, { width: 40, align: 'center' });
      doc.text('panjang', colStarts[4] + 80, headerTopY + 12, { width: 40, align: 'center' });
      doc.font('Helvetica-Bold').fontSize(8);
      doc.text('KUANTITI', colStarts[5], headerTopY + 8, { width: colWidths[5], align: 'center' });
      doc.text('KUBIKASI', colStarts[6], headerTopY + 8, { width: colWidths[6], align: 'center' });
      doc.text('Lokasi & Keterangan lain', colStarts[7], headerTopY + 4, { width: colWidths[7], align: 'center' });
      doc.fillColor('black');
      doc.rect(margin, headerTopY, pageW - (margin * 2), 24).stroke();
      colStarts.slice(1).forEach(x => doc.moveTo(x, headerTopY).lineTo(x, headerBottomY).stroke());
      doc.moveTo(colStarts[4], headerTopY + 10).lineTo(colStarts[5], headerTopY + 10).stroke();
      doc.moveTo(colStarts[4] + 40, headerTopY + 10).lineTo(colStarts[4] + 40, headerBottomY).stroke();
      doc.moveTo(colStarts[4] + 80, headerTopY + 10).lineTo(colStarts[4] + 80, headerBottomY).stroke();
    };

    drawTableHeader(tableTop);
    doc.y = tableTop + 24;
    const firstRowY = doc.y;

    const rowHeight = 28;
    (poData.items || []).forEach((item, idx) => {
      if (doc.y + rowHeight > pageH - margin - 80) {
        doc.addPage();
        tableTop = margin;
        drawTableHeader(tableTop);
        doc.y = tableTop + 24;
      }
      const rowTop = doc.y;
      doc.font('Helvetica').fontSize(8);
      doc.fillColor('blue');
      doc.text(poData.deadline ? new Date(poData.deadline).toLocaleDateString('en-GB') : '-', colStarts[0] + 2, rowTop + 4, { width: colWidths[0] - 4 });
      doc.fillColor('black');
      doc.text(poData.created_at ? new Date(poData.created_at).toLocaleDateString('en-GB') : '-', colStarts[0] + 2, rowTop + 14, { width: colWidths[0] - 4 });
      doc.text(poData.po_number || '-', colStarts[1] + 2, rowTop + 4, { width: colWidths[1] - 4 });
      doc.text(poData.project_name || '-', colStarts[1] + 2, rowTop + 14, { width: colWidths[1] - 4 });
      doc.text(item.product_name || '-', colStarts[2] + 2, rowTop + 4, { width: colWidths[2] - 4 });
      doc.text(`${item.kayu || ''} ${item.profile || ''}`.trim(), colStarts[2] + 2, rowTop + 14, { width: colWidths[2] - 4 });
      doc.text(item.finishing || '-', colStarts[3] + 2, rowTop + 4, { width: colWidths[3] - 4 });
      doc.text(`${item.gloss || ''} ${item.sample || ''}`.trim(), colStarts[3] + 2, rowTop + 14, { width: colWidths[3] - 4 });
      doc.text(item.thickness_mm || '-', colStarts[4], rowTop + 8, { width: 40, align: 'center' });
      doc.text(item.width_mm || '-', colStarts[4] + 40, rowTop + 8, { width: 40, align: 'center' });
      doc.text(item.length_mm || '-', colStarts[4] + 80, rowTop + 8, { width: 40, align: 'center' });
      doc.text(`${item.quantity || 0} ${item.satuan || 'pcs'}`, colStarts[5], rowTop + 8, { width: colWidths[5], align: 'center' });
      doc.text(item.kubikasi ? item.kubikasi.toFixed(4) : '0.0000', colStarts[6], rowTop + 8, { width: colWidths[6], align: 'center' });

      const lokasiKet = [
        item.location ? `Lokasi: ${item.location}` : null,
        item.keterangan ? `Catatan: ${item.keterangan}` : null
      ].filter(Boolean).join('\n');

      doc.text(lokasiKet || '-', colStarts[7] + 2, rowTop + 4, {
        width: colWidths[7] - 4
      });

      doc.y += rowHeight;
      if (idx < poData.items.length - 1) {
        doc.moveTo(margin, doc.y).lineTo(pageW - margin, doc.y).stroke();
      }
    });

    const tableBottomY = doc.y;
    doc.rect(margin, firstRowY, pageW - (margin * 2), tableBottomY - firstRowY).stroke();
    colStarts.slice(1).forEach(x => doc.moveTo(x, firstRowY).lineTo(x, tableBottomY).stroke());
    doc.moveTo(colStarts[4] + 40, firstRowY).lineTo(colStarts[4] + 40, tableBottomY).stroke();
    doc.moveTo(colStarts[4] + 80, firstRowY).lineTo(colStarts[4] + 80, tableBottomY).stroke();

    const totalY = doc.y;
    doc.font('Helvetica-Bold').fontSize(9);
    doc.fillColor('#D92121');
    doc.text('total', colStarts[5], totalY + 4, { width: colWidths[5], align: 'center' });
    doc.text(poData.kubikasi_total ? poData.kubikasi_total.toFixed(4) + ' m3' : '0.0000 m3', colStarts[6], totalY + 4, { width: colWidths[6], align: 'center' });
    doc.fillColor('black');
    doc.rect(margin, totalY, pageW - (margin * 2), 15).stroke();
    colStarts.slice(1).forEach(x => doc.moveTo(x, totalY).lineTo(x, totalY + 15).stroke());
    doc.y += 15;

    doc.moveDown(1);
    const notesY = doc.y;
    const accBoxY = pageH - margin - 40;
    const accBoxX = pageW - margin - 150;
    doc.font('Helvetica').fontSize(8);
    doc.fillColor('#008000');
    doc.text('cara kerja / request klien / detail lainnya:', margin + 2, notesY);
    doc.fillColor('black');
    const notesBoxHeight = (accBoxY - 5) - notesY;
    const notesTextHeight = notesBoxHeight - 14;
    doc.text(poData.notes || 'Tidak ada catatan khusus.', margin + 2, notesY + 12, {
      width: pageW / 2,
      height: notesTextHeight > 0 ? notesTextHeight : 10,
      ellipsis: true,
    });
    doc.rect(margin, notesY - 2, pageW - (margin * 2), notesBoxHeight).stroke();
    doc.rect(accBoxX, accBoxY, 150, 40).stroke();
    doc.text('ACC MNGR', accBoxX, accBoxY + 5, { width: 150, align: 'center' });
    doc.fillColor('#008000');
    doc.text(`tanggal cetak:\n${new Date().toLocaleDateString('id-ID')}`, accBoxX, accBoxY + 20, { width: 150, align: 'center' });
    doc.fillColor('black');

    if (poData.poPhotoPath && fs.existsSync(poData.poPhotoPath)) {
      doc.addPage();
      doc.font('Helvetica-Bold').fontSize(14).text('Lampiran: Foto Referensi (detail - A)', { align: 'center', underline: true });
      doc.moveDown(2);
      doc.image(poData.poPhotoPath, {
        fit: [pageW - margin * 2, pageH - margin * 2 - 50],
        align: 'center',
        valign: 'center'
      });
    }

    doc.end();

    return new Promise((resolve, reject) => {
      stream.on('finish', () => {
        shell.openPath(filePath);
        resolve({ success: true, path: filePath });
      });
      stream.on('error', (err) => {
        console.error('❌ Gagal tulis stream PDF:', err);
        reject({ success: false, error: err.message });
      });
    });
  } catch (error) {
    console.error('❌ Gagal generate PDF:', error);
    return { success: false, error: err.message };
  }
}
