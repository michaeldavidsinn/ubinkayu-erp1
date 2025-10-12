/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import React, { useState, useEffect, useMemo } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { ProgressBar } from '../components/ProgressBar'
import { POHeader } from '../types'
import { formatDistanceToNow } from 'date-fns'
import { id } from 'date-fns/locale'
import * as apiService from '../apiService'

// Helper untuk format waktu "5 menit yang lalu"
const formatTimeAgo = (dateString: string) => {
  try {
    return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: id })
  } catch (error) {
    return dateString
  }
}

const POTrackingItem = ({
  po,
  onUpdateClick
}: {
  po: POHeader
  onUpdateClick: (po: POHeader) => void
}) => {
  const getPriorityBadgeClass = (priority?: string) =>
    `status-badge ${(priority || 'normal').toLowerCase()}`
  return (
    <Card className="po-tracking-item-card">
      <div className="po-tracking-header">
        <div>
          <span className="po-tracking-number">{po.po_number}</span>
          <p className="po-tracking-customer">{po.project_name}</p>
        </div>
        <span className={getPriorityBadgeClass(po.priority)}>{po.priority || 'Normal'}</span>
      </div>
      <div className="po-tracking-progress">
        <span>Progress</span>
        <span>{po.progress?.toFixed(0) || 0}%</span>
      </div>
      <ProgressBar value={po.progress || 0} />
      <div className="po-tracking-footer">
        <div className="po-tracking-deadline">
          <span>
            Target: {po.deadline ? new Date(po.deadline).toLocaleDateString('id-ID') : '-'}
          </span>
        </div>
        <Button onClick={() => onUpdateClick(po)}>Update Progress</Button>
      </div>
    </Card>
  )
}

// Komponen untuk panel "Perlu Perhatian"
const AttentionCard = ({ title, items, icon, reasonKey, reasonPrefix }) => (
  <div className="attention-section">
    <h5>
      {icon} {title} ({items.length})
    </h5>
    {items.length > 0 ? (
      items.map((item, index) => (
        <div key={index} className="attention-item-small">
          <p>
            <strong>{item.item_name}</strong> (PO: {item.po_number})
          </p>
          <span>
            {reasonPrefix}: {item[reasonKey]}
          </span>
        </div>
      ))
    ) : (
      <p className="no-attention-text">Tidak ada</p>
    )}
  </div>
)

// [DIKEMBALIKAN] Komponen untuk menampilkan satu entri update terbaru
const UpdateEntry = ({ update }) => (
  <div className="update-entry">
    <div className="update-icon">⚙️</div>
    <div className="update-details">
      <p className="update-text">
        Item <strong>{update.item_name}</strong> (PO: {update.po_number}) masuk tahap{' '}
        <strong>{update.stage}</strong>.
      </p>
      <span className="update-time">{formatTimeAgo(update.created_at)}</span>
    </div>
  </div>
)

interface ProgressTrackingPageProps {
  onSelectPO: (po: POHeader) => void
}

const ProgressTrackingPage: React.FC<ProgressTrackingPageProps> = ({ onSelectPO }) => {
  const [poList, setPoList] = useState<POHeader[]>([])
  const [attentionData, setAttentionData] = useState({
    nearingDeadline: [],
    stuckItems: [],
    urgentItems: []
  })
  const [recentUpdates, setRecentUpdates] = useState<any[]>([]) // [DIKEMBALIKAN] State untuk update terbaru
  const [isLoading, setIsLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true)
      try {
        // [DIKEMBALIKAN] Panggil ketiga API secara bersamaan
        // @ts-ignore
        const [poData, attention, updates] = await Promise.all([
          apiService.getActivePOsWithProgress(), // <-- CORRECT NAME
          apiService.getAttentionData(),
          apiService.getRecentProgressUpdates() // <-- CORRECT NAME
      ]);
        setPoList(poData)
        setAttentionData(attention)
        setRecentUpdates(updates)
      } catch (err) {
        console.error('Gagal memuat data tracking:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAllData()
  }, [])

  const filteredPOs = useMemo(() => {
    if (!searchTerm) return poList
    return poList.filter(
      (po) =>
        po.po_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
        po.project_name.toLowerCase().includes(searchTerm.toLowerCase())
    )
  }, [poList, searchTerm])

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Tracking Progress Produksi</h1>
          <p>Pantau dan update kemajuan pengerjaan Purchase Order</p>
        </div>
      </div>

      <Card className="filter-panel-simple">
        <input
          type="text"
          placeholder="Cari Nomor PO atau Nama Customer..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input-full"
        />
      </Card>

      <div className="tracking-layout">
        <div className="active-po-list">
          {/* Bungkus semuanya di dalam Card agar konsisten */}
          <Card>
            <h3>PO Aktif ({filteredPOs.length})</h3>
            {isLoading ? (
              <p>Memuat data PO...</p>
            ) : filteredPOs.length > 0 ? (
              // Beri div wrapper agar bisa diberi jarak
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {filteredPOs.map((po) => (
                  <POTrackingItem key={po.id} po={po} onUpdateClick={onSelectPO} />
                ))}
              </div>
            ) : (
              <p>Tidak ada PO yang cocok dengan pencarian.</p>
            )}
          </Card>
        </div>
        <div className="recent-updates">
          <Card className="recent-updates-card">
            <h4>🚨 Perlu Perhatian</h4>
            <div className="attention-wrapper">
              <AttentionCard
                title="Prioritas Urgent"
                items={attentionData.urgentItems}
                icon="🔥"
                reasonKey="current_stage"
                reasonPrefix="Tahap"
              />
              <AttentionCard
                title="Mendekati Deadline"
                items={attentionData.nearingDeadline}
                icon="📅"
                reasonKey="deadline"
                reasonPrefix="Target"
              />
              <AttentionCard
                title="Item Macet (> 5 Hari)"
                items={attentionData.stuckItems}
                icon="⏳"
                reasonKey="current_stage"
                reasonPrefix="Tahap"
              />
            </div>
          </Card>

          {/* [DIKEMBALIKAN] Kartu untuk Update Terbaru diletakkan di bawah */}
          <Card className="recent-updates-card" style={{ marginTop: '1.5rem' }}>
            <h4>Update Terbaru</h4>
            {isLoading ? (
              <p>Memuat aktivitas...</p>
            ) : recentUpdates.length > 0 ? (
              <div className="updates-list">
                {recentUpdates.map((update) => (
                  <UpdateEntry key={update.id} update={update} />
                ))}
              </div>
            ) : (
              <p className="no-updates-text">Belum ada update progress terbaru.</p>
            )}
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ProgressTrackingPage
