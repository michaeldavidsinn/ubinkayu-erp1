/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable prettier/prettier */

import React, { useState, useEffect } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { POHeader, POItem } from '../types'

interface PODetailPageProps {
  po: POHeader | null
  onBackToList: () => void
  onShowHistory: () => void; // <-- [BARU] Prop untuk navigasi
}

// [MODIFIKASI] Hapus semua kode yang berhubungan dengan 'revisionHistory' dari halaman ini
const PODetailPage: React.FC<PODetailPageProps> = ({ po, onBackToList, onShowHistory }) => {
  const [items, setItems] = useState<POItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Efek ini sekarang hanya mengambil item TERBARU saja
    if (po?.id) {
      const fetchLatestItems = async () => {
        setIsLoading(true)
        try {
          // @ts-ignore
          const poItems = await window.api.listPOItems(po.id)
          setItems(poItems)
        } catch (error) {
          console.error(`Gagal memuat item untuk PO ${po.id}:`, error)
        } finally {
          setIsLoading(false)
        }
      }
      fetchLatestItems()
    }
  }, [po])

  if (!po) return (<div className="page-container"><p>Data PO tidak ditemukan.</p></div>);

  // Helper functions dan handlePreviewPO tetap sama...
  const formatDate = (d: string | undefined) => d ? new Date(d).toLocaleDateString('id-ID') : '-';
  const getPriorityBadgeClass = (p: string | undefined) => `status-badge ${(p || 'normal').toLowerCase()}`;
  const getStatusBadgeClass = (s: string | undefined) => `status-badge status-${(s || 'open').toLowerCase().replace(' ', '-')}`;

  const handlePreviewPO = async () => {
    if (!po || items.length === 0) {
      alert('Data PO atau item belum siap untuk dipreview.');
      return;
    }
    try {
      const payload = {
        nomorPo: po.po_number,
        namaCustomer: po.project_name,
        created_at: po.created_at,
        deadline: po.deadline,
        priority: po.priority,
        items: items,
        notes: po.notes,
      };
      // @ts-ignore
      await window.api.previewPO(payload);
    } catch (err) {
      console.error('Error saat preview PDF:', err);
      alert(`Gagal membuat preview PDF: ${(err as Error).message}`);
    }
  };


  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Detail Purchase Order: {po.po_number}</h1><p>Menampilkan informasi dan item versi terbaru.</p></div>
        <div className="header-actions">
          <Button onClick={onBackToList}>Kembali ke Daftar</Button>
          {/* [BARU] Tombol untuk ke halaman histori */}
          <Button variant="secondary" onClick={onShowHistory}>📜 Lihat Riwayat Revisi</Button>
          <Button variant="secondary" onClick={handlePreviewPO}>◎ Preview PDF</Button>
        </div>
      </div>

      {/* Tampilan Detail dan Item (TETAP SAMA SEPERTI KODE ASLI ANDA) */}
      <div className="detail-po-info">
        <Card className="po-summary-card">
          <div className="po-summary-header"><h3 className="po-summary-po-number">PO: {po.po_number}</h3><span className={getStatusBadgeClass(po.status)}>{po.status || 'Open'}</span></div>
          <p className="po-summary-customer"><strong>Customer:</strong> {po.project_name}</p>
          <div className="po-summary-grid">
            <div className="info-item"><label>Tanggal Input PO</label><span>{formatDate(po.created_at)}</span></div>
            <div className="info-item"><label>Target Kirim</label><span>{formatDate(po.deadline)}</span></div>
            <div className="info-item"><label>Prioritas</label><span className={getPriorityBadgeClass(po.priority)}>{po.priority || '-'}</span></div>
            <div className="info-item"><label>Total Kubikasi</label><span>{po.kubikasi_total ? `${Number(po.kubikasi_total).toFixed(3)} m³` : '0.000 m³'}</span></div>
          </div>
        </Card>
        {po.notes && (<Card className="notes-card"><h4>Catatan PO</h4><p>{po.notes}</p></Card>)}
      </div>
      <div className="item-section-header">
        <h2>Daftar Item (Versi Terbaru)</h2>
      </div>
      {isLoading ? (<p>⏳ Loading data item...</p>) : items.length === 0 ? (<Card><p>Tidak ada item terdaftar untuk PO ini.</p></Card>) : (
        items.map((item, index) => (
          <Card key={item.id || index} className="item-card">
            <div className="item-card-header"><h4>Item #{index + 1}: {item.product_name}</h4></div>
            <div className="form-grid">
              {Object.entries({'Produk ID': item.product_id, 'Jenis Kayu': item.wood_type, 'Profil': item.profile, 'Warna': item.color,'Finishing': item.finishing, 'Sample': item.sample, 'Marketing': item.marketing, 'Tebal (mm)': item.thickness_mm,'Lebar (mm)': item.width_mm, 'Panjang (mm)': item.length_mm, 'Qty': `${item.quantity || 0} ${item.satuan || ''}`,'Catatan Item': item.notes, 'Length Type': item.length_type, 'Lokasi': item.location,'Kubikasi (m³)': (Number(item.kubikasi) || 0).toFixed(3)}).map(([label, value]) => <Input key={label} label={label} value={value || (label.includes('mm') || label.includes('Qty') ? 0 : '-')} disabled />)}
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

export default PODetailPage;