/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/ban-ts-comment */
/* eslint-disable @typescript-eslint/explicit-function-return-type */
/* eslint-disable prettier/prettier */
// src/renderer/src/pages/InputPOPage.tsx

import React, { useState, useEffect } from 'react'
import { Card } from '../components/Card'
import { Input } from '../components/Input'
import { Textarea } from '../components/textarea'
import { Button } from '../components/Button'
import { POHeader, POItem } from '../types'

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

  useEffect(() => {
    // ... (useEffect Anda yang lain tidak perlu diubah)
    if (editingPO) {
        // ... (logika untuk mode edit)
        // [BARU] Jika mode edit, set juga path foto jika ada
        setPoPhotoPath(editingPO.photo_url || null);
    } else {
        // ... (logika untuk mode baru)
        setPoPhotoPath(null); // Pastikan path foto di-reset saat membuat PO baru
    }
  }, [editingPO])

  // [BARU] Fungsi untuk memilih foto PO
  const handleSelectPoPhoto = async () => {
    // @ts-ignore
    const selectedPath = await window.api.openFileDialog();
    if (selectedPath) {
      setPoPhotoPath(selectedPath);
    }
  };

  // [BARU] Fungsi untuk membatalkan pilihan foto PO
  const handleCancelPoPhoto = () => {
    setPoPhotoPath(null);
  };

  const getUniqueOptions = (field: keyof (typeof productList)[0]) => {
    return productList
      .map((p) => p[field])
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
  }

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
      setItems([])
    }

    const fetchProducts = async () => {
      try {
        // @ts-ignore
        const products = await window.api.getProducts()
        setProductList(products)
      } catch (error) {
        console.error('❌ Gagal memuat daftar produk:', error)
      }
    }
    fetchProducts()
  }, [editingPO])

  const handleDataChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setPoData((prev) => ({ ...prev, [e.target.name]: e.target.value }))
  }

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      {
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
      }
    ])
  }

  const handleItemChange = (id: number, field: keyof POItem, value: string | number) => {
    setItems((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, [field]: value, kubikasi: calculateKubikasi({ ...item, [field]: value }) } : item
      )
    )
  }

  const handleRemoveItem = (id: number) => {
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

// Ganti fungsi handleSaveOrUpdatePO Anda dengan versi ini

const handleSaveOrUpdatePO = async () => {
  // Validasi input (tetap sama)
  if (!poData.nomorPo || !poData.namaCustomer) {
    return alert('Nomor PO dan Nama Customer harus diisi!')
  }
  if (items.length === 0) {
    return alert('Tambahkan minimal satu item.')
  }

  setIsSaving(true)
  try {
    // Siapkan payload (tetap sama)
    const itemsWithKubikasi = items.map((item) => ({
      ...item,
      kubikasi: calculateKubikasi(item),
    }))

    const kubikasiTotal = itemsWithKubikasi.reduce(
      (acc, item) => acc + (item.kubikasi || 0),
      0
    )

    const payload = {
      ...poData,
      items: itemsWithKubikasi,
      kubikasi_total: kubikasiTotal,
      poId: editingPO?.id,
       poPhotoPath: poPhotoPath
    }
console.log('TITIK A (Frontend): Mengirim payload:', payload);
    // --- PERUBAHAN UTAMA DI SINI ---
    // Cukup panggil satu fungsi. Backend akan mengurus sisanya (save + upload).
    // @ts-ignore
    const result = editingPO
      ? await window.api.updatePO(payload)
      : await window.api.saveNewPO(payload)

    if (result.success) {
      alert(`PO berhasil ${editingPO ? 'diperbarui' : 'disimpan'} dan PDF telah diunggah!`)
      onSaveSuccess() // Kembali ke halaman daftar
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
        kubikasi: calculateKubikasi(item),
      }))

      const payload = {
        ...poData,
        items: itemsWithKubikasi,
      }

      // @ts-ignore
      const result = await window.api.previewPO(payload)

      if (result.success) {
        const pdfWindow = window.open()
        if (pdfWindow) {
          pdfWindow.document.write(
            `<iframe src="data:application/pdf;base64,${result.base64Data}" width="100%" height="100%"></iframe>`
          )
        }
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      alert(`❌ Gagal preview PO: ${(error as Error).message}`)
    } finally {
      setIsPreviewing(false)
    }
  }

  const calculateKubikasi = (item: POItem) => {
  // Ambil semua nilai dimensi dan kuantitas, default ke 0 jika tidak ada
  const tebal = item.thickness_mm || 0;
  const lebar = item.width_mm || 0;
  const panjang = item.length_mm || 0;
  const qty = item.quantity || 0;

  // Rumus untuk satuan 'pcs' (Potongan)
  // Volume = (Tebal(mm) * Lebar(mm) * Panjang(mm) * Jumlah Pcs) / 1 Miliar
  if (item.satuan === 'pcs') {
    return (tebal * lebar * panjang * qty) / 1_000_000_000;
  }

  // Rumus untuk satuan 'm1' (Meter Lari)
  // Volume = (Tebal(mm) * Lebar(mm) * Kuantitas(meter)) / 1 Juta
  if (item.satuan === 'm1') {
    // Di sini 'qty' adalah panjang dalam meter, jadi pembaginya berbeda
    return (tebal * lebar * qty) / 1_000_000;
  }

  // [BARU] Rumus untuk satuan 'm2' (Meter Persegi)
  // Volume = (Tebal(mm) * Kuantitas(meter persegi)) / 1000
  if (item.satuan === 'm2') {
    // Di sini 'qty' adalah luas dalam meter persegi
    return (tebal * qty) / 1000;
  }

  // Jika satuan tidak dikenali, kembalikan 0
  return 0;
};

  const totalKubikasi = items.reduce((acc, item) => acc + calculateKubikasi(item), 0)

  return (
    <div className="page-container">
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

      {/* Informasi Dasar */}
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
          label="Catatan"
          name="catatan"
          value={poData.catatan}
          onChange={handleDataChange}
          placeholder="Catatan khusus untuk PO ini..."
          rows={3}
        />
        {/* [BARU] Tambahkan bagian untuk pilih foto di sini */}
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
              <Button variant="secondary" onClick={handleSelectPoPhoto}>Pilih Foto</Button>
            )}
          </div>
        </div>
      </Card>

      {/* Daftar Item */}
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
            {/* Fields Produk & Spesifikasi */}
            <Input
              label="Product ID"
              value={item.product_id}
              onChange={(e) => handleItemChange(item.id, 'product_id', e.target.value)}
            />
            <div className="form-group">
              <label>Product Name</label>
              <select
                value={item.product_name}
                onChange={(e) => handleItemChange(item.id, 'product_name', e.target.value)}
              >
                <option value="">Pilih Produk</option>
                {getUniqueOptions('product_name').map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Wood Type</label>
              <select
                value={item.wood_type}
                onChange={(e) => handleItemChange(item.id, 'wood_type', e.target.value)}
              >
                <option value="">Pilih Tipe Kayu</option>
                {getUniqueOptions('wood_type').map((val) => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Profile</label>
              <select
                value={item.profile}
                onChange={(e) => handleItemChange(item.id, 'profile', e.target.value)}
              >
                <option value="">Pilih Profil</option>
                {getUniqueOptions('profile').map((val) => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Color</label>
              <select
                value={item.color}
                onChange={(e) => handleItemChange(item.id, 'color', e.target.value)}
              >
                <option value="">Pilih Warna</option>
                {getUniqueOptions('color').map((val) => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Finishing</label>
              <select
                value={item.finishing}
                onChange={(e) => handleItemChange(item.id, 'finishing', e.target.value)}
              >
                <option value="">Pilih Finishing</option>
                {getUniqueOptions('finishing').map((val) => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Sample</label>
              <select
                value={item.sample}
                onChange={(e) => handleItemChange(item.id, 'sample', e.target.value)}
              >
                <option value="">Pilih Sample</option>
                {getUniqueOptions('sample').map((val) => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>
            <div className="form-group">
              <label>Marketing</label>
              <select
                value={item.marketing}
                onChange={(e) => handleItemChange(item.id, 'marketing', e.target.value)}
              >
                <option value="">Pilih Marketing</option>
                {getUniqueOptions('marketing').map((val) => (
                  <option key={val} value={val}>{val}</option>
                ))}
              </select>
            </div>

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
              placeholder="e.g., RL, Fix"
            />
            <Input
              label="Quantity"
              type="number"
              value={item.quantity}
              onChange={(e) => handleItemChange(item.id, 'quantity', Number(e.target.value))}
            />
            <div className="form-group">
              <label>Satuan</label>
              <select
                value={item.satuan}
                onChange={(e) => handleItemChange(item.id, 'satuan', e.target.value)}
              >
                <option value="pcs">pcs</option>
                <option value="m1">m1</option>
                <option value="m1">m2</option>
              </select>
            </div>
            <Input
              label="Location"
              value={item.location}
              onChange={(e) => handleItemChange(item.id, 'location', e.target.value)}
              placeholder="e.g., Gudang A"
            />
            <Input
              label="Catatan Item"
              value={item.notes}
              onChange={(e) => handleItemChange(item.id, 'notes', e.target.value)}
            />
          </div>
          <div className="form-group">
            <label>Kubikasi Item</label>
            <p><b>{calculateKubikasi(item).toFixed(3)} m³</b></p>
          </div>
        </Card>
      ))}

      <Card>
        <h2>Kubikasi Total</h2>
        <p>
          <b>{totalKubikasi.toFixed(3)} m³</b>
        </p>
      </Card>
    </div>
  )
}

export default InputPOPage
