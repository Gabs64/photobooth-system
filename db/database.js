const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

// Ensure uploads directories exist (use /tmp on Vercel serverless environment if read-only)
const isVercel = process.env.VERCEL || process.env.NOW_BUILDER;
let baseDir = path.join(__dirname, '..', 'public', 'uploads');

if (isVercel) {
  baseDir = path.join('/tmp', 'uploads');
}

const subdirs = ['raw', 'composited', 'overlays', 'qrcodes', 'backgrounds'];
subdirs.forEach(sub => {
  const dirPath = path.join(baseDir, sub);
  if (!fs.existsSync(dirPath)) {
    try {
      fs.mkdirSync(dirPath, { recursive: true });
    } catch (e) {}
  }
});

let dbPath = path.join(__dirname, 'photobooth.db');
if (isVercel) {
  dbPath = path.join('/tmp', 'photobooth.db');
  // Copy seed db if available
  const origDb = path.join(__dirname, 'photobooth.db');
  if (!fs.existsSync(dbPath) && fs.existsSync(origDb)) {
    try { fs.copyFileSync(origDb, dbPath); } catch (e) {}
  }
}

const db = new Database(dbPath);

// Enable foreign keys and WAL mode for performance
try {
  db.pragma('foreign_keys = ON');
  db.pragma('journal_mode = WAL');
} catch (e) {}

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'photobooth_salt_2026').digest('hex');
}

function initSchema() {
  // Admin Users Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS admin_users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Events Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      event_date TEXT NOT NULL,
      theme_primary TEXT DEFAULT '#6366F1',
      theme_secondary TEXT DEFAULT '#EC4899',
      theme_bg_color TEXT DEFAULT '#0F172A',
      welcome_slogan TEXT DEFAULT 'Tap Screen to Start!',
      bg_image_url TEXT DEFAULT '',
      active_overlay_id TEXT,
      active_layout_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Overlays Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS overlays (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      position_x REAL DEFAULT 0,
      position_y REAL DEFAULT 0,
      scale REAL DEFAULT 1.0,
      rotation REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      schedule_time TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );
  `);

  // Print Layouts Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS print_layouts (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      name TEXT NOT NULL,
      paper_size TEXT DEFAULT '4x6',
      orientation TEXT DEFAULT 'portrait',
      rows INTEGER DEFAULT 2,
      cols INTEGER DEFAULT 2,
      cell_count INTEGER DEFAULT 4,
      spacing_px INTEGER DEFAULT 12,
      margin_px INTEGER DEFAULT 16,
      border_color TEXT DEFAULT '#FFFFFF',
      border_width_px INTEGER DEFAULT 4,
      corner_radius_px INTEGER DEFAULT 8,
      text_stamp TEXT DEFAULT 'Mia''s 10th Birthday! • Aug 15, 2026',
      text_color TEXT DEFAULT '#334155',
      font_size_pt INTEGER DEFAULT 16,
      show_qr_on_print INTEGER DEFAULT 1,
      is_active INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );
  `);

  // Sessions Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      event_id TEXT NOT NULL,
      mode TEXT DEFAULT '4-up',
      retakes_used INTEGER DEFAULT 0,
      status TEXT DEFAULT 'completed',
      guest_action TEXT DEFAULT 'both',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (event_id) REFERENCES events(id) ON DELETE CASCADE
    );
  `);

  // Photos Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS photos (
      id TEXT PRIMARY KEY,
      session_id TEXT NOT NULL,
      raw_paths TEXT NOT NULL, -- JSON array of raw photo filenames
      composited_path TEXT NOT NULL, -- final print sheet image
      cloud_file_id TEXT DEFAULT NULL,
      cloud_url TEXT DEFAULT NULL,
      qr_code_path TEXT DEFAULT NULL,
      share_token TEXT UNIQUE NOT NULL,
      upload_status TEXT DEFAULT 'pending', -- pending, uploading, success, failed
      retry_count INTEGER DEFAULT 0,
      last_error TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
    );
  `);

  // Cloud Config Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS cloud_config (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      provider TEXT DEFAULT 'google_drive', -- google_drive, dropbox, s3, local_sim
      account_name TEXT DEFAULT 'photobooth.cloud@gmail.com',
      destination_folder TEXT DEFAULT '/Photobooth/Mias10thBirthday/',
      sharing_permission TEXT DEFAULT 'anyone_with_link',
      link_expiration_days INTEGER DEFAULT 30,
      is_connected INTEGER DEFAULT 1,
      access_token TEXT DEFAULT NULL,
      refresh_token TEXT DEFAULT NULL,
      client_id TEXT DEFAULT NULL,
      client_secret TEXT DEFAULT NULL,
      last_synced_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Migration check for existing DB
  try {
    db.exec(`ALTER TABLE cloud_config ADD COLUMN access_token TEXT DEFAULT NULL`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE cloud_config ADD COLUMN refresh_token TEXT DEFAULT NULL`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE cloud_config ADD COLUMN client_id TEXT DEFAULT NULL`);
  } catch (e) {}
  try {
    db.exec(`ALTER TABLE cloud_config ADD COLUMN client_secret TEXT DEFAULT NULL`);
  } catch (e) {}

  // System Settings Table
  db.exec(`
    CREATE TABLE IF NOT EXISTS settings (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      countdown_duration INTEGER DEFAULT 3,
      retake_limit INTEGER DEFAULT 2,
      idle_timeout_sec INTEGER DEFAULT 35,
      printer_mode TEXT DEFAULT 'prompt', -- auto, prompt, disabled
      allow_guest_overlay_select INTEGER DEFAULT 1,
      audio_effects_enabled INTEGER DEFAULT 1,
      qr_placement TEXT DEFAULT 'both' -- screen_only, print_only, both
    );
  `);

  // Seed default data if empty
  seedInitialData();
}

