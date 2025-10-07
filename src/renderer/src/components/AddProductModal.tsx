// src/components/AddProductModal.tsx

import React, { useState } from 'react';
import { Button } from './Button';
import { Input } from './Input';


interface AddProductModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSaveSuccess: () => void;
}

export const AddProductModal: React.FC<AddProductModalProps> = ({ isOpen, onClose, onSaveSuccess }) => {
  const [newProduct, setNewProduct] = useState({
    product_name: '',
    wood_type: '',
    profile: '',
    color: '',
    finishing: '',
    sample: '',
    marketing: ''
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setNewProduct(prev => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async () => {
    // [DIUBAH] Validasi diubah: Cek apakah setidaknya ada satu field yang terisi.
    const isAnyFieldFilled = Object.values(newProduct).some(value => value.trim() !== '');

    if (!isAnyFieldFilled) {
      return alert('Harap isi minimal satu field untuk menyimpan produk baru.');
    }
    
    setIsSaving(true);
    try {
      // @ts-ignore
      const result = await window.api.addNewProduct(newProduct);
      if (result.success) {
        alert('Produk baru berhasil disimpan!');
        onSaveSuccess();
        onClose();
        setNewProduct({
            product_name: '', wood_type: '', profile: '', color: '',
            finishing: '', sample: '', marketing: ''
        });
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert(`Gagal menyimpan produk: ${(error as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <h2>Tambah Produk Baru ke Master</h2>
        <p>Produk ini akan tersedia untuk semua PO di masa depan.</p>
        
        <div className="form-grid">
          <Input label="Nama Produk" name="product_name" value={newProduct.product_name} onChange={handleChange} />
          <Input label="Tipe Kayu" name="wood_type" value={newProduct.wood_type} onChange={handleChange} />
          <Input label="Profil" name="profile" value={newProduct.profile} onChange={handleChange} />
          <Input label="Warna" name="color" value={newProduct.color} onChange={handleChange} />
          <Input label="Finishing" name="finishing" value={newProduct.finishing} onChange={handleChange} />
          <Input label="Sample" name="sample" value={newProduct.sample} onChange={handleChange} />
          <Input label="Marketing" name="marketing" value={newProduct.marketing} onChange={handleChange} />
          
        </div>

        <div className="modal-actions">
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? 'Menyimpan...' : 'Simpan Produk'}
          </Button>
        </div>
      </div>
    </div>
  );
};