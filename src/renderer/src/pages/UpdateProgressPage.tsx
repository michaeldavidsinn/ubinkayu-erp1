/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/ban-ts-comment */

import React, { useState, useEffect } from 'react'
import { Button } from '../components/Button'
import { Card } from '../components/Card'
import { POHeader, POItem, ProductionStage } from '../types'

const formatDate = (d: string) => new Date(d).toLocaleString('id-ID');
const formatDeadline = (d: string) => new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });

const ProgressItem = ({ item, poId, poNumber, onUpdate }: { item: POItem, poId: string, poNumber: string, onUpdate: () => void }) => {
  const stages: ProductionStage[] = ['Cari Bahan Baku', 'Sawmill', 'KD', 'Pembahanan', 'Moulding', 'Coating', 'Siap Kirim'];

  const latestStage = item.progressHistory?.[item.progressHistory.length - 1]?.stage;
  const currentStageIndex = latestStage ? stages.indexOf(latestStage) : -1;

  const [notes, setNotes] = useState('');
  // [DIUBAH] State sekarang menyimpan path file (string), bukan objek File
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  const handleViewPhoto = (url: string) => {
    try {
      // @ts-ignore
      window.api.openExternalLink(url);
    } catch (error) {
      console.error("Gagal membuka link eksternal:", error);
      alert(`Tidak dapat membuka link: ${(error as Error).message}`);
    }
  };

  // [BARU] Fungsi untuk membuka dialog pilih file menggunakan API Electron
  const handleSelectPhoto = async () => {
    try {
      // @ts-ignore
      const selectedPath = await window.api.openFileDialog();
      if (selectedPath) {
        setPhotoPath(selectedPath);
      }
    } catch (error) {
       console.error("Gagal membuka dialog file:", error);
       alert('Gagal memilih file.');
    }
  };

  const handleUpdate = async (nextStage: string) => {
    if (!notes && !photoPath) return alert('Harap isi catatan atau unggah foto.');
    setIsUpdating(true);
    try {
      const payload = {
        poId: poId,
        itemId: item.id,
        poNumber: poNumber,
        stage: nextStage,
        notes: notes,
        // [DIUBAH] Mengirim path file yang sudah disimpan di state
        photoPath: photoPath
      };
      // @ts-ignore
      const result = await window.api.updateItemProgress(payload);
      // @ts-ignore
      if (result.success) {
        alert(`Progress item ${item.product_name} berhasil diupdate!`);
        onUpdate();
        setNotes('');
        setPhotoPath(null); // Reset state path setelah berhasil
      } else {
        // @ts-ignore
        throw new Error(result.error || 'Terjadi kesalahan di backend.');
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
        {stages.map((stage, index) => {
            const deadlineInfo = item.stageDeadlines?.find(d => d.stageName === stage);
            const isCompleted = index <= currentStageIndex;
            const isOverdue = deadlineInfo && new Date() > new Date(deadlineInfo.deadline) && !isCompleted;

            return (
              <div key={stage} className={`stage ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}>
                <div className="stage-dot"></div>
                <div className="stage-name">{stage}</div>
                {deadlineInfo && <div className="stage-deadline">Target: {formatDeadline(deadlineInfo.deadline)}</div>}
              </div>
            )
        })}
      </div>
      {currentStageIndex < stages.length - 1 && (
        <div className="update-form">
          <h5>Update ke Tahap Berikutnya: {stages[currentStageIndex + 1]}</h5>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tambahkan catatan..." rows={3} />
          
          {/* [DIROMBAK] Mengganti <input type="file"> dengan tombol fungsional */}
          <div className="file-input-container" style={{ margin: '0.5rem 0' }}>
            <Button variant="secondary" onClick={handleSelectPhoto}>Pilih Foto</Button>
            {photoPath && <span className="file-name" style={{ marginLeft: '1rem' }}>{photoPath.split(/[/\\]/).pop()}</span>}
          </div>

          <Button onClick={() => handleUpdate(stages[currentStageIndex + 1])} disabled={isUpdating}>
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
                      <p>{log.notes}</p>
                    </div>
                    
                    {log.photo_url && (
                      <Button
                        variant="secondary"
                        onClick={() => handleViewPhoto(log.photo_url!)}
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
      ) : items.length > 0 ? (
        items.map((item) => <ProgressItem key={item.id} item={item} poId={po.id} poNumber={po.po_number} onUpdate={fetchItems} />)
      ) : (
        <Card><p>Tidak ada item yang ditemukan untuk PO ini pada revisi terbaru.</p></Card>
      )}
    </div>
  )
};

export default UpdateProgressPage;