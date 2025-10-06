import { listPOItemsLogic } from './_utils.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  try {
    const { poId } = req.query;
    if (!poId) throw new Error('Parameter "poId" is required.');
    const data = await listPOItemsLogic(poId);
    return res.status(200).json(data);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}