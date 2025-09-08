/* eslint-disable prettier/prettier */
import React from 'react'
import { POHeader } from '../types'
import { Button } from './Button'

// Props dikembalikan ke versi original tanpa seleksi
interface POTableProps {
  poList: POHeader[]
  onDeletePO: (poId: string) => Promise<void>
  onEditPO: (po: POHeader) => void
  onShowDetail: (po: POHeader) => void
}

const POTable: React.FC<POTableProps> = ({ poList, onDeletePO, onEditPO, onShowDetail }) => {
  return (
    <div className="po-table-container">
      <table className="po-table">
        <thead>
          <tr>
            {/* Kolom checkbox dihilangkan */}
            <th>Nomor PO</th>
            <th>Nama Customer</th>
            <th>Tanggal Input</th>
            <th>Target Kirim</th>
            <th>Status</th>
            <th>Prioritas</th>
            <th>Aksi</th>
          </tr>
        </thead>
        <tbody>
          {poList.map((po) => (
            // ClassName 'selected-row' dan checkbox dihilangkan
            <tr key={po.id}>
              <td>{po.po_number}</td>
              <td>{po.project_name}</td>
              <td>{po.created_at ? new Date(po.created_at).toLocaleDateString('id-ID') : '-'}</td>
              <td>{po.deadline ? new Date(po.deadline).toLocaleDateString('id-ID') : '-'}</td>
              <td>
                <span className={`status-badge status-${(po.status || 'open').toLowerCase().replace(' ', '-')}`}>
                  {po.status || 'Open'}
                </span>
              </td>
              <td>
                <span className={`status-badge ${(po.priority || 'Normal').toLowerCase()}`}>
                  {po.priority || 'Normal'}
                </span>
              </td>
              <td className="po-table-actions">
                <Button variant="secondary" onClick={() => onShowDetail(po)}>Detail</Button>
                <Button onClick={() => onEditPO(po)}>Revisi</Button>
                <Button variant="secondary" onClick={() => onDeletePO(po.id)}>Hapus</Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default POTable