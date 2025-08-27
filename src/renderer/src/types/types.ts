/* eslint-disable prettier/prettier */
// src/types/types.ts

export interface POItem {
  id: number;
  productId: string;
  notes: string;
  qty: number;
  satuan: string;
  thickness: number;
  width: number;
  length: number;
}

export interface POHeader {
  id: string;
  po_number: string;
  project_name: string;
  created_at: string;
  status?: string;
  priority?: string;
  deadline?: string;
  notes?: string;
}