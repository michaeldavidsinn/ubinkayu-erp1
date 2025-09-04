/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable prettier/prettier */
import React, { useState, useEffect, useMemo } from 'react'
import { Card } from './components/Card'
import { Input } from './components/Input'
import { Textarea } from './components/textarea'
import { Button } from './components/Button'

// --- Tipe Data ---
interface POItem {
  id: number
  purchase_order_id?: string
  revision_id?: string
  product_id: string
  product_name: string
  wood_type: string
  profile: string
  color: string
  finishing: string
  sample: string
  marketing: string
  thickness_mm: number
  width_mm: number
  length_mm: number
  length_type: string
  quantity: number
  satuan: string
  location: string
  notes: string
}

interface POHeader {
  id: string
  po_number: string
  project_name: string
  created_at: string
  status?: string
  priority?: string
  deadline?: string
  notes?: string
}

interface PORevision {
  id: string
  purchase_order_id: string
  revision_number: string
  deadline: string
  status: string
  priority: string
  notes: string
  created_at: string
}

// --- Komponen Utama Aplikasi ---
function App() {
  const [view, setView] = useState<'list' | 'input' | 'detail'>('list')
  const [purchaseOrders, setPurchaseOrders] = useState<POHeader[]>([])
  const [editingPO, setEditingPO] = useState<POHeader | null>(null)
  const [detailPO, setDetailPO] = useState<POHeader | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [products, setProducts] = useState<any[]>([])

  useEffect(() => {
    async function loadProducts() {
      try {
        const result = await window.api.getProducts()
        console.log('Produk dari sheet:', result)
        setProducts(result)
      } catch (err) {
        console.error('Gagal load produk:', err)
      }
    }
    loadProducts()
  }, [])

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
    setDetailPO(po)
    setView('detail')
  }

  const handleBackToList = () => {
    setEditingPO(null)
    fetchPOs()
    setView('list')
  }

  const handleBackFromDetail = () => {
    setDetailPO(null)
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
            onEditPO={handleEditPO}
            onShowDetail={handleShowDetail}
            isLoading={isLoading}
          />
        ) : view === 'input' ? (
          <InputPOPage onSaveSuccess={handleBackToList} editingPO={editingPO} />
        ) : (
          <PODetailPage po={detailPO} onBackToList={handleBackFromDetail} />
        )}
      </main>
    </div>
  )
}

interface FilterPanelProps {
  filters: any;
  onFilterChange: (name: string, value: any) => void;
  poCount: { displayed: number; total: number };
}

const FilterPanel: React.FC<FilterPanelProps> = ({ filters, onFilterChange, poCount }) => {
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onFilterChange(e.target.name, e.target.value);
  };

  return (
    <Card className="filter-panel">
      <div className="filter-header">
        <h3>📊 Sort & Filter Purchase Order</h3>
        <span>
          Menampilkan {poCount.displayed} dari {poCount.total} PO
        </span>
      </div>

      <div className="filter-grid">
        {/* --- Urutkan --- */}
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

        {/* --- Pencarian --- */}
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

        {/* --- Filter Dropdown --- */}
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

        {/* --- Filter Tanggal --- */}
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
          <Input type="date" name="deadlineFrom" value={filters.deadlineFrom} onChange={handleInputChange} />
        </div>
        <div className="form-group">
          <label>Tanggal Kirim Sampai</label>
          <Input type="date" name="deadlineTo" value={filters.deadlineTo} onChange={handleInputChange} />
        </div>
      </div>
    </Card>
  );
};

// --- Halaman: Daftar Purchase Order ---
interface POListPageProps {
  poList: POHeader[];
  onAddPO: () => void;
  onDeletePO: (poId: string) => Promise<void>;
  onEditPO: (po: POHeader) => void;
  onShowDetail: (po: POHeader) => void;
  isLoading: boolean;
}

