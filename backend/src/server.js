/**
 * Long-running server entry point (local development / a VM).
 * On Vercel the app is served by api/index.js instead, and the start-up
 * maintenance below runs from a daily cron (see /api/cron/maintenance).
 */
const app = require('./app');
const { connectDB } = require('./db/database');
const { runMigrations } = require('./services/migrations');
const { scheduleDailyAlerts } = require('./services/attendanceAlerts');

const PORT = process.env.PORT || 5000;

connectDB()
  .then(async () => {
    try {
      await runMigrations();
      scheduleDailyAlerts();
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
