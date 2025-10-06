// file: api/updateItemProgress.js

import { openDoc, getSheet, getNextIdFromSheet, getAuth, PROGRESS_PHOTOS_FOLDER_ID } from './_helpers.js';
import { google } from 'googleapis';
import stream from 'stream';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method Not Allowed' });
  }

  const data = req.body;
  const { poId, itemId, poNumber, stage, notes, photoBase64 } = data;

  try {
    let photoLink = null;
    if (photoBase64) {
        const auth = getAuth();
        const drive = google.drive({ version: 'v3', auth });
        const timestamp = new Date().toISOString().replace(/:/g, '-');
        const fileName = `PO-${poNumber}_ITEM-${itemId}_${timestamp}.jpg`;

        const imageBuffer = Buffer.from(photoBase64, 'base64');
        const bufferStream = new stream.PassThrough();
        bufferStream.end(imageBuffer);

        const response = await drive.files.create({
            requestBody: { name: fileName, mimeType: 'image/jpeg', parents: [PROGRESS_PHOTOS_FOLDER_ID] },
            media: { mimeType: 'image/jpeg', body: bufferStream },
            fields: 'id, webViewLink',
            supportsAllDrives: true,
        });
        photoLink = response.data.webViewLink;
    }

    const doc = await openDoc();
    const progressSheet = await getSheet(doc, 'progress_tracking');
    const nextId = await getNextIdFromSheet(progressSheet);

    await progressSheet.addRow({
      id: nextId,
      purchase_order_id: poId,
      purchase_order_item_id: itemId,
      stage: stage,
      notes: notes || '',
      photo_url: photoLink,
      created_at: new Date().toISOString(),
    });

    res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}