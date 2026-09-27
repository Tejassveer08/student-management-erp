const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { verifyToken, requirePermission, logAudit } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/faculty - List all faculty members
router.get('/', verifyToken, requirePermission('faculty', 'read'), (req, res) => {
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
      SELECT s.id, s.code, s.name, s.credits, s.semester, s.type,
             fcm.section, fcm.semester as mapped_semester
      FROM subjects s
      LEFT JOIN faculty_class_map fcm ON s.id = fcm.subject_id AND fcm.faculty_id = ?
      WHERE s.faculty_id = ? OR fcm.faculty_id = ?
    `).all(fac.id, fac.id, fac.id);

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
router.get('/:id', verifyToken, requirePermission('faculty', 'read'), (req, res) => {
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

  const classMappings = db.prepare(`
    SELECT fcm.*, s.name as subject_name, s.code as subject_code, s.credits
    FROM faculty_class_map fcm
    JOIN subjects s ON fcm.subject_id = s.id
    WHERE fcm.faculty_id = ?
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
    assigned_classes: classMappings,
    timetable
  });
});

// POST /api/faculty - Add new faculty member (Admin only)
router.post('/', verifyToken, requirePermission('faculty', 'create'), (req, res) => {
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
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    );

    const facResult = db.prepare(`
      INSERT INTO faculty (
        user_id, employee_id, department_id, designation, qualification,
        weekly_workload_hours, office_room, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'Active')
    `).run(
      userResult.lastInsertRowid,
      employeeId,
      departmentId || 1,
      designation || 'Assistant Professor',
      qualification || 'M.Tech, Ph.D (Pursuing)',
      weeklyWorkloadHours || 16,
      officeRoom || 'Room 302'
    );

    logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      userEmail: req.user.email,
      action: 'FACULTY_ONBOARD',
      entityType: 'faculty',
      entityId: facResult.lastInsertRowid,
      oldValue: null,
      newValue: { fullName, email, employeeId, designation },
      reason: 'New faculty member onboarding',
      ipAddress: req.ip
    });

    res.status(201).json({ message: 'Faculty registered successfully', facultyId: facResult.lastInsertRowid });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'A user with this email or employee ID already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/faculty/assign-class - Assign faculty to class & subject mapping (Admin only)
router.post('/assign-class', verifyToken, requirePermission('faculty', 'assign_classes'), (req, res) => {
  const { facultyId, subjectId, courseId, departmentId, semester, section } = req.body;

  if (!facultyId || !subjectId || !semester || !section) {
    return res.status(400).json({ error: 'Faculty ID, Subject ID, Semester, and Section are required.' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO faculty_class_map (
        faculty_id, subject_id, course_id, department_id, semester, section, academic_year
      ) VALUES (?, ?, ?, ?, ?, ?, '2025-2026')
      ON CONFLICT(faculty_id, subject_id, semester, section) DO NOTHING
    `).run(
      facultyId,
      subjectId,
      courseId || 1,
      departmentId || 1,
      semester,
      section
    );

    // Also link subject.faculty_id if not set
    db.prepare('UPDATE subjects SET faculty_id = ? WHERE id = ?').run(facultyId, subjectId);

    logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      userEmail: req.user.email,
      action: 'FACULTY_CLASS_ASSIGNMENT',
      entityType: 'faculty_class_map',
      entityId: result.lastInsertRowid || `${facultyId}_${subjectId}`,
      oldValue: null,
      newValue: { facultyId, subjectId, semester, section },
      reason: 'Administrative faculty-to-class workload assignment',
      ipAddress: req.ip
    });

    res.status(201).json({
      message: 'Faculty class assignment mapped successfully.',
      mappingId: result.lastInsertRowid
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
