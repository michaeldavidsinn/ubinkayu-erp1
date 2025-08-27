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

interface POHeader {
  id: string
  po_number: string
  project_name: string
  created_at: string
  status?: string
  priority?: string
  deadline?: string
  notes?: string;
}

// --- Komponen Utama Aplikasi ---
function App() {
  const [view, setView] = useState<'list' | 'input' | 'detail'>('list')
  const [purchaseOrders, setPurchaseOrders] = useState<POHeader[]>([])
  const [editingPO, setEditingPO] = useState<POHeader | null>(null)
  const [detailPO, setDetailPO] = useState<POHeader | null>(null);
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
    setDetailPO(po);
    setView('detail');
  };

  const handleBackToList = () => {
    setEditingPO(null)
    fetchPOs()
    setView('list')
  }

  const handleBackFromDetail = () => {
    setDetailPO(null);
    setView('list');
  };

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
            onEditPO={handleEditPO}
            onShowDetail={handleShowDetail}
            isLoading={isLoading}
          />
        ) : view === 'input' ? (
          <InputPOPage
            onSaveSuccess={handleBackToList}
            editingPO={editingPO}
          />
        ) : (
          <PODetailPage po={detailPO} onBackToList={handleBackFromDetail} />
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
  onEditPO: (po: POHeader) => void
  onShowDetail: (po: POHeader) => void;
  isLoading: boolean
}

const POListPage: React.FC<POListPageProps> = ({ poList, onAddPO, isLoading, onDeletePO, onEditPO, onShowDetail}) => (
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
              <Button variant="secondary" onClick={() => onShowDetail(po)}>Detail</Button>
              <Button onClick={() => onEditPO(po)}>Revisi</Button>
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

  // Perbarui useEffect untuk memuat item PO
  useEffect(() => {
    if (editingPO) {
      // Isi data header
      setPoData({
        nomorPo: editingPO.po_number,
        namaCustomer: editingPO.project_name,
        tanggalMasuk: editingPO.created_at ? editingPO.created_at.split('T')[0] : today,
        tanggalKirim: editingPO.deadline || '',
        prioritas: editingPO.priority || 'Normal',
        alamatKirim: '',
        catatan: editingPO.notes || '',
      });

      // Panggil backend untuk mengambil item yang terkait
      const fetchPOItems = async () => {
        try {
          // @ts-ignore
          const poItems = await window.api.listPOItems(editingPO.id);
          setItems(poItems);
          console.log("Item PO berhasil dimuat:", poItems);
        } catch (error) {
          console.error("Gagal memuat item PO:", error);
        }
      };

      fetchPOItems();

    } else {
      // Reset form jika bukan mode edit
      setPoData({
        nomorPo: '',
        namaCustomer: '',
        tanggalMasuk: today,
        tanggalKirim: '',
        prioritas: 'Normal',
        alamatKirim: '',
        catatan: '',
      });
      setItems([]);
    }
  }, [editingPO]);

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
          <h1>{editingPO ? 'Edit Purchase Order' : 'Input Purchase Order'}</h1>
          <p>{editingPO ? 'Perbarui data PO' : 'Buat PO baru dengan spesifikasi detail produk'}</p>
        </div>
        <div className="header-actions">
          <Button onClick={handlePingTest} style={{ backgroundColor: '#2F855A' }}>
            Tes Jembatan (Ping)
          </Button>
          <Button variant="secondary">◎ Preview</Button>
          <Button onClick={handleSaveOrUpdatePO} disabled={isSaving}>
            {isSaving ? 'Menyimpan...' : (editingPO ? 'Perbarui PO' : 'Simpan PO')}
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
            disabled={!!editingPO}
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

// --- Komponen Halaman Detail PO ---
interface PODetailPageProps {
    po: POHeader | null;
    onBackToList: () => void;
}

const PODetailPage: React.FC<PODetailPageProps> = ({ po, onBackToList }) => {
    const [items, setItems] = useState<POItem[]>([]);
    const [isLoadingItems, setIsLoadingItems] = useState(true);

    useEffect(() => {
        if (po) {
            const fetchItems = async () => {
                try {
                    setIsLoadingItems(true);
                    // @ts-ignore
                    const poItems = await window.api.listPOItems(po.id);
                    setItems(poItems);
                    console.log("Items untuk detail PO berhasil dimuat:", poItems);
                } catch (error) {
                    console.error("Gagal memuat item untuk detail:", error);
                } finally {
                    setIsLoadingItems(false);
                }
            };
            fetchItems();
        }
    }, [po]);

    if (!po) {
        return (
            <div className="page-container">
                <p>Data PO tidak ditemukan.</p>
                <Button onClick={onBackToList}>Kembali ke Daftar</Button>
            </div>
        );
    }

    return (
        <div className="page-container">
            <div className="page-header">
                <div>
                    <h1>Detail Purchase Order: {po.po_number}</h1>
                    <p>Informasi lengkap dan daftar item untuk PO ini.</p>
                </div>
                <Button onClick={onBackToList}>Kembali</Button>
            </div>
            <Card>
                <h2>Informasi Dasar</h2>
                <div className="detail-grid">
                    <div><b>Nomor PO:</b> {po.po_number}</div>
                    <div><b>Nama Customer:</b> {po.project_name}</div>
                    <div><b>Tanggal Masuk:</b> {po.created_at ? new Date(po.created_at).toLocaleDateString() : '-'}</div>
                    <div><b>Target Kirim:</b> {po.deadline ? new Date(po.deadline).toLocaleDateString() : '-'}</div>
                    <div><b>Prioritas:</b> {po.priority}</div>
                    <div><b>Status:</b> {po.status}</div>
                </div>
                {po.notes && (
                    <div>
                        <h3>Catatan:</h3>
                        <p>{po.notes}</p>
                    </div>
                )}
            </Card>

            <div className="item-section-header">
                <h2>Daftar Item</h2>
            </div>
            {isLoadingItems ? (
                <div className="loading-spinner">⏳ Loading item...</div>
            ) : items.length === 0 ? (
                <p>Tidak ada item terdaftar untuk PO ini.</p>
            ) : (
                items.map((item, index) => (
                    <Card key={item.id} className="item-card">
                        <div className="item-card-header">
                            <h4>Item #{index + 1}</h4>
                        </div>
                        <div className="form-grid">
                            <Input label="Produk ID" value={item.productId} disabled />
                            <Input label="Catatan / Notes" value={item.notes} disabled />
                            <Input label="Qty" type="number" value={item.qty} disabled />
                            <Input label="Satuan" value={item.satuan} disabled />
                            <Input label="Tebal (mm)" type="number" value={item.thickness} disabled />
                            <Input label="Lebar (mm)" type="number" value={item.width} disabled />
                            <Input label="Panjang (mm)" type="number" value={item.length} disabled />
                        </div>
                    </Card>
                ))
            )}
        </div>
    );
};


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
