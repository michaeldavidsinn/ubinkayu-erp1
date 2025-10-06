// file: api/listPOItems.js

import { openDoc, getSheet, toNum } from './_helpers.js';

async function getItemsByRevision(poId, rev, doc) {
  const sh = await getSheet(doc, 'purchase_order_items');
  const rows = await sh.getRows();
  return rows
    .filter((r) => String(r.get('purchase_order_id')).trim() === String(poId).trim() && toNum(r.get('revision_number'), -1) === toNum(rev, -1))
    .map((r) => r.toObject());
}

async function latestRevisionNumberForPO(poId, doc) {
  const sh = await getSheet(doc, 'purchase_orders');
  const rows = await sh.getRows();
  const nums = rows.filter((r) => String(r.get('id')).trim() === String(poId).trim()).map((r) => toNum(r.get('revision_number'), -1));
  return nums.length ? Math.max(...nums) : -1;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const { poId } = req.query;
  if (!poId) {
    return res.status(400).json({ error: 'poId is required' });
  }

  try {
    const doc = await openDoc();
    const latestRev = await latestRevisionNumberForPO(String(poId), doc);
    if (latestRev < 0) {
        return res.status(200).json([]); // PO tidak ditemukan, kembalikan array kosong
    }
    const items = await getItemsByRevision(String(poId), latestRev, doc);
    res.status(200).json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}