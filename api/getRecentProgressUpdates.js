// file: api/getRecentProgressUpdates.js

import { openDoc, getSheet, toNum } from './_helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const doc = await openDoc()
    const progressSheet = await getSheet(doc, 'progress_tracking')
    const itemSheet = await getSheet(doc, 'purchase_order_items')
    const poSheet = await getSheet(doc, 'purchase_orders')

    const [progressRows, itemRows, poRows] = await Promise.all([
      progressSheet.getRows(),
      itemSheet.getRows(),
      poSheet.getRows()
    ])

    const itemMap = new Map(itemRows.map((r) => [r.get('id'), r.toObject()]))
    const poMap = new Map()
    poRows.forEach((r) => {
      const poId = r.get('id')
      const rev = toNum(r.get('revision_number'))
      if (!poMap.has(poId) || rev > (poMap.get(poId).revision_number || -1)) {
        poMap.set(poId, r.toObject())
      }
    })

    const limit = req.query.limit ? parseInt(req.query.limit) : 10

    const sortedUpdates = progressRows
      .map((r) => r.toObject())
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    const recentUpdates = sortedUpdates.slice(0, limit)

    const enrichedUpdates = recentUpdates
      .map((update) => {
        const item = itemMap.get(update.purchase_order_item_id)
        if (!item) return null
        const po = poMap.get(item.purchase_order_id)
        if (!po) return null
        return { ...update, item_name: item.product_name, po_number: po.po_number }
      })
      .filter(Boolean)

    res.status(200).json(enrichedUpdates)
  } catch (err) {
    console.error('API Error in getRecentProgressUpdates:', err)
    res.status(500).json({ error: err.message })
  }
}
