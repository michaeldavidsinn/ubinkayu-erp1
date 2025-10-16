/* eslint-disable prettier/prettier */
import React, { useMemo } from 'react'
import { POHeader } from '../types'
import { Card } from '../components/Card'

import {
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts'

import { useWindowWidth } from '../hooks/useWindowWidth'

interface DashboardPageProps {
  poList: POHeader[]
  isLoading: boolean
}

const StatCard = ({ title, value, icon, color }) => (
  <Card className="stat-card" style={{ borderTop: `4px solid ${color}` }}>
    <div className="stat-card-icon">{icon}</div>
    <div className="stat-card-info">
      <span className="stat-card-title">{title}</span>
      <span className="stat-card-value">{value}</span>
    </div>
  </Card>
)

const DashboardPage: React.FC<DashboardPageProps> = ({ poList, isLoading }) => {
  const windowWidth = useWindowWidth() // <-- 2. PANGGIL HOOK DI SINI
  const isMobile = windowWidth < 500 // Tentukan breakpoint untuk mobile

  const dashboardData = useMemo(() => {
    if (!poList || poList.length === 0) {
      return {
        totalPOs: 0,
        activePOs: 0,
        completedPOs: 0,
        dailyPOData: [], // Diubah dari monthly
        statusPOData: [],
        nearingDeadlinePOs: []
      }
    }

    const totalPOs = poList.length
    const activePOs = poList.filter(
      (po) => po.status !== 'Completed' && po.status !== 'Cancelled'
    ).length
    const completedPOs = poList.filter((po) => po.status === 'Completed').length

    // [MODIFIKASI] Data dihitung per HARI, bukan per bulan
    const dailyCounts = poList.reduce((acc, po) => {
      const day = new Date(po.created_at).toLocaleDateString('id-ID', {
        day: '2-digit',
        month: 'short'
      })
      acc[day] = (acc[day] || 0) + 1
      return acc
    }, {})

    const completedCounts = poList.reduce((acc, po) => {
      if (po.status === 'Completed' && po.completed_at) {
        const day = new Date(po.completed_at).toLocaleDateString('id-ID', {
          day: '2-digit',
          month: 'short'
        })
        acc[day] = (acc[day] || 0) + 1
      }
      return acc
    }, {})

    const allDaysSet = new Set([...Object.keys(dailyCounts), ...Object.keys(completedCounts)]);
    const allDaysSorted = Array.from(allDaysSet).sort((a, b) => {
        return new Date(`${a} ${new Date().getFullYear()}`).getTime() - new Date(`${b} ${new Date().getFullYear()}`).getTime();
    });


    const dailyPOData = allDaysSorted.map(day => ({
      name: day,
      "PO Baru": dailyCounts[day] || 0,
      "PO Selesai": completedCounts[day] || 0,
  }));

    const statusCounts = poList.reduce((acc, po) => {
      const status = po.status || 'Open'
      acc[status] = (acc[status] || 0) + 1
      return acc
    }, {})
    const statusPOData = Object.keys(statusCounts).map((status) => ({
      name: status,
      value: statusCounts[status]
    }))

    const today = new Date()
    const nextTwoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000)
    const nearingDeadlinePOs = poList
      .filter((po) => {
        if (!po.deadline || po.status === 'Completed' || po.status === 'Cancelled') return false
        const deadlineDate = new Date(po.deadline)
        return deadlineDate >= today && deadlineDate <= nextTwoWeeks
      })
      .sort((a, b) => new Date(a.deadline || 0).getTime() - new Date(b.deadline || 0).getTime())

    return { totalPOs, activePOs, completedPOs, dailyPOData, statusPOData, nearingDeadlinePOs }
  }, [poList])

  const todayFormatted = new Date().toLocaleDateString('id-ID', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const PIE_COLORS = {
    Open: '#3182CE',
    'In Progress': '#D69E2E',
    Completed: '#38A169',
    Cancelled: '#E53E3E'
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Dashboard ERP</h1>
          <p>Ringkasan aktivitas produksi PT Ubinkayu — {todayFormatted}</p>
        </div>
      </div>
      {/* [MODIFIKASI] Tambahkan Kartu Notifikasi di sini */}
      {/* [MODIFIKASI] Ganti blok Kartu Notifikasi yang lama dengan yang ini */}
      {!isLoading && dashboardData.nearingDeadlinePOs.length > 0 && (
        <Card className="attention-card">
          <h4>Perhatian!</h4>
          <p>
            Ada <strong>{dashboardData.nearingDeadlinePOs.length} Purchase Order</strong> yang akan
            jatuh tempo dalam 14 hari ke depan.
          </p>

          {/* [MODIFIKASI] Ganti bagian ini dengan struktur yang lebih rapi */}
          <div className="attention-list">
            {dashboardData.nearingDeadlinePOs.map((po) => (
              <div key={po.id} className="attention-item">
                <div>
                  {' '}
                  {/* Wrapper untuk teks */}
                  <p className="attention-line-1">
                    <strong>{po.po_number}</strong>
                    <span className="customer-name"> - {po.project_name}</span>
                  </p>
                  <p className="attention-line-2">
                    Deadline:{' '}
                    {new Date(po.deadline || 0).toLocaleDateString('id-ID', {
                      day: '2-digit',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                </div>
                {/* Di sini Anda bisa menambahkan tombol jika perlu */}
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="dashboard-grid">
        <StatCard
          title="Total Purchase Order"
          value={isLoading ? '...' : dashboardData.totalPOs}
          icon="📦"
          color="#3182CE"
        />
        <StatCard
          title="PO Aktif (Produksi)"
          value={isLoading ? '...' : dashboardData.activePOs}
          icon="⏳"
          color="#D69E2E"
        />
        <StatCard
          title="PO Selesai"
          value={isLoading ? '...' : dashboardData.completedPOs}
          icon="✅"
          color="#38A169"
        />
      </div>

      <div className="dashboard-widgets-grid">
        {/* [MODIFIKASI] Mengganti BarChart menjadi LineChart */}
        <Card>
          <h4>Purchase Order Baru per Hari</h4>
          {isLoading ? (
            <p>Memuat data...</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <LineChart
                data={dashboardData.dailyPOData}
                margin={{ top: 20, right: 30, left: 0, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis allowDecimals={false} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="PO Baru"
                  stroke="#8884d8"
                  strokeWidth={2}
                  activeDot={{ r: 8 }}
                />
                <Line type="monotone" dataKey="PO Selesai" stroke="#38A169" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card>
          <h4>Komposisi Status PO</h4>
          {isLoading ? (
            <p>Memuat data...</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={dashboardData.statusPOData}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={isMobile ? 60 : 100} // <-- Buat radius lebih kecil di mobile
                  label={!isMobile} // <-- Sembunyikan label di mobile agar tidak berantakan
                >
                  {dashboardData.statusPOData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name] || '#8884d8'} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend
                  layout={isMobile ? 'horizontal' : 'vertical'} // <-- Tata letak legend
                  verticalAlign={isMobile ? 'bottom' : 'middle'}
                  align={isMobile ? 'center' : 'right'}
                />
              </PieChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <Card>
        <h4>🚨 PO Mendekati Deadline (14 Hari ke Depan)</h4>
        {isLoading ? (
          <p>Memuat data...</p>
        ) : dashboardData.nearingDeadlinePOs.length > 0 ? (
          <div className="table-container">
            <table className="simple-table">
              <thead>
                <tr>
                  <th>Nomor PO</th>
                  <th>Customer</th>
                  <th>Deadline</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.nearingDeadlinePOs.map((po) => (
                  <tr key={po.id}>
                    <td>{po.po_number}</td>
                    <td>{po.project_name}</td>
                    <td>{new Date(po.deadline || 0).toLocaleDateString('id-ID')}</td>
                    <td>
                      <span
                        className={`status-badge status-${(po.status || 'open').toLowerCase().replace(' ', '-')}`}
                      >
                        {po.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p>Tidak ada PO yang mendekati deadline. Kerja bagus! 👍</p>
        )}
      </Card>
    </div>
  )
}

export default DashboardPage
