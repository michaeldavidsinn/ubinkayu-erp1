/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/ban-ts-comment */

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '../components/Button';
import { Card } from '../components/Card';
import { POHeader, POItem, ProductionStage } from '../types';

// Helper functions
const formatDate = (d: string) => new Date(d).toLocaleString('id-ID');
const formatDeadlineForInput = (isoString: string) => new Date(isoString).toISOString().split('T')[0];

// --- ProgressItem Component ---
// Handles a single item's progress display and update form.
const ProgressItem = ({ item, poId, poNumber, onUpdate }: { item: POItem; poId: string; poNumber: string; onUpdate: () => void }) => {
  const stages: ProductionStage[] = ['Cari Bahan Baku', 'Sawmill', 'KD', 'Pembahanan', 'Moulding', 'Coating', 'Siap Kirim'];
  const latestStage = item.progressHistory?.[item.progressHistory.length - 1]?.stage;
  const currentStageIndex = latestStage ? stages.indexOf(latestStage) : -1;

  // State for the form
  const [notes, setNotes] = useState('');
  const [photoPath, setPhotoPath] = useState<string | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // State for editable deadlines
  const [editableDeadlines, setEditableDeadlines] = useState(item.stageDeadlines || []);

  // Function to handle changes in the date inputs
  const handleDeadlineChange = (stageName: string, newDate: string) => {
    if (!newDate || stageName !== 'Siap Kirim') return;
    const newDeadlineISO = new Date(newDate).toISOString();

    const updatedDeadlines = editableDeadlines.map(d =>
      d.stageName === stageName ? { ...d, deadline: newDeadlineISO } : d
    );
    setEditableDeadlines(updatedDeadlines);

    // Call the backend directly via window.api
    // @ts-ignore
    window.api.updateStageDeadline({
      poId,
      itemId: item.id,
      stageName,
      newDeadline: newDeadlineISO
    }).catch(err => {
      alert(`Gagal menyimpan deadline baru: ${err.message}`);
      setEditableDeadlines(item.stageDeadlines || []); // Revert on failure
    });
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
    if (!notes && !photoPath) return alert('Harap isi catatan atau unggah foto.');
    setIsUpdating(true);
    try {
      const payload = {
        poId,
        itemId: item.id,
        poNumber,
        stage: nextStage,
        notes,
        photoPath, // Send the file path directly
      };

      // @ts-ignore
      const result = await window.api.updateItemProgress(payload);

      if (result.success) {
        alert(`Progress item ${item.product_name} berhasil diupdate!`);
        onUpdate();
        setNotes('');
        setPhotoPath(null);
      } else {
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

      <div className="timeline-container">
        <div className="progress-timeline">
          {stages.map((stage) => {
            const deadlineInfo = editableDeadlines.find((d) => d.stageName === stage);
            const isCompleted = stages.indexOf(stage) <= currentStageIndex;
            const isOverdue = deadlineInfo && new Date() > new Date(deadlineInfo.deadline) && !isCompleted;
            const isEditable = stage === 'Siap Kirim'; // Tentukan apakah bisa diedit

            return (
              <div key={stage} className={`stage ${isCompleted ? 'completed' : ''} ${isOverdue ? 'overdue' : ''}`}>
                <div className="stage-dot"></div>
                <div className="stage-name">{stage}</div>

                {deadlineInfo && (
                  <div className={`stage-deadline ${isEditable ? 'editable' : ''}`}>
                    <label htmlFor={`deadline-${item.id}-${stage}`}>Target:</label>
                    <input
                      id={`deadline-${item.id}-${stage}`}
                      type="date"
                      value={formatDeadlineForInput(deadlineInfo.deadline)}
                      onChange={(e) => handleDeadlineChange(stage, e.target.value)}
                      disabled={!isEditable} // Nonaktifkan input jika tidak bisa diedit
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {currentStageIndex < stages.length - 1 && (
        <div className="update-form">
          <h5>Update ke Tahap Berikutnya: {stages[currentStageIndex + 1]}</h5>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Tambahkan catatan..." rows={3} />

          <div>
            <label onClick={handleSelectPhoto} className="file-input-label">
              {photoPath ? `✅ ${photoPath.split(/[/\\]/).pop()}` : '📷 Unggah Foto (Opsional)'}
            </label>
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
                      <Button variant="secondary" onClick={() => handleViewPhoto(log.photo_url!)} className="view-photo-btn">
                        Lihat Foto
                      </Button>
                    )}
                </div>
            ))}
         </div>
      )}
    </Card>
  );
};

// --- Main Page Component ---
interface UpdateProgressPageProps {
  po: POHeader | null;
  onBack: () => void;
}

const UpdateProgressPage: React.FC<UpdateProgressPageProps> = ({ po, onBack }) => {
  const [items, setItems] = useState<POItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    if (!po?.id) return;

    setIsLoading(true);
    try {
      // @ts-ignore
      const fetchedItems = await window.api.getPOItemsWithDetails(po.id);
      setItems(fetchedItems);
    } catch (err) {
      console.error('Gagal memuat item:', err);
    } finally {
      setIsLoading(false);
    }
  }, [po]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  if (!po) {
    return (
      <div className="page-container">
        <p>Pilih PO untuk diupdate.</p>
        <Button onClick={onBack}>Kembali</Button>
      </div>
    );
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
  );
};

export default UpdateProgressPage;