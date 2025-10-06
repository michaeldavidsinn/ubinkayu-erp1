// file: src/renderer/src/apiService.js

/**
 * File ini berfungsi sebagai lapisan abstraksi untuk semua panggilan ke backend.
 * Ia secara otomatis mendeteksi apakah aplikasi berjalan di Electron atau di web/mobile.
 * - Jika di Electron, ia akan menggunakan `window.api` (IPC).
 * - Jika di web/mobile, ia akan menggunakan `fetch` untuk memanggil endpoint API Vercel.
 */

// Kosongkan jika Vercel dan aplikasi Anda berada di domain yang sama.
// Jika berbeda, isi dengan URL Vercel Anda, misal: 'https://ubinkayu-erp.vercel.app'
const API_BASE_URL = '';

/**
 * Helper untuk menangani panggilan fetch API.
 * @param {string} endpoint - Path endpoint, misal: '/api/listPOs'
 * @param {object} options - Opsi untuk fetch (method, body, dll.)
 */
async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (!response.ok) {
      // Coba parse error dari backend jika ada
      const errorData = await response.json().catch(() => ({ error: 'Network response was not ok' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Fetch API error for endpoint ${endpoint}:`, error);
    // Melempar ulang error agar bisa ditangkap oleh komponen
    throw error;
  }
}

// --- Fungsi CRUD untuk Purchase Order (PO) ---

export function listPOs() {
  if (window.api) {
    return window.api.listPOs();
  }
  return fetchAPI('/api/listPOs');
}

export function saveNewPO(data) {
  if (window.api) {
    return window.api.saveNewPO(data);
  }
  return fetchAPI('/api/saveNewPO', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updatePO(data) {
  if (window.api) {
    return window.api.updatePO(data);
  }
  return fetchAPI('/api/updatePO', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deletePO(poId) {
  if (window.api) {
    return window.api.deletePO(poId);
  }
  return fetchAPI(`/api/deletePO?poId=${poId}`, {
    method: 'DELETE',
  });
}

// --- Fungsi untuk Produk ---

export function getProducts() {
  if (window.api) {
    return window.api.getProducts();
  }
  return fetchAPI('/api/getProducts');
}

// --- Fungsi Detail PO & Revisi ---

export function listPOItems(poId) {
  if (window.api) {
    return window.api.listPOItems(poId);
  }
  return fetchAPI(`/api/listPOItems?poId=${poId}`);
}

export function getRevisionHistory(poId) {
  if (window.api) {
    return window.api.getRevisionHistory(poId);
  }
  return fetchAPI(`/api/getRevisionHistory?poId=${poId}`);
}

// --- Fungsi Pratinjau (Preview) ---

export function previewPO(data) {
  if (window.api) {
    return window.api.previewPO(data);
  }
  return fetchAPI('/api/previewPO', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// --- Fungsi Progress Tracking ---

export function updateItemProgress(data) {
  if (window.api) {
    return window.api.updateItemProgress(data);
  }
  // Untuk mobile, foto harus dikirim sebagai base64
  return fetchAPI('/api/updateItemProgress', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function getActivePOsWithProgress() {
  // Perhatikan nama fungsi di window.api berbeda
  if (window.api) {
    return window.api.getActivePOs();
  }
  return fetchAPI('/api/getActivePOsWithProgress');
}

export function getPOItemsWithDetails(poId) {
  // Perhatikan nama fungsi di window.api berbeda
  if (window.api) {
    return window.api.getPOItemsDetails(poId);
  }
  return fetchAPI(`/api/getPOItemsWithDetails?poId=${poId}`);
}

export function getRecentProgressUpdates() {
  // Perhatikan nama fungsi di window.api berbeda
  if (window.api) {
    return window.api.getRecentUpdates();
  }
  return fetchAPI('/api/getRecentProgressUpdates');
}

// --- Fungsi Analisis & Dashboard ---

export function getAttentionData() {
  if (window.api) {
    return window.api.getAttentionData();
  }
  return fetchAPI('/api/getAttentionData');
}

export function getProductSalesAnalysis() {
  if (window.api) {
    return window.api.getProductSalesAnalysis();
  }
  return fetchAPI('/api/getProductSalesAnalysis');
}

export function getSalesItemData() {
  if (window.api) {
    return window.api.getSalesItemData();
  }
  return fetchAPI('/api/getSalesItemData');
}