/* eslint-disable prettier/prettier */
import React, { useMemo } from 'react';
import { POHeader } from '../types';
import { Card } from '../components/Card';
// Impor komponen dari recharts
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

// Definisikan props yang diterima oleh halaman ini
interface DashboardPageProps {
  poList: POHeader[];
  isLoading: boolean;
}

// Komponen kecil untuk menampilkan kartu statistik
const StatCard = ({ title, value, icon, color }) => (
  <Card className="stat-card" style={{ borderTop: `4px solid ${color}` }}>
    <div className="stat-card-icon">{icon}</div>
    <div className="stat-card-info">
      <span className="stat-card-title">{title}</span>
      <span className="stat-card-value">{value}</span>
    </div>
  </Card>
);

const DashboardPage: React.FC<DashboardPageProps> = ({ poList, isLoading }) => {
  // Gunakan useMemo agar kalkulasi tidak diulang setiap render
  const dashboardData = useMemo(() => {
    if (!poList || poList.length === 0) {
        return {
            totalPOs: 0,
            activePOs: 0,
            completedPOs: 0,
            monthlyPOData: [],
            statusPOData: [],
            nearingDeadlinePOs: []
        };
    }

    // 1. Kalkulasi Statistik Dasar
    const totalPOs = poList.length;
    const activePOs = poList.filter(
      (po) => po.status !== 'Completed' && po.status !== 'Cancelled'
    ).length;
    const completedPOs = poList.filter((po) => po.status === 'Completed').length;

    // 2. Data untuk Grafik PO per Bulan
    const monthlyCounts = poList.reduce((acc, po) => {
        const month = new Date(po.created_at).toLocaleString('id-ID', { month: 'short', year: 'numeric' });
        acc[month] = (acc[month] || 0) + 1;
        return acc;
    }, {});
    const monthlyPOData = Object.keys(monthlyCounts).map(month => ({
        name: month,
        "PO Baru": monthlyCounts[month]
    })).sort((a,b) => new Date(a.name) - new Date(b.name));


    // 3. Data untuk Diagram Status PO
    const statusCounts = poList.reduce((acc, po) => {
        const status = po.status || 'Open';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});
    const statusPOData = Object.keys(statusCounts).map(status => ({
        name: status,
        value: statusCounts[status]
    }));

    // 4. Data untuk Daftar PO Mendekati Deadline
    const today = new Date();
    const nextTwoWeeks = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000);
    const nearingDeadlinePOs = poList.filter(po => {
        if (!po.deadline || po.status === 'Completed' || po.status === 'Cancelled') return false;
        const deadlineDate = new Date(po.deadline);
        return deadlineDate >= today && deadlineDate <= nextTwoWeeks;
    }).sort((a,b) => new Date(a.deadline).getTime() - new Date(b.deadline).getTime());


    return { totalPOs, activePOs, completedPOs, monthlyPOData, statusPOData, nearingDeadlinePOs };
  }, [poList]);

  const todayFormatted = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Warna untuk Pie Chart
  const PIE_COLORS = { 'Open': '#3182CE', 'In Progress': '#D69E2E', 'Completed': '#38A169', 'Cancelled': '#E53E3E' };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Dashboard ERP</h1>
          <p>Ringkasan aktivitas produksi PT Ubinkayu — {todayFormatted}</p>
        </div>
      </div>

      {/* Grid untuk menampilkan kartu statistik */}
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

      {/* Grid untuk Chart dan Data Penting Lainnya */}
      <div className="dashboard-widgets-grid">
        <Card>
            <h4>Purchase Order Baru per Bulan</h4>
            {isLoading ? <p>Memuat data...</p> : (
            <ResponsiveContainer width="100%" height={300}>
                <BarChart data={dashboardData.monthlyPOData} margin={{ top: 20, right: 20, left: -10, bottom: 5 }}>
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="PO Baru" fill="#3182CE" />
                </BarChart>
            </ResponsiveContainer>
            )}
        </Card>
        <Card>
            <h4>Komposisi Status PO</h4>
            {isLoading ? <p>Memuat data...</p> : (
            <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                    <Pie data={dashboardData.statusPOData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                        {dashboardData.statusPOData.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[entry.name] || '#8884d8'} />
                        ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                </PieChart>
            </ResponsiveContainer>
            )}
        </Card>
      </div>

      <Card>
        <h4>🚨 PO Mendekati Deadline (14 Hari ke Depan)</h4>
        {isLoading ? <p>Memuat data...</p> : dashboardData.nearingDeadlinePOs.length > 0 ? (
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
                    {dashboardData.nearingDeadlinePOs.map(po => (
                        <tr key={po.id}>
                            <td>{po.po_number}</td>
                            <td>{po.project_name}</td>
                            <td>{new Date(po.deadline).toLocaleDateString('id-ID')}</td>
                            <td><span className={`status-badge status-${(po.status || 'open').toLowerCase().replace(' ', '-')}`}>{po.status}</span></td>
                        </tr>
                    ))}
                </tbody>
            </table>
        ) : (
            <p>Tidak ada PO yang mendekati deadline. Kerja bagus! 👍</p>
        )}
      </Card>

    </div>
  );
};

export default DashboardPage;