/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import React, { useState, useEffect } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { POHeader } from '../types'
import { formatDistanceToNow } from 'date-fns';
import { id } from 'date-fns/locale';

// Helper untuk format waktu "5 menit yang lalu"
const formatTimeAgo = (dateString: string) => {
    try {
        return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: id });
    } catch (error) {
        return dateString;
    }
}

const ProgressBar = ({ value }: { value: number }) => (
  <div className="progress-bar-container">
    <div className="progress-bar-fill" style={{ width: `${value}%` }} />
  </div>
)

const POTrackingItem = ({ po, onUpdateClick }: { po: POHeader; onUpdateClick: (po: POHeader) => void }) => {
  const getPriorityBadgeClass = (priority?: string) => `status-badge ${(priority || 'normal').toLowerCase()}`

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
          <span>Target: {po.deadline ? new Date(po.deadline).toLocaleDateString('id-ID') : '-'}</span>
        </div>
        <Button onClick={() => onUpdateClick(po)}>Update Progress</Button>
      </div>
    </Card>
  )
}

// [BARU] Komponen untuk menampilkan satu entri update
const UpdateEntry = ({ update }) => (
    <div className="update-entry">
        <div className="update-icon">⚙️</div>
        <div className="update-details">
            <p className="update-text">
                Item <strong>{update.item_name}</strong> (PO: {update.po_number}) masuk tahap <strong>{update.stage}</strong>.
            </p>
            <span className="update-time">{formatTimeAgo(update.created_at)}</span>
        </div>
    </div>
);


interface ProgressTrackingPageProps {
  onSelectPO: (po: POHeader) => void;
}

const ProgressTrackingPage: React.FC<ProgressTrackingPageProps> = ({ onSelectPO }) => {
  const [poList, setPoList] = useState<POHeader[]>([])
  const [recentUpdates, setRecentUpdates] = useState<any[]>([]); // State untuk update terbaru
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchAllData = async () => {
      setIsLoading(true)
      try {
        // Panggil kedua API secara bersamaan
        // @ts-ignore
        const [poData, updateData] = await Promise.all([
            window.api.getActivePOs(),
            window.api.getRecentUpdates()
        ]);
        setPoList(poData)
        setRecentUpdates(updateData)
      } catch (err) {
        console.error('Gagal memuat data tracking:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchAllData()
  }, [])

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Tracking Progress Produksi</h1>
          <p>Pantau dan update kemajuan pengerjaan Purchase Order</p>
        </div>
      </div>

      <div className="tracking-layout">
        <div className="active-po-list">
          <h3>PO Aktif ({poList.length})</h3>
          {isLoading ? (
            <p>Memuat data PO...</p>
          ) : poList.length > 0 ? (
            poList.map((po) => <POTrackingItem key={po.id} po={po} onUpdateClick={onSelectPO} />)
          ) : (
            <p>Tidak ada PO yang sedang aktif.</p>
          )}
        </div>
        <div className="recent-updates">
          <Card className="recent-updates-card">
            <h4>Update Terbaru</h4>
            {isLoading ? (
                <p>Memuat aktivitas...</p>
            ) : recentUpdates.length > 0 ? (
                <div className="updates-list">
                    {recentUpdates.map(update => <UpdateEntry key={update.id} update={update} />)}
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