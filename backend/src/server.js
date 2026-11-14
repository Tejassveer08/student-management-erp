const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Connect to MongoDB
const { connectDB } = require('./db/database');
const { runMigrations } = require('./services/migrations');
const { ROOT: UPLOADS_ROOT } = require('./services/uploads');

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
const PORT = process.env.PORT || 5000;

// CORS: same-origin in production (frontend served by this app); set CORS_ORIGIN to allow others
app.use(cors(process.env.CORS_ORIGIN ? { origin: process.env.CORS_ORIGIN.split(',').map((o) => o.trim()) } : undefined));
app.use(express.json({ limit: '1mb' }));
app.set('trust proxy', 'loopback');

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

// Uploaded files (random 128-bit names); never rendered as HTML
app.use('/api/uploads', express.static(UPLOADS_ROOT, {
  fallthrough: false,
  setHeaders: (res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Security-Policy', "default-src 'none'");
  }
}));

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

connectDB()
  .then(async () => {
    try {
      await runMigrations();
    } catch (err) {
      console.error('Start-up maintenance failed (continuing):', err.message);
    }
    app.listen(PORT, () => {
      console.log(`================================================================`);
      console.log(`🎓 Student Management ERP Backend Server running on port ${PORT}`);
      console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
      console.log(`================================================================`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });

module.exports = app;
