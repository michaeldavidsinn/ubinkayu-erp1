// file: api/saveNewPO.js

import { openDoc, getSheet, getNextIdFromSheet, scrubItemPayload, generateAndUploadPO } from './_helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const data = req.body;

  try {
    const doc = await openDoc();
    const now = new Date().toISOString();
    const poSheet = getSheet(doc, 'purchase_orders');
    const itemSheet = getSheet(doc, 'purchase_order_items');

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
    const itemsToAdd = (data.items || []).map((raw) => {
      const clean = scrubItemPayload(raw);
      const newItem = {
        id: nextItemId,
        purchase_order_id: poId,
        ...clean,
        revision_id: 0,
        revision_number: 0,
        kubikasi: raw.kubikasi || 0
      };
      itemsWithIds.push({ ...raw, id: nextItemId });
      nextItemId++;
      return newItem;
    });

    if (itemsToAdd.length > 0) {
      await itemSheet.addRows(itemsToAdd);
    }

    const poDataForJpeg = {
      po_number: data.nomorPo,
      project_name: data.namaCustomer,
      deadline: data.tanggalKirim,
      priority: data.prioritas,
      items: itemsWithIds,
      notes: data.catatan,
      created_at: now,
      kubikasi_total: data.kubikasi_total || 0,
      // [FIX] Gunakan poPhotoBase64, bukan poPhotoPath
      poPhotoBase64: data.poPhotoBase64
    };

    const uploadResult = await generateAndUploadPO(poDataForJpeg, 0);

    if (uploadResult.success) {
      newPoRow.set('pdf_link', uploadResult.link);
      await newPoRow.save();
    } else {
      newPoRow.set('pdf_link', `ERROR: ${uploadResult.error}`);
      await newPoRow.save();
    }

    res.status(200).json({ success: true, poId, revision_number: 0 });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}