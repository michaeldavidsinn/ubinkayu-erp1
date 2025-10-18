/* eslint-disable prettier/prettier */
// src/renderer/src/types/index.ts

export type ProductionStage =
  | 'Cari Bahan Baku'
  | 'Sawmill'
  | 'KD'
  | 'Pembahanan'
  | 'Moulding'
  | 'Coating'
  | 'Siap Kirim'

export interface ProgressUpdate {
  id: string
  purchase_order_item_id: string
  stage: ProductionStage
  notes: string
  photo_url: string | null
  created_at: string
}

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
  progressHistory?: ProgressUpdate[]
  stageDeadlines?: { stageName: string; deadline: string }[]
  customer_name?: string
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
  pdf_link?: string | null
  progress?: number
  items?: POItem[]
  photo_url?: string | null
  marketing?: string
}

export interface PORevision {
  id: string
  purchase_order_id: string
  revision_number: number
  project_name: string
  deadline: string | null
  status: string | null
  priority: string | null
  notes: string | null
  created_at: string
  pdf_link?: string | null
  acc_marketing?: string
}

export interface RevisionHistoryItem {
  revision: PORevision
  items: POItem[]
}

export interface AnalysisData {
  topSellingProducts: { name: string; totalQuantity: number }[]
  trendingProducts: { name: string; change: number }[]
  slowMovingProducts: string[]
  woodTypeDistribution: { name: string; value: number }[]
  topCustomers: { name: string; totalKubikasi: number }[]
}

export interface DeleteResult {
  success: boolean
  message: string
  summary?: {
    duration?: string
    failedFileDeletes?: number
  }
  error?: string
}
