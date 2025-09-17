/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/ban-ts-comment */

import React, { useState, useEffect } from 'react'
import { POHeader, POItem } from '../types'
import { Button } from '../components/Button'
import { Card } from '../components/Card'

// Helper untuk menampilkan tanggal
const formatDate = (d: string) => new Date(d).toLocaleString('id-ID')

// Komponen untuk satu item PO
const ProgressItem = ({ item, poId, poNumber, onUpdate }: { item: POItem, poId: string, poNumber: string, onUpdate: () => void }) => {
  const stages = ['Pembahanan'];
  if (item.sample === 'Ada sample') {
    stages.push('Kasih Sample');
  }
  stages.push('Start Produksi');
  stages.push('Kirim');

  const latestStage = item.progressHistory?.[item.progressHistory.length - 1]?.stage
  const currentStageIndex = latestStage ? stages.indexOf(latestStage) : -1

  const [notes, setNotes] = useState('')

  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false)

const handleCancelPhoto = () => {
    setPhotoPath(null);
  };

  const handleViewPhoto = (url: string) => {
    // @ts-ignore
    window.api.openExternalLink(url);
  };

   const handleSelectPhoto = async () => {
    // @ts-ignore
    const selectedPath = await window.api.openFileDialog();
    if (selectedPath) {
      setPhotoPath(selectedPath);
    }
  };

  const handleUpdate = async (nextStage: string) => {
    if (!notes && !photoPath) {
      return alert('Harap isi catatan atau unggah foto.');
    }
    setIsUpdating(true);
    try {
      const payload = {
        poId: poId,
        itemId: item.id,
        poNumber: poNumber,
        stage: nextStage,
        notes: notes,
        // [PERBAIKAN] Kirim path yang sudah kita simpan di state
        photoPath: photoPath
      };
      // @ts-ignore
      const result = await window.api.updateItemProgress(payload);
      if (result.success) {
        alert(`Progress item ${item.product_name} berhasil diupdate ke tahap '${nextStage}'!`);
        onUpdate();
        setNotes('');
        setPhotoPath(null); // Reset path foto
      } else {
        throw new Error(result.error);
      }
    } catch (err) {
      alert(`Gagal update progress: ${(err as Error).message}`);
    } finally {
      setIsUpdating(false);
    }
  };

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
          {/* [MODIFIKASI] Tampilan input file diubah menjadi kondisional */}
          <div className="file-input-container">
            {photoPath ? (
              <div className="file-preview">
                <span className="file-name" title={photoPath}>
                  {photoPath.split(/[/\\]/).pop()}
                </span>
                <Button variant="secondary" onClick={handleCancelPhoto} className="cancel-photo-btn">
                  Batal
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={handleSelectPhoto}>Pilih Foto</Button>
            )}
          </div>
          {/* [PERBAIKAN] Ganti input file dengan tombol */}
         
          
          <Button
            onClick={() => handleUpdate(stages[currentStageIndex + 1])}
            disabled={isUpdating}
             className="btn-primary" // Anda bisa menambahkan class ini jika perlu
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
              <div className="log-details">
                <p><strong>{log.stage}</strong> ({formatDate(log.created_at)})</p>
                {log.notes && <p>{log.notes}</p>}
              </div>
              
              {log.photo_url && (
                <Button 
                  variant="secondary" 
                  onClick={() => handleViewPhoto(log.photo_url)}
                  className="view-photo-btn"
                >
                  Lihat Foto
                </Button>
              )}
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
        items.map((item) => <ProgressItem key={item.id} item={item} poId={po.id} poNumber={po.po_number} onUpdate={fetchItems} />)
      )}
    </div>
  )
}

export default UpdateProgressPage