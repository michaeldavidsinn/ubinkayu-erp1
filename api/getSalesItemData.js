// file: api/getSalesItemData.js

import { openDoc, getSheet, toNum } from './_helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const doc = await openDoc()
    const itemSheet = await getSheet(doc, 'purchase_order_items')
    const poSheet = await getSheet(doc, 'purchase_orders')

    const [itemRows, poRows] = await Promise.all([itemSheet.getRows(), poSheet.getRows()])

    const poMap = new Map()
    poRows.forEach((r) => {
      const poId = r.get('id')
      const rev = toNum(r.get('revision_number'))
      if (!poMap.has(poId) || rev > (poMap.get(poId).revision_number || -1)) {
        poMap.set(poId, r.toObject())
      }
    })

    const combinedData = itemRows
      .map((item) => {
        const itemObject = item.toObject()
        const po = poMap.get(itemObject.purchase_order_id)
        if (!po) return null
        return {
          ...itemObject,
          customer_name: po.project_name,
          po_date: po.created_at
        }
      })
      .filter(Boolean)

    res.status(200).json(combinedData)
  } catch (err) {
    console.error('API Error in getSalesItemData:', err)
    res.status(500).json({ error: err.message })
  }
}
