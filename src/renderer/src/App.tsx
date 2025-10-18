// file: src/renderer/src/App.tsx

import { useState, useEffect } from 'react'
import { POHeader } from './types'
import Navbar from './components/Navbar'
import POListPage from './pages/POListPage'
import InputPOPage from './pages/InputPOPage'
import PODetailPage from './pages/PODetailPage'
import ProgressTrackingPage from './pages/ProgressTrackingPage'
import DashboardPage from './pages/DashboardPage'
import RevisionHistoryPage from './pages/RevisionHistoryPage'
import UpdateProgressPage from './pages/UpdateProgressPage'
import AnalysisPage from './pages/AnalysisPage'

// Impor semua fungsi dari apiService
import * as apiService from './apiService'

function App() {
  const [view, setView] = useState<string>('dashboard')
  const [purchaseOrders, setPurchaseOrders] = useState<POHeader[]>([])
  const [editingPO, setEditingPO] = useState<POHeader | null>(null)
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [trackingPO, setTrackingPO] = useState<POHeader | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const fetchPOs = async () => {
    setIsLoading(true)
    try {
      // Menggunakan apiService
      const pos: POHeader[] = await apiService.listPOs()
      setPurchaseOrders(pos)
    } catch (error) {
      console.error('Gagal mengambil daftar PO:', error)
      alert(`Gagal mengambil daftar PO: ${(error as Error).message}`)
    } finally {
      setIsLoading(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true) // Tampilkan loading
    await fetchPOs()      // Panggil ulang fungsi fetch data
    setIsRefreshing(false) // Sembunyikan loading
  }

  useEffect(() => {
    // Hanya fetch data jika berada di view yang relevan
    if (['dashboard', 'list'].includes(view)) {
      fetchPOs()
    }
  }, [view])

  const handleDeletePO = async (poId: string) => {
    const poToDelete = purchaseOrders.find((po) => po.id === poId)
    const poInfo = poToDelete ? `${poToDelete.po_number} - ${poToDelete.project_name}` : poId
    const confirmMessage = `⚠️ PERINGATAN PENGHAPUSAN\n\nPO: ${poInfo}\n\nData yang akan dihapus PERMANEN:\n• Semua revisi PO\n• Semua item & progress\n• File PDF & foto dari Google Drive\n\nTindakan ini TIDAK DAPAT DIBATALKAN!\n\nApakah Anda yakin ingin melanjutkan?`

    if (window.confirm(confirmMessage)) {
      setIsLoading(true)
      try {
        // Menggunakan apiService
        const result = await apiService.deletePO(poId)
        if (result.success) {
          alert(`✅ PENGHAPUSAN BERHASIL\n\n${result.message}`)
          fetchPOs() // Muat ulang daftar PO
        } else {
          throw new Error(result.error)
        }
      } catch (error) {
        alert(`❌ Gagal menghapus PO: ${(error as Error).message}\n\nSilakan coba lagi.`)
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
    setSelectedPoId(po.id)
    setView('detail')
  }

  const handleShowHistory = () => {
    if (selectedPoId) {
      setView('history')
    }
  }

  const handleNavigate = (targetView: 'dashboard' | 'list' | 'tracking' | 'analysis'): void => {
    setSelectedPoId(null)
    setTrackingPO(null)
    setEditingPO(null)
    setView(targetView)
  }

  const handleBackToList = () => {
    handleNavigate('list')
  }

  const handleSelectPOForTracking = (po: POHeader) => {
    setTrackingPO(po)
    setView('updateProgress')
  }

  const handleShowProgress = (po: POHeader) => {
    setTrackingPO(po)
    setView('updateProgress')
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
        return (
          <PODetailPage
            po={currentPO}
            onBackToList={handleBackToList}
            onShowHistory={handleShowHistory}
          />
        )
      case 'tracking':
        return <ProgressTrackingPage onSelectPO={handleSelectPOForTracking} />
      case 'history':
        return (
          <RevisionHistoryPage
            poId={currentPO?.id || null}
            poNumber={currentPO?.po_number || null}
            onBack={() => setView('detail')}
          />
        )
      case 'updateProgress':
        return <UpdateProgressPage po={trackingPO} onBack={() => setView('tracking')} />
      case 'analysis':
        return <AnalysisPage />
      case 'list':
      default:
        return (
          <POListPage
            poList={purchaseOrders}
            onAddPO={handleShowInputForm}
            onDeletePO={handleDeletePO}
            onEditPO={handleEditPO}
            onShowDetail={handleShowDetail}
            onShowProgress={handleShowProgress}
            isLoading={isLoading}
          />
        )
    }
  }

  return (
    <div className="app-layout">
      <Navbar
        currentView={view}
        onNavigate={handleNavigate}
        onRefresh={handleRefresh}      // <-- TAMBAHKAN INI
        isRefreshing={isRefreshing}  // <-- TAMBAHKAN INI
      />
      <main className="main-content">{renderContent()}</main>
    </div>
  )
}

export default App
