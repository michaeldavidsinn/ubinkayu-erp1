/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prettier/prettier */
// src/renderer/src/pages/ProgressTrackingPage.tsx

import React from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'

// Komponen kecil untuk Progress Bar
const ProgressBar = ({ value }: { value: number }) => (
  <div className="progress-bar-container">
    <div className="progress-bar-fill" style={{ width: `${value}%` }} />
  </div>
)

// Komponen untuk setiap item di daftar PO Aktif
const POTrackingItem = ({ po }: { po: any }) => {
    const getPriorityBadgeClass = (priority: string | undefined) => {
        switch (priority) {
            case 'Urgent': return 'status-badge urgent';
            case 'High': return 'status-badge high';
            default: return 'status-badge normal';
        }
    };

    return (
        <Card className="po-tracking-item-card">
            <div className="po-tracking-header">
                <div>
                    <span className="po-tracking-number">{po.po_number}</span>
                    <p className="po-tracking-customer">{po.project_name}</p>
                </div>
                <span className={getPriorityBadgeClass(po.priority)}>{po.priority}</span>
            </div>
            <div className="po-tracking-progress">
                <span>Progress</span>
                <span>{po.progress}%</span>
            </div>
            <ProgressBar value={po.progress} />
            <div className="po-tracking-footer">
                <div className="po-tracking-deadline">
                    <span>Target: {new Date(po.deadline).toLocaleDateString('id-ID')}</span>
                    {po.is_overdue && <span className="status-badge overdue">Terlambat</span>}
                </div>
                <div className="po-tracking-actions">
                    <Button variant="secondary">Update Progress</Button>
                    <Button variant="icon">📄</Button> {/* Ganti dengan ikon history */}
                </div>
            </div>
        </Card>
    );
};

// Komponen untuk setiap item di daftar Perhatian
const AttentionItem = ({ po }: { po: any }) => (
    <div className="attention-item">
        <div className="attention-info">
            <span className="attention-po-number">{po.po_number}</span>
            <span className="attention-customer">{po.project_name}</span>
            <span className="attention-deadline">Target: {new Date(po.deadline).toLocaleDateString('id-ID')}</span>
        </div>
        <div className="attention-progress">
            <span>Progress: {po.progress}%</span>
            <a href="#">Update</a>
        </div>
    </div>
);


const ProgressTrackingPage = ({ poList }: { poList: any[] }) => {
  // Filter PO yang butuh perhatian (misal: progress 0% atau terlambat)
  const attentionPOs = poList.filter(po => po.progress < 10 || po.is_overdue);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Tracking Progress Produksi</h1>
          <p>Pantau dan update kemajuan pengerjaan Purchase Order</p>
        </div>
        <Button>+ Update Progress</Button>
      </div>

      {/* Bagian Perhatian */}
      <Card className="attention-card">
        <h4>Perhatian: PO Urgent ({attentionPOs.length})</h4>
        <div className="attention-list">
            {attentionPOs.map(po => <AttentionItem key={po.id} po={po} />)}
        </div>
      </Card>

      {/* Konten Utama */}
      <div className="tracking-layout">
        <div className="active-po-list">
          <h3>PO Aktif ({poList.length})</h3>
          {poList.map((po) => <POTrackingItem key={po.id} po={po} />)}
        </div>
        <div className="recent-updates">
          <Card className="recent-updates-card">
            <h4>Update Terbaru</h4>
            <p className="no-updates-text">Belum ada update progress.</p>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default ProgressTrackingPage