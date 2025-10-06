// file: api/getActivePOsWithProgress.js

import { openDoc, getSheet, toNum, PRODUCTION_STAGES } from './_helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const doc = await openDoc()
    const poSheet = await getSheet(doc, 'purchase_orders')
    const itemSheet = await getSheet(doc, 'purchase_order_items')
    const progressSheet = await getSheet(doc, 'progress_tracking')

    const [poRows, itemRows, progressRows] = await Promise.all([
      poSheet.getRows(),
      itemSheet.getRows(),
      progressSheet.getRows()
    ])

    const byId = new Map()
    for (const r of poRows) {
      const id = String(r.get('id')).trim()
      const rev = toNum(r.get('revision_number'), -1)
      if (!byId.has(id) || rev > (byId.get(id).rev || -1)) {
        byId.set(id, { rev, row: r })
      }
    }
    const latestPoRows = Array.from(byId.values()).map(({ row }) => row)
    const activePOs = latestPoRows.filter(
      (r) => r.get('status') !== 'Completed' && r.get('status') !== 'Cancelled'
    )

    const progressByCompositeKey = progressRows.reduce((acc, row) => {
      const poId = row.get('purchase_order_id')
      const itemId = row.get('purchase_order_item_id')
      const key = `${poId}-${itemId}`
      if (!acc[key]) acc[key] = []
      acc[key].push({ stage: row.get('stage'), created_at: row.get('created_at') })
      return acc
    }, {})

    const latestItemRevisions = new Map()
    itemRows.forEach((item) => {
      const poId = item.get('purchase_order_id')
      const rev = toNum(item.get('revision_number'), -1)
      if (!latestItemRevisions.has(poId) || rev > latestItemRevisions.get(poId)) {
        latestItemRevisions.set(poId, rev)
      }
    })

    const result = activePOs.map((po) => {
      const poId = po.get('id')
      const latestRev = latestItemRevisions.get(poId) ?? -1
      const poItems = itemRows.filter(
        (item) =>
          item.get('purchase_order_id') === poId &&
          toNum(item.get('revision_number'), -1) === latestRev
      )

      if (poItems.length === 0) return { ...po.toObject(), progress: 0 }

      let totalPercentage = 0
      poItems.forEach((item) => {
        const itemId = item.get('id')
        const stages = PRODUCTION_STAGES
        const compositeKey = `${poId}-${itemId}`
        const itemProgressHistory = progressByCompositeKey[compositeKey] || []
        let latestStageIndex = -1
        if (itemProgressHistory.length > 0) {
          const latestProgress = itemProgressHistory.sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )[0]
          latestStageIndex = stages.indexOf(latestProgress.stage)
        }
        const itemPercentage =
          latestStageIndex >= 0 ? ((latestStageIndex + 1) / stages.length) * 100 : 0
        totalPercentage += itemPercentage
      })
      const poProgress = totalPercentage / poItems.length
      return { ...po.toObject(), progress: Math.round(poProgress) }
    })

    res.status(200).json(result)
  } catch (err) {
    console.error('API Error in getActivePOsWithProgress:', err)
    res.status(500).json({ error: err.message })
  }
}
