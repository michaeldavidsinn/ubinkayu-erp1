/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable prettier/prettier */
// src/renderer/src/pages/PODetailPage.tsx

import React, { useState, useEffect } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { POHeader, PORevision, POItem } from '../types'

interface PODetailPageProps {
  po: POHeader | null
  onBackToList: () => void
}

const PODetailPage: React.FC<PODetailPageProps> = ({ po, onBackToList }) => {
  const [revisions, setRevisions] = useState<PORevision[]>([])
  const [selectedRevisionNumber, setSelectedRevisionNumber] = useState<string | null>(null)
  const [items, setItems] = useState<POItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Hook #1: Mengambil daftar revisi saat PO berubah
  useEffect(() => {
    if (po?.id) {
      const fetchRevisions = async () => {
        setItems([])
        setIsLoading(true)
        try {
          // @ts-ignore
          const revs = await window.api.listPORevisions(po.id)
          setRevisions(revs)
          if (revs && revs.length > 0) {
            setSelectedRevisionNumber(revs[0].revision_number)
          } else {
            setIsLoading(false)
          }
        } catch (error) {
          console.error('Gagal memuat daftar revisi:', error)
          setIsLoading(false)
        }
      }
      fetchRevisions()
    }
  }, [po])

  // Hook #2: Mengambil item setelah nomor revisi valid dipilih
  useEffect(() => {
    if (po?.id && selectedRevisionNumber !== null && typeof selectedRevisionNumber !== 'undefined') {
      const fetchItemsForRevision = async () => {
        setIsLoading(true) // Set loading saat kita mulai fetching item
        try {
          // @ts-ignore
          const poItems = await window.api.listPOItemsByRevision(po.id, selectedRevisionNumber)
          setItems(poItems)
        } catch (error) {
          console.error(`Gagal memuat item untuk revisi ${selectedRevisionNumber}:`, error)
        } finally {
          setIsLoading(false) // Set loading selesai setelah fetch berhasil atau gagal
        }
      }
      fetchItemsForRevision()
    }
  }, [selectedRevisionNumber, po?.id])

  if (!po) return (<div className="page-container"><p>Data PO tidak ditemukan.</p></div>);

  const currentRevision = revisions.find((r) => r.revision_number === selectedRevisionNumber)
  const formatDate = (d: string | undefined) => d ? new Date(d).toLocaleDateString('id-ID') : '-';
  const formatDateTime = (d: string | undefined) => d ? new Date(d).toLocaleString('id-ID') : 'No Date';
  const getPriorityBadgeClass = (p: string | undefined) => `status-badge ${(p || 'normal').toLowerCase()}`;
  const getStatusBadgeClass = (s: string | undefined) => `status-badge status-${(s || 'open').toLowerCase().replace(' ', '-')}`;

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Detail Purchase Order: {po.po_number}</h1><p>Informasi lengkap dan daftar item untuk PO ini.</p></div>
        <div className="header-actions"><Button onClick={onBackToList}>Kembali</Button><Button variant="secondary">◎ Preview PDF</Button></div>
      </div>
      <div className="detail-po-info">
        <Card className="po-summary-card">
          <div className="po-summary-header"><h3 className="po-summary-po-number">PO: {po.po_number}</h3><span className={getStatusBadgeClass(currentRevision?.status || po.status)}>{currentRevision?.status || po.status || 'Open'}</span></div>
          <p className="po-summary-customer"><strong>Customer:</strong> {po.project_name}</p>
          <div className="po-summary-grid">
            <div className="info-item"><label>Tanggal Input PO</label><span>{formatDate(po.created_at)}</span></div>
            <div className="info-item"><label>Target Kirim</label><span>{formatDate(currentRevision?.deadline)}</span></div>
            <div className="info-item"><label>Prioritas</label><span className={getPriorityBadgeClass(currentRevision?.priority)}>{currentRevision?.priority || '-'}</span></div>
            <div className="info-item"><label>Total Kubikasi</label><span>{po.kubikasi_total ? `${Number(po.kubikasi_total).toFixed(3)} m³` : '0.000 m³'}</span></div>
          </div>
        </Card>
        {currentRevision?.notes && (<Card className="notes-card"><h4>Catatan Revisi #{currentRevision.revision_number}</h4><p>{currentRevision.notes}</p></Card>)}
      </div>
      <div className="item-section-header">
        <h2>Daftar Item</h2>
        <div className="form-group">
          <label htmlFor="revision-select">Tampilkan Histori:</label>
          <select id="revision-select" value={selectedRevisionNumber || ''} onChange={(e) => setSelectedRevisionNumber(e.target.value)} disabled={revisions.length === 0}>
            {revisions.map((rev) => (<option key={rev.id} value={rev.revision_number}>Revisi #{rev.revision_number} ({formatDateTime(rev.created_at)})</option>))}
          </select>
        </div>
      </div>
      {isLoading ? (<p>⏳ Loading data item...</p>) : items.length === 0 ? (<Card><p>Tidak ada item terdaftar untuk revisi ini.</p></Card>) : (
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