// File: src/renderer/src/App.tsx (Versi Final dengan Edit)

import React, { useState, useEffect } from 'react'
import { Card } from './components/card'
import { Input } from './components/input'
import { Textarea } from './components/textarea'
import { Button } from './components/button'

// --- Tipe Data ---
interface POItem {
  id: number
  productId: string
  notes: string
  qty: number
  satuan: string
  thickness: number
  width: number
  length: number
}

// Tambahkan beberapa properti yang mungkin tidak ada saat edit
interface POHeader {
  id: string
  po_number: string
  project_name: string
  created_at: string
  status?: string
  priority?: string
  deadline?: string
  notes?: string; // Menambahkan notes untuk mode edit
}

// --- Komponen Utama Aplikasi ---
function App() {
  const [view, setView] = useState<'list' | 'input'>('list')
  const [purchaseOrders, setPurchaseOrders] = useState<POHeader[]>([])
  const [editingPO, setEditingPO] = useState<POHeader | null>(null) // State baru untuk PO yang sedang diedit
  const [isLoading, setIsLoading] = useState(true)

  const fetchPOs = async () => {
    setIsLoading(true)
    try {
      // @ts-ignore
      const pos: POHeader[] = await window.api.listPOs()

      console.log('Data PO yang diterima di frontend:', pos)

      setPurchaseOrders(pos)
    } catch (error) {
      console.error('Gagal mengambil daftar PO:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const handleDeletePO = async (poId: string) => {
    if (window.confirm(`Yakin ingin menghapus PO ini? Semua data terkait akan hilang permanen.`)) {
      setIsLoading(true)
      try {
        // @ts-ignore
        const result = await window.api.deletePO(poId)
        if (result.success) {
          alert('PO berhasil dihapus.')
          await fetchPOs() // Muat ulang daftar setelah berhasil
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

  // ✨ Fungsi baru untuk memulai mode edit
  const handleEditPO = (po: POHeader) => {
    setEditingPO(po)
    setView('input')
  }

  const handleShowInputForm = () => {
    setEditingPO(null) // Pastikan mode edit nonaktif saat input baru
    setView('input')
  }

  // Fungsi callback untuk kembali ke list setelah simpan/update
  const handleBackToList = () => {
    setEditingPO(null)
    fetchPOs()
    setView('list')
  }

  useEffect(() => {
    fetchPOs()
  }, [])

  return (
    <div className="app-layout">
      <Navbar activeLink={view === 'input' ? '+ Input PO' : 'Purchase Orders'} />
      <main className="main-content">
        {view === 'list' ? (
          <POListPage
            poList={purchaseOrders}
            onAddPO={handleShowInputForm}
            onDeletePO={handleDeletePO}
            onEditPO={handleEditPO} // ✨ Berikan fungsi baru ke komponen anak
            isLoading={isLoading}
          />
        ) : (
          <InputPOPage
            onSaveSuccess={handleBackToList}
            editingPO={editingPO} // ✨ Berikan data PO yang sedang diedit
          />
        )}
      </main>
    </div>
  )
}

// --- Halaman: Daftar Purchase Order ---
interface POListPageProps {
  poList: POHeader[]
  onAddPO: () => void
  onDeletePO: (poId: string) => Promise<void>
  onEditPO: (po: POHeader) => void // ✨ Perbarui props untuk menerima fungsi edit
  isLoading: boolean
}

const POListPage: React.FC<POListPageProps> = ({ poList, onAddPO, isLoading, onDeletePO, onEditPO}) => (
  <div className="page-container">
    <div className="page-header">
      <div>
        <h1>Kelola Purchase Order</h1>
        <p>Pantau dan kelola semua pesanan produksi</p>
      </div>
      <Button onClick={onAddPO}>+ Tambah PO Baru</Button>
    </div>
    <Card>
      <p>
        Menampilkan {poList.length} dari {poList.length} PO
      </p>
    </Card>
    <div className="po-grid">
      {isLoading ? (
        <div className="loading-spinner">⏳ Loading data PO dari Google Sheets...</div>
      ) : poList.length === 0 ? (
        <p>Belum ada data Purchase Order.</p>
      ) : (
        poList.map((po) => (
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
                <b>Tanggal Input:</b>{' '}
                {po.created_at ? new Date(po.created_at).toLocaleDateString() : '-'}
              </span>
            </div>
            <div className="po-card-info">
              <span>
                <b>Target Kirim:</b>{' '}
                {po.deadline ? new Date(po.deadline).toLocaleDateString() : '-'}
              </span>
            </div>
            <div className="po-card-footer">
              <Button variant="secondary">Detail</Button>
              <Button onClick={() => onEditPO(po)}>Edit</Button> {/* ✨ Tambahkan handler onEditPO */}
              <Button
                variant="secondary"
                onClick={() => onDeletePO(po.id)}
              >
                Hapus
            </Button>
            </div>
          </Card>
        ))
      )}
    </div>
  </div>
)

// --- Halaman: Input Purchase Order ---
// ✨ Perbarui props untuk menerima data PO yang sedang diedit
interface InputPOPageProps {
  onSaveSuccess: () => void
  editingPO: POHeader | null
}

const InputPOPage: React.FC<InputPOPageProps> = ({ onSaveSuccess, editingPO }) => {
  const today = new Date().toISOString().split('T')[0]
  const [poData, setPoData] = useState({
    nomorPo: editingPO?.po_number || '',
    namaCustomer: editingPO?.project_name || '',
    tanggalMasuk: editingPO?.created_at ? editingPO.created_at.split('T')[0] : today,
    tanggalKirim: editingPO?.deadline || '',
    prioritas: editingPO?.priority || 'Normal',
    alamatKirim: '',
    catatan: editingPO?.notes || '',
  })
  const [items, setItems] = useState<POItem[]>([])
  const [isSaving, setIsSaving] = useState(false)

  // ✨ Effect untuk mengisi form jika mode edit aktif
  useEffect(() => {
    if (editingPO) {
      // Di sini Anda perlu memuat item-item PO jika fitur tersebut tersedia.
      // Saat ini, kita hanya mengisi data header.
      setPoData({
        nomorPo: editingPO.po_number,
        namaCustomer: editingPO.project_name,
        tanggalMasuk: editingPO.created_at ? editingPO.created_at.split('T')[0] : today,
        tanggalKirim: editingPO.deadline || '',
        prioritas: editingPO.priority || 'Normal',
        alamatKirim: '', // Alamat kirim tidak disimpan di sheets, jadi dikosongkan
        catatan: editingPO.notes || '',
      })
      // Untuk mengedit item, Anda akan memanggil backend untuk mengambil itemnya
      // await window.api.listPOItems(editingPO.id)
    }
  }, [editingPO])

  const handleDataChange = (
    e: React.ChangeEvent<HTMLInputElement | React.ChangeEvent<HTMLTextAreaElement> | HTMLSelectElement>
  ) => setPoData((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleAddItem = () =>
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        productId: '',
        notes: '',
        qty: 1,
        satuan: 'pcs',
        thickness: 0,
        width: 0,
        length: 0
      }
    ])

  const handleItemChange = (id: number, field: keyof POItem, value: string | number) =>
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, [field]: value } : item)))

  const handleRemoveItem = (id: number) => setItems((prev) => prev.filter((item) => item.id !== id))

  const handlePingTest = async () => {
    console.log('---  MENGIRIM PING KE BACKEND ---')
    try {
      // @ts-ignore
      const response = await window.api.ping()
      console.log('--- ✅ PONG DITERIMA DARI BACKEND:', response, '---')
      alert(`PONG diterima! Jembatan komunikasi BERFUNGSI.`)
    } catch (error) {
      console.error('--- ❌ GAGAL MENGIRIM PING:', error)
      alert(`GAGAL! Jembatan komunikasi TIDAK berfungsi. Cek error di konsol.`)
    }
  }

  // ✨ Fungsi baru untuk menangani simpan dan update
  const handleSaveOrUpdatePO = async () => {
    if (!poData.nomorPo || !poData.namaCustomer)
      return alert('Nomor PO dan Nama Customer harus diisi!')
    if (items.length === 0) return alert('Tambahkan minimal satu item.')
    setIsSaving(true)
    try {
      const payload = { ...poData, items, poId: editingPO?.id }
      // @ts-ignore
      const result = editingPO ? await window.api.updatePO(payload) : await window.api.saveNewPO(payload);

      if (result.success) {
        alert(`PO berhasil ${editingPO ? 'diperbarui' : 'disimpan'}!`)
        onSaveSuccess()
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      alert(`Gagal ${editingPO ? 'memperbarui' : 'menyimpan'} PO: ${(error as Error).message}`)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>{editingPO ? 'Edit Purchase Order' : 'Input Purchase Order'}</h1> {/* ✨ Judul dinamis */}
          <p>{editingPO ? 'Perbarui data PO' : 'Buat PO baru dengan spesifikasi detail produk'}</p> {/* ✨ Subjudul dinamis */}
        </div>
        <div className="header-actions">
          <Button onClick={handlePingTest} style={{ backgroundColor: '#2F855A' }}>
            Tes Jembatan (Ping)
          </Button>
          <Button variant="secondary">◎ Preview</Button>
          <Button onClick={handleSaveOrUpdatePO} disabled={isSaving}>
            {isSaving ? 'Menyimpan...' : (editingPO ? 'Perbarui PO' : 'Simpan PO')} {/* ✨ Label tombol dinamis */}
          </Button>
        </div>
      </div>
      <Card>
        <h2>Informasi Dasar PO</h2>
        <div className="form-grid">
          <Input
            label="Nomor PO *"
            name="nomorPo"
            value={poData.nomorPo}
            onChange={handleDataChange}
            placeholder="e.g., 2505.1127"
            disabled={!!editingPO} // ✨ Nonaktifkan input PO Number saat edit
          />
          <Input
            label="Nama Customer *"
            name="namaCustomer"
            value={poData.namaCustomer}
            onChange={handleDataChange}
            placeholder="e.g., ELIE MAGDA SBY"
          />
          <Input
            label="Tanggal Masuk"
            name="tanggalMasuk"
            type="date"
            value={poData.tanggalMasuk}
            onChange={handleDataChange}
            disabled
          />
          <Input
            label="Tanggal Target Kirim *"
            name="tanggalKirim"
            type="date"
            value={poData.tanggalKirim}
            onChange={handleDataChange}
          />
          <div className="form-group">
            <label>Prioritas</label>
            <select name="prioritas" value={poData.prioritas} onChange={handleDataChange}>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>
        </div>
        <Textarea
          label="Alamat Kirim"
          name="alamatKirim"
          value={poData.alamatKirim}
          onChange={handleDataChange}
          placeholder="Alamat lengkap pengiriman..."
          rows={3}
        />
        <Textarea
          label="Catatan"
          name="catatan"
          value={poData.catatan}
          onChange={handleDataChange}
          placeholder="Catatan khusus untuk PO ini..."
          rows={3}
        />
      </Card>

      <div className="item-section-header">
        <h2>Daftar Item</h2>
        <Button onClick={handleAddItem}>+ Tambah Item</Button>
      </div>

      {items.map((item, index) => (
        <Card key={item.id} className="item-card">
          <div className="item-card-header">
            <h4>Item #{index + 1}</h4>
            <Button variant="secondary" onClick={() => handleRemoveItem(item.id)}>
              Hapus
            </Button>
          </div>
          <div className="form-grid">
            <Input
              label="Produk ID"
              value={item.productId}
              onChange={(e) => handleItemChange(item.id, 'productId', e.target.value)}
            />
            <Input
              label="Catatan / Notes"
              value={item.notes}
              onChange={(e) => handleItemChange(item.id, 'notes', e.target.value)}
            />
            <Input
              label="Qty"
              type="number"
              value={item.qty}
              onChange={(e) => handleItemChange(item.id, 'qty', Number(e.target.value))}
            />
            <Input
              label="Satuan"
              value={item.satuan}
              onChange={(e) => handleItemChange(item.id, 'satuan', e.target.value)}
            />
            <Input
              label="Tebal (mm)"
              type="number"
              value={item.thickness}
              onChange={(e) => handleItemChange(item.id, 'thickness', Number(e.target.value))}
            />
            <Input
              label="Lebar (mm)"
              type="number"
              value={item.width}
              onChange={(e) => handleItemChange(item.id, 'width', Number(e.target.value))}
            />
            <Input
              label="Panjang (mm)"
              type="number"
              value={item.length}
              onChange={(e) => handleItemChange(item.id, 'length', Number(e.target.value))}
            />
          </div>
        </Card>
      ))}
    </div>
  )
}

// --- Komponen Statis: Navbar ---
interface NavbarProps {
  activeLink: string
}
const Navbar: React.FC<NavbarProps> = ({ activeLink }) => (
  <nav className="navbar">
    <div className="navbar-brand">PT Ubinkayu ERP</div>
    <div className="navbar-links">
      <a href="#" className={activeLink === 'Dashboard' ? 'active' : ''}>
        Dashboard
      </a>
      <a href="#" className={activeLink === 'Purchase Orders' ? 'active' : ''}>
        Purchase Orders
      </a>
      <a href="#" className={activeLink === '+ Input PO' ? 'active' : ''}>
        + Input PO
      </a>
      <a href="#" className={activeLink === 'Progress Tracking' ? 'active' : ''}>
        Progress Tracking
      </a>
      <a href="#" className={activeLink === 'Reports' ? 'active' : ''}>
        Reports
      </a>
      <a href="#" className={activeLink === 'Users' ? 'active' : ''}>
        Users
      </a>
    </div>
  </nav>
)

export default App