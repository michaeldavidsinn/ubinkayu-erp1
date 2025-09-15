// File: src/renderer/src/pages/PODetailPage.tsx

import React, { useState, useEffect } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { POHeader, POItem } from '../types'

interface PODetailPageProps {
  po: POHeader | null
  onBackToList: () => void
  onShowHistory: () => void;
}

const PODetailPage: React.FC<PODetailPageProps> = ({ po, onBackToList, onShowHistory }) => {
  const [items, setItems] = useState<POItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
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

  const formatDate = (d: string | undefined) => d ? new Date(d).toLocaleDateString('id-ID') : '-';
  const getPriorityBadgeClass = (p: string | undefined) => `status-badge ${(p || 'normal').toLowerCase()}`;
  const getStatusBadgeClass = (s: string | undefined) => `status-badge status-${(s || 'open').toLowerCase().replace(' ', '-')}`;

  // [MODIFIKASI] Fungsi untuk handle tombol "Buka PDF"
  const handleOpenPdf = async () => {
    if (!po) return;

    // Prioritaskan membuka link dari Google Drive
    // @ts-ignore
    if (po.pdf_link && po.pdf_link.startsWith('http')) {
      alert('Membuka PDF dari Google Drive...');
      try {
        // @ts-ignore
        await window.api.openExternalLink(po.pdf_link);
      } catch (err) {
        alert(`Gagal membuka link: ${(err as Error).message}`);
      }
    } else {
      // Fallback untuk data lama atau jika upload gagal: generate preview lokal
      alert('Link PDF tidak ditemukan di database. Membuat preview lokal sementara...');
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
        console.error('Error saat preview PDF lokal:', err);
        alert(`Gagal membuat preview PDF lokal: ${(err as Error).message}`);
      }
    }
  };


  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Detail Purchase Order: {po.po_number}</h1><p>Menampilkan informasi dan item versi terbaru.</p></div>
        <div className="header-actions">
          <Button onClick={onBackToList}>Kembali ke Daftar</Button>
          <Button variant="secondary" onClick={onShowHistory}>📜 Lihat Riwayat Revisi</Button>

          {/* [MODIFIKASI] Tombol Preview diubah menjadi Buka PDF */}
          <Button onClick={handleOpenPdf}>📄 Buka PDF</Button>
        </div>
      </div>

      <div className="detail-po-info">
        {/* ... (sisa JSX Anda untuk menampilkan detail, tidak perlu diubah) ... */}
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