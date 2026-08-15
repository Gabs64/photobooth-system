const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../../db/database');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, '../../public/uploads/overlays');
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname) || '.png';
    cb(null, 'overlay_' + uniqueSuffix + ext);
  }
});

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    if (file.mimetype.includes('image/png') || file.mimetype.includes('image/svg+xml') || file.mimetype.includes('image/webp')) {
      cb(null, true);
    } else {
      cb(new Error('Only PNG/SVG transparency overlay files are supported!'), false);
    }
  }
});

// GET All Overlays for Event
router.get('/', (req, res) => {
  try {
    const overlays = db.prepare('SELECT * FROM overlays ORDER BY created_at DESC').all();
    res.json(overlays);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPLOAD New Overlay File
router.post('/upload', upload.single('overlay_file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No overlay file provided' });
    }

    const { event_id, name, position_x, position_y, scale, rotation, schedule_time } = req.body;
    const overlayId = 'ovl_' + Date.now();
    const filePath = '/uploads/overlays/' + req.file.filename;
    const targetEventId = event_id || 'evt_mia10th';

    db.prepare(`
      INSERT INTO overlays (id, event_id, name, file_path, position_x, position_y, scale, rotation, is_active, schedule_time)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    `).run(
      overlayId,
      targetEventId,
      name || req.file.originalname,
      filePath,
      parseFloat(position_x || 0),
      parseFloat(position_y || 0),
      parseFloat(scale || 1.0),
      parseFloat(rotation || 0),
      schedule_time || null
    );

    const newOverlay = db.prepare('SELECT * FROM overlays WHERE id = ?').get(overlayId);
    res.json({ success: true, overlay: newOverlay });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE Overlay Metadata (WYSIWYG Position/Scale/Schedule)
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, position_x, position_y, scale, rotation, is_active, schedule_time } = req.body;

    const current = db.prepare('SELECT * FROM overlays WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Overlay not found' });

    if (is_active === 1 || is_active === true) {
      // Deactivate other overlays for this event if active set
      db.prepare('UPDATE overlays SET is_active = 0 WHERE event_id = ?').run(current.event_id);
      db.prepare('UPDATE events SET active_overlay_id = ? WHERE id = ?').run(id, current.event_id);
    }

    db.prepare(`
      UPDATE overlays 
      SET name = COALESCE(?, name),
          position_x = COALESCE(?, position_x),
          position_y = COALESCE(?, position_y),
          scale = COALESCE(?, scale),
          rotation = COALESCE(?, rotation),
          is_active = COALESCE(?, is_active),
          schedule_time = COALESCE(?, schedule_time)
      WHERE id = ?
    `).run(name, position_x, position_y, scale, rotation, is_active ? 1 : 0, schedule_time, id);

    const updated = db.prepare('SELECT * FROM overlays WHERE id = ?').get(id);
    res.json({ success: true, overlay: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Overlay
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const overlay = db.prepare('SELECT * FROM overlays WHERE id = ?').get(id);
    if (overlay) {
      db.prepare('DELETE FROM overlays WHERE id = ?').run(id);
    }
    res.json({ success: true, deleted_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
