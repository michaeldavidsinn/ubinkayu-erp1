// file: src/renderer/src/apiService.js

/**
 * File ini berfungsi sebagai lapisan abstraksi untuk semua panggilan ke backend.
 * Ia secara otomatis mendeteksi apakah aplikasi berjalan di Electron atau di web/mobile (Capacitor).
 * - Jika di Electron, ia akan menggunakan `window.api` (IPC).
 * - Jika di web/mobile, ia akan menggunakan `fetch` untuk memanggil endpoint API Vercel.
 */

// PENTING: Ganti dengan URL Vercel Anda setelah deploy berhasil.
// Untuk development lokal, biarkan kosong.
const API_BASE_URL = 'https://ubinkayu-erp1-git-erp1-mobile-ceab6c-michaeldavidsinns-projects.vercel.app';

/**
 * Helper untuk menangani panggilan fetch API secara konsisten.
 * @param {string} endpoint - Path endpoint yang sudah diformat dengan query params.
 * @param {object} options - Opsi untuk fetch (method, body, dll.)
 */
async function fetchAPI(endpoint, options = {}) {
  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, options);
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Network response was not ok' }));
      throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
    }
    return response.json();
  } catch (error) {
    console.error(`Fetch API error for endpoint ${endpoint}:`, error);
    throw error;
  }
}

/**
 * Helper untuk membuat endpoint API dengan format ?action=...
 * @param {string} action - Nama fungsi yang akan dipanggil di backend.
 * @param {object} params - Parameter tambahan untuk query URL.
 */
function createApiEndpoint(action, params = {}) {
    const query = new URLSearchParams({ action, ...params }).toString();
    return `/api?${query}`;
}

// --- Fungsi CRUD untuk Purchase Order (PO) ---

export function listPOs() {
  if (window.api) {
    console.log('%cELECTRON MODE: Using window.api (IPC) for listPOs', 'color: green; font-weight: bold;'); // <-- TAMBAHKAN INI
    return window.api.listPOs();
  }
  console.log('%cWEB MODE: Using fetch() for listPOs', 'color: orange; font-weight: bold;'); // <-- TAMBAHKAN INI
  return fetchAPI(createApiEndpoint('listPOs'));
}

export function saveNewPO(data) {
  if (window.api) return window.api.saveNewPO(data);
  return fetchAPI(createApiEndpoint('saveNewPO'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function updatePO(data) {
  if (window.api) return window.api.updatePO(data);
  return fetchAPI(createApiEndpoint('updatePO'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function deletePO(poId) {
  if (window.api) return window.api.deletePO(poId);
  return fetchAPI(createApiEndpoint('deletePO', { poId }), {
    method: 'DELETE',
  });
}

// --- Fungsi untuk Produk ---

export function getProducts() {
  if (window.api) return window.api.getProducts();
  return fetchAPI(createApiEndpoint('getProducts'));
}

// --- Fungsi Detail PO & Revisi ---

export function listPOItems(poId) {
  if (window.api) return window.api.listPOItems(poId);
  return fetchAPI(createApiEndpoint('listPOItems', { poId }));
}

export function getRevisionHistory(poId) {
  if (window.api) return window.api.getRevisionHistory(poId);
  return fetchAPI(createApiEndpoint('getRevisionHistory', { poId }));
}

// --- Fungsi Pratinjau (Preview) ---

export function previewPO(data) {
  if (window.api) return window.api.previewPO(data);
  return fetchAPI(createApiEndpoint('previewPO'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

// --- Fungsi Progress Tracking ---

export function updateItemProgress(data) {
  if (window.api) return window.api.updateItemProgress(data);
  return fetchAPI(createApiEndpoint('updateItemProgress'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
}

export function getActivePOsWithProgress() {
  if (window.api) return window.api.getActivePOs(); // Nama di preload.js berbeda
  return fetchAPI(createApiEndpoint('getActivePOsWithProgress'));
}

export function getPOItemsWithDetails(poId) {
  if (window.api) return window.api.getPOItemsDetails(poId); // Nama di preload.js berbeda
  return fetchAPI(createApiEndpoint('getPOItemsWithDetails', { poId }));
}

export function getRecentProgressUpdates() {
  if (window.api) return window.api.getRecentUpdates(); // Nama di preload.js berbeda
  return fetchAPI(createApiEndpoint('getRecentProgressUpdates'));
}

// --- Fungsi Analisis & Dashboard ---

export function getAttentionData() {
  if (window.api) return window.api.getAttentionData();
  return fetchAPI(createApiEndpoint('getAttentionData'));
}

export function getProductSalesAnalysis() {
  if (window.api) return window.api.getProductSalesAnalysis();
  return fetchAPI(createApiEndpoint('getProductSalesAnalysis'));
}

export function getSalesItemData() {
  if (window.api) return window.api.getSalesItemData();
  return fetchAPI(createApiEndpoint('getSalesItemData'));
}