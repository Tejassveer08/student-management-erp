const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { connectDB } = require('./db/database');
const { serveUpload } = require('./services/uploads');
const { runMigrations } = require('./services/migrations');

const authRoutes = require('./routes/auth');
const studentRoutes = require('./routes/students');
const facultyRoutes = require('./routes/faculty');
const academicRoutes = require('./routes/academics');
const attendanceRoutes = require('./routes/attendance');
const examRoutes = require('./routes/exams');
const cgpaRoutes = require('./routes/cgpa_probability');
const assignmentRoutes = require('./routes/assignments');
const feeRoutes = require('./routes/fees');
const noticeRoutes = require('./routes/notices');
const libraryHostelRoutes = require('./routes/library_hostel');
const placementRoutes = require('./routes/placements');
const engagementRoutes = require('./routes/engagement');
const dashboardRoutes = require('./routes/dashboard');
const settingsRoutes = require('./routes/settings');
const societiesRoutes = require('./routes/societies');
const forumRoutes = require('./routes/forum');

const app = express();

// CORS: same-origin in production (frontend served by this app); set CORS_ORIGIN to allow others
app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) } : undefined));
app.use(express.json({ limit: '1mb' }));
// Behind Vercel's edge proxy the client IP arrives in X-Forwarded-For
app.set('trust proxy', process.env.VERCEL ? 1 : 'loopback');

// Request logging middleware
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ONLINE',
    project: 'Full Fledged Student Management ERP System',
    institution: 'Guru Tegh Bahadur Institute of Technology (GGSIPU)',
    version: '1.1.0',
    timestamp: new Date().toISOString()
  });
});

// Make sure MongoDB is connected before any route touches it. The connection is
// cached, so this only waits on a cold start.
app.use('/api', (req, res, next) => {
  if (req.path === '/health') return next();
  connectDB().then(() => next(), next);
});

// Mount modular REST API routes
app.use('/api/auth', authRoutes);
app.use('/api/students', studentRoutes);
app.use('/api/faculty', facultyRoutes);
app.use('/api/academics', academicRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/cgpa', cgpaRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/notices', noticeRoutes);
app.use('/api/library', libraryHostelRoutes);
app.use('/api/placements', placementRoutes);
app.use('/api/engagement', engagementRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/societies', societiesRoutes);
app.use('/api/forum', forumRoutes);

// Uploaded files (random 128-bit names, stored in MongoDB GridFS); never rendered as HTML
app.get('/api/uploads/:kind/:name', serveUpload);

// Daily maintenance (Vercel Cron). Re-runs the idempotent start-up refreshes:
// fee ledger, CGPA calibration, attendance alerts, merit list.
app.get('/api/cron/maintenance', async (req, res, next) => {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.get('authorization') !== `Bearer ${secret}`) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const started = Date.now();
    await runMigrations();
    res.json({ ok: true, ms: Date.now() - started });
  } catch (err) {
    next(err);
  }
});

// Unknown API routes → JSON 404 (instead of the SPA fallback)
app.use('/api', (req, res) => res.status(404).json({ error: `No API route for ${req.method} ${req.originalUrl}` }));

// Serve frontend static build if present (for single-server production deployment)
const frontendDist = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendDist)) {
  app.use(express.static(frontendDist));
  app.use((req, res, next) => {
    if (req.method === 'GET' && !req.originalUrl.startsWith('/api')) {
      return res.sendFile(path.resolve(frontendDist, 'index.html'));
    }
    next();
  });
}

// Error handling fallback
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error('Server Uncaught Error:', err);
  res.status(status).json({ error: status >= 500 && process.env.NODE_ENV === 'production' ? 'Internal Server Error' : err.message || 'Internal Server Error' });
});

module.exports = app;
