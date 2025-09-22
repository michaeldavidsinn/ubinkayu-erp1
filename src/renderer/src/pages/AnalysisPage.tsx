/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/ban-ts-comment */

import React, { useState, useEffect, useMemo } from 'react';
import { Card } from '../components/Card';
import { AnalysisData } from '../types';
import { BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, CartesianGrid, PieChart, Pie, Cell } from 'recharts';

const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#AF19FF'];

const AnalysisPage: React.FC = () => {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        // @ts-ignore
        const data = await window.api.getProductSalesAnalysis();
        setAnalysisData(data);
      } catch (err) {
        console.error("Gagal mengambil data analisis:", err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, []);

  const recommendationText = useMemo(() => {
    if (!analysisData || !analysisData.trendingProducts || analysisData.trendingProducts.length === 0) {
      return "Saat ini belum ada tren penjualan produk yang signifikan.";
    }
    const topTrending = analysisData.trendingProducts.slice(0, 2).map(p => p.name).join(' dan ');
    return `Pertimbangkan untuk menambah stok untuk produk ${topTrending} karena permintaannya sedang meningkat pesat.`;
  }, [analysisData]);

  if (isLoading) {
    return <div className="page-container"><p>🧠 Menganalisis data penjualan, mohon tunggu...</p></div>;
  }

  if (!analysisData) {
    return <div className="page-container"><p>Gagal memuat data analisis.</p></div>;
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Analisis & Prediksi Penjualan</h1>
          <p>Wawasan berbasis data untuk membantu pengambilan keputusan stok.</p>
        </div>
      </div>

      {/* --- Bagian Analisis Material & Customer --- */}
      <div className="dashboard-widgets-grid">
        <Card>
          <h4>{'📊 Distribusi Jenis Kayu Terlaris'}</h4>
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={analysisData.woodTypeDistribution}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                nameKey="name"
                label={(props) => `${props.name} (${props.percent.toFixed(0)}%)`}
              >
                {analysisData.woodTypeDistribution.map((entry, index) => (
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
              {analysisData.topCustomers.map(c => (
                <li key={c.name}>
                  <span>{c.name}</span>
                  <strong>{c.totalKubikasi.toFixed(3)} m³</strong>
                </li>
              ))}
            </ol>
          ) : <p>Belum ada data kubikasi customer.</p>}
        </Card>
      </div>

      {/* --- Bagian Top 10 Produk --- */}
      <Card style={{ marginTop: '1.5rem' }}>
        <h4>{'🏆 Top 10 Produk Terlaris (Berdasarkan Kuantitas)'}</h4>
        <ResponsiveContainer width="100%" height={400}>
            <BarChart
              layout="vertical"
              data={analysisData.topSellingProducts.slice().reverse()}
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

      {/* --- Bagian Tren, Slow Moving, dan Rekomendasi --- */}
      <div className="dashboard-widgets-grid" style={{ marginTop: '1.5rem' }}>
        <Card>
            <h4>{'🔥 Produk Tren Naik (>20% dalam sebulan)'}</h4>
            {analysisData.trendingProducts.length > 0 ? (
                <ul className="insight-list">
                    {analysisData.trendingProducts.map(p => (
                        <li key={p.name}>
                            <strong>{p.name}</strong>
                            <span className="trend-up">+{p.change.toFixed(0)}%</span>
                        </li>
                    ))}
                </ul>
            ) : <p>Tidak ada produk yang sedang tren naik.</p>}
        </Card>
        <Card>
            <h4>{'❄️ Produk Kurang Laris (Belum Pernah Terjual)'}</h4>
            {analysisData.slowMovingProducts.length > 0 ? (
                <ul className="insight-list">
                    {analysisData.slowMovingProducts.slice(0, 5).map(name => <li key={name}>{name}</li>)}
                    {analysisData.slowMovingProducts.length > 5 && <li>dan lainnya...</li>}
                </ul>
            ) : <p>Semua produk pernah terjual. Kerja bagus!</p>}
        </Card>
      </div>

      <Card className="recommendation-card">
        <h4>{'📦 Rekomendasi Stok Cerdas'}</h4>
        <p>{recommendationText}</p>
      </Card>
    </div>
  );
};

export default AnalysisPage;