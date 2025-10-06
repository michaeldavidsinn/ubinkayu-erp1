import { listPOItemsByRevisionLogic } from './_utils.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { poId, revisionNumber } = req.query;
    if (!poId || !revisionNumber) throw new Error('Parameter "poId" dan "revisionNumber" dibutuhkan.');
    const data = await listPOItemsByRevisionLogic(poId, revisionNumber);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}