/* eslint-disable prettier/prettier */
import React from 'react'
import { POHeader } from '../types'
import { Button } from './Button'
import { ProgressBar } from '../components/ProgressBar';

// Props dikembalikan ke versi original tanpa seleksi
interface POTableProps {
  poList: POHeader[]
  onDeletePO: (poId: string) => Promise<void>
  onEditPO: (po: POHeader) => void
  onShowDetail: (po: POHeader) => void
  onShowProgress: (po: POHeader) => void // [BARU] Tambahkan prop ini
}

const POTable: React.FC<POTableProps> = ({ poList, onDeletePO, onEditPO, onShowDetail, onShowProgress }) => {
  return (
    <div className="po-table-container">
      <table className="po-table">
        <thead>
          <tr>
            <th>Nomor PO</th>
            <th>Customer</th>
            {/* [BARU] Tambah header kolom Progress */}
            <th>Progress</th>
            <th>Target Kirim</th>
            <th>Status</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {poList.map((po) => (
            <tr key={po.id}>
              <td>{po.po_number}</td>
              <td>{po.project_name}</td>
              {/* [BARU] Tambah sel untuk Progress Bar */}
              <td style={{ minWidth: '150px' }}>
                <ProgressBar value={po.progress || 0} />
              </td>
              <td>{po.deadline ? new Date(po.deadline).toLocaleDateString('id-ID') : '-'}</td>
              <td>
                <span className={`status-badge status-${(po.status || 'open').toLowerCase().replace(' ', '-')}`}>
                  {po.status || 'Open'}
                </span>
              </td>
              <td className="po-table-actions">
                <Button variant="primary" onClick={() => onShowProgress(po)}>Progress</Button>
                <Button variant="secondary" onClick={() => onShowDetail(po)}>Detail</Button>
                <Button onClick={() => onEditPO(po)}>Revisi</Button>
                <Button variant="danger" onClick={() => onDeletePO(po.id)}>Hapus</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default POTable