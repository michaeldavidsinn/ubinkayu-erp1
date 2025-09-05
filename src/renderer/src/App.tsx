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

function App() {
  const [view, setView] = useState<'list' | 'input' | 'detail'>('list')
  const [purchaseOrders, setPurchaseOrders] = useState<POHeader[]>([])
  const [editingPO, setEditingPO] = useState<POHeader | null>(null)
  const [detailPO, setDetailPO] = useState<POHeader | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchPOs = async () => {
    setIsLoading(true)
    try {
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
          await fetchPOs() // Muat ulang daftar setelah hapus
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

  const handleBackToList = () => {
    setEditingPO(null)
    setDetailPO(null)
    fetchPOs() // Selalu muat ulang data saat kembali ke daftar
    setView('list')
  }

  const renderContent = () => {
    switch (view) {
      case 'input':
        return <InputPOPage onSaveSuccess={handleBackToList} editingPO={editingPO} />
      case 'detail':
        return <PODetailPage po={detailPO} onBackToList={handleBackToList} />
      case 'list':
      default:
        return (
          <POListPage
            poList={purchaseOrders}
            onAddPO={handleShowInputForm}
            onDeletePO={handleDeletePO}
            onEditPO={handleEditPO}
            onShowDetail={handleShowDetail}
            isLoading={isLoading}
          />
        )
    }
  }

  return (
    <div className="app-layout">
      <Navbar activeLink="Purchase Orders" />
      <main className="main-content">{renderContent()}</main>
    </div>
  )
}

export default App