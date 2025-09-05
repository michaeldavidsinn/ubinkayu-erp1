/* eslint-disable prettier/prettier */
// src/renderer/src/components/FilterPanel.tsx

import React from 'react'
import { Card } from './Card'
import { Input } from './Input'

interface FilterPanelProps {
  filters: any
  onFilterChange: (name: string, value: any) => void
  poCount: { displayed: number; total: number }
}

const FilterPanel: React.FC<FilterPanelProps> = ({ filters, onFilterChange, poCount }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onFilterChange(e.target.name, e.target.value)
  }

  return (
    <Card className="filter-panel">
      <div className="filter-header">
        <h3>📊 Sort & Filter Purchase Order</h3>
        <span>
          Menampilkan {poCount.displayed} dari {poCount.total} PO
        </span>
      </div>

      <div className="filter-grid">
        <div className="form-group">
          <label>Urutkan Berdasarkan</label>
          <select name="sortBy" value={filters.sortBy} onChange={handleInputChange}>
            <option value="deadline-asc">Tanggal Kirim (Terdekat)</option>
            <option value="deadline-desc">Tanggal Kirim (Terjauh)</option>
            <option value="created-desc">PO Terbaru</option>
            <option value="created-asc">PO Terlama</option>
            <option value="priority">Prioritas (Urgent &gt; High &gt; Normal)</option>
          </select>
        </div>

        <div className="form-group search-bar">
          <label>Pencarian</label>
          <Input
            type="text"
            name="searchQuery"
            placeholder="Cari berdasarkan nomor PO atau nama customer..."
            value={filters.searchQuery}
            onChange={handleInputChange}
          />
        </div>

        <div className="form-group">
          <label>Status PO</label>
          <select name="status" value={filters.status} onChange={handleInputChange}>
            <option value="all">Semua Status</option>
            <option value="Open">Open</option>
            <option value="In Progress">In Progress</option>
            <option value="Completed">Completed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>

        <div className="form-group">
          <label>Prioritas</label>
          <select name="priority" value={filters.priority} onChange={handleInputChange}>
            <option value="all">Semua Prioritas</option>
            <option value="Urgent">Urgent</option>
            <option value="High">High</option>
            <option value="Normal">Normal</option>
          </select>
        </div>

        <div className="form-group">
          <label>Tanggal Input Dari</label>
          <Input type="date" name="dateFrom" value={filters.dateFrom} onChange={handleInputChange} />
        </div>
        <div className="form-group">
          <label>Tanggal Input Sampai</label>
          <Input type="date" name="dateTo" value={filters.dateTo} onChange={handleInputChange} />
        </div>

        <div className="form-group">
          <label>Tanggal Kirim Dari</label>
          <Input
            type="date"
            name="deadlineFrom"
            value={filters.deadlineFrom}
            onChange={handleInputChange}
          />
        </div>
        <div className="form-group">
          <label>Tanggal Kirim Sampai</label>
          <Input
            type="date"
            name="deadlineTo"
            value={filters.deadlineTo}
            onChange={handleInputChange}
          />
        </div>
      </div>
    </Card>
  )
}

export default FilterPanel