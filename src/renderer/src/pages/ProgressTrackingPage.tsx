// src/renderer/src/pages/ProgressTrackingPage.tsx

import React, { useState, useEffect } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { POHeader } from '../types'

const ProgressBar = ({ value }: { value: number }) => (
  <div className="progress-bar-container">
    <div className="progress-bar-fill" style={{ width: `${value}%` }} />
  </div>
)

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

interface ProgressTrackingPageProps {
  onSelectPO: (po: POHeader) => void
}

const ProgressTrackingPage: React.FC<ProgressTrackingPageProps> = ({ onSelectPO }) => {
  const [poList, setPoList] = useState<POHeader[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const fetchPOs = async () => {
      setIsLoading(true)
      try {
        // @ts-ignore
        const data = await window.api.getActivePOs()
        setPoList(data)
      } catch (err) {
        console.error('Gagal memuat PO aktif:', err)
      } finally {
        setIsLoading(false)
      }
    }
    fetchPOs()
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
          ) : (
            poList.map((po) => <POTrackingItem key={po.id} po={po} onUpdateClick={onSelectPO} />)
          )}
        </div>
        <div className="recent-updates">
          <Card className="recent-updates-card">
            <h4>Update Terbaru</h4>
            <p className="no-updates-text">Fitur ini sedang dalam pengembangan.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ProgressTrackingPage
