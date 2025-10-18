/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/ban-ts-comment */

import React, { useState, useEffect } from 'react'
import { POItem, PORevision, RevisionHistoryItem } from '../types'

// --- START: Component & Service Definitions ---
// The following are defined here to resolve import errors.

const apiService = {
  getRevisionHistory: async (poId: string): Promise<RevisionHistoryItem[]> => {
    if ((window as any).api) {
      return (window as any).api.getRevisionHistory(poId)
    }
    console.warn('API service not found, returning mock data.')
    // Mock data to demonstrate the comparison feature
    const mockRevision1: PORevision = { id: 1, po_id: Number(poId), revision_number: 1, project_name: 'Customer A', priority: 'Normal', deadline: '2025-11-10', notes: 'Initial order.', created_at: '2025-10-10T10:00:00Z', status: 'Open', acc_marketing: 'John', pdf_link: 'http://example.com/rev1.pdf' };
    const mockItems1: POItem[] = [ { id: 101, product_name: 'Panel Kayu', wood_type: 'Meranti', profile: 'P1', thickness_mm: 18, width_mm: 1200, length_mm: 2400, quantity: 10, satuan: 'pcs', color: 'Natural', finishing: 'Gloss', sample: 'S1', notes: '' } ];
    const mockRevision2: PORevision = { ...mockRevision1, id: 2, revision_number: 2, priority: 'High', deadline: '2025-11-05', created_at: '2025-10-12T11:00:00Z', notes: 'Urgent request, deadline moved up.' };
    const mockItems2: POItem[] = [ { ...mockItems1[0], id: 102, quantity: 15, color: 'Dark Walnut' }, { id: 103, product_name: 'List Profil', wood_type: 'Meranti', profile: 'LP2', thickness_mm: 12, width_mm: 50, length_mm: 3000, quantity: 20, satuan: 'pcs', color: 'Dark Walnut', finishing: 'Gloss', sample: 'S1', notes: 'New item added.' } ];
    return [ { revision: mockRevision2, items: mockItems2 }, { revision: mockRevision1, items: mockItems1 } ];
  },
  openExternalLink: async (url: string): Promise<void> => {
    if ((window as any).api) {
      return (window as any).api.openExternalLink(url)
    }
    console.log(`Opening external link (mock): ${url}`)
    window.open(url, '_blank')
  }
}

const Button: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ children, ...props }) => (
  <button className="btn" {...props}>{children}</button>
)

const Card: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className }) => (
  <div className={`card-container ${className || ''}`}>{children}</div>
)

// --- END: Component & Service Definitions ---

// --- START: Helper Functions for Comparison ---

interface ComparisonResult {
  headerChanges: string[]
  added: POItem[]
  removed: POItem[]
  modified: { item: POItem; changes: string[] }[]
}

const findHeaderChanges = (current: PORevision, previous: PORevision): string[] => {
  const changes: string[] = []
  const fieldLabels: { [key in keyof PORevision]?: string } = {
    project_name: 'Customer',
    priority: 'Prioritas',
    deadline: 'Deadline',
    notes: 'Catatan',
    acc_marketing: 'Marketing'
  }

  for (const key in fieldLabels) {
    const field = key as keyof PORevision
    if (current[field] !== previous[field]) {
      changes.push(
        `${fieldLabels[field]}: "${previous[field] || 'Kosong'}" → "${current[field] || 'Kosong'}"`
      )
    }
  }
  return changes
}

const generateItemKey = (item: POItem): string => {
  return `${item.product_name}-${item.wood_type}-${item.profile}-${item.thickness_mm}x${item.width_mm}x${item.length_mm}`
}

const findItemChanges = (newItem: POItem, oldItem: POItem): string[] => {
  const changes: string[] = []
  const fieldsToCompare: (keyof POItem)[] = ['color', 'finishing', 'sample', 'quantity', 'satuan', 'notes']

  fieldsToCompare.forEach((field) => {
    if (newItem[field] !== oldItem[field]) {
      changes.push(`${field}: "${oldItem[field] || ''}" → "${newItem[field] || ''}"`)
    }
  })
  return changes
}

