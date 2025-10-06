// file: api/updatePO.js

import { openDoc, getSheet, getNextIdFromSheet, scrubItemPayload, generateAndUploadPO, toNum } from './_helpers.js';

// Helper khusus untuk file ini
async function latestRevisionNumberForPO(poId, doc) {
  const sh = await getSheet(doc, 'purchase_orders');
  const rows = await sh.getRows();
  const nums = rows.filter((r) => String(r.get('id')).trim() === String(poId).trim()).map((r) => toNum(r.get('revision_number'), -1));
  return nums.length ? Math.max(...nums) : -1;
}
async function getHeaderForRevision(poId, rev, doc) {
  const sh = await getSheet(doc, 'purchase_orders');
  const rows = await sh.getRows();
  return rows.find((r) => String(r.get('id')).trim() === String(poId).trim() && toNum(r.get('revision_number'), -1) === toNum(rev, -1)) || null;
}

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

    const latest = await latestRevisionNumberForPO(String(data.poId), doc);
    const prevRow = latest >= 0 ? await getHeaderForRevision(String(data.poId), latest, doc) : null;
    const prev = prevRow ? prevRow.toObject() : {};
    const newRev = latest >= 0 ? latest + 1 : 0;

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
    });

    const itemsWithIds = [];
    let nextItemId = parseInt(await getNextIdFromSheet(itemSheet), 10);
    const itemsToAdd = (data.items || []).map((raw) => {
      const clean = scrubItemPayload(raw);
      const newItem = {
        id: nextItemId,
        purchase_order_id: String(data.poId),
        ...clean,
        revision_id: newRev,
        revision_number: newRev,
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
      po_number: data.nomorPo ?? prev.po_number,
      project_name: data.namaCustomer ?? prev.project_name,
      deadline: data.tanggalKirim ?? prev.deadline,
      priority: data.prioritas ?? prev.priority,
      items: itemsWithIds,
      notes: data.catatan ?? prev.notes,
      created_at: now,
      kubikasi_total: data.kubikasi_total ?? prev.kubikasi_total ?? 0,
      poPhotoBase64: data.poPhotoBase64
    };

    const uploadResult = await generateAndUploadPO(poDataForJpeg, newRev);

    if (uploadResult.success) {
      newRevisionRow.set('pdf_link', uploadResult.link);
      await newRevisionRow.save();
    } else {
      newRevisionRow.set('pdf_link', `ERROR: ${uploadResult.error}`);
      await newRevisionRow.save();
    }

    res.status(200).json({ success: true, revision_number: newRev });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}