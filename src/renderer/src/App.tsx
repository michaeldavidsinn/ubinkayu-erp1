/* eslint-disable @typescript-eslint/explicit-function-return-type */
// src/renderer/src/App.tsx

import React, { useState, useEffect } from 'react'
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

function App() {
  const [view, setView] = useState<string>('dashboard')
  const [purchaseOrders, setPurchaseOrders] = useState<POHeader[]>([])
  const [editingPO, setEditingPO] = useState<POHeader | null>(null)
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const [trackingPO, setTrackingPO] = useState<POHeader | null>(null)

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
    if (['dashboard', 'list', 'detail', 'history', 'input'].includes(view)) {
      fetchPOs()
    }
  }, [view])

  const handleDeletePO = async (poId: string) => {
    // Find the PO to get more info for the confirmation
    const poToDelete = purchaseOrders.find(po => po.id === poId)
    const poInfo = poToDelete ? `${poToDelete.po_number} - ${poToDelete.project_name}` : poId
    
    const confirmMessage = `⚠️ PERINGATAN PENGHAPUSAN LENGKAP ⚠️\n\n` +
      `PO: ${poInfo}\n\n` +
      `Data yang akan dihapus PERMANEN:\n` +
      `• Semua revisi PO dari spreadsheet\n` +
      `• Semua item dan progress tracking\n` +
      `• File PDF dari Google Drive\n` +
      `• Foto progress dari Google Drive\n\n` +
      `Proses ini akan memakan waktu 5-15 detik tergantung jumlah file.\n` +
      `Tindakan ini TIDAK DAPAT DIBATALKAN!\n\n` +
      `Apakah Anda yakin ingin melanjutkan?`
    
    if (window.confirm(confirmMessage)) {
      setIsLoading(true)
      
      // Show progress message immediately
      const progressMessage = `🗜️ Menghapus PO ${poInfo}...\n\n` +
        `Sedang memproses:\n` +
        `• Menghapus file dari Google Drive\n` +
        `• Membersihkan data spreadsheet\n\n` +
        `Mohon tunggu, jangan tutup aplikasi...`
      
      // Use setTimeout to show progress message without blocking
      const progressAlert = setTimeout(() => {
        // This will be cleared when deletion completes
      }, 100)
      
      try {
        // @ts-ignore
        const result = await window.api.deletePO(poId)
        clearTimeout(progressAlert)
        
        if (result.success) {
          // Show detailed success message with timing
          const duration = result.summary?.duration || 'beberapa detik'
          let successMessage = `${result.message}\n\nWaktu pemrosesan: ${duration}`
          
          if (result.summary?.failedFileDeletes > 0) {
            successMessage += `\n\n⚠️ Catatan: ${result.summary.failedFileDeletes} file tidak dapat dihapus dari Drive (mungkin sudah dihapus atau tidak memiliki akses)`
          }
          
          alert(`✅ PENGHAPUSAN BERHASIL\n\n${successMessage}`)
          await fetchPOs()
        } else {
          throw new Error(result.error)
        }
      } catch (error) {
        clearTimeout(progressAlert)
        alert(`❌ Gagal menghapus PO: ${(error as Error).message}\n\nSilakan coba lagi atau hubungi administrator.`)
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

  const handleNavigate = (targetView: 'dashboard' | 'list' | 'tracking') => {
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

  const handleSelectPOForTracking = (po: POHeader) => {
    setTrackingPO(po)
    setView('updateProgress')
  }

  // [MODIFIKASI 1] Buat fungsi handler untuk tombol "Progress" dari POListPage
  const handleShowProgress = (po: POHeader) => {
    setTrackingPO(po) // Simpan data PO yang dipilih
    setView('updateProgress') // Ganti tampilan ke halaman update progress
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
            onShowProgress={handleShowProgress} // [MODIFIKASI 2] Teruskan handler sebagai prop
            isLoading={isLoading}
          />
        )
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