function seedInitialData() {
  const adminCount = db.prepare('SELECT COUNT(*) as count FROM admin_users').get().count;
  if (adminCount === 0) {
    db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run('admin', hashPassword('photobooth2026!'));
  }

  const eventCount = db.prepare('SELECT COUNT(*) as count FROM events').get().count;
  if (eventCount === 0) {
    const eventId = 'evt_mia10th';
    const overlay1Id = 'ovl_birthday_gold';
    const overlay2Id = 'ovl_retro_neon';
    const layout1Id = 'lay_4x6_grid';
    const layout2Id = 'lay_2x6_strip';

    // Insert Default Event
    db.prepare(`
      INSERT INTO events (id, name, event_date, theme_primary, theme_secondary, theme_bg_color, welcome_slogan, active_overlay_id, active_layout_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      eventId,
      "Mia's 10th Birthday Bash!",
      "2026-08-15",
      "#8B5CF6", // Violet
      "#F43F5E", // Rose
      "#0F172A", // Dark Slate
      "Tap Screen to Snap & Celebrate!",
      overlay1Id,
      layout1Id
    );

    // Insert Default Overlays
    db.prepare(`
      INSERT INTO overlays (id, event_id, name, file_path, position_x, position_y, scale, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(overlay1Id, eventId, 'Birthday Celebration Frame', '/uploads/overlays/overlay_birthday.png', 0, 0, 1.0, 1);

    db.prepare(`
      INSERT INTO overlays (id, event_id, name, file_path, position_x, position_y, scale, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(overlay2Id, eventId, 'Retro Neon Glow', '/uploads/overlays/overlay_neon.png', 0, 0, 1.0, 0);

    // Insert Default Print Layouts (Landscape Orientation)
    db.prepare(`
      INSERT INTO print_layouts (id, event_id, name, paper_size, orientation, rows, cols, cell_count, spacing_px, margin_px, text_stamp, show_qr_on_print, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(layout1Id, eventId, '4-Photo Classic Grid (6x4" Landscape)', '4x6', 'landscape', 2, 2, 4, 16, 20, "Mia's 10th Birthday! • Aug 15, 2026", 1, 1);

    db.prepare(`
      INSERT INTO print_layouts (id, event_id, name, paper_size, orientation, rows, cols, cell_count, spacing_px, margin_px, text_stamp, show_qr_on_print, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(layout2Id, eventId, '3-Photo Strip (6x2" Landscape)', '2x6', 'landscape', 1, 3, 3, 14, 18, "Mia's Birthday • 08.15.2026", 1, 0);

    // Insert Cloud Config
    db.prepare(`
      INSERT OR REPLACE INTO cloud_config (id, provider, account_name, destination_folder, sharing_permission, link_expiration_days, is_connected)
      VALUES (1, 'google_drive', 'mia.birthday.cloud@gmail.com', '/Photobooth/Mias10thBirthday/', 'anyone_with_link', 30, 1)
    `).run();

    // Insert System Settings
    db.prepare(`
      INSERT OR REPLACE INTO settings (id, countdown_duration, retake_limit, idle_timeout_sec, printer_mode, allow_guest_overlay_select, audio_effects_enabled, qr_placement)
      VALUES (1, 5, 2, 35, 'prompt', 1, 1, 'both')
    `).run();
    db.prepare(`UPDATE settings SET countdown_duration = 5 WHERE id = 1`).run();
  }
}

initSchema();

module.exports = db;
