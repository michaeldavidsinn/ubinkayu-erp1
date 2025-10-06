// file: api/getProductSalesAnalysis.js

import { openDoc, getSheet, toNum } from './_helpers.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  try {
    const doc = await openDoc()
    const itemSheet = await getSheet(doc, 'purchase_order_items')
    const poSheet = await getSheet(doc, 'purchase_orders')
    const productSheet = await getSheet(doc, 'product_master')

    const [itemRows, poRows, productRows] = await Promise.all([
      itemSheet.getRows(),
      poSheet.getRows(),
      productSheet.getRows()
    ])

    const poMap = new Map()
    poRows.forEach((r) => {
      const poId = r.get('id')
      const rev = toNum(r.get('revision_number'))
      if (!poMap.has(poId) || rev > (poMap.get(poId).revision_number || -1)) {
        poMap.set(poId, r.toObject())
      }
    })

    const salesData = {}
    const salesByDate = []
    const woodTypeData = {}
    const customerData = {}

    itemRows.forEach((item) => {
      const productName = item.get('product_name')
      const quantity = toNum(item.get('quantity'), 0)
      const woodType = item.get('wood_type')
      const kubikasi = toNum(item.get('kubikasi'), 0)
      const poId = item.get('purchase_order_id')
      const po = poMap.get(poId)

      if (!productName || !po) return

      salesData[productName] = (salesData[productName] || 0) + quantity
      salesByDate.push({ date: new Date(po.created_at), name: productName, quantity: quantity })
      if (woodType) woodTypeData[woodType] = (woodTypeData[woodType] || 0) + quantity
      if (po.project_name)
        customerData[po.project_name] = (customerData[po.project_name] || 0) + kubikasi
    })

    const topSellingProducts = Object.entries(salesData)
      .map(([name, totalQuantity]) => ({ name, totalQuantity }))
      .sort((a, b) => b.totalQuantity - a.totalQuantity)
      .slice(0, 10)
    const woodTypeDistribution = Object.entries(woodTypeData)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value)
    const topCustomers = Object.entries(customerData)
      .map(([name, totalKubikasi]) => ({ name, totalKubikasi }))
      .sort((a, b) => b.totalKubikasi - a.totalKubikasi)
      .slice(0, 5)

    const today = new Date()
    const thirtyDaysAgo = new Date(new Date().setDate(today.getDate() - 30))
    const sixtyDaysAgo = new Date(new Date().setDate(today.getDate() - 60))
    const salesLast30 = {}
    const salesPrev30 = {}
    salesByDate.forEach((sale) => {
      if (sale.date >= thirtyDaysAgo)
        salesLast30[sale.name] = (salesLast30[sale.name] || 0) + sale.quantity
      else if (sale.date >= sixtyDaysAgo)
        salesPrev30[sale.name] = (salesPrev30[sale.name] || 0) + sale.quantity
    })
    const trendingProducts = Object.keys(salesLast30)
      .map((name) => {
        const last30 = salesLast30[name]
        const prev30 = salesPrev30[name] || 0
        const change = prev30 === 0 && last30 > 0 ? 100 : ((last30 - prev30) / (prev30 || 1)) * 100
        return { name, last30, prev30, change }
      })
      .filter((p) => p.change > 20 && p.last30 > p.prev30)
      .sort((a, b) => b.change - a.change)

    const allProductNames = productRows.map((r) => r.get('product_name'))
    const soldProductNames = new Set(Object.keys(salesData))
    const neverSoldProducts = allProductNames.filter((name) => !soldProductNames.has(name))

    res.status(200).json({
      topSellingProducts,
      woodTypeDistribution,
      topCustomers,
      trendingProducts,
      slowMovingProducts: neverSoldProducts
    })
  } catch (err) {
    console.error('API Error in getProductSalesAnalysis:', err)
    res.status(500).json({
      error: err.message,
      topSellingProducts: [],
      woodTypeDistribution: [],
      topCustomers: [],
      trendingProducts: [],
      slowMovingProducts: []
    })
  }
}
