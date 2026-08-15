const express = require('express');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config();

const db = require('./db/database');
const cloudWorker = require('./services/cloudUploadService');

const eventsRouter = require('./routes/api/events');
const overlaysRouter = require('./routes/api/overlays');
const layoutsRouter = require('./routes/api/layouts');
const sessionsRouter = require('./routes/api/sessions');
const cloudRouter = require('./routes/api/cloud');
const analyticsRouter = require('./routes/api/analytics');
const settingsRouter = require('./routes/api/settings');

const authRouter = require('./routes/api/auth');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Simple Cookie Parser Middleware
app.use((req, res, next) => {
  req.cookies = {};
  const cookieHeader = req.headers.cookie;
  if (cookieHeader) {
    cookieHeader.split(';').forEach(cookie => {
      const parts = cookie.split('=');
      req.cookies[parts[0].trim()] = decodeURIComponent(parts[1] ? parts[1].trim() : '');
    });
  }
  next();
});

// Static files
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// API Routes
app.use('/api/auth', authRouter.router);
app.use('/api/events', eventsRouter);
app.use('/api/overlays', overlaysRouter);
app.use('/api/layouts', layoutsRouter);
app.use('/api/sessions', sessionsRouter);
app.use('/api/cloud', cloudRouter);
app.use('/api/analytics', analyticsRouter);
app.use('/api/settings', settingsRouter);

// Frontend Page Routes
app.get('/kiosk', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/kiosk/index.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/admin/index.html'));
});

app.get('/share/:token', (req, res) => {
  res.sendFile(path.join(__dirname, 'public/share/index.html'));
});

// Default Redirect to Kiosk Touchscreen
app.get('/', (req, res) => {
  res.redirect('/kiosk');
});

// Start Background Cloud Upload Queue Worker
cloudWorker.startWorker(4000);

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`====================================================`);
    console.log(`  Birthday Party Photobooth System Running!`);
    console.log(`  Guest Touchscreen Kiosk: http://localhost:${PORT}/kiosk`);
    console.log(`  Admin Management Portal: http://localhost:${PORT}/admin`);
    console.log(`====================================================`);
  });
}

module.exports = app;