const POListPage: React.FC<POListPageProps> = ({
  poList,
  onAddPO,
  isLoading,
  onDeletePO,
  onEditPO,
  onShowDetail
}) => {
  // State untuk menyimpan semua kriteria filter
  const [filters, setFilters] = useState({
    sortBy: 'deadline-asc',
    searchQuery: '',
    status: 'all',
    priority: 'all',
    dateFrom: '',
    dateTo: '',
    deadlineFrom: '',
    deadlineTo: ''
  });

  const handleFilterChange = (name: string, value: any) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // Logika untuk memfilter dan mengurutkan data PO
  const filteredAndSortedPOs = useMemo(() => {
    let processedPOs = [...poList];

    // 1. Terapkan Filter Pencarian
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      processedPOs = processedPOs.filter(
        po =>
          po.po_number.toLowerCase().includes(query) ||
          po.project_name.toLowerCase().includes(query)
      );
    }

    // 2. Terapkan Filter Status
    if (filters.status !== 'all') {
      processedPOs = processedPOs.filter(po => po.status === filters.status);
    }

    // 3. Terapkan Filter Prioritas
    if (filters.priority !== 'all') {
      processedPOs = processedPOs.filter(po => po.priority === filters.priority);
    }

    // 4. Terapkan Filter Tanggal Input
    if (filters.dateFrom) {
      processedPOs = processedPOs.filter(po => new Date(po.created_at) >= new Date(filters.dateFrom));
    }
    if (filters.dateTo) {
      processedPOs = processedPOs.filter(po => new Date(po.created_at) <= new Date(filters.dateTo + 'T23:59:59'));
    }

    // 5. Terapkan Filter Tanggal Kirim
    if (filters.deadlineFrom) {
      processedPOs = processedPOs.filter(po => po.deadline && new Date(po.deadline) >= new Date(filters.deadlineFrom));
    }
    if (filters.deadlineTo) {
      processedPOs = processedPOs.filter(po => po.deadline && new Date(po.deadline) <= new Date(filters.deadlineTo + 'T23:59:59'));
    }

    // 6. Terapkan Logika Pengurutan (Sorting)
    const priorityMap = { Urgent: 1, High: 2, Normal: 3 };
    switch (filters.sortBy) {
      case 'deadline-asc':
        processedPOs.sort((a, b) => new Date(a.deadline || 0).getTime() - new Date(b.deadline || 0).getTime());
        break;
      case 'deadline-desc':
        processedPOs.sort((a, b) => new Date(b.deadline || 0).getTime() - new Date(a.deadline || 0).getTime());
        break;
      case 'created-desc':
        processedPOs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'created-asc':
        processedPOs.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
        break;
      case 'priority':
        processedPOs.sort((a, b) => (priorityMap[a.priority] || 4) - (priorityMap[b.priority] || 4));
        break;
    }

    return processedPOs;
  }, [poList, filters]);

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>Kelola Purchase Order</h1>
          <p>Pantau dan kelola semua pesanan produksi dengan fitur sort dan filter</p>
        </div>
        <Button onClick={onAddPO}>+ Tambah PO Baru</Button>
      </div>

      {/* Tampilkan Panel Filter di sini */}
      <FilterPanel
        filters={filters}
        onFilterChange={handleFilterChange}
        poCount={{ displayed: filteredAndSortedPOs.length, total: poList.length }}
      />

      <div className="po-grid">
        {isLoading ? (
          <div className="loading-spinner">⏳ Loading data PO dari Google Sheets...</div>
        ) : filteredAndSortedPOs.length === 0 ? (
          <Card>
            <p>Tidak ada data Purchase Order yang cocok dengan kriteria filter Anda.</p>
          </Card>
        ) : (
          // Gunakan data yang sudah difilter untuk me-render kartu
          filteredAndSortedPOs.map((po) => (
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
                  <b>Status PO:</b> {po.status || 'Open'}
                </span>
              </div>
              <div className="po-card-info">
                <span>
                  <b>Tanggal Input:</b>{' '}
                  {po.created_at ? new Date(po.created_at).toLocaleDateString('id-ID') : '-'}
                </span>
              </div>
              <div className="po-card-info">
                <span>
                  <b>Target Kirim:</b>{' '}
                  {po.deadline ? new Date(po.deadline).toLocaleDateString('id-ID') : '-'}
                </span>
              </div>
              <div className="po-card-footer">
                <Button variant="secondary" onClick={() => onShowDetail(po)}>Detail</Button>
                <Button onClick={() => onEditPO(po)}>Revisi</Button>
                <Button variant="secondary" onClick={() => onDeletePO(po.id)}>Hapus</Button>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

// --- Halaman: Input Purchase Order ---
interface InputPOPageProps {
  onSaveSuccess: () => void
  editingPO: POHeader | null
}

const InputPOPage: React.FC<InputPOPageProps> = ({ onSaveSuccess, editingPO }) => {
  const today = new Date().toISOString().split('T')[0]
  const [productList, setProductList] = useState<any[]>([])
  const [poData, setPoData] = useState({
    nomorPo: editingPO?.po_number || '',
    namaCustomer: editingPO?.project_name || '',
    tanggalMasuk: editingPO?.created_at ? editingPO.created_at.split('T')[0] : today,
    tanggalKirim: editingPO?.deadline || '',
    prioritas: editingPO?.priority || 'Normal',
    alamatKirim: '',
    catatan: editingPO?.notes || ''
  })
  const [items, setItems] = useState<POItem[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const getUniqueOptions = (field: keyof (typeof productList)[0]) => {
    return productList
      .map((p) => p[field]) // ambil kolom yang dipilih
      .filter(Boolean) // buang yang kosong/null
      .filter((v, i, a) => a.indexOf(v) === i) // filter duplikat manual
  }

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
        catatan: editingPO.notes || ''
      })

      // Panggil backend untuk mengambil item yang terkait
      const fetchPOItems = async () => {
        try {
          // @ts-ignore
          const poItems = await window.api.listPOItems(editingPO.id)
          setItems(poItems)
          console.log('Item PO berhasil dimuat:', poItems)
        } catch (error) {
          console.error('Gagal memuat item PO:', error)
        }
      }

      fetchPOItems()
    } else {
      // Reset form jika bukan mode edit
      setPoData({
        nomorPo: '',
        namaCustomer: '',
        tanggalMasuk: today,
        tanggalKirim: '',
        prioritas: 'Normal',
        alamatKirim: '',
        catatan: ''
      })
      setItems([])
    }
    const fetchProducts = async () => {
      try {
        // @ts-ignore
        const products = await window.api.getProducts()
        setProductList(products)
      } catch (error) {
        console.error('Gagal memuat daftar produk:', error)
      }
    }
    fetchProducts()
  }, [editingPO])

  const handleDataChange = (
    e: React.ChangeEvent<
      HTMLInputElement | React.ChangeEvent<HTMLTextAreaElement> | HTMLSelectElement
    >
  ) => setPoData((prev) => ({ ...prev, [e.target.name]: e.target.value }))

  const handleAddItem = () =>
    setItems((prev) => [
      ...prev,
      {
        id: Date.now(),
        purchase_order_id: '',
        revision_id: '',
        product_id: '',
        product_name: '',
        wood_type: '',
        profile: '',
        color: '',
        finishing: '',
        sample: '',
        marketing: '',
        thickness_mm: 0,
        width_mm: 0,
        length_mm: 0,
        length_type: '',
        quantity: 1,
        satuan: 'pcs',
        location: '',
        notes: ''
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
      const result = editingPO
        ? await window.api.updatePO(payload)
        : await window.api.saveNewPO(payload)

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
          <Button onClick={onSaveSuccess}>Kembali</Button>
          <Button onClick={handlePingTest} style={{ backgroundColor: '#2F855A' }}>
            Tes Jembatan (Ping)
          </Button>
          <Button variant="secondary">◎ Preview</Button>
          <Button onClick={handleSaveOrUpdatePO} disabled={isSaving}>
            {isSaving ? 'Menyimpan...' : editingPO ? 'Perbarui PO' : 'Simpan PO'}
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
            {/* Product ID tetap input */}
            <Input
              label="Product ID"
              value={item.product_id}
              onChange={(e) => handleItemChange(item.id, 'product_id', e.target.value)}
            />

            {/* Product Name */}
            <div className="form-field">
              <label>Product Name</label>
              <select
                value={item.product_name}
                onChange={(e) => handleItemChange(item.id, 'product_name', e.target.value)}
              >
                <option value="">Pilih Produk</option>
                {getUniqueOptions('product_name').map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>

            {/* Wood Type */}
            <div className="form-field">
              <label>Wood Type</label>
              <select
                value={item.wood_type}
                onChange={(e) => handleItemChange(item.id, 'wood_type', e.target.value)}
              >
                <option value="">Pilih Wood Type</option>
                {getUniqueOptions('wood_type').map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            </div>

            {/* Profile */}
            <div className="form-field">
              <label>Profile</label>
              <select
                value={item.profile}
                onChange={(e) => handleItemChange(item.id, 'profile', e.target.value)}
              >
                <option value="">Pilih Profile</option>
                {getUniqueOptions('profile').map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            </div>

            {/* Color */}
            <div className="form-field">
              <label>Color</label>
              <select
                value={item.color}
                onChange={(e) => handleItemChange(item.id, 'color', e.target.value)}
              >
                <option value="">Pilih Color</option>
                {getUniqueOptions('color').map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            </div>

            {/* Finishing */}
            <div className="form-field">
              <label>Finishing</label>
              <select
                value={item.finishing}
                onChange={(e) => handleItemChange(item.id, 'finishing', e.target.value)}
              >
                <option value="">Pilih Finishing</option>
                {getUniqueOptions('finishing').map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            </div>

            {/* Sample */}
            <div className="form-field">
              <label>Sample</label>
              <select
                value={item.sample}
                onChange={(e) => handleItemChange(item.id, 'sample', e.target.value)}
              >
                <option value="">Pilih Sample</option>
                {getUniqueOptions('sample').map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            </div>

            {/* Marketing */}
            <div className="form-field">
              <label>Marketing</label>
              <select
                value={item.marketing}
                onChange={(e) => handleItemChange(item.id, 'marketing', e.target.value)}
              >
                <option value="">Pilih Marketing</option>
                {getUniqueOptions('marketing').map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            </div>

            {/* Satuan */}
            <div className="form-field">
              <label>Satuan</label>
              <select
                value={item.satuan}
                onChange={(e) => handleItemChange(item.id, 'satuan', e.target.value)}
              >
                <option value="">Pilih Satuan</option>
                {getUniqueOptions('satuan').map((val) => (
                  <option key={val} value={val}>
                    {val}
                  </option>
                ))}
              </select>
            </div>

            {/* Sisanya tetap input number / text */}
            <Input
              label="Thickness (mm)"
              type="number"
              value={item.thickness_mm}
              onChange={(e) => handleItemChange(item.id, 'thickness_mm', Number(e.target.value))}
            />
            <Input
              label="Width (mm)"
              type="number"
              value={item.width_mm}
              onChange={(e) => handleItemChange(item.id, 'width_mm', Number(e.target.value))}
            />
            <Input
              label="Length (mm)"
              type="number"
              value={item.length_mm}
              onChange={(e) => handleItemChange(item.id, 'length_mm', Number(e.target.value))}
            />
            <Input
              label="Length Type"
              value={item.length_type}
              onChange={(e) => handleItemChange(item.id, 'length_type', e.target.value)}
            />
            <Input
              label="Quantity"
              type="number"
              value={item.quantity}
              onChange={(e) => handleItemChange(item.id, 'quantity', Number(e.target.value))}
            />
            <Input
              label="Location"
              value={item.location}
              onChange={(e) => handleItemChange(item.id, 'location', e.target.value)}
            />
            <Input
              label="Notes"
              value={item.notes}
              onChange={(e) => handleItemChange(item.id, 'notes', e.target.value)}
            />
          </div>
        </Card>
      ))}
    </div>
  )
}

// --- Komponen Halaman Detail PO ---
interface PODetailPageProps {
  po: POHeader | null
  onBackToList: () => void
}

const PODetailPage: React.FC<PODetailPageProps> = ({ po, onBackToList }) => {
  const [revisions, setRevisions] = useState<PORevision[]>([])
  const [selectedRevisionId, setSelectedRevisionId] = useState<string | null>(null)
  const [items, setItems] = useState<POItem[]>([])
  const [isLoading, setIsLoading] = useState(true)

  // Efek 1: Ambil daftar revisi saat PO berubah
  useEffect(() => {
    if (po) {
      const fetchRevisions = async () => {
        setIsLoading(true)
        try {
          // @ts-ignore
          const revs = await window.api.listPORevisions(po.id)
          setRevisions(revs)
          // Otomatis pilih revisi terbaru (paling atas setelah diurutkan)
          if (revs.length > 0) {
            setSelectedRevisionId(revs[0].id)
          } else {
            setIsLoading(false) // Tidak ada revisi, berhenti loading
          }
        } catch (error) {
          console.error('Gagal memuat daftar revisi:', error)
          setIsLoading(false)
        }
      }
      fetchRevisions()
    }
  }, [po])

  // Efek 2: Ambil item setiap kali revisi yang dipilih berubah
  useEffect(() => {
    if (selectedRevisionId) {
      const fetchItemsForRevision = async () => {
        setIsLoading(true)
        try {
          // @ts-ignore
          const poItems = await window.api.listPOItemsByRevision(selectedRevisionId)
          setItems(poItems)
        } catch (error) {
          console.error(`Gagal memuat item untuk revisi ${selectedRevisionId}:`, error)
        } finally {
          setIsLoading(false)
        }
      }
      fetchItemsForRevision()
    }
  }, [selectedRevisionId])

  if (!po) {
    return (
      <div className="page-container">
        <p>Data PO tidak ditemukan.</p>
        <Button onClick={onBackToList}>Kembali ke Daftar</Button>
      </div>
    )
  }

  // Cari data dari revisi yang sedang aktif untuk ditampilkan
  const currentRevision = revisions.find((r) => r.id === selectedRevisionId)

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
        {/* Menggunakan grid layout sederhana dengan 2 kolom */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
            gap: '24px'
          }}
        >
          {/* === Kolom Kiri === */}
          <div>
            {/* Info PO & Customer */}
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Nomor PO</p>
            <h3 style={{ margin: '4px 0 20px 0', fontSize: '1.5rem', color: '#111827' }}>
              {po.po_number}
            </h3>

            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Nama Customer</p>
            <h4 style={{ margin: '4px 0 20px 0', fontWeight: 500, color: '#1f2937' }}>
              {po.project_name}
            </h4>

            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Status</p>
            <h4 style={{ margin: '4px 0 0 0', fontWeight: 600, color: '#1f2937' }}>
              {currentRevision?.status || '-'}
            </h4>
          </div>

          {/* === Kolom Kanan === */}
          <div>
            {/* Info Tanggal & Prioritas */}
            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Tanggal Input PO</p>
            <h4 style={{ margin: '4px 0 20px 0', fontWeight: 500, color: '#1f2937' }}>
              {po.created_at ? new Date(po.created_at).toLocaleDateString('id-ID') : '-'}
            </h4>

            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Target Kirim</p>
            <h4 style={{ margin: '4px 0 20px 0', fontWeight: 500, color: '#1f2937' }}>
              {currentRevision?.deadline
                ? new Date(currentRevision.deadline).toLocaleDateString('id-ID')
                : '-'}
            </h4>

            <p style={{ color: '#6b7280', fontSize: '0.875rem', margin: 0 }}>Prioritas</p>
            <h4 style={{ margin: '4px 0 0 0', fontWeight: 'bold', color: '#1f2937' }}>
              {currentRevision?.priority || '-'}
            </h4>
          </div>
        </div>

        {/* === Bagian Catatan === */}
        {currentRevision?.notes && (
          <>
            <hr style={{ margin: '24px 0 16px 0', border: 0, borderTop: '1px solid #e5e7eb' }} />
            <div>
              <h4 style={{ margin: 0, color: '#374151' }}>
                Catatan (Revisi #{currentRevision.revision_number})
              </h4>
              <p style={{ marginTop: '8px', whiteSpace: 'pre-wrap', color: '#1f2937' }}>
                {currentRevision.notes}
              </p>
            </div>
          </>
        )}
      </Card>

      <div className="item-section-header">
        <h2>Daftar Item</h2>
        <div className="form-group">
          <label htmlFor="revision-select" style={{ marginRight: '10px' }}>
            Tampilkan Histori:
          </label>
          <select
            id="revision-select"
            value={selectedRevisionId || ''}
            onChange={(e) => setSelectedRevisionId(e.target.value)}
            disabled={revisions.length === 0}
          >
            {revisions.map((rev) => (
              <option key={rev.id} value={rev.id}>
                Revisi #{rev.revision_number} ({new Date(rev.created_at).toLocaleString('id-ID')})
              </option>
            ))}
          </select>
        </div>
      </div>

      {isLoading ? (
        <div className="loading-spinner">⏳ Loading data revisi...</div>
      ) : items.length === 0 ? (
        <Card>
          <p>Tidak ada item terdaftar untuk revisi ini.</p>
        </Card>
      ) : (
        items.map((item, index) => (
          <Card key={item.id} className="item-card">
            <div className="item-card-header">
              <h4>Item #{index + 1}</h4>
            </div>
            <div className="form-grid">
              {/* Semua input di-disable karena ini halaman detail */}
              <Input label="Produk ID" value={item.product_id} disabled />
              <Input label="Nama Produk" value={item.product_name} disabled />
              <Input label="Jenis Kayu" value={item.wood_type} disabled />
              <Input label="Profil" value={item.profile} disabled />
              <Input label="Warna" value={item.color} disabled />
              <Input label="Finishing" value={item.finishing} disabled />
              <Input label="Sample" value={item.sample} disabled />
              <Input label="Marketing" value={item.marketing} disabled />
              <Input label="Tebal (mm)" type="number" value={item.thickness_mm} disabled />
              <Input label="Lebar (mm)" type="number" value={item.width_mm} disabled />
              <Input label="Panjang (mm)" type="number" value={item.length_mm} disabled />
              <Input label="Jenis Panjang" value={item.length_type} disabled />
              <Input label="Qty" type="number" value={item.quantity} disabled />
              <Input label="Satuan" value={item.satuan} disabled />
              <Input label="Lokasi" value={item.location} disabled />
              <Input label="Catatan / Notes" value={item.notes} disabled />
            </div>
          </Card>
        ))
      )}
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
