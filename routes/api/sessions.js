const express = require('express');
const router = express.Router();
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const db = require('../../db/database');
const cloudWorker = require('../../services/cloudUploadService');

// Helper to save base64 data URLs to file
function saveBase64Image(dataUrl, targetFilePath) {
  const matches = dataUrl.match(/^data:image\/([a-zA-Z0-9]+);base64,(.+)$/);
  if (!matches || matches.length !== 3) {
    throw new Error('Invalid base64 image data URL string');
  }
  const buffer = Buffer.from(matches[2], 'base64');
  fs.writeFileSync(targetFilePath, buffer);
}

// GET Session Gallery & History
router.get('/gallery', (req, res) => {
  try {
    const { mode, status, limit } = req.query;
    let query = `
      SELECT p.id as photo_id, p.session_id, p.raw_paths, p.composited_path, 
             p.cloud_url, p.qr_code_path, p.share_token, p.upload_status, p.created_at,
             s.mode, s.retakes_used, s.guest_action, s.event_id
      FROM photos p
      JOIN sessions s ON p.session_id = s.id
      ORDER BY p.created_at DESC
    `;
    if (limit) {
      query += ` LIMIT ${parseInt(limit)}`;
    }
    const photos = db.prepare(query).all();

    const parsedPhotos = photos.map(p => ({
      ...p,
      raw_paths: JSON.parse(p.raw_paths || '[]')
    }));

    res.json(parsedPhotos);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const QRCode = require('qrcode');

// CREATE Photo Session
router.post('/save', async (req, res) => {
  try {
    const {
      event_id,
      mode,
      retakes_used,
      guest_action,
      raw_images,
      composited_image
    } = req.body;

    if (!composited_image) {
      return res.status(400).json({ error: 'Composited photo sheet is required' });
    }

    const sessionId = 'ses_' + Date.now();
    const photoId = 'pho_' + Date.now();
    const shareToken = crypto.randomBytes(6).toString('hex');
    const targetEventId = event_id || 'evt_mia10th';

    // 1. Save Session record
    db.prepare(`
      INSERT INTO sessions (id, event_id, mode, retakes_used, status, guest_action)
      VALUES (?, ?, ?, ?, 'completed', ?)
    `).run(sessionId, targetEventId, mode || '4-up', parseInt(retakes_used || 0), guest_action || 'both');

    // 2. Save Raw Snapshots to disk
    const savedRawPaths = [];
    if (Array.isArray(raw_images) && raw_images.length > 0) {
      raw_images.forEach((imgData, index) => {
        const filename = `raw_${sessionId}_${index + 1}.jpg`;
        const filePath = path.join(__dirname, '../../public/uploads/raw', filename);
        saveBase64Image(imgData, filePath);
        savedRawPaths.push(`/uploads/raw/${filename}`);
      });
    }

    // 3. Save Composited Print Sheet image to disk
    const compFilename = `comp_${sessionId}.jpg`;
    const compFilePath = path.join(__dirname, '../../public/uploads/composited', compFilename);
    saveBase64Image(composited_image, compFilePath);
    const compositedWebPath = `/uploads/composited/${compFilename}`;

    // 4. Generate Instant Local Share Link & QR Code
    const hostHeader = req.headers.host || 'localhost:3000';
    const protocol = req.protocol || 'http';
    const initialShareUrl = `${protocol}://${hostHeader}/share/${shareToken}`;
    const qrFilename = `qr_${shareToken}.png`;
    const qrFilePath = path.join(__dirname, '../../public/uploads/qrcodes', qrFilename);
    const qrWebPath = `/uploads/qrcodes/${qrFilename}`;
    let initialQrDataUrl = null;

    try {
      initialQrDataUrl = await QRCode.toDataURL(initialShareUrl, {
        color: { dark: '#0F172A', light: '#FFFFFF' },
        width: 400,
        margin: 2
      });
      await QRCode.toFile(qrFilePath, initialShareUrl, {
        color: { dark: '#0F172A', light: '#FFFFFF' },
        width: 400,
        margin: 2
      });
    } catch (qrErr) {
      console.warn('[Session Save] Instant QR code pre-gen warning:', qrErr.message);
    }

    // 5. Save Photo Record
    db.prepare(`
      INSERT INTO photos (
        id, session_id, raw_paths, composited_path, cloud_url, 
        qr_code_path, share_token, upload_status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending')
    `).run(
      photoId,
      sessionId,
      JSON.stringify(savedRawPaths),
      compositedWebPath,
      initialShareUrl,
      qrWebPath,
      shareToken
    );

    // 6. Trigger Cloud Upload Worker asynchronously in background (non-blocking)
    cloudWorker.processPhotoById(photoId).catch(uploadErr => {
      console.warn('[Session Save] Asynchronous cloud upload error:', uploadErr.message);
    });

    // 7. Return instant response to Kiosk app
    res.json({
      success: true,
      sessionId,
      photoId,
      shareToken,
      cloudUrl: initialShareUrl,
      qrCodeUrl: qrWebPath,
      qrDataUrl: initialQrDataUrl,
      compositedUrl: compositedWebPath,
      rawUrls: savedRawPaths
    });

  } catch (err) {
    console.error('Error saving photobooth session:', err);
    res.status(500).json({ error: err.message });
  }
});

// GET Photo Upload & QR Code Status by Photo ID
router.get('/status/:photoId', (req, res) => {
  try {
    const { photoId } = req.params;
    const photo = db.prepare('SELECT id, upload_status, cloud_url, qr_code_path, last_error FROM photos WHERE id = ?').get(photoId);
    if (!photo) return res.status(404).json({ error: 'Photo not found' });
    res.json(photo);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Single Photo Details by Share Token (for Public Share Portal)
router.get('/share/:token', (req, res) => {
  try {
    const { token } = req.params;
    const photo = db.prepare(`
      SELECT p.*, s.mode, s.created_at, e.name as event_name, e.event_date, e.theme_primary, e.theme_secondary
      FROM photos p
      JOIN sessions s ON p.session_id = s.id
      JOIN events e ON s.event_id = e.id
      WHERE p.share_token = ?
    `).get(token);

    if (!photo) {
      return res.status(404).json({ error: 'Photo not found or link has expired' });
    }

    res.json({
      ...photo,
      raw_paths: JSON.parse(photo.raw_paths || '[]')
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
