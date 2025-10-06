// File: /api/updateItemProgress.js
import { updateItemProgressLogic } from './_utils.js';
import formidable from 'formidable';
import fs from 'fs';

// Matikan body parser bawaan Vercel untuk menangani form data
export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

  try {
    const data = await new Promise((resolve, reject) => {
      const form = formidable();
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const { fields, files } = data;
    const { poId, itemId, poNumber, stage, notes } = fields;

    let photoBuffer = null;
    let photoFilename = null;
    if (files.photo) {
        photoBuffer = fs.readFileSync(files.photo.filepath);
        photoFilename = files.photo.originalFilename;
    }

    const result = await updateItemProgressLogic({
      poId, itemId, poNumber, stage, notes, photoBuffer, photoFilename
    });

    return res.status(200).json(result);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
}