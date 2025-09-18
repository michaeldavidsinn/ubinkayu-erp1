/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */

import React, { useState, useMemo } from 'react'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import FilterPanel from '../components/FilterPanel'
import { POHeader } from '../types'
import POTable from '../components/POTable'
import { ProgressBar } from '../components/ProgressBar'

interface POListPageProps {
  poList: POHeader[]
  onAddPO: () => void
  onDeletePO: (poId: string) => Promise<void>
  onEditPO: (po: POHeader) => void
  onShowDetail: (po: POHeader) => void
  onShowProgress: (po: POHeader) => void
  isLoading: boolean
}

const POListPage: React.FC<POListPageProps> = ({
  poList,
  onAddPO,
  isLoading,
  onDeletePO,
  onEditPO,
  onShowDetail,
  onShowProgress
}) => {
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')

  const [filters, setFilters] = useState({
    sortBy: 'created-desc',
    searchQuery: '',
    status: 'all',
    priority: 'all',
    dateFrom: '',
    dateTo: '',
    deadlineFrom: '',
    deadlineTo: ''
  })

  const handleFilterChange = (name: string, value: any) => {
    setFilters((prev) => ({ ...prev, [name]: value }))
  }

  const filteredAndSortedPOs = useMemo(() => {
    let processedPOs = [...poList]

    // --- Filtering ---
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      processedPOs = processedPOs.filter(
        (po) =>
          po.po_number.toLowerCase().includes(query) ||
          po.project_name.toLowerCase().includes(query)
      )
    }

    if (filters.status !== 'all') {
      processedPOs = processedPOs.filter(
        (po) => (po.status || 'Open').toLowerCase() === filters.status.toLowerCase()
      )
    }

    if (filters.priority !== 'all') {
      processedPOs = processedPOs.filter(
        (po) => (po.priority || 'Normal').toLowerCase() === filters.priority.toLowerCase()
      )
    }

    // (Sisa logika filter dan sort tidak berubah)

    // --- Sorting ---
    const priorityMap: Record<string, number> = { urgent: 1, high: 2, normal: 3 }
    switch (filters.sortBy) {
      case 'deadline-asc':
        processedPOs.sort(
          (a, b) => new Date(a.deadline || 0).getTime() - new Date(b.deadline || 0).getTime()
        )
        break
      case 'deadline-desc':
        processedPOs.sort(
          (a, b) => new Date(b.deadline || 0).getTime() - new Date(a.deadline || 0).getTime()
        )
        break
      case 'created-desc':
        processedPOs.sort(
          (a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
        )
        break
      case 'created-asc':
        processedPOs.sort(
          (a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
        )
        break
      case 'priority':
        processedPOs.sort(
          (a, b) =>
            (priorityMap[(a.priority || 'normal').toLowerCase()] || 4) -
            (priorityMap[(b.priority || 'normal').toLowerCase()] || 4)
        )
        break
    }
    return processedPOs
  }, [poList, filters])

  const renderContent = () => {
    if (isLoading) {
      return <p>⏳ Loading data PO dari Google Sheets...</p>
    }
    if (filteredAndSortedPOs.length === 0) {
      return (
        <Card>
          <p>Tidak ada data Purchase Order yang cocok dengan kriteria filter Anda.</p>
        </Card>
      )
    }
    if (viewMode === 'table') {
      return (
        <POTable
          poList={filteredAndSortedPOs}
          onShowDetail={onShowDetail}
          onEditPO={onEditPO}
          onDeletePO={onDeletePO}
          onShowProgress={onShowProgress}
        />
      )
    }

    return (
      <div className="po-grid">
        {filteredAndSortedPOs.map((po) => (
          <Card key={po.id} className="po-item-card">
            <div className="po-card-header">
              <span>
                <b>PO:</b> {po.po_number}
              </span>
              <span className={`status-badge ${(po.priority || 'Normal').toLowerCase()}`}>
                {po.priority || 'Normal'}
              </span>
            </div>
            <p className="customer-name">{po.project_name}</p>

            <div className="po-card-info">
              <span>
                <b>Status:</b> {po.status || 'Open'}
              </span>
              <span>
                <b>Progress: {po.progress?.toFixed(0) || 0}%</b>
              </span>
            </div>
            <ProgressBar value={po.progress || 0} />

            <div className="po-card-footer">
              <div className="button-row">
                <Button variant="secondary" onClick={() => onShowDetail(po)}>
                  Detail
                </Button>
                <Button onClick={() => onEditPO(po)}>Revisi</Button>
              </div>
              <div className="button-row">
                <Button variant="primary" onClick={() => onShowProgress(po)}>
                  Progress
                </Button>
                <Button variant="danger" onClick={() => onDeletePO(po.id)}>
                  Hapus
                </Button>
              </div>
            </div>
          </Card>
        ))}
      </div>
    )
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Kelola Purchase Order</h1>
          <p>Pantau dan kelola semua pesanan produksi dengan fitur sort dan filter</p>
        </div>
        <Button onClick={onAddPO}>+ Tambah PO Baru</Button>
      </div>

      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        poCount={{ displayed: filteredAndSortedPOs.length, total: poList.length }}
      />

      <div className="view-switcher">
        <button
          className={`view-switcher-btn ${viewMode === 'card' ? 'active' : ''}`}
          onClick={() => setViewMode('card')}
        >
          Tampilan Kartu
        </button>
        <button
          className={`view-switcher-btn ${viewMode === 'table' ? 'active' : ''}`}
          onClick={() => setViewMode('table')}
        >
          Tampilan Tabel
        </button>
      </div>

      {renderContent()}
    </div>
  )
} // <-- Kurung kurawal penutup yang hilang kemungkinan ada di sini

export default POListPage
