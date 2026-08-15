const express = require('express');
const router = express.Router();
const db = require('../../db/database');

// GET All Print Layout Templates
router.get('/', (req, res) => {
  try {
    const layouts = db.prepare('SELECT * FROM print_layouts ORDER BY created_at DESC').all();
    res.json(layouts);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// CREATE Print Layout Template
router.post('/', (req, res) => {
  try {
    const {
      event_id,
      name,
      paper_size,
      orientation,
      rows,
      cols,
      cell_count,
      spacing_px,
      margin_px,
      border_color,
      border_width_px,
      corner_radius_px,
      text_stamp,
      text_color,
      font_size_pt,
      show_qr_on_print,
      is_active
    } = req.body;

    const layoutId = 'lay_' + Date.now();
    const targetEventId = event_id || 'evt_mia10th';

    if (is_active === 1 || is_active === true) {
      db.prepare('UPDATE print_layouts SET is_active = 0 WHERE event_id = ?').run(targetEventId);
      db.prepare('UPDATE events SET active_layout_id = ? WHERE id = ?').run(layoutId, targetEventId);
    }

    db.prepare(`
      INSERT INTO print_layouts (
        id, event_id, name, paper_size, orientation, rows, cols, cell_count, 
        spacing_px, margin_px, border_color, border_width_px, corner_radius_px,
        text_stamp, text_color, font_size_pt, show_qr_on_print, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      layoutId,
      targetEventId,
      name || 'Custom Layout',
      paper_size || '4x6',
      orientation || 'portrait',
      parseInt(rows || 2),
      parseInt(cols || 2),
      parseInt(cell_count || 4),
      parseInt(spacing_px || 12),
      parseInt(margin_px || 16),
      border_color || '#FFFFFF',
      parseInt(border_width_px || 4),
      parseInt(corner_radius_px || 8),
      text_stamp || '',
      text_color || '#334155',
      parseInt(font_size_pt || 16),
      show_qr_on_print ? 1 : 0,
      is_active ? 1 : 0
    );

    const newLayout = db.prepare('SELECT * FROM print_layouts WHERE id = ?').get(layoutId);
    res.json({ success: true, layout: newLayout });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// UPDATE Print Layout Template
router.put('/:id', (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const current = db.prepare('SELECT * FROM print_layouts WHERE id = ?').get(id);
    if (!current) return res.status(404).json({ error: 'Print layout not found' });

    if (body.is_active === 1 || body.is_active === true) {
      db.prepare('UPDATE print_layouts SET is_active = 0 WHERE event_id = ?').run(current.event_id);
      db.prepare('UPDATE events SET active_layout_id = ? WHERE id = ?').run(id, current.event_id);
    }

    db.prepare(`
      UPDATE print_layouts
      SET name = COALESCE(?, name),
          paper_size = COALESCE(?, paper_size),
          orientation = COALESCE(?, orientation),
          rows = COALESCE(?, rows),
          cols = COALESCE(?, cols),
          cell_count = COALESCE(?, cell_count),
          spacing_px = COALESCE(?, spacing_px),
          margin_px = COALESCE(?, margin_px),
          border_color = COALESCE(?, border_color),
          border_width_px = COALESCE(?, border_width_px),
          corner_radius_px = COALESCE(?, corner_radius_px),
          text_stamp = COALESCE(?, text_stamp),
          text_color = COALESCE(?, text_color),
          font_size_pt = COALESCE(?, font_size_pt),
          show_qr_on_print = COALESCE(?, show_qr_on_print),
          is_active = COALESCE(?, is_active)
      WHERE id = ?
    `).run(
      body.name,
      body.paper_size,
      body.orientation,
      body.rows,
      body.cols,
      body.cell_count,
      body.spacing_px,
      body.margin_px,
      body.border_color,
      body.border_width_px,
      body.corner_radius_px,
      body.text_stamp,
      body.text_color,
      body.font_size_pt,
      body.show_qr_on_print !== undefined ? (body.show_qr_on_print ? 1 : 0) : null,
      body.is_active !== undefined ? (body.is_active ? 1 : 0) : null,
      id
    );

    const updated = db.prepare('SELECT * FROM print_layouts WHERE id = ?').get(id);
    res.json({ success: true, layout: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE Print Layout Template
router.delete('/:id', (req, res) => {
  try {
    const { id } = req.params;
    db.prepare('DELETE FROM print_layouts WHERE id = ?').run(id);
    res.json({ success: true, deleted_id: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
