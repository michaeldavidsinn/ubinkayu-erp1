/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import React, { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { RevisionHistoryItem } from '../types';
import * as apiService from '../apiService'

interface RevisionHistoryPageProps {
  poId: string | null;
  poNumber: string | null;
  onBack: () => void;
}

const RevisionHistoryPage: React.FC<RevisionHistoryPageProps> = ({ poId, poNumber, onBack }) => {
  const [history, setHistory] = useState<RevisionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (poId) {
      const fetchHistoryData = async () => {
        setIsLoading(true);
        try {
          // @ts-ignore
          const data = await apiService.getRevisionHistory(poId);
          setHistory(data);
        } catch (error) {
          console.error(`Gagal memuat histori untuk PO ID ${poId}:`, error);
        } finally {
          setIsLoading(false);
        }
      };
      fetchHistoryData();
    }
  }, [poId]);

  const formatDate = (d: string | undefined | null) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric'}) : '-';

  // [BARU] Fungsi untuk membuka link PDF
  const handleOpenPdf = (url: string) => {
    // @ts-ignore
    apiService.openExternalLink(url);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Riwayat Revisi: PO {poNumber}</h1>
          <p>Menampilkan semua versi perubahan untuk Purchase Order ini.</p>
        </div>
        <Button onClick={onBack}>Kembali ke Detail</Button>
      </div>

      {isLoading ? (
        <p>⏳ Memuat riwayat revisi...</p>
      ) : history.length > 0 ? (
        history.map((revItem, index) => (
          <Card key={revItem.revision.revision_number} className="revision-history-card">
            {/* [MODIFIKASI] Tata letak header diubah agar lebih rapi */}
            <div className="revision-header">
              <div className="revision-title-group">
                <h3>Revisi #{revItem.revision.revision_number}</h3>
                {index === 0 && <span className="status-badge status-completed">Versi Terbaru</span>}
              </div>
              <div className="revision-actions-group">
                <span>Dibuat pada: {formatDate(revItem.revision.created_at)}</span>
                {/* [BARU] Tombol Buka PDF hanya muncul jika link ada */}
                {revItem.revision.pdf_link && revItem.revision.pdf_link.startsWith('http') && (
                  <Button onClick={() => handleOpenPdf(revItem.revision.pdf_link!)}>
                    📄 Buka PDF Revisi Ini
                  </Button>
                )}
              </div>
            </div>
            <div className="revision-details">
                <p><strong>Customer:</strong> {revItem.revision.project_name || '-'}</p>
                <p><strong>Prioritas:</strong> {revItem.revision.priority || 'Normal'}</p>
                <p><strong>Status:</strong> {revItem.revision.status || '-'}</p>
                <p><strong>Deadline:</strong> {formatDate(revItem.revision.deadline)}</p>
                {revItem.revision.notes && <p><strong>Catatan:</strong> {revItem.revision.notes}</p>}
            </div>
            <h4>Item pada revisi ini:</h4>
            <div className="po-table-container">
                <table className="simple-table">
                    {/* ... (Isi tabel tidak berubah) ... */}
                    <thead>
                        <tr>
                            <th>Produk</th>
                            <th>Jenis Kayu</th>
                            <th>Profil</th>
                            <th>Warna</th>
                            <th>Finishing</th>
                            <th>Ukuran (mm)</th>
                            <th>Qty</th>
                            <th>Catatan Item</th>
                        </tr>
                    </thead>
                    <tbody>
                        {revItem.items.map(item => (
                            <tr key={item.id}>
                                <td>{item.product_name || '-'}</td>
                                <td>{item.wood_type || '-'}</td>
                                <td>{item.profile || '-'}</td>
                                <td>{item.color || '-'}</td>
                                <td>{item.finishing || '-'}</td>
                                <td>{`${item.thickness_mm} x ${item.width_mm} x ${item.length_mm}`}</td>
                                <td>{`${item.quantity} ${item.satuan}`}</td>
                                <td>{item.notes || '-'}</td>
                            </tr>
                        ))}
                        {revItem.items.length === 0 && (
                            <tr><td colSpan={8}>Tidak ada item pada revisi ini.</td></tr>
                        )}
                    </tbody>
                </table>
            </div>
          </Card>
        ))
      ) : (
        <Card>
          <p>Tidak ada data riwayat revisi yang ditemukan untuk PO ini.</p>
        </Card>
      )}
    </div>
  );
};

export default RevisionHistoryPage;