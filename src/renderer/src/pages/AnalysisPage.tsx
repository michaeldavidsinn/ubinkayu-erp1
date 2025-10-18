/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/ban-ts-comment */

import React, { useState, useEffect, useMemo } from 'react'
import { Card } from '../components/Card'
import { AnalysisData, POItem } from '../types'
import { useWindowWidth } from '../hooks/useWindowWidth'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts'

import * as apiService from '../apiService'

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF']

// Helper untuk menghitung kesimpulan dari data yang difilter
const calculateInsights = (items: POItem[]) => {
  if (items.length === 0) {
    return { topProduct: 'N/A', topWood: 'N/A', topColor: 'N/A', topFinishing: 'N/A' }
  }
  const count = (key: keyof POItem) =>
    items.reduce(
      (acc, item) => {
        const value = item[key] as string
        if (value) acc[value] = (acc[value] || 0) + (item.quantity || 1)
        return acc
      },
      {} as Record<string, number>
    )

  const getTopItem = (data: Record<string, number>) =>
    Object.keys(data).length > 0
      ? Object.keys(data).reduce((a, b) => (data[a] > data[b] ? a : b))
      : 'N/A'

  return {
    topProduct: getTopItem(count('product_name')),
    topWood: getTopItem(count('wood_type')),
    topColor: getTopItem(count('color')),
    topFinishing: getTopItem(count('finishing'))
  }
}

