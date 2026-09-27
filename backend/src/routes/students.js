const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db/database');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/students - List students with search and filter
router.get('/', verifyToken, (req, res) => {
  const { search, semester, section, status } = req.query;

  let query = `
    SELECT s.*, u.full_name, u.email, u.phone, u.avatar_url,
           c.name as course_name, c.code as course_code,
           d.name as department_name, d.code as department_code
    FROM students s
    JOIN users u ON s.user_id = u.id
    JOIN courses c ON s.course_id = c.id
    JOIN departments d ON s.department_id = d.id
    WHERE 1=1
  `;
  const params = [];

  if (search) {
    query += ` AND (u.full_name LIKE ? OR s.roll_no LIKE ? OR s.enrollment_no LIKE ? OR u.email LIKE ?)`;
    const searchPattern = `%${search}%`;
    params.push(searchPattern, searchPattern, searchPattern, searchPattern);
  }

  if (semester) {
    query += ` AND s.semester = ?`;
    params.push(Number(semester));
  }

  if (section) {
    query += ` AND s.section = ?`;
    params.push(section);
  }

  if (status) {
    query += ` AND s.status = ?`;
    params.push(status);
  }

  query += ` ORDER BY s.roll_no ASC`;

  const students = db.prepare(query).all(...params);

  // Compute live attendance percentage for each student
  const studentsWithStats = students.map(st => {
    const attStats = db.prepare(`
      SELECT 
        COUNT(*) as total_sessions,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late_count
      FROM attendance_records
      WHERE student_id = ?
    `).get(st.id);

    const total = attStats.total_sessions || 0;
    const attended = (attStats.present_count || 0) + (attStats.late_count ? attStats.late_count * 0.5 : 0);
    const attendancePct = total > 0 ? Number(((attended / total) * 100).toFixed(1)) : 100.0;

    return {
      ...st,
      live_attendance_pct: attendancePct,
      is_attendance_critical: attendancePct < 75.0
    };
  });

  res.json(studentsWithStats);
});

// GET /api/students/:id - Detailed profile
router.get('/:id', verifyToken, (req, res) => {
  const student = db.prepare(`
    SELECT s.*, u.full_name, u.email, u.phone, u.avatar_url,
           c.name as course_name, c.code as course_code,
           d.name as department_name, d.code as department_code,
           p.full_name as linked_parent_name, p.email as linked_parent_email, p.phone as linked_parent_phone
    FROM students s
    JOIN users u ON s.user_id = u.id
    JOIN courses c ON s.course_id = c.id
    JOIN departments d ON s.department_id = d.id
    LEFT JOIN users p ON s.parent_user_id = p.id
    WHERE s.id = ?
  `).get(req.params.id);

  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  // Attendance stats
  const attStats = db.prepare(`
    SELECT 
      COUNT(*) as total_sessions,
      SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present_count,
      SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late_count,
      SUM(CASE WHEN status = 'Absent' THEN 1 ELSE 0 END) as absent_count
    FROM attendance_records
    WHERE student_id = ?
  `).get(student.id);

  const total = attStats.total_sessions || 0;
  const attended = (attStats.present_count || 0) + (attStats.late_count ? attStats.late_count * 0.5 : 0);
  const attendancePct = total > 0 ? Number(((attended / total) * 100).toFixed(1)) : 100.0;

  // Fee records
  const fees = db.prepare(`
    SELECT sfp.*, fs.semester, fs.academic_year, fs.due_date, fs.total_amount as original_fee
    FROM student_fee_payments sfp
    JOIN fee_structures fs ON sfp.fee_structure_id = fs.id
    WHERE sfp.student_id = ?
  `).all(student.id);

  // Subject-wise marks
  const marks = db.prepare(`
    SELECT em.*, sub.code as subject_code, sub.name as subject_name, sub.credits,
           ex.name as exam_name, ex.exam_type
    FROM exam_marks em
    JOIN subjects sub ON em.subject_id = sub.id
    JOIN examinations ex ON em.exam_id = ex.id
    WHERE em.student_id = ?
  `).all(student.id);

  res.json({
    ...student,
    attendance: {
      total_sessions: total,
      present_count: attStats.present_count || 0,
      late_count: attStats.late_count || 0,
      absent_count: attStats.absent_count || 0,
      attendance_percentage: attendancePct,
      is_at_risk: attendancePct < 75.0
    },
    fees,
    marks
  });
});

