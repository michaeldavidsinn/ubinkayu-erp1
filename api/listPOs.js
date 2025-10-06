// file: api/listPOs.js

import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';

// =================================================================
// [FIX] HELPER FUNCTIONS DIMASUKKAN LANGSUNG KE DALAM FILE INI
// =================================================================

const ALIASES = {
  purchase_orders: ['purchase_orders', 'purchase_order'],
  purchase_order_items: ['purchase_order_items', 'po_items'],
  progress_tracking: ['purchase_order_items_progress', 'progress'],
};

function getSheet(doc, key) {
  const titles = ALIASES[key] || [key];
  for (const t of titles) {
    if (doc.sheetsByTitle[t]) return doc.sheetsByTitle[t];
  }
  throw new Error(`Sheet "${titles[0]}" tidak ditemukan.`);
}

function toNum(v, def = 0) {
  const n = Number(String(v ?? '').trim());
  return Number.isFinite(n) ? n : def;
}

// =================================================================
// FUNGSI UTAMA (HANDLER)
// =================================================================

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  try {
    const SPREADSHEET_ID = '1Bp5rETvaAe9nT4DrNpm-WsQqQlPNaau4gIzw1nA5Khk';

    const serviceAccountAuth = new JWT({
      email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: process.env.GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    await doc.loadInfo();

    // [FIX] Menggunakan 'doc' yang sudah diinisialisasi di atas
    // dan memanggil helper 'getSheet' yang sudah kita tambahkan
    const poSheet = getSheet(doc, 'purchase_orders');
    const itemSheet = getSheet(doc, 'purchase_order_items');
    const progressSheet = getSheet(doc, 'progress_tracking');

    const [poRows, itemRows, progressRows] = await Promise.all([
      poSheet.getRows(),
      itemSheet.getRows(),
      progressSheet.getRows(),
    ]);

    // --- (LOGIKA ANDA DARI SINI SUDAH BENAR SEMUA) ---
    const byId = new Map();
    for (const r of poRows) {
      const id = String(r.get('id')).trim();
      const rev = toNum(r.get('revision_number'), -1); // Memakai helper 'toNum'
      const keep = byId.get(id);
      if (!keep || rev > keep.rev) byId.set(id, { rev, row: r });
    }
    const latestPoRows = Array.from(byId.values()).map(({ row }) => row);

    const progressByCompositeKey = progressRows.reduce((acc, row) => {
      const poId = row.get('purchase_order_id');
      const itemId = row.get('purchase_order_item_id');
      const key = `${poId}-${itemId}`;
      if (!acc[key]) acc[key] = [];
      acc[key].push({ stage: row.get('stage'), created_at: row.get('created_at') });
      return acc;
    }, {});

    const itemsByPoId = itemRows.reduce((acc, item) => {
      const poId = item.get('purchase_order_id');
      if (!acc[poId]) acc[poId] = [];
      acc[poId].push(item.toObject());
      return acc;
    }, {});

    const latestItemRevisions = new Map();
    itemRows.forEach((item) => {
      const poId = item.get('purchase_order_id');
      const rev = toNum(item.get('revision_number'), -1);
      const current = latestItemRevisions.get(poId);
      if (!current || rev > current) {
        latestItemRevisions.set(poId, rev);
      }
    });

    const result = latestPoRows.map((po) => {
      const poObject = po.toObject();
      const poId = poObject.id;

      const latestRev = latestItemRevisions.get(poId) ?? -1;
      const poItems = (itemsByPoId[poId] || []).filter(
        (item) => toNum(item.revision_number, -1) === latestRev
      );

      let poProgress = 0;
      if (poItems.length > 0) {
        let totalPercentage = 0;
        poItems.forEach((item) => {
          const itemId = item.id;
          const needsSample = item.sample === 'Ada sample';
          const stages = ['Pembahanan'];
          if (needsSample) stages.push('Kasih Sample');
          stages.push('Start Produksi', 'Kirim');
          const compositeKey = `${poId}-${itemId}`;
          const itemProgressHistory = progressByCompositeKey[compositeKey] || [];
          let latestStageIndex = -1;
          if (itemProgressHistory.length > 0) {
            const latestProgress = itemProgressHistory.sort(
              (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )[0];
            latestStageIndex = stages.indexOf(latestProgress.stage);
          }
          const itemPercentage =
            latestStageIndex >= 0 ? ((latestStageIndex + 1) / stages.length) * 100 : 0;
          totalPercentage += itemPercentage;
        });
        poProgress = totalPercentage / poItems.length;
      }

      let finalStatus = poObject.status;
      if (finalStatus !== 'Cancelled') {
        if (poProgress >= 100) finalStatus = 'Completed';
        else if (poProgress > 0) finalStatus = 'In Progress';
        else finalStatus = 'Open';
      }

      return {
        ...poObject,
        items: poItems,
        progress: Math.round(poProgress),
        status: finalStatus,
        pdf_link: po.get('pdf_link') || null,
      };
    });
    // --- (AKHIR DARI LOGIKA ANDA) ---

    // [FIX] Hapus 'return result' dan gunakan res.json() untuk mengirim data
    res.status(200).json(result);

  } catch (error) {
    console.error('API Error:', error);
    res.status(500).json({ error: 'Failed to fetch data from Google Sheets', details: error.message });
  }
}