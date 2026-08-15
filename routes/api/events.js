const express = require('express');
const router = express.Router();
const db = require('../../db/database');

// GET Active Event with associated Overlay and Print Layout
router.get('/active', (req, res) => {
  try {
    const event = db.prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT 1').get();
    if (!event) {
      return res.status(404).json({ error: 'No active event found' });
    }

    const activeOverlay = db.prepare('SELECT * FROM overlays WHERE id = ?').get(event.active_overlay_id) || 
                          db.prepare('SELECT * FROM overlays WHERE event_id = ? AND is_active = 1 LIMIT 1').get(event.id);
    
    const activeLayout = db.prepare('SELECT * FROM print_layouts WHERE id = ?').get(event.active_layout_id) ||
                         db.prepare('SELECT * FROM print_layouts WHERE event_id = ? AND is_active = 1 LIMIT 1').get(event.id);

    const allOverlays = db.prepare('SELECT * FROM overlays WHERE event_id = ? ORDER BY created_at DESC').all(event.id);
    const allLayouts = db.prepare('SELECT * FROM print_layouts WHERE event_id = ? ORDER BY created_at DESC').all(event.id);
    let settings = db.prepare('SELECT * FROM settings WHERE id = 1').get() || {};
    settings.countdown_duration = 5;

    res.json({
      event,
      activeOverlay,
      activeLayout,
      allOverlays,
      allLayouts,
      settings
    });
  } catch (err) {
    console.error('Error fetching active event:', err);
    res.status(500).json({ error: err.message });
  }
});

// UPDATE Event Details & Theme Branding
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const { name, event_date, theme_primary, theme_secondary, theme_bg_color, welcome_slogan, bg_image_url, active_overlay_id, active_layout_id } = req.body;

    const stmt = db.prepare(`
      UPDATE events 
      SET name = COALESCE(?, name),
          event_date = COALESCE(?, event_date),
          theme_primary = COALESCE(?, theme_primary),
          theme_secondary = COALESCE(?, theme_secondary),
          theme_bg_color = COALESCE(?, theme_bg_color),
          welcome_slogan = COALESCE(?, welcome_slogan),
          bg_image_url = COALESCE(?, bg_image_url),
          active_overlay_id = COALESCE(?, active_overlay_id),
          active_layout_id = COALESCE(?, active_layout_id)
      WHERE id = ?
    `);

    stmt.run(name, event_date, theme_primary, theme_secondary, theme_bg_color, welcome_slogan, bg_image_url, active_overlay_id, active_layout_id, id);

    const updatedEvent = db.prepare('SELECT * FROM events WHERE id = ?').get(id);
    res.json({ success: true, event: updatedEvent });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
