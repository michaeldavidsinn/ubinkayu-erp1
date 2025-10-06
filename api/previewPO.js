// file: api/previewPO.js

import { generatePOJpeg } from './_helpers.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const data = req.body;

  try {
    const poData = {
      po_number: data.nomorPo,
      project_name: data.namaCustomer,
      created_at: new Date().toISOString(),
      deadline: data.tanggalKirim || '',
      priority: data.prioritas || '',
      items: data.items || [],
      notes: data.catatan || '',
      kubikasi_total: data.kubikasi_total || 0,
      poPhotoBase64: data.poPhotoBase64
    };

    // generatePOJpeg akan mengembalikan { success, buffer, fileName }
    const result = await generatePOJpeg(poData, 'preview');

    if (result.success) {
      // Ubah buffer menjadi base64 untuk dikirim sebagai JSON
      const base64Data = result.buffer.toString('base64');
      res.status(200).json({ success: true, base64Data: base64Data });
    } else {
      throw new Error(result.error || 'Failed to generate JPEG buffer');
    }
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}