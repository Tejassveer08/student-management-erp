const express = require('express');
const db = require('../db/database');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/academics/departments
router.get('/departments', verifyToken, (req, res) => {
  const depts = db.prepare('SELECT * FROM departments ORDER BY name ASC').all();
  res.json(depts);
});

// GET /api/academics/courses
router.get('/courses', verifyToken, (req, res) => {
  const courses = db.prepare(`
    SELECT c.*, d.name as department_name, d.code as department_code
    FROM courses c
    JOIN departments d ON c.department_id = d.id
    ORDER BY c.name ASC
  `).all();
  res.json(courses);
});

// GET /api/academics/subjects
router.get('/subjects', verifyToken, (req, res) => {
  const { semester, departmentId } = req.query;
  let query = `
    SELECT s.*, c.name as course_name, 
           u.full_name as faculty_name, f.employee_id as faculty_employee_id
    FROM subjects s
    JOIN courses c ON s.course_id = c.id
    LEFT JOIN faculty f ON s.faculty_id = f.id
    LEFT JOIN users u ON f.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (semester) {
    query += ' AND s.semester = ?';
    params.push(Number(semester));
  }

  if (departmentId) {
    query += ' AND c.department_id = ?';
    params.push(Number(departmentId));
  }

  query += ' ORDER BY s.code ASC';

  const subjects = db.prepare(query).all(...params);
  res.json(subjects);
});

// POST /api/academics/subjects (Admin only)
router.post('/subjects', verifyToken, requireRoles('admin'), (req, res) => {
  const { courseId, code, name, semester, credits, type, facultyId, syllabusOutline, difficultyIndex } = req.body;

  if (!code || !name || !semester) {
    return res.status(400).json({ error: 'Subject code, name, and semester are required' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO subjects (course_id, code, name, semester, credits, type, faculty_id, syllabus_outline, difficulty_index)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      courseId || 1,
      code.toUpperCase().trim(),
      name.trim(),
      semester,
      credits || 4,
      type || 'Theory',
      facultyId || null,
      syllabusOutline || '',
      difficultyIndex || 0.50
    );

    res.status(201).json({ message: 'Subject created successfully', subjectId: result.lastInsertRowid });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/academics/timetable
router.get('/timetable', verifyToken, (req, res) => {
  const { semester, section, facultyId, day } = req.query;

  let query = `
    SELECT ts.*, sub.name as subject_name, sub.code as subject_code, sub.type as subject_type,
           u.full_name as faculty_name
    FROM timetable_slots ts
    JOIN subjects sub ON ts.subject_id = sub.id
    JOIN faculty f ON ts.faculty_id = f.id
    JOIN users u ON f.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (semester) {
    query += ' AND ts.semester = ?';
    params.push(Number(semester));
  }

  if (section) {
    query += ' AND ts.section = ?';
    params.push(section);
  }

  if (facultyId) {
    query += ' AND ts.faculty_id = ?';
    params.push(Number(facultyId));
  }

  if (day) {
    query += ' AND ts.day_of_week = ?';
    params.push(day);
  }

  query += `
    ORDER BY 
      CASE ts.day_of_week
        WHEN 'Monday' THEN 1
        WHEN 'Tuesday' THEN 2
        WHEN 'Wednesday' THEN 3
        WHEN 'Thursday' THEN 4
        WHEN 'Friday' THEN 5
        ELSE 6
      END, ts.start_time ASC
  `;

  const slots = db.prepare(query).all(...params);
  res.json(slots);
});

// POST /api/academics/timetable (Admin/Faculty only)
router.post('/timetable', verifyToken, requireRoles('admin', 'faculty'), (req, res) => {
  const { subjectId, facultyId, semester, section, dayOfWeek, startTime, endTime, roomNo } = req.body;

  if (!subjectId || !facultyId || !dayOfWeek || !startTime || !endTime || !roomNo) {
    return res.status(400).json({ error: 'All schedule slot fields are required' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO timetable_slots (subject_id, faculty_id, semester, section, day_of_week, start_time, end_time, room_no)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(subjectId, facultyId, semester || 4, section || 'CSE-2', dayOfWeek, startTime, endTime, roomNo);

    res.status(201).json({ message: 'Timetable slot created successfully', slotId: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
