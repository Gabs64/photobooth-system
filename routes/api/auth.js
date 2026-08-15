const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const db = require('../../db/database');

const SECRET = process.env.ADMIN_SESSION_SECRET || 'photobooth_admin_secret_key_2026';

function hashPassword(password) {
  return crypto.createHash('sha256').update(password + 'photobooth_salt_2026').digest('hex');
}

function generateToken(username) {
  const timestamp = Date.now();
  const signature = crypto.createHmac('sha256', SECRET).update(`${username}:${timestamp}`).digest('hex');
  return Buffer.from(`${username}:${timestamp}:${signature}`).toString('base64');
}

function verifyToken(token) {
  if (!token) return null;
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [username, timestamp, signature] = decoded.split(':');
    if (!username || !timestamp || !signature) return null;

    // Check expiration (24 hour session)
    if (Date.now() - parseInt(timestamp, 10) > 24 * 60 * 60 * 1000) return null;

    const expectedSig = crypto.createHmac('sha256', SECRET).update(`${username}:${timestamp}`).digest('hex');
    if (signature === expectedSig) {
      return { username };
    }
  } catch (e) {}
  return null;
}

// POST /api/auth/login
router.post('/login', (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) {
    return res.status(400).json({ success: false, error: 'Username and password are required' });
  }

  const hash = hashPassword(password);
  const user = db.prepare('SELECT * FROM admin_users WHERE username = ? AND password_hash = ?').get(username, hash);

  if (!user) {
    return res.status(401).json({ success: false, error: 'Invalid admin username or password' });
  }

  const token = generateToken(user.username);
  res.cookie('admin_token', token, {
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000,
    sameSite: 'lax'
  });

  return res.json({
    success: true,
    token: token,
    username: user.username,
    message: 'Admin authentication successful!'
  });
});

// GET /api/auth/check
router.get('/check', (req, res) => {
  const token = req.cookies?.admin_token || req.headers.authorization?.replace('Bearer ', '');
  const verified = verifyToken(token);

  if (verified) {
    return res.json({ authenticated: true, username: verified.username });
  }
  return res.json({ authenticated: false });
});

// POST /api/auth/logout
router.post('/logout', (req, res) => {
  res.clearCookie('admin_token');
  return res.json({ success: true, message: 'Logged out successfully' });
});

module.exports = {
  router,
  verifyToken
};
