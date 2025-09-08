/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable prettier/prettier */
// src/renderer/src/pages/POListPage.tsx

import React, { useState, useMemo } from 'react'
import { Card } from '../components/Card'
import { Button } from '../components/Button'
import FilterPanel from '../components/FilterPanel'
import { POHeader } from '../types'
import POTable from '../components/POTable'

interface POListPageProps {
  poList: POHeader[]
  onAddPO: () => void
  onDeletePO: (poId: string) => Promise<void>
  onEditPO: (po: POHeader) => void
  onShowDetail: (po: POHeader) => void
  isLoading: boolean
}

const POListPage: React.FC<POListPageProps> = ({
  poList,
  onAddPO,
  isLoading,
  onDeletePO,
  onEditPO,
  onShowDetail
}) => {
  const [viewMode, setViewMode] = useState<'card' | 'table'>('card')

  const [filters, setFilters] = useState({
    sortBy: 'created-asc',
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

    // 1. Terapkan Filter Pencarian
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      processedPOs = processedPOs.filter(
        (po) =>
          po.po_number.toLowerCase().includes(query) ||
          po.project_name.toLowerCase().includes(query)
      )
    }

    // 2. Terapkan Filter Status
    if (filters.status !== 'all') {
      processedPOs = processedPOs.filter((po) => po.status === filters.status)
    }

    // 3. Terapkan Filter Prioritas
    if (filters.priority !== 'all') {
      processedPOs = processedPOs.filter((po) => po.priority === filters.priority)
    }

    // 4. Terapkan Filter Tanggal Input
    if (filters.dateFrom) {
      processedPOs = processedPOs.filter(
        (po) => new Date(po.created_at) >= new Date(filters.dateFrom)
      )
    }
    if (filters.dateTo) {
      processedPOs = processedPOs.filter(
        (po) => new Date(po.created_at) <= new Date(filters.dateTo + 'T23:59:59')
      )
    }

    // 5. Terapkan Filter Tanggal Kirim
    if (filters.deadlineFrom) {
      processedPOs = processedPOs.filter(
        (po) => po.deadline && new Date(po.deadline) >= new Date(filters.deadlineFrom)
      )
    }
    if (filters.deadlineTo) {
      processedPOs = processedPOs.filter(
        (po) => po.deadline && new Date(po.deadline) <= new Date(filters.deadlineTo + 'T23:59:59')
      )
    }

    // 6. Terapkan Logika Pengurutan (Sorting)
    const priorityMap = { Urgent: 1, High: 2, Normal: 3 }
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
        processedPOs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case 'created-asc':
        processedPOs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        break
      case 'priority':
        // @ts-ignore
        processedPOs.sort((a, b) => (priorityMap[a.priority] || 4) - (priorityMap[b.priority] || 4))
        break
    }
    return processedPOs
  }, [poList, filters])

  const renderContent = () => {
    if (isLoading) {
      return <div className="loading-spinner">⏳ Loading data PO dari Google Sheets...</div>
    }
    if (filteredAndSortedPOs.length === 0) {
      return <Card><p>Tidak ada data Purchase Order yang cocok dengan kriteria filter Anda.</p></Card>
    }
    if (viewMode === 'table') {
      return (
        <POTable
          poList={filteredAndSortedPOs}
          onShowDetail={onShowDetail}
          onEditPO={onEditPO}
          onDeletePO={onDeletePO}
        />
      )
    }

    return (
      <div className="po-grid">
        {filteredAndSortedPOs.map((po) => (
          <Card key={po.id} className="po-item-card">
            <div className="po-card-header">
              <span><b>PO:</b> {po.po_number}</span>
              <span className={`status-badge ${(po.priority || 'Normal').toLowerCase()}`}>
                {po.priority || 'Normal'}
              </span>
            </div>
            <p className="customer-name">{po.project_name}</p>
            <div className="po-card-info">
              <span><b>Status PO:</b> {po.status || 'Open'}</span>
            </div>
            <div className="po-card-info">
              <span><b>Tanggal Input:</b> {po.created_at ? new Date(po.created_at).toLocaleDateString('id-ID') : '-'}</span>
            </div>
            <div className="po-card-info">
              <span><b>Target Kirim:</b> {po.deadline ? new Date(po.deadline).toLocaleDateString('id-ID') : '-'}</span>
            </div>
            <div className="po-card-footer">
              <Button variant="secondary" onClick={() => onShowDetail(po)}>Detail</Button>
              <Button onClick={() => onEditPO(po)}>Revisi</Button>
              <Button variant="secondary" onClick={() => onDeletePO(po.id)}>Hapus</Button>
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
}

export default POListPage