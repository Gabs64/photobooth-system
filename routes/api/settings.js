const express = require('express');
const router = express.Router();
const db = require('../../db/database');

// GET Global Kiosk Settings
router.get('/', (req, res) => {
  try {
    const settings = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    res.json(settings);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE Global Kiosk Settings
router.put('/', (req, res) => {
  try {
    const {
      countdown_duration,
      retake_limit,
      idle_timeout_sec,
      printer_mode,
      allow_guest_overlay_select,
      audio_effects_enabled,
      qr_placement
    } = req.body;

    db.prepare(`
      UPDATE settings
      SET countdown_duration = COALESCE(?, countdown_duration),
          retake_limit = COALESCE(?, retake_limit),
          idle_timeout_sec = COALESCE(?, idle_timeout_sec),
          printer_mode = COALESCE(?, printer_mode),
          allow_guest_overlay_select = COALESCE(?, allow_guest_overlay_select),
          audio_effects_enabled = COALESCE(?, audio_effects_enabled),
          qr_placement = COALESCE(?, qr_placement)
      WHERE id = 1
    `).run(
      countdown_duration,
      retake_limit,
      idle_timeout_sec,
      printer_mode,
      allow_guest_overlay_select !== undefined ? (allow_guest_overlay_select ? 1 : 0) : null,
      audio_effects_enabled !== undefined ? (audio_effects_enabled ? 1 : 0) : null,
      qr_placement
    );

    const updated = db.prepare('SELECT * FROM settings WHERE id = 1').get();
    res.json({ success: true, settings: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
