// file: api/getAttentionData.js

import { openDoc, getSheet, toNum } from './_helpers.js'

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
    poRows.forEach((r) => {
      const id = r.get('id')
      const rev = toNum(r.get('revision_number'))
      if (!byId.has(id) || rev > byId.get(id).rev) {
        byId.set(id, { rev, row: r })
      }
    })
    const latestPoMap = new Map(
      Array.from(byId.values()).map((item) => [item.row.get('id'), item.row])
    )

    const latestItemRevisions = new Map()
    itemRows.forEach((item) => {
      const poId = item.get('purchase_order_id')
      const rev = toNum(item.get('revision_number'), -1)
      const current = latestItemRevisions.get(poId)
      if (!current || rev > current) {
        latestItemRevisions.set(poId, rev)
      }
    })

    const activeItems = itemRows.filter((item) => {
      const po = latestPoMap.get(item.get('purchase_order_id'))
      if (!po) return false
      const latestRev = latestItemRevisions.get(item.get('purchase_order_id')) ?? -1
      return (
        po.get('status') !== 'Completed' &&
        po.get('status') !== 'Cancelled' &&
        toNum(item.get('revision_number')) === latestRev
      )
    })

    const progressByCompositeKey = progressRows.reduce((acc, row) => {
      const poId = row.get('purchase_order_id')
      const itemId = row.get('purchase_order_item_id')
      const key = `${poId}-${itemId}`
      if (!acc[key]) acc[key] = []
      acc[key].push({ stage: row.get('stage'), created_at: row.get('created_at') })
      return acc
    }, {})

    const nearingDeadline = []
    const stuckItems = []
    const urgentItems = []
    const today = new Date()
    const sevenDaysFromNow = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000)
    const fiveDaysAgo = new Date(today.getTime() - 5 * 24 * 60 * 60 * 1000)

    activeItems.forEach((item) => {
      const po = latestPoMap.get(item.get('purchase_order_id'))
      const poId = po.get('id')
      const itemId = item.get('id')
      const compositeKey = `${poId}-${itemId}`
      const itemProgressHistory = progressByCompositeKey[compositeKey] || []
      const latestProgress = itemProgressHistory.sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      )[0]
      const currentStage = latestProgress ? latestProgress.stage : 'Belum Mulai'

      const attentionItem = {
        po_number: po.get('po_number'),
        item_name: item.get('product_name'),
        current_stage: currentStage
      }

      if (po.get('priority') === 'Urgent') {
        urgentItems.push(attentionItem)
      }

      const deadline = new Date(po.get('deadline'))
      if (deadline <= sevenDaysFromNow && deadline >= today && currentStage !== 'Siap Kirim') {
        nearingDeadline.push({ ...attentionItem, deadline: po.get('deadline') })
      }

      if (
        latestProgress &&
        new Date(latestProgress.created_at) < fiveDaysAgo &&
        currentStage !== 'Siap Kirim'
      ) {
        stuckItems.push({ ...attentionItem, last_update: latestProgress.created_at })
      }
    })

    res.status(200).json({ nearingDeadline, stuckItems, urgentItems })
  } catch (err) {
    console.error('API Error in getAttentionData:', err)
    res
      .status(500)
      .json({ error: err.message, nearingDeadline: [], stuckItems: [], urgentItems: [] })
  }
}
