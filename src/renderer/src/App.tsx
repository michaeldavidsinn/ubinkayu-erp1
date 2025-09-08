/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable prettier/prettier */
// src/renderer/src/App.tsx

import React, { useState, useEffect } from 'react'
import { POHeader } from './types'

// Impor Komponen dan Halaman
import Navbar from './components/Navbar'
import POListPage from './pages/POListPage'
import InputPOPage from './pages/InputPOPage'
import PODetailPage from './pages/PODetailPage'
import ProgressTrackingPage from './pages/ProgressTrackingPage'
import DashboardPage from './pages/DashboardPage';

// --- DUMMY DATA UNTUK HALAMAN TRACKING ---
const dummyTrackingData = [
  { id: '1', po_number: '29938231223', project_name: 'UDjiptama', priority: 'Urgent', progress: 0, deadline: '2025-08-28', is_overdue: true },
  { id: '2', po_number: 'ggv', project_name: 'jkhkx', priority: 'Normal', progress: 25, deadline: '2025-09-15', is_overdue: false },
  { id: '3', po_number: 'albert', project_name: 'albert', priority: 'High', progress: 75, deadline: '2025-09-20', is_overdue: false },
  { id: '4', po_number: 'PO-004', project_name: 'Proyek Delta', priority: 'Normal', progress: 100, deadline: '2025-09-01', is_overdue: false },
]

function App() {
  // BARU: Tambahkan 'tracking' sebagai salah satu kemungkinan view
  const [view, setView] = useState<'dashboard' | 'list' | 'input' | 'detail' | 'tracking'>('dashboard');
  const [purchaseOrders, setPurchaseOrders] = useState<POHeader[]>([])
  const [editingPO, setEditingPO] = useState<POHeader | null>(null)
  const [detailPO, setDetailPO] = useState<POHeader | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  // ... (fungsi fetchPOs, handleDeletePO, dll. tetap sama) ...
  const fetchPOs = async () => {
    setIsLoading(true)
    try {
      // @ts-ignore
      const pos: POHeader[] = await window.api.listPOs()
      setPurchaseOrders(pos)
    } catch (error) {
      console.error('Gagal mengambil daftar PO:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchPOs()
  }, [])

  const handleDeletePO = async (poId: string) => {
    if (window.confirm(`Yakin ingin menghapus PO ini? Semua data terkait akan hilang permanen.`)) {
      setIsLoading(true)
      try {
        // @ts-ignore
        const result = await window.api.deletePO(poId)
        if (result.success) {
          alert('PO berhasil dihapus.')
          await fetchPOs()
        } else {
          throw new Error(result.error)
        }
      } catch (error) {
        alert(`Gagal menghapus PO: ${(error as Error).message}`)
      } finally {
        setIsLoading(false)
      }
    }
  }

  const handleEditPO = (po: POHeader) => {
    setEditingPO(po)
    setView('input')
  }

  const handleShowInputForm = () => {
    setEditingPO(null)
    setView('input')
  }

  const handleShowDetail = (po: POHeader) => {
    setDetailPO(po)
    setView('detail')
  }

  // BARU: Fungsi untuk menangani navigasi dari Navbar
  const handleNavigate = (targetView: 'dashboard' | 'list' | 'tracking') => { setView(targetView); };

  const handleBackToList = () => {
    setEditingPO(null)
    setDetailPO(null)
    fetchPOs()
    handleNavigate('list')
  }

  const renderContent = () => {
    switch (view) {
      // [BARU] Tambahkan case untuk dashboard
      case 'dashboard':
        return <DashboardPage poList={purchaseOrders} isLoading={isLoading} />;
      case 'input':
        return <InputPOPage onSaveSuccess={handleBackToList} editingPO={editingPO} />;
      case 'detail':
        return <PODetailPage po={detailPO} onBackToList={handleBackToList} />;
      case 'tracking':
        return <ProgressTrackingPage poList={[]} />;
      case 'list':
      default:
        return <POListPage poList={purchaseOrders} onAddPO={handleShowInputForm} onDeletePO={handleDeletePO} onEditPO={handleEditPO} onShowDetail={handleShowDetail} isLoading={isLoading}/>;
    }
  };

  return (
    <div className="app-layout">
      {/* BARU: Kirim 'view' dan 'handleNavigate' sebagai props */}
      <Navbar currentView={view} onNavigate={handleNavigate} />
      <main className="main-content">{renderContent()}</main>
    </div>
  )
}

export default App