const AnalysisPage: React.FC = () => {
  const windowWidth = useWindowWidth()
  const isMobile = windowWidth < 640
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null)
  const [allItems, setAllItems] = useState<POItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const [filters, setFilters] = useState({
    wood_type: 'all',
    profile: 'all',
    color: 'all',
    finishing: 'all'
  })

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true)
      try {
        // @ts-ignore
        const [summaryData, itemData] = await Promise.all([
          apiService.getProductSalesAnalysis(),
          apiService.getSalesItemData()
        ])
        setAnalysisData(summaryData)
        setAllItems(itemData)
      } catch (err) {
        console.error('Gagal mengambil data analisis:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchData()
  }, [])

  const uniqueOptions = useMemo(() => {
    const wood_type = new Set<string>()
    const profile = new Set<string>()
    const color = new Set<string>()
    const finishing = new Set<string>()
    allItems.forEach((item) => {
      if (item.wood_type) wood_type.add(item.wood_type)
      if (item.profile) profile.add(item.profile)
      if (item.color) color.add(item.color)
      if (item.finishing) finishing.add(item.finishing)
    })
    return {
      wood_type: [...wood_type],
      profile: [...profile],
      color: [...color],
      finishing: [...finishing]
    }
  }, [allItems])

  const filteredItems = useMemo(() => {
    return allItems.filter((item) => {
      return (
        (filters.wood_type === 'all' || item.wood_type === filters.wood_type) &&
        (filters.profile === 'all' || item.profile === filters.profile) &&
        (filters.color === 'all' || item.color === filters.color) &&
        (filters.finishing === 'all' || item.finishing === filters.finishing)
      )
    })
  }, [allItems, filters])

  const insights = useMemo(() => calculateInsights(filteredItems), [filteredItems])

  const handleFilterChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const recommendationText = useMemo(() => {
    if (
      !analysisData ||
      !analysisData.trendingProducts ||
      analysisData.trendingProducts.length === 0
    ) {
      return 'Saat ini belum ada tren penjualan produk yang signifikan.'
    }
    const topTrending = analysisData.trendingProducts
      .slice(0, 2)
      .map((p) => p.name)
      .join(' dan ')
    return `Pertimbangkan untuk menambah stok untuk produk ${topTrending} karena permintaannya sedang meningkat pesat.`
  }, [analysisData])

  if (isLoading) {
    return (
      <div className="page-container">
        <p>🧠 Menganalisis data penjualan, mohon tunggu...</p>
      </div>
    )
  }
  if (!analysisData) {
    return (
      <div className="page-container">
        <p>Gagal memuat data analisis.</p>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Analisis & Prediksi Penjualan</h1>
          <p>Wawasan berbasis data untuk membantu pengambilan keputusan stok.</p>
        </div>
      </div>

      {/* --- BAGIAN RINGKASAN UMUM (GRAFIK) --- */}
      <h3>Ringkasan Umum</h3>
      <div className="dashboard-widgets-grid">
        <Card>
          <h4>{'📊 Distribusi Jenis Kayu Terlaris'}</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analysisData.woodTypeDistribution}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                fill="#8884d8"
                label={isMobile ? false : (props: any) => `${props.name} (${(props.percent * 100).toFixed(0)}%)`}
              >
                {analysisData.woodTypeDistribution.map((_entry, index) => (
                  <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => `${value} unit`} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </Card>
        <Card>
          <h4>{'⭐ Top 5 Customer (Berdasarkan Volume m³)'}</h4>
          {analysisData.topCustomers.length > 0 ? (
            <ol className="top-customer-list">
              {analysisData.topCustomers.map((c) => (
                <li key={c.name}>
                  <span>{c.name}</span>
                  <strong>{c.totalKubikasi.toFixed(3)} m³</strong>
                </li>
              ))}
            </ol>
          ) : (
            <p>Belum ada data kubikasi customer.</p>
          )}
        </Card>
      </div>
      <Card style={{ marginTop: '1.5rem' }}>
        <h4>{'🏆 Top 10 Produk Terlaris (Berdasarkan Kuantitas)'}</h4>
        <ResponsiveContainer width="100%" height={400}>
          <BarChart
            layout="vertical"
            data={analysisData.topSellingProducts.slice()}
            margin={{ top: 20, right: 30, left: 100, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" allowDecimals={false} />
            <YAxis type="category" dataKey="name" width={150} interval={0} />
            <Tooltip formatter={(value) => `${value} unit`} />
            <Legend />
            <Bar dataKey="totalQuantity" name="Total Kuantitas Terjual" fill="#8884d8" />
          </BarChart>
        </ResponsiveContainer>
      </Card>
      <div className="dashboard-widgets-grid" style={{ marginTop: '1.5rem' }}>
        <Card>
          <h4>{'🔥 Produk Tren Naik (>20% dalam sebulan)'}</h4>
          {analysisData.trendingProducts.length > 0 ? (
            <ul className="insight-list">
              {analysisData.trendingProducts.map((p) => (
                <li key={p.name}>
                  <strong>{p.name}</strong>
                  <span className="trend-up">+{p.change.toFixed(0)}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>Tidak ada produk yang sedang tren naik.</p>
          )}
        </Card>
        <Card>
          <h4>{'❄️ Produk Kurang Laris (Belum Pernah Terjual)'}</h4>
          {analysisData.slowMovingProducts.length > 0 ? (
            <ul className="insight-list">
              {analysisData.slowMovingProducts.slice(0, 5).map((name) => (
                <li key={name}>{name}</li>
              ))}
              {analysisData.slowMovingProducts.length > 5 && <li>dan lainnya...</li>}
            </ul>
          ) : (
            <p>Semua produk pernah terjual. Kerja bagus!</p>
          )}
        </Card>
      </div>
      <Card className="recommendation-card">
        <h4>{'📦 Rekomendasi Stok Cerdas'}</h4>
        <p>{recommendationText}</p>
      </Card>

      {/* --- BAGIAN EKSPLORASI DATA INTERAKTIF --- */}
      <h3 style={{ marginTop: '2rem' }}>Eksplorasi Minat Customer</h3>
      <Card>
        <div className="interactive-bi-layout">
          <div className="bi-filters">
            <h4>Filter Data</h4>
            <div className="form-group">
              <label>Jenis Kayu</label>
              <select name="wood_type" value={filters.wood_type} onChange={handleFilterChange}>
                <option value="all">Semua</option>
                {uniqueOptions.wood_type.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Profil</label>
              <select name="profile" value={filters.profile} onChange={handleFilterChange}>
                <option value="all">Semua</option>
                {uniqueOptions.profile.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Warna</label>
              <select name="color" value={filters.color} onChange={handleFilterChange}>
                <option value="all">Semua</option>
                {uniqueOptions.color.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Finishing</label>
              <select name="finishing" value={filters.finishing} onChange={handleFilterChange}>
                <option value="all">Semua</option>
                {uniqueOptions.finishing.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="bi-results">
            <Card className="insight-card">
              <h4>Kesimpulan Otomatis</h4>
              <p>
                Dari <strong>{filteredItems.length}</strong> item yang cocok:
              </p>
              <ul>
                <li>
                  Produk Paling Laris: <strong>{insights.topProduct}</strong>
                </li>
                <li>
                  Jenis Kayu Paling Umum: <strong>{insights.topWood}</strong>
                </li>
                <li>
                  Warna Paling Diminati: <strong>{insights.topColor}</strong>
                </li>
                <li>
                  Finishing Paling Populer: <strong>{insights.topFinishing}</strong>
                </li>
              </ul>
            </Card>
          </div>
        </div>
        <div className="po-table-container" style={{ marginTop: '1.5rem' }}>
          <table className="simple-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>Customer</th>
                <th>Jenis Kayu</th>
                <th>Profil</th>
                <th>Warna</th>
                <th>Finishing</th>
                <th>Qty</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.slice(0, 100).map((item) => (
                <tr key={item.id}>
                  <td>{item.product_name}</td>
                  <td>{item.customer_name}</td>
                  <td>{item.wood_type}</td>
                  <td>{item.profile}</td>
                  <td>{item.color}</td>
                  <td>{item.finishing}</td>
                  <td>
                    {item.quantity} {item.satuan}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredItems.length > 100 && (
            <p style={{ textAlign: 'center', marginTop: '1rem' }}>
              <i>Dan {filteredItems.length - 100} item lainnya...</i>
            </p>
          )}
        </div>
      </Card>
    </div>
  )
}

export default AnalysisPage
