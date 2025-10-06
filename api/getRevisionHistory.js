// file: api/getRevisionHistory.js

import { openDoc, getSheet, toNum } from './_helpers.js'

async function listPORevisions(poId, doc) {
  const poSheet = await getSheet(doc, 'purchase_orders')
  const rows = await poSheet.getRows()
  return rows
    .filter((r) => String(r.get('id')).trim() === String(poId).trim())
    .map((r) => r.toObject())
    .sort((a, b) => a.revision_number - b.revision_number)
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { poId } = req.query
  if (!poId) {
    return res.status(400).json({ error: 'poId is required' })
  }

  try {
    const doc = await openDoc()
    const metas = await listPORevisions(String(poId), doc)
    const itemSheet = await getSheet(doc, 'purchase_order_items')
    const allItemRows = await itemSheet.getRows()

    const history = metas.map((m) => ({
      revision: m,
      items: allItemRows
        .filter(
          (r) =>
            String(r.get('purchase_order_id')) === String(poId) &&
            toNum(r.get('revision_number'), -1) === toNum(m.revision_number, -1)
        )
        .map((r) => r.toObject())
    }))

    history.sort((a, b) => b.revision.revision_number - a.revision.revision_number)
    res.status(200).json(history)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
}
