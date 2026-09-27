const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

// Initialize DB schema
require('./db/database');

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

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

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
    version: '1.0.0',
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

// Error handling fallback
app.use((err, req, res, next) => {
  console.error('Server Uncaught Error:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, () => {
  console.log(`================================================================`);
  console.log(`🎓 Student Management ERP Backend Server running on port ${PORT}`);
  console.log(`📡 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`================================================================`);
});

module.exports = app;
