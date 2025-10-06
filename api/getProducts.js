import { openDoc, getSheet } from './_helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const doc = await openDoc();
    const sheet = getSheet(doc, 'product_master');
    const rows = await sheet.getRows();
    const products = rows.map((r) => r.toObject());
    res.status(200).json(products);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}