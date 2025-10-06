/* eslint-disable prettier/prettier */
/* eslint-disable @typescript-eslint/ban-ts-comment */
import React, { useState, useEffect } from 'react'
import * as apiService from '@renderer/services/apiService';
import { POHeader } from './types'

// Impor Komponen dan Halaman
import Navbar from './components/Navbar'
import POListPage from './pages/POListPage'
import InputPOPage from './pages/InputPOPage'
import PODetailPage from './pages/PODetailPage'
import ProgressTrackingPage from './pages/ProgressTrackingPage'
import DashboardPage from './pages/DashboardPage'
import RevisionHistoryPage from './pages/RevisionHistoryPage'
import UpdateProgressPage from './pages/UpdateProgressPage'
import AnalysisPage from './pages/AnalysisPage'

function App() {
  const [view, setView] = useState<string>('dashboard')
  const [purchaseOrders, setPurchaseOrders] = useState<POHeader[]>([])
  const [editingPO, setEditingPO] = useState<POHeader | null>(null)
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [trackingPO, setTrackingPO] = useState<POHeader | null>(null);

  const fetchPOs = async () => {
    setIsLoading(true)
    try {
      // @ts-ignore
      const pos = await apiService.listPOs();
      setPurchaseOrders(pos)
    } catch (error) {
      console.error('Gagal mengambil daftar PO:', error)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (['dashboard', 'list', 'detail', 'history', 'input'].includes(view)) {
        fetchPOs()
    }
  }, [view])

  const handleDeletePO = async (poId: string) => {
    if (window.confirm(`Yakin ingin menghapus PO ini? Semua data terkait akan hilang permanen.`)) {
      try {
        // @ts-ignore
        const result = await window.api.deletePO(poId);
        if (result.success) {
            alert(result.message || 'PO berhasil dihapus.');
            fetchPOs();
        } else {
            throw new Error(result.error);
        }
      } catch (error) {
        alert(`Gagal menghapus PO: ${(error as Error).message}`);
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
    setSelectedPoId(po.id)
    setView('detail')
  }

  const handleShowProgress = (po: POHeader) => {
    setTrackingPO(po);
    setView('updateProgress');
  };

  const handleShowHistory = () => {
    if (selectedPoId) {
      setView('history')
    }
  }

  const handleNavigate = (targetView: 'dashboard' | 'list' | 'tracking' | 'analysis') => {
    setSelectedPoId(null)
    setTrackingPO(null)
    setView(targetView)
  }

  const handleBackToList = () => {
    setEditingPO(null)
    setSelectedPoId(null)
    fetchPOs()
    handleNavigate('list')
  }

  const getCurrentPO = () => {
    if (!selectedPoId) return null
    return purchaseOrders.find((p) => p.id === selectedPoId) || null
  }

  const renderContent = () => {
    const currentPO = getCurrentPO()

    switch (view) {
      case 'dashboard':
        return <DashboardPage poList={purchaseOrders} isLoading={isLoading} />
      case 'input':
        return <InputPOPage onSaveSuccess={handleBackToList} editingPO={editingPO} />
      case 'detail':
        return <PODetailPage po={currentPO} onBackToList={handleBackToList} onShowHistory={handleShowHistory} />
      case 'tracking':
        return <ProgressTrackingPage onSelectPO={handleShowProgress} />
      case 'history':
        return <RevisionHistoryPage poId={currentPO?.id || null} poNumber={currentPO?.po_number || null} onBack={() => setView('detail')} />
      case 'updateProgress':
        return <UpdateProgressPage po={trackingPO} onBack={() => setView('tracking')} />;
      case 'analysis':
        return <AnalysisPage />;
      case 'list':
      default:
        return <POListPage poList={purchaseOrders} onAddPO={handleShowInputForm} onDeletePO={handleDeletePO} onEditPO={handleEditPO} onShowDetail={handleShowDetail} onShowProgress={handleShowProgress} isLoading={isLoading} />
    }
  }

  return (
    <div className="app-layout">
      <Navbar currentView={view} onNavigate={handleNavigate} />
      <main className="main-content">{renderContent()}</main>
    </div>
  )
}

export default App