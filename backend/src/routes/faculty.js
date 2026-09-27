const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/faculty - List all faculty members
router.get('/', verifyToken, (req, res) => {
  const facultyList = db.prepare(`
    SELECT f.*, u.full_name, u.email, u.phone, u.avatar_url,
           d.name as department_name, d.code as department_code
    FROM faculty f
    JOIN users u ON f.user_id = u.id
    JOIN departments d ON f.department_id = d.id
    ORDER BY f.employee_id ASC
  `).all();

  // Attach assigned subjects & workload summary
  const facultyWithSubjects = facultyList.map(fac => {
    const subjects = db.prepare(`
      SELECT id, code, name, credits, semester, type
      FROM subjects
      WHERE faculty_id = ?
    `).all(fac.id);

    const timetableSlotsCount = db.prepare(`
      SELECT COUNT(*) as slot_count
      FROM timetable_slots
      WHERE faculty_id = ?
    `).get(fac.id);

    return {
      ...fac,
      assigned_subjects: subjects,
      scheduled_slots_count: timetableSlotsCount.slot_count || 0
    };
  });

  res.json(facultyWithSubjects);
});

// GET /api/faculty/:id - Single faculty details
router.get('/:id', verifyToken, (req, res) => {
  const fac = db.prepare(`
    SELECT f.*, u.full_name, u.email, u.phone, u.avatar_url,
           d.name as department_name, d.code as department_code
    FROM faculty f
    JOIN users u ON f.user_id = u.id
    JOIN departments d ON f.department_id = d.id
    WHERE f.id = ?
  `).get(req.params.id);

  if (!fac) {
    return res.status(404).json({ error: 'Faculty member not found' });
  }

  const subjects = db.prepare(`
    SELECT id, code, name, credits, semester, type, difficulty_index
    FROM subjects
    WHERE faculty_id = ?
  `).all(fac.id);

  const timetable = db.prepare(`
    SELECT ts.*, sub.name as subject_name, sub.code as subject_code
    FROM timetable_slots ts
    JOIN subjects sub ON ts.subject_id = sub.id
    WHERE ts.faculty_id = ?
    ORDER BY 
      CASE ts.day_of_week
        WHEN 'Monday' THEN 1
        WHEN 'Tuesday' THEN 2
        WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4
        WHEN 'Friday' THEN 5
        ELSE 6
      END, ts.start_time ASC
  `).all(fac.id);

  res.json({
    ...fac,
    assigned_subjects: subjects,
    timetable
  });
});

// POST /api/faculty - Add new faculty member (Admin only)
router.post('/', verifyToken, requireRoles('admin'), (req, res) => {
  const { fullName, email, phone, employeeId, departmentId, designation, qualification, weeklyWorkloadHours, officeRoom } = req.body;

  if (!fullName || !email || !employeeId) {
    return res.status(400).json({ error: 'Full name, email, and employee ID are required' });
  }

  const salt = bcrypt.genSaltSync(10);
  const defaultPass = bcrypt.hashSync('faculty123', salt);

  try {
    const userResult = db.prepare(`
      INSERT INTO users (email, password_hash, role, full_name, phone, avatar_url)
      VALUES (?, ?, 'faculty', ?, ?, ?)
    `).run(
      email.toLowerCase().trim(),
      defaultPass,
      fullName,
      phone || null,
      'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=150&auto=format&fit=crop&q=80'
    );

    const facultyResult = db.prepare(`
      INSERT INTO faculty (user_id, employee_id, department_id, designation, qualification, weekly_workload_hours, office_room, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
    `).run(
      userResult.lastInsertRowid,
      employeeId,
      departmentId || 1,
      designation || 'Assistant Professor',
      qualification || 'M.Tech / Ph.D',
      weeklyWorkloadHours || 16,
      officeRoom || 'Faculty Room'
    );

    res.status(201).json({
      message: 'Faculty registered successfully',
      facultyId: facultyResult.lastInsertRowid
    });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'A user with this email or employee ID already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