const compareRevisions = (current: RevisionHistoryItem, previous: RevisionHistoryItem): ComparisonResult => {
  const headerChanges = findHeaderChanges(current.revision, previous.revision)
  const currentMap = new Map(current.items.map((item) => [generateItemKey(item), item]))
  const previousMap = new Map(previous.items.map((item) => [generateItemKey(item), item]))

  const added: POItem[] = []
  const removed: POItem[] = []
  const modified: { item: POItem; changes: string[] }[] = []

  currentMap.forEach((currentItem, key) => {
    if (!previousMap.has(key)) {
      added.push(currentItem)
    } else {
      const previousItem = previousMap.get(key)!
      const itemChanges = findItemChanges(currentItem, previousItem)
      if (itemChanges.length > 0) {
        modified.push({ item: currentItem, changes: itemChanges })
      }
    }
  })

  previousMap.forEach((previousItem, key) => {
    if (!currentMap.has(key)) {
      removed.push(previousItem)
    }
  })

  return { headerChanges, added, removed, modified }
}

// --- END: Helper Functions ---

interface RevisionHistoryPageProps {
  poId: string | null
  poNumber: string | null
  onBack: () => void
}

const RevisionHistoryPage: React.FC<RevisionHistoryPageProps> = ({ poId, poNumber, onBack }) => {
  const [history, setHistory] = useState<RevisionHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (poId) {
      const fetchHistoryData = async () => {
        setIsLoading(true)
        try {
          const data = await apiService.getRevisionHistory(poId)
          setHistory(data)
        } catch (error) {
          console.error(`Gagal memuat histori untuk PO ID ${poId}:`, error)
        } finally {
          setIsLoading(false)
        }
      }
      fetchHistoryData()
    }
  }, [poId])

  const formatDate = (d: string | undefined | null) =>
    d ? new Date(d).toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }) : '-'

  const handleOpenPdf = (url: string) => {
    apiService.openExternalLink(url)
  }

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
        history.map((revItem, index) => {
          const previousRevision = history[index + 1]
          const changes = previousRevision ? compareRevisions(revItem, previousRevision) : null
          const hasChanges =
            changes &&
            (changes.headerChanges.length > 0 ||
              changes.added.length > 0 ||
              changes.removed.length > 0 ||
              changes.modified.length > 0)

          return (
            <Card key={revItem.revision.revision_number} className="revision-history-card">
              <div className="revision-header">
                <div className="revision-title-group">
                  <h3>Revisi #{revItem.revision.revision_number}</h3>
                  {index === 0 && <span className="status-badge status-completed">Versi Terbaru</span>}
                </div>
                <div className="revision-actions-group">
                  <span>Dibuat pada: {formatDate(revItem.revision.created_at)}</span>
                  {revItem.revision.pdf_link && revItem.revision.pdf_link.startsWith('http') && (
                    <Button onClick={() => handleOpenPdf(revItem.revision.pdf_link!)}>
                      📄 Buka File Revisi Ini
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

              {!previousRevision ? (
                <p><em>Ini adalah versi awal.</em></p>
              ) : hasChanges && changes ? (
                <div className="revision-changes-summary">
                  <h4>Ringkasan Perubahan dari Versi Sebelumnya:</h4>
                  {changes.headerChanges.length > 0 && (
                    <div className="change-section">
                      <h5>(~) Informasi Dasar Diubah:</h5>
                      <ul>{changes.headerChanges.map((change, i) => <li key={i}>{change}</li>)}</ul>
                    </div>
                  )}
                  {changes.added.length > 0 && (
                    <div className="change-section">
                      <h5>(+) Item Ditambahkan:</h5>
                      <ul>{changes.added.map((item) => <li key={item.id}>{item.product_name} ({item.quantity} {item.satuan})</li>)}</ul>
                    </div>
                  )}
                  {changes.removed.length > 0 && (
                    <div className="change-section">
                      <h5>(-) Item Dihapus:</h5>
                      <ul>{changes.removed.map((item) => <li key={item.id}>{item.product_name} ({item.quantity} {item.satuan})</li>)}</ul>
                    </div>
                  )}
                  {changes.modified.length > 0 && (
                    <div className="change-section">
                      <h5>(~) Item Diubah:</h5>
                      <ul>
                        {changes.modified.map((mod) => (
                          <li key={mod.item.id}>
                            <strong>{mod.item.product_name}:</strong>
                            <ul>{mod.changes.map((change, i) => <li key={i}>{change}</li>)}</ul>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <p><em>Tidak ada perubahan dari versi sebelumnya.</em></p>
              )}

              <h4>Item pada revisi ini:</h4>
              <div className="po-table-container">
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
                    {revItem.items.map((item) => (
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
          )
        })
      ) : (
        <Card>
          <p>Tidak ada data riwayat revisi yang ditemukan untuk PO ini.</p>
        </Card>
      )}
    </div>
  )
}

export default RevisionHistoryPage
