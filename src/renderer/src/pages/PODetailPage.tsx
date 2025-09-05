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
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null)
  const [items, setItems] = useState<POItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (po) {
      const fetchRevisions = async () => {
        setIsLoading(true)
        try {
          const revs = await window.api.listPORevisions(po.id)
          setRevisions(revs)
          if (revs.length > 0) {
            setSelectedRevisionId(revs[0].id)
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

  useEffect(() => {
    if (selectedRevisionId) {
      const fetchItemsForRevision = async () => {
        setIsLoading(true)
        try {
          const poItems = await window.api.listPOItemsByRevision(selectedRevisionId)
          setItems(poItems)
        } catch (error) {
          console.error(`Gagal memuat item untuk revisi ${selectedRevisionId}:`, error)
        } finally {
          setIsLoading(false)
        }
      }
      fetchItemsForRevision()
    }
  }, [selectedRevisionId])

  if (!po) {
    return (
      <div className="page-container">
        <p>Data PO tidak ditemukan.</p>
        <Button onClick={onBackToList}>Kembali ke Daftar</Button>
      </div>
    )
  }

  const currentRevision = revisions.find((r) => r.id === selectedRevisionId)

  // Helper untuk mendapatkan kelas badge prioritas
  const getPriorityBadgeClass = (priority: string | undefined) => {
    switch (priority) {
      case 'Urgent': return 'status-badge urgent';
      case 'High': return 'status-badge high';
      case 'Normal': return 'status-badge normal';
      default: return 'status-badge normal'; // Default jika tidak ada
    }
  };

  // Helper untuk mendapatkan kelas badge status
  const getStatusBadgeClass = (status: string | undefined) => {
    switch (status) {
      case 'Open': return 'status-badge status-open';
      case 'In Progress': return 'status-badge status-in-progress';
      case 'Completed': return 'status-badge status-completed';
      case 'Cancelled': return 'status-badge status-cancelled';
      default: return 'status-badge status-open';
    }
  };


  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Detail Purchase Order: {po.po_number}</h1>
          <p>Informasi lengkap dan daftar item untuk PO ini.</p>
        </div>
        <Button onClick={onBackToList}>Kembali</Button>
      </div>

      <div className="detail-po-info"> {/* Wrapper baru untuk layout yang lebih baik */}
        <Card className="po-summary-card"> {/* Gunakan kelas untuk styling khusus */}
            <div className="po-summary-header">
                <h3 className="po-summary-po-number">PO: {po.po_number}</h3>
                <span className={getStatusBadgeClass(currentRevision?.status || po.status)}>
                  {currentRevision?.status || po.status || 'Open'}
                </span>
            </div>
            <p className="po-summary-customer">
                <strong>Customer:</strong> {po.project_name}
            </p>

            <div className="po-summary-grid">
                <div className="info-item">
                    <label>Tanggal Input PO</label>
                    <span>{po.created_at ? new Date(po.created_at).toLocaleDateString('id-ID') : '-'}</span>
                </div>
                <div className="info-item">
                    <label>Target Kirim</label>
                    <span>{currentRevision?.deadline ? new Date(currentRevision.deadline).toLocaleDateString('id-ID') : '-'}</span>
                </div>
                <div className="info-item">
                    <label>Prioritas</label>
                    <span className={getPriorityBadgeClass(currentRevision?.priority)}>{currentRevision?.priority || '-'}</span>
                </div>
            </div>
        </Card>

        {currentRevision?.notes && (
          <Card className="notes-card"> {/* Kartu terpisah untuk catatan */}
            <h4>Catatan Revisi #{currentRevision.revision_number}</h4>
            <p>{currentRevision.notes}</p>
          </Card>
        )}
      </div>

      <div className="item-section-header">
        <h2>Daftar Item</h2>
        <div className="form-group">
          <label htmlFor="revision-select">Tampilkan Histori:</label>
          <select
            id="revision-select"
            value={selectedRevisionId || ''}
            onChange={(e) => setSelectedRevisionId(e.target.value)}
            disabled={revisions.length === 0}
          >
            {revisions.map((rev) => (
              <option key={rev.id} value={rev.id}>
                Revisi #{rev.revision_number} ({new Date(rev.created_at).toLocaleString('id-ID')})
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-spinner">⏳ Loading data item...</div>
      ) : items.length === 0 ? (
        <Card>
          <p>Tidak ada item terdaftar untuk revisi ini.</p>
        </Card>
      ) : (
        items.map((item, index) => (
          <Card key={item.id} className="item-card">
            <div className="item-card-header">
              <h4>Item #{index + 1}: {item.product_name}</h4>
            </div>
            <div className="form-grid">
              <Input label="Produk ID" value={item.product_id} disabled />
              <Input label="Jenis Kayu" value={item.wood_type} disabled />
              <Input label="Profil" value={item.profile} disabled />
              <Input label="Warna" value={item.color} disabled />
              <Input label="Finishing" value={item.finishing} disabled />
              <Input label="Tebal (mm)" value={item.thickness_mm} disabled />
              <Input label="Lebar (mm)" value={item.width_mm} disabled />
              <Input label="Panjang (mm)" value={item.length_mm} disabled />
              <Input label="Qty" value={`${item.quantity} ${item.satuan}`} disabled />
              <Input label="Catatan Item" value={item.notes || '-'} disabled />
            </div>
          </Card>
        ))
      )}
    </div>
  )
}

export default PODetailPage