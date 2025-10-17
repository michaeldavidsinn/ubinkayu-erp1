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
    catatan: editingPO?.notes || '',
    marketing: editingPO?.marketing || ''
  })
  const [items, setItems] = useState<POItem[]>([])
  const [isSaving, setIsSaving] = useState(false)
  const [isPreviewing, setIsPreviewing] = useState(false)
  const [poPhotoPath, setPoPhotoPath] = useState<string | null>(null)
  const [isAddProductModalOpen, setIsAddProductModalOpen] = useState(false)

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

  const getUniqueOptions = (field: keyof (typeof productList)[0]) => {
    return productList
      .map((p) => p[field])
      .filter(Boolean)
      .filter((v, i, a) => a.indexOf(v) === i)
      .sort()
  }

  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.toLowerCase()
    const s2 = str2.toLowerCase()
    const longer = s1.length > s2.length ? s1 : s2
    const shorter = s1.length > s2.length ? s2 : s1

    if (longer.length === 0) return 1.0
    const editDistance = getEditDistance(longer, shorter)
    return (longer.length - editDistance) / longer.length
  }

  const getEditDistance = (s1: string, s2: string): number => {
    const costs: number[] = []
    for (let i = 0; i <= s1.length; i++) {
      let lastValue = i
      for (let j = 0; j <= s2.length; j++) {
        if (i === 0) {
          costs[j] = j
        } else if (j > 0) {
          let newValue = costs[j - 1]
          if (s1.charAt(i - 1) !== s2.charAt(j - 1)) {
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1
          }
          costs[j - 1] = lastValue
          lastValue = newValue
        }
      }
      if (i > 0) costs[s2.length] = lastValue
    }
    return costs[s2.length]
  }

  const findBestMatch = (field: string, value: string): string => {
    if (!value.trim()) return value

    const options = getUniqueOptions(field as any)

    // First, try exact match (case-insensitive)
    const exactMatch = options.find((opt) => opt.toLowerCase() === value.toLowerCase())
    if (exactMatch) return exactMatch

    // Then, try fuzzy matching with similarity threshold
    const matches = options
      .map((opt) => ({
        option: opt,
        similarity: calculateSimilarity(value, opt)
      }))
      .filter((m) => m.similarity >= 0.6) // 60% similarity threshold
      .sort((a, b) => b.similarity - a.similarity)

    return matches.length > 0 ? matches[0].option : value
  }

  useEffect(() => {
    if (editingPO) {
      setPoPhotoPath(editingPO.photo_url as string | null || null)
    } else {
      setPoPhotoPath(null)
    }
  }, [editingPO])

  const handleSelectPoPhoto = async () => {
    try {
      const selectedPath = await (window as any).api.openFileDialog()
      if (selectedPath) {
        setPoPhotoPath(selectedPath)
      }
    } catch (error) {
      console.error('Failed to select photo:', error)
    }
  }

  const handleCancelPoPhoto = () => {
    setPoPhotoPath(null)
  }

  const fetchProducts = useCallback(async () => {
    try {
      const products = await (window as any).api.getProducts()
      setProductList(products)
      console.log('Product list refreshed successfully.')
    } catch (error) {
      console.error('Failed to load product list:', error)
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
        catatan: editingPO.notes || '',
        marketing: (editingPO as any).marketing || ''
      })

      const fetchPOItems = async () => {
        try {
          const poItems = await (window as any).api.listPOItems(editingPO.id)
          setItems(poItems)
        } catch (error) {
          console.error('Failed to load PO items:', error)
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
        catatan: '',
        marketing: ''
      })
      setItems([createEmptyItem()])
    }

    fetchProducts()
  }, [editingPO, fetchProducts, today])

  const handleDataChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target
    setPoData((prev) => ({ ...prev, [name]: value }))
  }

  const handleDataBlur = (field: string, value: string) => {
    const correctedValue = findBestMatch(field, value)
    setPoData((prev) => ({ ...prev, [field]: correctedValue }))
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

  const handleItemBlur = (id: number | string, field: keyof POItem, value: string | number) => {
    if (typeof value !== 'string') return

    setItems((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          const correctedValue = findBestMatch(field, value)
          const updatedItem = { ...item, [field]: correctedValue }
          return { ...updatedItem, kubikasi: calculateKubikasi(updatedItem) }
        }
        return item
      })
    )
  }

  const handleRemoveItem = (id: number | string) => {
    if (items.length <= 1) return
    setItems((prev) => prev.filter((item) => item.id !== id))
  }

  const handleSaveOrUpdatePO = async () => {
    if (!poData.nomorPo || !poData.namaCustomer) {
      alert('PO Number and Customer Name are required!')
      return
    }
    if (items.length === 0) {
      alert('Add at least one item.')
      return
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
        poPhotoPath: poPhotoPath
      }

      const result = editingPO
        ? await (window as any).api.updatePO(payload)
        : await (window as any).api.saveNewPO(payload)

      if (result.success) {
        alert(`PO successfully ${editingPO ? 'updated' : 'saved'}!`)
        onSaveSuccess()
      } else {
        throw new Error(result.error || 'Unknown error occurred.')
      }
    } catch (error) {
      alert(`Failed to save PO: ${(error as Error).message}`)
    } finally {
      setIsSaving(false)
    }
  }

  const handlePreviewPO = async () => {
    if (items.length === 0) {
      alert('Add at least one item to preview.')
      return
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
        poPhotoPath: poPhotoPath
      }

      const result = await (window as any).api.previewPO(payload)

      if (result.success) {
        const imageWindow = window.open()
        if (imageWindow) {
          imageWindow.document.write(
            `<title>PO Preview</title><style>body{margin:0;}</style><img src="data:image/jpeg;base64,${result.base64Data}" style="width:100%;">`
          )
        }
      } else {
        throw new Error(result.error || 'Failed to generate preview data.')
      }
    } catch (error) {
      alert(`Failed to preview PO: ${(error as Error).message}`)
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
      <div className="page-header">
        <div>
          <h1>{editingPO ? 'Revise Purchase Order' : 'Input Purchase Order'}</h1>
          <p>{editingPO ? 'Update PO and item data' : 'Create new PO with detailed specifications'}</p>
        </div>
        <div className="header-actions">
          <Button onClick={onSaveSuccess}>Back</Button>
          <Button variant="secondary" onClick={handlePreviewPO} disabled={isPreviewing}>
            {isPreviewing ? 'Opening Preview...' : '◎ Preview'}
          </Button>
          <Button onClick={handleSaveOrUpdatePO} disabled={isSaving}>
            {isSaving ? 'Saving...' : editingPO ? 'Save Revision' : 'Save New PO'}
          </Button>
        </div>
      </div>

      <Card>
        <h2>Basic PO Information</h2>
        <div className="form-grid">
          <Input
            label="PO Number *"
            name="nomorPo"
            value={poData.nomorPo}
            onChange={handleDataChange}
            placeholder="e.g., 2505.1127"
            disabled={!!editingPO}
          />
          <Input
            label="Customer Name *"
            name="namaCustomer"
            value={poData.namaCustomer}
            onChange={handleDataChange}
            placeholder="e.g., ELIE MAGDA SBY"
          />
          <Input
            label="Entry Date"
            name="tanggalMasuk"
            type="date"
            value={poData.tanggalMasuk}
            onChange={handleDataChange}
            disabled
          />
          <Input
            label="Target Delivery Date *"
            name="tanggalKirim"
            type="date"
            value={poData.tanggalKirim}
            onChange={handleDataChange}
          />
          <div className="form-group">
            <label>Priority</label>
            <select name="prioritas" value={poData.prioritas} onChange={handleDataChange}>
              <option value="Normal">Normal</option>
              <option value="High">High</option>
              <option value="Urgent">Urgent</option>
            </select>
          </div>

          <div className="form-group">
            <label>Marketing</label>
            <input
              list="marketing-list"
              name="marketing"
              value={poData.marketing}
              onChange={handleDataChange}
              onBlur={() => handleDataBlur('marketing', poData.marketing)}
              placeholder="Select or type name"
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
          label="Notes"
          name="catatan"
          value={poData.catatan}
          onChange={handleDataChange}
          placeholder="Special notes for this PO..."
          rows={3}
        />
        <div className="form-group" style={{ marginTop: '1rem' }}>
          <label>PO Reference Photo (Optional)</label>
          <div className="file-input-container">
            {poPhotoPath ? (
              <div className="file-preview">
                <span className="file-name" title={poPhotoPath}>
                  {poPhotoPath.split(/[/\\]/).pop()}
                </span>
                <Button variant="secondary" onClick={handleCancelPoPhoto} className="cancel-photo-btn">
                  Cancel
                </Button>
              </div>
            ) : (
              <Button variant="secondary" onClick={handleSelectPoPhoto}>
                Select Photo
              </Button>
            )}
          </div>
        </div>
      </Card>

      <div className="item-section-header">
        <h2>Item List</h2>
        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <Button variant="secondary" onClick={() => setIsAddProductModalOpen(true)}>
            + Add Master Product
          </Button>
          <Button onClick={handleAddItem}>+ Add Row</Button>
        </div>
      </div>

      <Card>
        <div className="table-responsive">
          <table className="item-table">
            <thead>
              <tr>
                <th>Product</th>
                <th>Wood Type</th>
                <th>Profile</th>
                <th>Color</th>
                <th>Finishing</th>
                <th>Sample</th>
                <th>Size (T x W x L)</th>
                <th>Length Type</th>
                <th>Qty</th>
                <th>Item Notes</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id}>
                  <td style={{ minWidth: '150px' }}>
                    <input
                      list="product-list"
                      value={item.product_name}
                      onChange={(e) => handleItemChange(item.id, 'product_name', e.target.value)}
                      onBlur={() => handleItemBlur(item.id, 'product_name', item.product_name)}
                      placeholder="Select/Type Product"
                    />
                    <datalist id="product-list">
                      {getUniqueOptions('product_name').map((name) => (
                        <option key={name} value={name} />
                      ))}
                    </datalist>
                  </td>
                  <td style={{ minWidth: '130px' }}>
                    <input
                      list="wood-type-list"
                      value={item.wood_type}
                      onChange={(e) => handleItemChange(item.id, 'wood_type', e.target.value)}
                      onBlur={() => handleItemBlur(item.id, 'wood_type', item.wood_type)}
                      placeholder="Select/Type Wood"
                    />
                    <datalist id="wood-type-list">
                      {getUniqueOptions('wood_type').map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </td>
                  <td style={{ minWidth: '100px' }}>
                    <input
                      list="profile-list"
                      type="text"
                      value={item.profile}
                      onChange={(e) => handleItemChange(item.id, 'profile', e.target.value)}
                      onBlur={() => handleItemBlur(item.id, 'profile', item.profile)}
                      placeholder="Select/Type Profile"
                    />
                    <datalist id="profile-list">
                      {getUniqueOptions('profile').map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </td>
                  <td style={{ minWidth: '100px' }}>
                    <input
                      list="color-list"
                      type="text"
                      value={item.color}
                      onChange={(e) => handleItemChange(item.id, 'color', e.target.value)}
                      onBlur={() => handleItemBlur(item.id, 'color', item.color)}
                      placeholder="Select/Type Color"
                    />
                    <datalist id="color-list">
                      {getUniqueOptions('color').map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </td>
                  <td style={{ minWidth: '120px' }}>
                    <input
                      list="finishing-list"
                      value={item.finishing}
                      onChange={(e) => handleItemChange(item.id, 'finishing', e.target.value)}
                      onBlur={() => handleItemBlur(item.id, 'finishing', item.finishing)}
                      placeholder="Select/Type Finishing"
                    />
                    <datalist id="finishing-list">
                      {getUniqueOptions('finishing').map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </td>
                  <td style={{ minWidth: '120px' }}>
                    <input
                      list="sample-list"
                      value={item.sample}
                      onChange={(e) => handleItemChange(item.id, 'sample', e.target.value)}
                      onBlur={() => handleItemBlur(item.id, 'sample', item.sample)}
                      placeholder="Select/Type Sample"
                    />
                    <datalist id="sample-list">
                      {getUniqueOptions('sample').map((val) => (
                        <option key={val} value={val} />
                      ))}
                    </datalist>
                  </td>
                  <td style={{ minWidth: '200px' }}>
                    <div className="size-inputs">
                      <input
                        type="number"
                        value={item.thickness_mm}
                        onChange={(e) => handleItemChange(item.id, 'thickness_mm', Number(e.target.value))}
                        placeholder="T"
                      />
                      <span>x</span>
                      <input
                        type="number"
                        value={item.width_mm}
                        onChange={(e) => handleItemChange(item.id, 'width_mm', Number(e.target.value))}
                        placeholder="W"
                      />
                      <span>x</span>
                      <input
                        type="number"
                        value={item.length_mm}
                        onChange={(e) => handleItemChange(item.id, 'length_mm', Number(e.target.value))}
                        placeholder="L"
                      />
                    </div>
                  </td>
                  <td style={{ minWidth: '80px' }}>
                    <input
                      type="text"
                      value={item.length_type}
                      onChange={(e) => handleItemChange(item.id, 'length_type', e.target.value)}
                      placeholder="Type"
                    />
                  </td>
                  <td style={{ minWidth: '150px' }}>
                    <div className="quantity-inputs">
                      <input
                        type="number"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(item.id, 'quantity', Number(e.target.value))}
                        placeholder="Qty"
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
                  <td style={{ minWidth: '180px' }}>
                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) => handleItemChange(item.id, 'notes', e.target.value)}
                      placeholder="Notes..."
                    />
                  </td>
                  <td>
                    <Button variant="danger" onClick={() => handleRemoveItem(item.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card>
        <h2>Total Kubikasi</h2>
        <p>
          <b>{totalKubikasi.toFixed(3)} m³</b>
        </p>
      </Card>

      <AddProductModal
        isOpen={isAddProductModalOpen}
        onClose={() => setIsAddProductModalOpen(false)}
        onSaveSuccess={fetchProducts}
      />
    </div>
  )
}

export default InputPOPage
