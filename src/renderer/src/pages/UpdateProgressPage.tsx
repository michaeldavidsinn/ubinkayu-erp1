/* eslint-disable react/prop-types */
// src/renderer/src/pages/UpdateProgressPage.tsx

import React, { useState, useEffect } from 'react'
import { POHeader, POItem } from '../types'
import { Button } from '../components/Button'
import { Card } from '../components/Card'

// Helper untuk menampilkan tanggal
const formatDate = (d) => new Date(d).toLocaleString('id-ID')

// Komponen untuk satu item PO
const ProgressItem = ({ item, poNumber, onUpdate }) => {
  const stages = ['supply', 'produksi']
  if (item.sample === 'Ada sample') {
    stages.push('sample')
  }
  stages.push('selesai')

  const latestStage = item.progressHistory?.[item.progressHistory.length - 1]?.stage
  const currentStageIndex = latestStage ? stages.indexOf(latestStage) : -1

  const [notes, setNotes] = useState('')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleUpdate = async (nextStage) => {
    if (!notes && !photoFile) {
      return alert('Harap isi catatan atau unggah foto.')
    }
    setIsUpdating(true)
    try {
      const payload = {
        itemId: item.id,
        poNumber: poNumber,
        stage: nextStage,
        notes: notes,
        photoPath: photoFile?.path // Electron bisa mengakses path file
      }
      // @ts-ignore
      const result = await window.api.updateItemProgress(payload)
      if (result.success) {
        alert(`Progress item ${item.product_name} berhasil diupdate ke tahap '${nextStage}'!`)
        onUpdate() // Panggil fungsi untuk refresh data
        setNotes('')
        setPhotoFile(null)
      } else {
        throw new Error(result.error)
      }
    } catch (err) {
      alert(`Gagal update progress: ${(err as Error).message}`)
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card className="item-card">
      <div className="item-card-header">
        <h4>{item.product_name} ({item.wood_type})</h4>
        <span>Qty: {item.quantity} {item.satuan}</span>
      </div>
      <div className="progress-timeline">
        {stages.map((stage, index) => (
          <div key={stage} className={`stage ${index <= currentStageIndex ? 'completed' : ''}`}>
            <div className="stage-dot"></div>
            <div className="stage-name">{stage}</div>
          </div>
        ))}
      </div>
      {currentStageIndex < stages.length - 1 && (
        <div className="update-form">
          <h5>Update ke Tahap Berikutnya: {stages[currentStageIndex + 1]}</h5>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Tambahkan catatan..."
            rows={3}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => e.target.files && setPhotoFile(e.target.files[0])}
          />
          <Button
            onClick={() => handleUpdate(stages[currentStageIndex + 1])}
            disabled={isUpdating}
          >
            {isUpdating ? 'Menyimpan...' : 'Simpan Progress'}
          </Button>
        </div>
      )}
      {item.progressHistory && item.progressHistory.length > 0 && (
         <div className="history-log">
            <h6>Riwayat Progress</h6>
            {item.progressHistory.map(log => (
                <div key={log.id} className="log-entry">
                    <p><strong>{log.stage}</strong> ({formatDate(log.created_at)})</p>
                    <p>{log.notes}</p>
                    {log.photo_url && <a href={log.photo_url} target="_blank" rel="noopener noreferrer">Lihat Foto</a>}
                </div>
            ))}
         </div>
      )}
    </Card>
  )
}


interface UpdateProgressPageProps {
  po: POHeader | null
  onBack: () => void
}

const UpdateProgressPage: React.FC<UpdateProgressPageProps> = ({ po, onBack }) => {
  const [items, setItems] = useState<POItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const fetchItems = async () => {
    if (po?.id) {
      setIsLoading(true)
      try {
        // @ts-ignore
        const fetchedItems = await window.api.getPOItemsDetails(po.id)
        setItems(fetchedItems)
      } catch (err) {
        console.error('Gagal memuat item:', err)
      } finally {
        setIsLoading(false)
      }
    }
  }

  useEffect(() => {
    fetchItems()
  }, [po])

  if (!po) {
    return (
      <div className="page-container">
        <p>Pilih PO untuk diupdate.</p>
        <Button onClick={onBack}>Kembali</Button>
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Update Progress: PO {po.po_number}</h1>
          <p>Customer: {po.project_name}</p>
        </div>
        <Button onClick={onBack}>Kembali ke Daftar Tracking</Button>
      </div>

      {isLoading ? (
        <p>Memuat item...</p>
      ) : (
        items.map((item) => <ProgressItem key={item.id} item={item} poNumber={po.po_number} onUpdate={fetchItems} />)
      )}
    </div>
  )
}

export default UpdateProgressPage