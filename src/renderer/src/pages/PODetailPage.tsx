/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/ban-ts-comment */

import React, { useState, useEffect } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { POHeader, POItem } from '../types'
import { ProgressBar } from '../components/ProgressBar' // [BARU] Impor ProgressBar

interface PODetailPageProps {
  po: POHeader | null
  onBackToList: () => void
  onShowHistory: () => void
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

  if (!po) {
    return (
      <div className="page-container">
        <p>Data PO tidak ditemukan.</p>
      </div>
    )
  }

  const formatDate = (d: string | undefined) => (d ? new Date(d).toLocaleDateString('id-ID') : '-')
  const getPriorityBadgeClass = (p: string | undefined) =>
    `status-badge ${(p || 'normal').toLowerCase()}`
  const getStatusBadgeClass = (s: string | undefined) =>
    `status-badge status-${(s || 'open').toLowerCase().replace(' ', '-')}`

  const handleOpenPdf = async () => {
    if (!po) return
    // @ts-ignore
    if (po.pdf_link && po.pdf_link.startsWith('http')) {
      alert('Membuka file dari Google Drive...')
      try {
        // @ts-ignore
        await window.api.openExternalLink(po.pdf_link)
      } catch (err) {
        alert(`Gagal membuka link: ${(err as Error).message}`)
      }
    } else {
      alert('Link file tidak ditemukan. Membuat preview lokal sementara...')
      try {
        const payload = {
          nomorPo: po.po_number,
          namaCustomer: po.project_name,
          created_at: po.created_at,
          deadline: po.deadline,
          priority: po.priority,
          items: items,
          notes: po.notes
        }
        // @ts-ignore
        await window.api.previewPO(payload)
      } catch (err) {
        console.error('Error saat preview lokal:', err)
        alert(`Gagal membuat preview lokal: ${(err as Error).message}`)
      }
    }
  }

  return (
    <div className="page-container">
      {/* BAGIAN ATAS (HEADER & INFO PO) - TIDAK DIUBAH SAMA SEKALI */}
      <div className="page-header">
        <div>
          <h1>Detail Purchase Order: {po.po_number}</h1>
          <p>Menampilkan informasi dan item versi terbaru.</p>
        </div>
        <div className="header-actions">
          <Button onClick={onBackToList}>Kembali ke Daftar</Button>
          <Button variant="secondary" onClick={onShowHistory}>
            📜 Lihat Riwayat Revisi
          </Button>
          <Button onClick={handleOpenPdf}>📄 Buka File</Button>
        </div>
      </div>

      <div className="detail-po-info">
        <Card className="po-summary-card">
          <div className="po-summary-header">
            <h3 className="po-summary-po-number">PO: {po.po_number}</h3>
            <span className={getStatusBadgeClass(po.status)}>{po.status || 'Open'}</span>
          </div>
          <p className="po-summary-customer">
            <strong>Customer:</strong> {po.project_name}
          </p>
          <div className="po-summary-grid">
            <div className="info-item">
              <label>Tanggal Input PO</label>
              <span>{formatDate(po.created_at)}</span>
            </div>
            <div className="info-item">
              <label>Target Kirim</label>
              <span>{formatDate(po.deadline)}</span>
            </div>
            <div className="info-item">
              <label>Prioritas</label>
              <span className={getPriorityBadgeClass(po.priority)}>{po.priority || '-'}</span>
            </div>
            <div className="info-item">
              <label>Total Kubikasi</label>
              <span>{po.kubikasi_total ? `${Number(po.kubikasi_total).toFixed(3)} m³` : '0.000 m³'}</span>
            </div>
          </div>
          <div className="po-summary-progress">
            <div className="progress-info">
              <label>Progress Produksi</label>
              <span>{po.progress?.toFixed(0) || 0}%</span>
            </div>
            <ProgressBar value={po.progress || 0} />
          </div>
        </Card>
        {po.notes && (
          <Card className="notes-card">
            <h4>Catatan PO</h4>
            <p>{po.notes}</p>
          </Card>
        )}
      </div>

      {/* [DIROMBAK] BAGIAN DAFTAR ITEM DIUBAH MENJADI TABEL */}
      <div className="item-section-header">
        <h2>Daftar Item (Versi Terbaru)</h2>
      </div>
      {isLoading ? (
        <p>⏳ Loading data item...</p>
      ) : items.length === 0 ? (
        <Card>
          <p>Tidak ada item terdaftar untuk PO ini.</p>
        </Card>
      ) : (
        <Card>
          <div className="table-responsive">
            <table className="item-table">
              <thead>
                <tr>
                  <th>Produk</th>
                  <th>Jenis Kayu</th>
                  <th>Profil</th>
                  <th>Warna</th>
                  <th>Finishing</th>
                  <th>Sample</th>
                  <th>Ukuran (mm)</th>
                  <th>Tipe Pjg</th>
                  <th>Qty</th>
                  <th>Catatan Item</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.product_name || '-'}</td>
                    <td>{item.wood_type || '-'}</td>
                    <td>{item.profile || '-'}</td>
                    <td>{item.color || '-'}</td>
                    <td>{item.finishing || '-'}</td>
                    <td>{item.sample || '-'}</td>
                    <td>{`${item.thickness_mm || 0} x ${item.width_mm || 0} x ${
                      item.length_mm || 0
                    }`}</td>
                    <td>{item.length_type || '-'}</td>
                    <td>{`${item.quantity || 0} ${item.satuan || ''}`}</td>
                    <td>{item.notes || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  )
}

export default PODetailPage