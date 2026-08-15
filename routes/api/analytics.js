const express = require('express');
const router = express.Router();
const db = require('../../db/database');

// GET Dashboard Overview Analytics
router.get('/overview', (req, res) => {
  try {
    const totalSessions = db.prepare('SELECT COUNT(*) as count FROM sessions').get().count;
    const totalPhotos = db.prepare('SELECT COUNT(*) as count FROM photos').get().count;
    const totalPrints = db.prepare("SELECT COUNT(*) as count FROM sessions WHERE guest_action = 'print' OR guest_action = 'both'").get().count;
    const totalUploadsSuccess = db.prepare("SELECT COUNT(*) as count FROM photos WHERE upload_status = 'success'").get().count;
    const totalUploadsFailed = db.prepare("SELECT COUNT(*) as count FROM photos WHERE upload_status = 'failed'").get().count;

    // Mode Breakdown
    const modeBreakdown = db.prepare(`
      SELECT mode, COUNT(*) as count 
      FROM sessions 
      GROUP BY mode
    `).all();

    // Recent Sessions Hourly Trend
    const hourlyTrend = db.prepare(`
      SELECT strftime('%H:00', created_at) as hour, COUNT(*) as count
      FROM sessions
      GROUP BY hour
      ORDER BY hour ASC
      LIMIT 12
    `).all();

    res.json({
      metrics: {
        totalSessions,
        totalPhotos,
        totalPrints,
        totalUploadsSuccess,
        totalUploadsFailed,
        uploadSuccessRate: totalPhotos > 0 ? Math.round((totalUploadsSuccess / totalPhotos) * 100) : 100
      },
      modeBreakdown,
      hourlyTrend
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
