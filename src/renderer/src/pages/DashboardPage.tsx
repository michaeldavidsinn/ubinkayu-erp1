/* eslint-disable prettier/prettier */
import React, { useMemo } from 'react';
import { POHeader } from '../types';
import { Card } from '../components/Card';

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
  const stats = useMemo(() => {
    const totalPOs = poList.length;
    // Anggap PO aktif jika statusnya BUKAN 'Completed' atau 'Cancelled'
    const activePOs = poList.filter(
      (po) => po.status !== 'Completed' && po.status !== 'Cancelled'
    ).length;
    const completedPOs = poList.filter((po) => po.status === 'Completed').length;

    return { totalPOs, activePOs, completedPOs };
  }, [poList]);

  const today = new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Dashboard ERP</h1>
          <p>Ringkasan aktivitas produksi PT Ubinkayu — {today}</p>
        </div>
      </div>

      {/* Grid untuk menampilkan kartu statistik */}
      <div className="dashboard-grid">
        <StatCard
          title="Total Purchase Order"
          value={isLoading ? '...' : stats.totalPOs}
          icon="📦"
          color="#3182CE"
        />
        <StatCard
          title="PO Aktif (Produksi)"
          value={isLoading ? '...' : stats.activePOs}
          icon="⏳"
          color="#D69E2E"
        />
        <StatCard
          title="PO Selesai"
          value={isLoading ? '...' : stats.completedPOs}
          icon="✅"
          color="#38A169"
        />
      </div>

      {/* Kartu Selamat Datang */}
      <Card className="welcome-card">
        <h2>Selamat Datang di Sistem ERP</h2>
        <p>Sistem manajemen produksi untuk PT Ubinkayu Indonesia - spesialis flooring, decking, wall panel, dan produk kayu berkualitas.</p>
        <div className="welcome-grid">
            <div>
                <h4>Fitur Utama:</h4>
                <ul>
                    <li>Manajemen Purchase Order</li>
                    <li>Tracking Progress Produksi</li>
                    <li>Manajemen Produk & Stok</li>
                    <li>Laporan & Analisis</li>
                </ul>
            </div>
            <div>
                <h4>Jenis Produk:</h4>
                <ul>
                    <li>Flooring (Jati, Merbau, Ulin)</li>
                    <li>Decking Premium</li>
                    <li>Wall Panel Custom</li>
                    <li>Furniture Kayu Solid</li>
                </ul>
            </div>
        </div>
      </Card>
    </div>
  );
};

export default DashboardPage;