// POST /api/students - Register/Admit new student (Admin & Faculty)
router.post('/', verifyToken, requireRoles('admin', 'faculty'), (req, res) => {
  const {
    fullName, email, phone, rollNo, enrollmentNo,
    courseId, departmentId, semester, section,
    admissionYear, dob, bloodGroup, address,
    parentName, parentEmail, parentPhone, initialCgpa,
    password
  } = req.body;

  if (!fullName || !email || !rollNo || !enrollmentNo) {
    return res.status(400).json({ error: 'Full name, email, roll number, and enrollment number are required' });
  }

  // Create user record
  const salt = bcrypt.genSaltSync(10);
  const userPassword = password && password.trim() ? password.trim() : 'student123';
  const defaultPass = bcrypt.hashSync(userPassword, salt);

  try {
    const userResult = db.prepare(`
      INSERT INTO users (email, password_hash, role, full_name, phone, avatar_url)
      VALUES (?, ?, 'student', ?, ?, ?)
    `).run(
      email.toLowerCase().trim(),
      defaultPass,
      fullName.trim(),
      phone || null,
      'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
    );

    const studentResult = db.prepare(`
      INSERT INTO students (
        user_id, roll_no, enrollment_no, course_id, department_id,
        semester, section, admission_year, dob, blood_group, address,
        status, current_cgpa, total_credits_earned, parent_name, parent_phone
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, 76, ?, ?)
    `).run(
      userResult.lastInsertRowid,
      rollNo.trim(),
      enrollmentNo.trim(),
      courseId || 1,
      departmentId || 1,
      semester || 4,
      section || 'CSE-2',
      admissionYear || 2023,
      dob || '2005-01-01',
      bloodGroup || 'O+',
      address || 'New Delhi, India',
      initialCgpa || 8.0,
      parentName || 'Parent / Guardian',
      parentPhone || phone || ''
    );

    res.status(201).json({
      message: 'Student admitted successfully',
      studentId: studentResult.lastInsertRowid,
      loginCredentials: {
        email: email.toLowerCase().trim(),
        temporaryPassword: userPassword
      }
    });
  } catch (err) {
    if (err.message.includes('UNIQUE')) {
      return res.status(400).json({ error: 'A student with this email, roll number, or enrollment number already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/students/batch - Bulk register multiple students from a class list
router.post('/batch', verifyToken, requireRoles('admin', 'faculty'), (req, res) => {
  const { studentsList } = req.body;
  if (!Array.isArray(studentsList) || studentsList.length === 0) {
    return res.status(400).json({ error: 'Please provide a valid array of student records.' });
  }

  const salt = bcrypt.genSaltSync(10);
  const defaultPass = bcrypt.hashSync('student123', salt);
  let successCount = 0;
  const errors = [];

  const insertUser = db.prepare(`
    INSERT INTO users (email, password_hash, role, full_name, phone, avatar_url)
    VALUES (?, ?, 'student', ?, ?, ?)
  `);

  const insertStudent = db.prepare(`
    INSERT INTO students (
      user_id, roll_no, enrollment_no, course_id, department_id,
      semester, section, admission_year, dob, blood_group, address,
      status, current_cgpa, total_credits_earned, parent_name, parent_phone
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'Active', ?, 76, ?, ?)
  `);

  for (const st of studentsList) {
    if (!st.fullName || !st.email || !st.rollNo || !st.enrollmentNo) {
      errors.push(`Skipped "${st.fullName || 'Unknown'}": Missing required fields (Name, Email, Roll, or Enrollment).`);
      continue;
    }

    try {
      const uRes = insertUser.run(
        st.email.toLowerCase().trim(),
        st.password ? bcrypt.hashSync(st.password, salt) : defaultPass,
        st.fullName.trim(),
        st.phone || null,
        'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'
      );

      insertStudent.run(
        uRes.lastInsertRowid,
        st.rollNo.trim(),
        st.enrollmentNo.trim(),
        st.courseId || 1,
        st.departmentId || 1,
        st.semester || 4,
        st.section || 'CSE-2',
        st.admissionYear || 2023,
        st.dob || '2005-01-01',
        st.bloodGroup || 'O+',
        st.address || 'New Delhi, India',
        st.initialCgpa || 8.0,
        st.parentName || 'Parent / Guardian',
        st.parentPhone || st.phone || ''
      );
      successCount++;
    } catch (err) {
      errors.push(`Error for ${st.fullName} (${st.email}): ${err.message}`);
    }
  }

  res.json({
    message: `Batch processed: Successfully registered ${successCount} student(s).`,
    successCount,
    errors
  });
});

// PUT /api/students/:id - Update student record
router.put('/:id', verifyToken, requireRoles('admin', 'faculty'), (req, res) => {
  const { fullName, phone, semester, section, currentCgpa, status, address, parentName, parentPhone } = req.body;
  const student = db.prepare('SELECT user_id FROM students WHERE id = ?').get(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  if (fullName || phone) {
    db.prepare(`
      UPDATE users 
      SET full_name = COALESCE(?, full_name),
          phone = COALESCE(?, phone)
      WHERE id = ?
    `).run(fullName, phone, student.user_id);
  }

  db.prepare(`
    UPDATE students
    SET semester = COALESCE(?, semester),
        section = COALESCE(?, section),
        current_cgpa = COALESCE(?, current_cgpa),
        status = COALESCE(?, status),
        address = COALESCE(?, address),
        parent_name = COALESCE(?, parent_name),
        parent_phone = COALESCE(?, parent_phone)
    WHERE id = ?
  `).run(semester, section, currentCgpa, status, address, parentName, parentPhone, req.params.id);

  res.json({ message: 'Student updated successfully' });
});

// DELETE /api/students/:id - Delete student (Admin only)
router.delete('/:id', verifyToken, requireRoles('admin'), (req, res) => {
  const student = db.prepare('SELECT user_id FROM students WHERE id = ?').get(req.params.id);
  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  db.prepare('DELETE FROM users WHERE id = ?').run(student.user_id);
  res.json({ message: 'Student record deleted successfully' });
});

module.exports = router;
