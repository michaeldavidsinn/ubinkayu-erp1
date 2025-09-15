// src/renderer/src/types/index.ts

export interface POItem {
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
  kubikasi?: number
}

export interface POHeader {
  id: string
  po_number: string
  project_name: string
  created_at: string
  status?: string
  priority?: string
  deadline?: string
  notes?: string
  kubikasi_total?: number
}

export interface PORevision {
  id: string
  purchase_order_id: string
  revision_number: number // Sebaiknya number
  project_name: string // Ditambahkan karena Anda menggunakannya
  deadline: string | null // Memperbolehkan null
  status: string | null
  priority: string | null
  notes: string | null
  created_at: string
}

export interface RevisionHistoryItem {
  revision: PORevision // Menggunakan tipe PORevision yang sudah ada
  items: POItem[]
}
