import React, { useState, useEffect, useCallback } from 'react'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { Textarea } from '../components/textarea'
import { Button } from '../components/Button'
import { POHeader, POItem } from '../types'
import { AddProductModal } from '../components/AddProductModal'

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
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [poPhotoPath, setPoPhotoPath] = useState<string | null>(null)
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false)

  // Fungsi baru untuk membuat objek item kosong
  const createEmptyItem = (): POItem => ({
    id: Date.now(),
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
    notes: '',
    kubikasi: 0
  })

  useEffect(() => {
    if (editingPO) {
      // @ts-ignore
      setPoPhotoPath(editingPO.photo_url || null)
    } else {
      setPoPhotoPath(null)
    }
  }, [editingPO])

  const handleSelectPoPhoto = async () => {
    // @ts-ignore
    const selectedPath = await window.api.openFileDialog()
    if (selectedPath) {
      setPoPhotoPath(selectedPath)
    }
  }

  const handleCancelPoPhoto = () => {
    setPoPhotoPath(null)
  }

  const getUniqueOptions = (field: keyof (typeof productList)[0]) => {
    return productList
      .map((p) => p[field])
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
  }

  const fetchProducts = useCallback(async () => {
    try {
      // @ts-ignore
      const products = await window.api.getProducts()
      setProductList(products)
      console.log('Daftar produk berhasil di-refresh.')
    } catch (error) {
      console.error('❌ Gagal memuat daftar produk:', error)
    }
  }, [])

  useEffect(() => {
    if (editingPO) {
      setPoData({
        nomorPo: editingPO.po_number,
        namaCustomer: editingPO.project_name,
        tanggalMasuk: editingPO.created_at ? editingPO.created_at.split('T')[0] : today,
        tanggalKirim: editingPO.deadline || '',
        prioritas: editingPO.priority || 'Normal',
        alamatKirim: '',
        catatan: editingPO.notes || ''
      })

      const fetchPOItems = async () => {
        try {
          // @ts-ignore
          const poItems = await window.api.listPOItems(editingPO.id)
          setItems(poItems)
        } catch (error) {
          console.error('❌ Gagal memuat item PO:', error)
        }
      }
      fetchPOItems()
    } else {
      setPoData({
        nomorPo: '',
        namaCustomer: '',
        tanggalMasuk: today,
        tanggalKirim: '',
        prioritas: 'Normal',
        alamatKirim: '',
        catatan: ''
      })
      // Tambahkan satu baris kosong saat membuat PO baru
      setItems([createEmptyItem()])
    }

    fetchProducts()
  }, [editingPO, fetchProducts])

  const handleDataChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setPoData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleAddItem = () => {
    setItems((prev) => [...prev, createEmptyItem()])
  }

  const handleItemChange = (id: number | string, field: keyof POItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const updatedItem = { ...item, [field]: value }
          return { ...updatedItem, kubikasi: calculateKubikasi(updatedItem) }
        }
        return item
      })
    )
  }

  const handleRemoveItem = (id: number | string) => {
    // Jangan biarkan baris terakhir dihapus
    if (items.length <= 1) return
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleSaveOrUpdatePO = async () => {
    if (!poData.nomorPo || !poData.namaCustomer) {
      return alert('Nomor PO dan Nama Customer harus diisi!')
    }
    if (items.length === 0) {
      return alert('Tambahkan minimal satu item.')
    }

    setIsSaving(true)
    try {
      const itemsWithKubikasi = items.map((item) => ({
        ...item,
        kubikasi: calculateKubikasi(item)
      }))

      const kubikasiTotal = itemsWithKubikasi.reduce((acc, item) => acc + (item.kubikasi || 0), 0)

      const payload = {
        ...poData,
        items: itemsWithKubikasi,
        kubikasi_total: kubikasiTotal,
        poId: editingPO?.id,
        poPhotoPath: poPhotoPath,
        acc_marketing: poData.marketing
      }
      // @ts-ignore
      const result = editingPO
        ? // @ts-ignore
          await window.api.updatePO(payload)
        : // @ts-ignore
          await window.api.saveNewPO(payload)

      if (result.success) {
        alert(`PO berhasil ${editingPO ? 'diperbarui' : 'disimpan'} dan file gambar telah diunggah!`)
        onSaveSuccess()
      } else {
        throw new Error(result.error || 'Terjadi kesalahan yang tidak diketahui di backend.')
      }
    } catch (error) {
      alert(`❌ Gagal menyimpan PO: ${(error as Error).message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePreviewPO = async () => {
    if (items.length === 0) {
      return alert('Tambahkan minimal satu item untuk preview.')
    }
    setIsPreviewing(true)
    try {
      const itemsWithKubikasi = items.map((item) => ({
        ...item,
        kubikasi: calculateKubikasi(item)
      }))

      const kubikasiTotal = itemsWithKubikasi.reduce((acc, item) => acc + (item.kubikasi || 0), 0)

      const payload = {
        ...poData,
        items: itemsWithKubikasi,
        kubikasi_total: kubikasiTotal,
        poPhotoPath: poPhotoPath,
        acc_marketing: poData.marketing
      }

      // @ts-ignore
      const result = await window.api.previewPO(payload)

      if (result.success) {
        const imageWindow = window.open()
        if (imageWindow) {
          imageWindow.document.write(
            `<title>PO Preview</title><style>body{margin:0;}</style><img src="data:image/jpeg;base64,${result.base64Data}" style="width:100%;">`
          )
        }
      } else {
        throw new Error(result.error || 'Gagal menghasilkan data preview.')
      }
    } catch (error) {
      alert(`❌ Gagal preview PO: ${(error as Error).message}`)
    } finally {
      setIsPreviewing(false)
    }
  }

  const calculateKubikasi = (item: POItem) => {
    const tebal = item.thickness_mm || 0
    const lebar = item.width_mm || 0
    const panjang = item.length_mm || 0
    const qty = item.quantity || 0

    if (item.satuan === 'pcs') {
      return (tebal * lebar * panjang * qty) / 1_000_000_000
    }
    if (item.satuan === 'm1') {
      return (tebal * lebar * qty) / 1_000_000
    }
    if (item.satuan === 'm2') {
      return (tebal * qty) / 1000
    }
    return 0
  }

  const totalKubikasi = items.reduce((acc, item) => acc + calculateKubikasi(item), 0)

  return (
    <div className="page-container">
      {/* BAGIAN INFORMASI DASAR PO (TIDAK BERUBAH) */}
      <div className="page-header">
        <div>
          <h1>{editingPO ? 'Revisi Purchase Order' : 'Input Purchase Order'}</h1>
          <p>{editingPO ? 'Perbarui data PO dan itemnya' : 'Buat PO baru dengan spesifikasi detail'}</p>
        </div>
        <div className="header-actions">
          <Button onClick={onSaveSuccess}>Kembali</Button>
          <Button variant="secondary" onClick={handlePreviewPO} disabled={isPreviewing}>
            {isPreviewing ? 'Membuka Preview...' : '◎ Preview'}
          </Button>
          <Button onClick={handleSaveOrUpdatePO} disabled={isSaving}>
            {isSaving ? 'Menyimpan...' : editingPO ? 'Simpan Revisi' : 'Simpan PO Baru'}
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

          {/* [TAMBAH] Input Combobox untuk Marketing */}
          <div className="form-group">
            <label>Marketing</label>
            <input
              list="marketing-list"
              name="marketing"
              value={poData.marketing}
              onChange={handleDataChange}
              placeholder="Pilih atau ketik nama"
              className="combobox-input"
            />
            <datalist id="marketing-list">
              {getUniqueOptions('marketing').map((name) => (
                <option key={name} value={name} />
              ))}
            </datalist>
          </div>
        </div>
        <Textarea
          label="Catatan"
          name="catatan"
          value={poData.catatan}
          onChange={handleDataChange}
          placeholder="Catatan khusus untuk PO ini..."
          rows={3}
        />
        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label>Foto Referensi PO (Opsional)</label>
          <div className="file-input-container">
            {poPhotoPath ? (
              <div className="file-preview">
                <span className="file-name" title={poPhotoPath}>
                  {poPhotoPath.split(/[/\\]/).pop()}
                </span>
                <Button variant="secondary" onClick={handleCancelPoPhoto} className="cancel-photo-btn">
                  Batal
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={handleSelectPoPhoto}>
                Pilih Foto
              </Button>
            )}
          </div>
        </div>
      </Card>

      {/* [DIROMBAK TOTAL] BAGIAN DAFTAR ITEM */}
      <div className="item-section-header">
        <h2>Daftar Item</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="secondary" onClick={() => setIsAddProductModalOpen(true)}>
            + Tambah Produk Master
          </Button>
          <Button onClick={handleAddItem}>+ Tambah Baris</Button>
        </div>
      </div>

      <Card>
        <div className="table-responsive">
          <table className="item-table">
            <thead>
              <tr>
                <th>Produk</th>
                <th>Jenis Kayu</th>
                <th>Profil</th>
                <th>Warna</th>
                <th>Finishing</th>
                <th>Sample</th>
                <th>Ukuran (T x L x P)</th>
                <th>Tipe Pjg</th>
                <th>Qty</th>
                <th>Catatan Item</th>
                <th>Aksi</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  {/* Produk */}
                  <td style={{ minWidth: '150px' }}>
                    <input
                      list="product-list"
                      value={item.product_name}
                      onChange={(e) => handleItemChange(item.id, 'product_name', e.target.value)}
                      placeholder="Pilih/Ketik Produk"
                    />
                    <datalist id="product-list">
                      {getUniqueOptions('product_name').map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </td>
                  {/* Jenis Kayu */}
                  <td style={{ minWidth: '130px' }}>
                    <input
                      list="wood-type-list"
                      value={item.wood_type}
                      onChange={(e) => handleItemChange(item.id, 'wood_type', e.target.value)}
                      placeholder="Pilih/Ketik Kayu"
                    />
                    <datalist id="wood-type-list">
                      {getUniqueOptions('wood_type').map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </td>
                  {/* Profil */}
                  <td style={{ minWidth: '100px' }}>
                    <input
                      list="profile-list"
                      type="text"
                      value={item.profile}
                      onChange={(e) => handleItemChange(item.id, 'profile', e.target.value)}
                      placeholder="Pilih/Ketik Profil"
                    />
                     <datalist id="profile-list">
                      {getUniqueOptions('profile').map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </td>
                  {/* Warna */}
                  <td style={{ minWidth: '100px' }}>
                    <input
                      list="color-list"
                      type="text"
                      value={item.color}
                      onChange={(e) => handleItemChange(item.id, 'color', e.target.value)}
                      placeholder="Pilih/Ketik Warna"
                    />
                    <datalist id="color-list">
                      {getUniqueOptions('color').map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </td>
                  {/* Finishing */}
                  <td style={{ minWidth: '120px' }}>
                    <input
                      list="finishing-list"
                      value={item.finishing}
                      onChange={(e) => handleItemChange(item.id, 'finishing', e.target.value)}
                      placeholder="Pilih/Ketik Finishing"
                    />
                    <datalist id="finishing-list">
                      {getUniqueOptions('finishing').map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </td>
                  {/* Sample */}
                  <td style={{ minWidth: '120px' }}>
                     <input
                      list="sample-list"
                      value={item.sample}
                      onChange={(e) => handleItemChange(item.id, 'sample', e.target.value)}
                      placeholder="Pilih/Ketik Sample"
                    />
                    <datalist id="sample-list">
                      {getUniqueOptions('sample').map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </td>
                  {/* Ukuran (T x L x P) */}
                  <td style={{ minWidth: '200px' }}>
                    <div className="size-inputs">
                      <input
                        type="number" // <-- Ini adalah input angka biasa
                        value={item.thickness_mm}
                        onChange={(e) => handleItemChange(item.id, 'thickness_mm', Number(e.target.value))}
                      />
                      <span>x</span>
                      <input
                        type="number" // <-- Ini adalah input angka biasa
                        value={item.width_mm}
                        onChange={(e) => handleItemChange(item.id, 'width_mm', Number(e.target.value))}
                      />
                      <span>x</span>
                      <input
                        type="number" // <-- Ini adalah input angka biasa
                        value={item.length_mm}
                        onChange={(e) => handleItemChange(item.id, 'length_mm', Number(e.target.value))}
                      />
                    </div>
                  </td>
                  {/* Tipe Panjang */}
                  <td style={{ minWidth: '80px' }}>
                     <input
                      type="text"
                      value={item.length_type}
                      onChange={(e) => handleItemChange(item.id, 'length_type', e.target.value)}
                    />
                  </td>
                  {/* Kuantitas */}
                  <td style={{ minWidth: '150px' }}>
                    <div className="quantity-inputs">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', Number(e.target.value))}
                      />
                      <select
                        value={item.satuan}
                        onChange={(e) => handleItemChange(item.id, 'satuan', e.target.value)}
                      >
                        <option value="pcs">pcs</option>
                        <option value="m1">m1</option>
                        <option value="m2">m2</option>
                      </select>
                    </div>
                  </td>
                  {/* Catatan Item */}
                  <td style={{ minWidth: '180px' }}>
                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) => handleItemChange(item.id, 'notes', e.target.value)}
                      placeholder="Catatan..."
                    />
                  </td>
                  {/* Aksi */}
                  <td>
                    <Button variant="danger" onClick={() => handleRemoveItem(item.id)}>
                      Hapus
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* BAGIAN KUBIKASI TOTAL (TIDAK BERUBAH) */}
      <Card>
        <h2>Kubikasi Total</h2>
        <p>
          <b>{totalKubikasi.toFixed(3)} m³</b>
        </p>
      </Card>

      {/* MODAL (TIDAK BERUBAH) */}
      <AddProductModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        onSaveSuccess={fetchProducts}
      />
    </div>
  )
}

export default InputPOPage