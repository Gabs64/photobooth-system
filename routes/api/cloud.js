const express = require('express');
const router = express.Router();
const { google } = require('googleapis');
const db = require('../../db/database');

function getOAuth2Client(req) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  
  let redirectUri = process.env.GOOGLE_REDIRECT_URI;
  if (!redirectUri && req) {
    const host = req.headers.host;
    const protocol = req.headers['x-forwarded-proto'] || 'https';
    if (host) {
      redirectUri = `${protocol}://${host}/api/cloud/gdrive/callback`;
    }
  }
  if (!redirectUri) {
    redirectUri = 'http://localhost:3000/api/cloud/gdrive/callback';
  }

  if (!clientId || !clientSecret) {
    return null;
  }
  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

// GET Cloud Configuration & Upload Queue Status
router.get('/status', (req, res) => {
  try {
    const config = db.prepare('SELECT * FROM cloud_config WHERE id = 1').get();
    const pendingCount = db.prepare("SELECT COUNT(*) as count FROM photos WHERE upload_status = 'pending'").get().count;
    const uploadingCount = db.prepare("SELECT COUNT(*) as count FROM photos WHERE upload_status = 'uploading'").get().count;
    const successCount = db.prepare("SELECT COUNT(*) as count FROM photos WHERE upload_status = 'success'").get().count;
    const failedCount = db.prepare("SELECT COUNT(*) as count FROM photos WHERE upload_status = 'failed'").get().count;

    const recentUploads = db.prepare(`
      SELECT id, session_id, composited_path, cloud_url, upload_status, retry_count, last_error, created_at 
      FROM photos 
      ORDER BY created_at DESC LIMIT 20
    `).all();

    const hasClientCredentials = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

    res.json({
      config,
      hasClientCredentials,
      stats: {
        pending: pendingCount,
        uploading: uploadingCount,
        success: successCount,
        failed: failedCount,
        total: pendingCount + uploadingCount + successCount + failedCount
      },
      recentUploads
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET Google Drive OAuth Authorization URL
router.get('/gdrive/auth-url', (req, res) => {
  const oauth2Client = getOAuth2Client(req);
  if (!oauth2Client) {
    return res.status(400).json({ 
      error: 'Google Drive credentials missing on Vercel. Please add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in Vercel Settings -> Environment Variables.' 
    });
  }

  const scopes = [
    'https://www.googleapis.com/auth/drive.file',
    'https://www.googleapis.com/auth/userinfo.email'
  ];

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: scopes,
    prompt: 'consent'
  });

  res.json({ authUrl });
});

// GET Google Drive OAuth Callback Handler
router.get('/gdrive/callback', async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).send('Authorization code missing');
  }

  const oauth2Client = getOAuth2Client();
  if (!oauth2Client) {
    return res.status(500).send('OAuth client not configured');
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    oauth2Client.setCredentials(tokens);

    // Get user account email if available
    let accountEmail = 'Google Drive User';
    try {
      const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client });
      const userinfo = await oauth2.userinfo.get();
      if (userinfo.data && userinfo.data.email) {
        accountEmail = userinfo.data.email;
      }
    } catch (e) {}

    // Save tokens in database
    db.prepare(`
      UPDATE cloud_config
      SET provider = 'google_drive',
          account_name = ?,
          access_token = ?,
          refresh_token = COALESCE(?, refresh_token),
          is_connected = 1,
          last_synced_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(accountEmail, tokens.access_token, tokens.refresh_token || null);

    res.send(`
      <!DOCTYPE html>
      <html>
      <head><title>Google Drive Connected!</title></head>
      <body style="font-family: sans-serif; text-align: center; padding: 50px; background: #0F172A; color: #FFF;">
        <h1 style="color: #34D399;">🎉 Google Drive Connected Successfully!</h1>
        <p>Connected Account: <strong>${accountEmail}</strong></p>
        <p>Redirecting back to Admin Management Portal...</p>
        <script>
          setTimeout(() => {
            window.location.href = '/admin#cloud';
          }, 2000);
        </script>
      </body>
      </html>
    `);
  } catch (err) {
    console.error('Google OAuth callback error:', err);
    res.status(500).send(`Authentication failed: ${err.message}`);
  }
});

// UPDATE Cloud Config
router.put('/config', (req, res) => {
  try {
    const { provider, account_name, destination_folder, sharing_permission, link_expiration_days, is_connected } = req.body;

    db.prepare(`
      UPDATE cloud_config
      SET provider = COALESCE(?, provider),
          account_name = COALESCE(?, account_name),
          destination_folder = COALESCE(?, destination_folder),
          sharing_permission = COALESCE(?, sharing_permission),
          link_expiration_days = COALESCE(?, link_expiration_days),
          is_connected = COALESCE(?, is_connected),
          last_synced_at = CURRENT_TIMESTAMP
      WHERE id = 1
    `).run(
      provider,
      account_name,
      destination_folder,
      sharing_permission,
      link_expiration_days,
      is_connected !== undefined ? (is_connected ? 1 : 0) : null
    );

    const updated = db.prepare('SELECT * FROM cloud_config WHERE id = 1').get();
    res.json({ success: true, config: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// MANUALLY TRIGGER QUEUE RETRY
router.post('/retry-all', (req, res) => {
  try {
    db.prepare("UPDATE photos SET upload_status = 'pending', retry_count = 0, last_error = NULL WHERE upload_status = 'failed'").run();
    res.json({ success: true, message: 'Failed uploads re-queued for processing' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
