// file: api/getPOItemsWithDetails.js

import { openDoc, getSheet, toNum, PRODUCTION_STAGES } from './_helpers.js'

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
    const poSheet = await getSheet(doc, 'purchase_orders')
    const itemSheet = await getSheet(doc, 'purchase_order_items')
    const progressSheet = await getSheet(doc, 'progress_tracking')

    const [poRows, itemRows, progressRows] = await Promise.all([
      poSheet.getRows(),
      itemSheet.getRows(),
      progressSheet.getRows()
    ])

    const allRevisionsForPO = poRows.filter((r) => r.get('id') === poId)
    const latestPoRev = Math.max(
      -1,
      ...allRevisionsForPO.map((r) => toNum(r.get('revision_number')))
    )
    const poData = allRevisionsForPO.find((r) => toNum(r.get('revision_number')) === latestPoRev)
    if (!poData) throw new Error(`PO dengan ID ${poId} tidak ditemukan.`)

    const poStartDate = new Date(poData.get('created_at'))
    const poDeadline = new Date(poData.get('deadline'))
    let stageDeadlines = []
    if (poStartDate && poDeadline && poDeadline > poStartDate) {
      const totalDuration = poDeadline.getTime() - poStartDate.getTime()
      const durationPerStage = totalDuration / PRODUCTION_STAGES.length
      stageDeadlines = PRODUCTION_STAGES.map((stageName, index) => {
        const deadlineTime = poStartDate.getTime() + durationPerStage * (index + 1)
        return { stageName, deadline: new Date(deadlineTime).toISOString() }
      })
    }

    const poItems = itemRows.filter(
      (item) =>
        item.get('purchase_order_id') === poId &&
        toNum(item.get('revision_number'), -1) === latestPoRev
    )
    const poProgressRows = progressRows.filter((row) => row.get('purchase_order_id') === poId)
    const progressByItemId = poProgressRows.reduce((acc, row) => {
      const itemId = row.get('purchase_order_item_id')
      if (!acc[itemId]) acc[itemId] = []
      acc[itemId].push(row.toObject())
      return acc
    }, {})

    const result = poItems.map((item) => {
      const itemObject = item.toObject()
      const itemId = String(itemObject.id)
      const history = (progressByItemId[itemId] || []).sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at)
      )
      return { ...itemObject, progressHistory: history, stageDeadlines: stageDeadlines }
    })

    res.status(200).json(result)
  } catch (err) {
    console.error('API Error in getPOItemsWithDetails:', err)
    res.status(500).json({ error: err.message })
  }
}
