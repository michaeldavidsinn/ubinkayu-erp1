/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable prettier/prettier */
import React, { useState, useEffect } from 'react'
import { POHeader } from './types'

// Impor Komponen dan Halaman
import Navbar from './components/Navbar'
import POListPage from './pages/POListPage'
import InputPOPage from './pages/InputPOPage'
import PODetailPage from './pages/PODetailPage'
import ProgressTrackingPage from './pages/ProgressTrackingPage'
import DashboardPage from './pages/DashboardPage';
import RevisionHistoryPage from './pages/RevisionHistoryPage';

function App() {
  const [view, setView] = useState<'dashboard' | 'list' | 'input' | 'detail' | 'tracking' | 'history'>('dashboard');
  const [purchaseOrders, setPurchaseOrders] = useState<POHeader[]>([])
  const [editingPO, setEditingPO] = useState<POHeader | null>(null)

  // [PERUBAHAN KUNCI] Kita akan fokus pada ID-nya saja
  const [selectedPoId, setSelectedPoId] = useState<string | null>(null);

  const [isLoading, setIsLoading] = useState(true)

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
    setSelectedPoId(po.id); // Simpan ID-nya
    setView('detail')
  }

  const handleShowHistory = () => {
    // ID sudah tersimpan di state, jadi kita tinggal ganti view
    if (selectedPoId) {
        setView('history');
    } else {
        alert("Error: PO ID tidak ditemukan untuk melihat histori.");
    }
  };

  const handleNavigate = (targetView: 'dashboard' | 'list' | 'tracking') => {
    setSelectedPoId(null); // Reset ID saat pindah ke menu utama
    setView(targetView);
  };

  const handleBackToList = () => {
    setEditingPO(null)
    setSelectedPoId(null) // Reset ID
    fetchPOs()
    handleNavigate('list')
  }

  // Helper untuk mendapatkan detail PO berdasarkan ID yang tersimpan
  const getCurrentPO = () => {
    if (!selectedPoId) return null;
    return purchaseOrders.find(p => p.id === selectedPoId) || null;
  }

  const renderContent = () => {
    const currentPO = getCurrentPO();

    switch (view) {
      case 'dashboard':
        return <DashboardPage poList={purchaseOrders} isLoading={isLoading} />;
      case 'input':
        return <InputPOPage onSaveSuccess={handleBackToList} editingPO={editingPO} />;
      case 'detail':
        return <PODetailPage po={currentPO} onBackToList={handleBackToList} onShowHistory={handleShowHistory} />;
      case 'tracking':
        return <ProgressTrackingPage />;
      case 'history':
        return <RevisionHistoryPage poId={currentPO?.id || null} poNumber={currentPO?.po_number || null} onBack={() => setView('detail')} />;
      case 'list':
      default:
        return <POListPage poList={purchaseOrders} onAddPO={handleShowInputForm} onDeletePO={handleDeletePO} onEditPO={handleEditPO} onShowDetail={handleShowDetail} isLoading={isLoading}/>;
    }
  };

  return (
    <div className="app-layout">
      <Navbar currentView={view} onNavigate={handleNavigate} />
      <main className="main-content">{renderContent()}</main>
    </div>
  )
}

export default App