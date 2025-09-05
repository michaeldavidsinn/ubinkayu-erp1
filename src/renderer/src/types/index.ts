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
}

export interface PORevision {
  id: string
  purchase_order_id: string
  revision_number: string
  deadline: string
  status: string
  priority: string
  notes: string
  created_at: string
}
