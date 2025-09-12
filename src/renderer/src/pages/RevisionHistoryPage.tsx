/* eslint-disable prettier/prettier */
import React, { useState, useEffect } from 'react';
import { Card } from '../components/Card';
import { Button } from '../components/Button';
import { POItem } from '../types';

// Tipe data yang sama seperti sebelumnya
interface RevisionHistoryItem {
  revision: {
    revision_number: number;
    created_at: string;
    status: string;
    deadline: string;
    notes: string;
  };
  items: POItem[];
}

interface RevisionHistoryPageProps {
  poId: string | null;
  poNumber: string | null;
  onBack: () => void;
}

const RevisionHistoryPage: React.FC<RevisionHistoryPageProps> = ({ poId, poNumber, onBack }) => {

  console.log('RevisionHistoryPage Menerima poId:', poId);

  const [history, setHistory] = useState<RevisionHistoryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Pastikan poId ada sebelum fetching
    if (poId) {
      const fetchHistoryData = async () => {
        setIsLoading(true);
        try {
          // @ts-ignore
          const data = await window.api.getRevisionHistory(poId);
          console.log('DATA HISTORY DITERIMA:', data); // Debugging
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

  const formatDate = (d: string | undefined) => d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric'}) : '-';

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
            <div className="revision-header">
              <h3>Revisi #{revItem.revision.revision_number}</h3>
              {index === 0 && <span className="status-badge status-completed">Versi Terbaru</span>}
              <span>Dibuat pada: {formatDate(revItem.revision.created_at)}</span>
            </div>
            <div className="revision-details">
                <p><strong>Status:</strong> {revItem.revision.status || '-'}</p>
                <p><strong>Deadline:</strong> {formatDate(revItem.revision.deadline)}</p>
                {revItem.revision.notes && <p><strong>Catatan:</strong> {revItem.revision.notes}</p>}
            </div>
            <h4>Item pada revisi ini:</h4>
            <div className="po-table-container"> {/* Tambahkan wrapper agar bisa scroll horizontal jika perlu */}
                <table className="simple-table">
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