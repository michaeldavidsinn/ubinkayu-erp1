// File: src/renderer/src/App.tsx (Versi Final yang Diperbaiki)

import React, { useState, useEffect } from 'react';
import { Card } from './components/card';
import { Input } from './components/input';
import { Textarea } from './components/textarea';
import { Button } from './components/button';

// --- Tipe Data ---
interface POItem { id: number; productId: string; notes: string; qty: number; satuan: string; thickness: number; width: number; length: number; }
interface POHeader { id: string; po_number: string; project_name: string; created_at: string; status?: string; priority?: string; deadline?: string; }


// --- Komponen Utama Aplikasi ---
function App() {
  const [view, setView] = useState<'list' | 'input'>('list'); // Mengontrol halaman yang tampil
  const [purchaseOrders, setPurchaseOrders] = useState<POHeader[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Fungsi untuk mengambil semua data PO dari backend
  const fetchPOs = async () => {
    setIsLoading(true);
    try {
      // @ts-ignore - 'api' is defined in preload
      const pos: POHeader[] = await window.api.listPOs();
      setPurchaseOrders(pos);
    } catch (error) {
      console.error("Gagal mengambil daftar PO:", error);
    } finally {
      setIsLoading(false);
    }
  };

  // Jalankan fetchPOs() saat aplikasi pertama kali dimuat
  useEffect(() => {
    fetchPOs();
  }, []);

  const handleShowInputForm = () => setView('input');
  const handleBackToList = () => {
    fetchPOs(); // Ambil data terbaru setelah menyimpan PO baru
    setView('list');
  };

  return (
    <div className="app-layout">
      <Navbar activeLink={view === 'input' ? '+ Input PO' : 'Purchase Orders'} />
      <main className="main-content">
        {view === 'list' ? (
          <POListPage poList={purchaseOrders} onAddPO={handleShowInputForm} isLoading={isLoading} />
        ) : (
          <InputPOPage onSaveSuccess={handleBackToList} />
        )}
      </main>
    </div>
  );
}


// --- Halaman: Daftar Purchase Order ---
interface POListPageProps {
  poList: POHeader[];
  onAddPO: () => void;
  isLoading: boolean;
}

const POListPage: React.FC<POListPageProps> = ({ poList, onAddPO, isLoading }) => (
  <div className="page-container">
    <div className="page-header">
      <div>
        <h1>Kelola Purchase Order</h1>
        <p>Pantau dan kelola semua pesanan produksi</p>
      </div>
      <Button onClick={onAddPO}>+ Tambah PO Baru</Button>
    </div>
    <Card>
      <p>Menampilkan {poList.length} dari {poList.length} PO</p>
    </Card>
    <div className="po-grid">
      {isLoading ? <p>Loading data PO dari Google Sheets...</p> : 
       poList.length === 0 ? <p>Belum ada data Purchase Order.</p> :
        poList.map(po => (
          <Card key={po.id} className="po-item-card">
            <div className="po-card-header">
              <span>{po.po_number}</span>
              <span className={`status-badge ${po.priority?.toLowerCase()}`}>{po.priority || 'Normal'}</span>
            </div>
            <p className="customer-name">{po.project_name}</p>
            <div className="po-card-info">
                <span>Target Kirim:</span>
                <span>{po.deadline ? new Date(po.deadline).toLocaleDateString() : '-'}</span>
            </div>
            <div className="po-card-footer">
               <Button variant="secondary">Detail</Button>
               <Button>Edit</Button>
            </div>
          </Card>
        ))
      }
    </div>
  </div>
);


// --- Halaman: Input Purchase Order ---
interface InputPOPageProps {
  onSaveSuccess: () => void;
}

const InputPOPage: React.FC<InputPOPageProps> = ({ onSaveSuccess }) => {
  const [poData, setPoData] = useState({ nomorPo: '', namaCustomer: '', tanggalMasuk: new Date().toLocaleDateString('en-CA'), tanggalKirim: '', prioritas: 'Normal', alamatKirim: '', catatan: '' });
  const [items, setItems] = useState<POItem[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  const handleDataChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => setPoData(prev => ({ ...prev, [e.target.name]: e.target.value }));
  const handleAddItem = () => setItems(prev => [...prev, { id: Date.now(), productId: '', notes: '', qty: 1, satuan: 'pcs', thickness: 0, width: 0, length: 0 }]);
  const handleItemChange = (id: number, field: keyof POItem, value: string | number) => setItems(prev => prev.map(item => item.id === id ? { ...item, [field]: value } : item));
  const handleRemoveItem = (id: number) => setItems(prev => prev.filter(item => item.id !== id));
  
const handlePingTest = async () => {
    console.log('---  MENGIRIM PING KE BACKEND ---');
    try {
      // @ts-ignore
      const response = await window.api.ping();
      console.log('--- ✅ PONG DITERIMA DARI BACKEND:', response, '---');
      alert(`PONG diterima! Jembatan komunikasi BERFUNGSI.`);
    } catch (error) {
      console.error('--- ❌ GAGAL MENGIRIM PING:', error);
      alert(`GAGAL! Jembatan komunikasi TIDAK berfungsi. Cek error di konsol.`);
    }
  };

  const handleSavePO = async () => {
    if (!poData.nomorPo || !poData.namaCustomer) return alert('Nomor PO dan Nama Customer harus diisi!');
    if (items.length === 0) return alert('Tambahkan minimal satu item.');
    setIsSaving(true);
    try {
      const payload = { ...poData, items };
      // @ts-ignore
      const result = await window.api.saveNewPO(payload);
      if (result.success) {
        alert(`PO berhasil disimpan dengan ID: ${result.poId}`);
        onSaveSuccess(); // Kembali ke halaman daftar
      } else {
        throw new Error(result.error);
      }
    } catch (error) {
      alert(`Gagal menyimpan PO: ${(error as Error).message}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div><h1>Input Purchase Order</h1><p>Buat PO baru dengan spesifikasi detail produk</p></div>
        <div className="header-actions">


<Button onClick={handlePingTest} style={{backgroundColor: '#2F855A'}}>Tes Jembatan (Ping)</Button>
          <Button variant="secondary">◎ Preview</Button>
          <Button onClick={handleSavePO} disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan PO'}</Button>

          <Button variant="secondary">◎ Preview</Button>
          <Button onClick={handleSavePO} disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan PO'}</Button>
        </div>
      </div>
      <Card>
          <h2>Informasi Dasar PO</h2>
          <div className="form-grid">
              <Input label="Nomor PO *" name="nomorPo" value={poData.nomorPo} onChange={handleDataChange} placeholder="e.g., 2505.1127" />
              <Input label="Nama Customer *" name="namaCustomer" value={poData.namaCustomer} onChange={handleDataChange} placeholder="e.g., ELIE MAGDA SBY" />
              <Input label="Tanggal Masuk" name="tanggalMasuk" type="date" value={poData.tanggalMasuk} onChange={handleDataChange} disabled />
              <Input label="Tanggal Target Kirim *" name="tanggalKirim" type="date" value={poData.tanggalKirim} onChange={handleDataChange} />
              <div className="form-group">
                  <label>Prioritas</label>
                  <select name="prioritas" value={poData.prioritas} onChange={handleDataChange}>
                      <option value="Normal">Normal</option>
                      <option value="High">High</option>
                      <option value="Urgent">Urgent</option>
                  </select>
              </div>
          </div>
          <Textarea label="Alamat Kirim" name="alamatKirim" value={poData.alamatKirim} onChange={handleDataChange} placeholder="Alamat lengkap pengiriman..." rows={3} />
          <Textarea label="Catatan" name="catatan" value={poData.catatan} onChange={handleDataChange} placeholder="Catatan khusus untuk PO ini..." rows={3} />
      </Card>
      
      <div className="item-section-header">
        <h2>Daftar Item</h2>
        <Button onClick={handleAddItem}>+ Tambah Item</Button>
      </div>

      {items.map((item, index) => (
        <Card key={item.id} className="item-card">
          <div className="item-card-header">
            <h4>Item #{index + 1}</h4>
            <Button variant="secondary" onClick={() => handleRemoveItem(item.id)}>Hapus</Button>
          </div>
          <div className="form-grid">
            <Input label="Produk ID" value={item.productId} onChange={(e) => handleItemChange(item.id, 'productId', e.target.value)} />
            <Input label="Catatan / Notes" value={item.notes} onChange={(e) => handleItemChange(item.id, 'notes', e.target.value)} />
            <Input label="Qty" type="number" value={item.qty} onChange={(e) => handleItemChange(item.id, 'qty', Number(e.target.value))} />
            <Input label="Satuan" value={item.satuan} onChange={(e) => handleItemChange(item.id, 'satuan', e.target.value)} />
            <Input label="Tebal (mm)" type="number" value={item.thickness} onChange={(e) => handleItemChange(item.id, 'thickness', Number(e.target.value))} />
            <Input label="Lebar (mm)" type="number" value={item.width} onChange={(e) => handleItemChange(item.id, 'width', Number(e.target.value))} />
            <Input label="Panjang (mm)" type="number" value={item.length} onChange={(e) => handleItemChange(item.id, 'length', Number(e.target.value))} />
          </div>
        </Card>
      ))}
    </div>
  );
};


// --- Komponen Statis: Navbar ---
interface NavbarProps {
  activeLink: string;
}
const Navbar: React.FC<NavbarProps> = ({ activeLink }) => (
  <nav className="navbar">
    <div className="navbar-brand">PT Ubinkayu ERP</div>
    <div className="navbar-links">
      <a href="#" className={activeLink === 'Dashboard' ? 'active' : ''}>Dashboard</a>
      <a href="#" className={activeLink === 'Purchase Orders' ? 'active' : ''}>Purchase Orders</a>
      <a href="#" className={activeLink === '+ Input PO' ? 'active' : ''}>+ Input PO</a>
      <a href="#" className={activeLink === 'Progress Tracking' ? 'active' : ''}>Progress Tracking</a>
      <a href="#" className={activeLink === 'Reports' ? 'active' : ''}>Reports</a>
      <a href="#" className={activeLink === 'Users' ? 'active' : ''}>Users</a>
    </div>
  </nav>
);

export default App;