const express = require('express');
const db = require('../db/database');
const { verifyToken, requirePermission, logAudit } = require('../middleware/authMiddleware');
const { marksToGradePoint } = require('../services/cgpaCalculator');

const router = express.Router();

// GET /api/exams - List all examinations
router.get('/', verifyToken, requirePermission('exams', 'read'), (req, res) => {
  const exams = db.prepare('SELECT * FROM examinations ORDER BY start_date DESC').all();
  res.json(exams);
});

// POST /api/exams - Schedule new exam (Admin only)
router.post('/', verifyToken, requirePermission('exams', 'create'), (req, res) => {
  const { name, semester, academicYear, examType, startDate, endDate } = req.body;
  if (!name || !semester || !examType || !startDate || !endDate) {
    return res.status(400).json({ error: 'All exam fields are required' });
  }

  const result = db.prepare(`
    INSERT INTO examinations (name, semester, academic_year, exam_type, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?, 'Scheduled')
  `).run(name, semester, academicYear || '2025-2026', examType, startDate, endDate);

  logAudit({
    userId: req.user.id,
    userRole: req.user.role,
    userEmail: req.user.email,
    action: 'EXAM_SCHEDULE_CREATE',
    entityType: 'examinations',
    entityId: result.lastInsertRowid,
    oldValue: null,
    newValue: { name, semester, examType, startDate, endDate },
    reason: 'New examination schedule creation',
    ipAddress: req.ip
  });

  res.status(201).json({ message: 'Exam scheduled successfully', examId: result.lastInsertRowid });
});

// POST /api/exams/:id/publish - Publish final examination results (Admin only)
router.post('/:id/publish', verifyToken, requirePermission('exams', 'publish_results'), (req, res) => {
  const exam = db.prepare('SELECT * FROM examinations WHERE id = ?').get(req.params.id);
  if (!exam) {
    return res.status(404).json({ error: 'Examination not found' });
  }

  db.prepare(`
    UPDATE examinations
    SET status = 'Results_Declared'
    WHERE id = ?
  `).run(req.params.id);

  logAudit({
    userId: req.user.id,
    userRole: req.user.role,
    userEmail: req.user.email,
    action: 'EXAM_RESULTS_PUBLISH',
    entityType: 'examinations',
    entityId: req.params.id,
    oldValue: { status: exam.status },
    newValue: { status: 'Results_Declared' },
    reason: 'Official release of semester examination results',
    ipAddress: req.ip
  });

  res.json({
    message: `Examination "${exam.name}" results officially declared and published!`,
    examId: exam.id,
    status: 'Results_Declared'
  });
});

// GET /api/exams/marks - Fetch marks with DB scoping
router.get('/marks', verifyToken, requirePermission('exams', 'read'), (req, res) => {
  const { examId, subjectId } = req.query;
  let studentId = req.query.studentId;

  // DB scoping
  if (req.user.role === 'student') {
    studentId = req.student ? req.student.id : 0;
  } else if (req.user.role === 'parent') {
    if (studentId) {
      const isWard = db.prepare('SELECT 1 FROM ward_links WHERE parent_user_id = ? AND student_id = ?').get(req.user.id, studentId);
      if (!isWard) return res.status(403).json({ error: 'Access denied: Not your linked ward.' });
    } else {
      const firstWard = db.prepare('SELECT student_id FROM ward_links WHERE parent_user_id = ? ORDER BY is_primary DESC LIMIT 1').get(req.user.id);
      studentId = firstWard ? firstWard.student_id : 0;
    }
  }

  let query = `
    SELECT em.*, sub.code as subject_code, sub.name as subject_name, sub.credits,
           ex.name as exam_name, ex.exam_type, ex.status as exam_status,
           s.roll_no, s.enrollment_no, u.full_name as student_name
    FROM exam_marks em
    JOIN subjects sub ON em.subject_id = sub.id
    JOIN examinations ex ON em.exam_id = ex.id
    JOIN students s ON em.student_id = s.id
    JOIN users u ON s.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (examId) {
    query += ' AND em.exam_id = ?';
    params.push(Number(examId));
  }
  if (subjectId) {
    query += ' AND em.subject_id = ?';
    params.push(Number(subjectId));
  }
  if (studentId) {
    query += ' AND em.student_id = ?';
    params.push(Number(studentId));
  }

  // If faculty, scope to their assigned classes/subjects
  if (req.user.role === 'faculty') {
    query += ` AND em.subject_id IN (SELECT subject_id FROM faculty_class_map WHERE faculty_id = ?)`;
    params.push(req.faculty?.id || 0);
  }

  query += ' ORDER BY s.roll_no ASC';

  const marks = db.prepare(query).all(...params);
  res.json(marks);
});

// POST /api/exams/marks - Faculty marks entry with DB Scoping (internal/assignments)
router.post('/marks', verifyToken, requirePermission('exams', 'enter_marks'), (req, res) => {
  const { examId, subjectId, studentId, internalAssessment, assignmentScore, externalExam, remarks, reason } = req.body;

  if (!examId || !subjectId || !studentId) {
    return res.status(400).json({ error: 'Exam ID, Subject ID, and Student ID are required' });
  }

  // DB scoping check for Faculty: must be assigned to this subject
  if (req.user.role === 'faculty') {
    const isMapped = db.prepare(`
      SELECT 1 FROM faculty_class_map 
      WHERE faculty_id = ? AND subject_id = ?
    `).get(req.faculty?.id, subjectId);

    if (!isMapped) {
      return res.status(403).json({
        error: 'Forbidden: You are not assigned to teach or evaluate this subject.'
      });
    }
  }

  const internal = Number(internalAssessment || 0);
  const assignment = Number(assignmentScore || 0);
  const external = Number(externalExam || 0);
  const total = Number((internal + assignment + external).toFixed(1));

  const gradeInfo = marksToGradePoint(total);

  try {
    const existing = db.prepare('SELECT * FROM exam_marks WHERE exam_id = ? AND subject_id = ? AND student_id = ?').get(examId, subjectId, studentId);

    db.prepare(`
      INSERT INTO exam_marks (
        exam_id, subject_id, student_id, internal_assessment, assignment_score, external_exam,
        total_score, letter_grade, grade_points, remarks
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(exam_id, subject_id, student_id) DO UPDATE SET
        internal_assessment = excluded.internal_assessment,
        assignment_score = excluded.assignment_score,
        external_exam = excluded.external_exam,
        total_score = excluded.total_score,
        letter_grade = excluded.letter_grade,
        grade_points = excluded.grade_points,
        remarks = excluded.remarks
    `).run(examId, subjectId, studentId, internal, assignment, external, total, gradeInfo.grade, gradeInfo.gp, remarks || '');

    // If Admin performed an override/moderation on an existing score, log audit
    if (req.user.role === 'admin' && existing) {
      logAudit({
        userId: req.user.id,
        userRole: req.user.role,
        userEmail: req.user.email,
        action: 'EXAM_MARKS_MODERATION',
        entityType: 'exam_marks',
        entityId: `${examId}_${subjectId}_${studentId}`,
        oldValue: { internal: existing.internal_assessment, total: existing.total_score, grade: existing.letter_grade },
        newValue: { internal, total, grade: gradeInfo.grade },
        reason: reason || 'Administrative marks moderation',
        ipAddress: req.ip
      });
    }

    res.json({
      message: 'Marks recorded successfully',
      total_score: total,
      letter_grade: gradeInfo.grade,
      grade_points: gradeInfo.gp
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exams/report-card/:studentId - Full official marksheet with DB scoping
router.get('/report-card/:studentId', verifyToken, requirePermission('exams', 'read'), (req, res) => {
  const targetStudentId = Number(req.params.studentId);

  // DB scoping check
  if (req.user.role === 'student') {
    if (!req.student || req.student.id !== targetStudentId) {
      return res.status(403).json({ error: 'Access denied: Students can only view their own marksheet.' });
    }
  } else if (req.user.role === 'parent') {
    const isWard = db.prepare('SELECT 1 FROM ward_links WHERE parent_user_id = ? AND student_id = ?').get(req.user.id, targetStudentId);
    if (!isWard) {
      return res.status(403).json({ error: 'Access denied: You can only view marksheets of your linked wards.' });
    }
  }

  const student = db.prepare(`
    SELECT s.*, u.full_name as student_name, u.email as student_email,
           c.name as course_name, c.code as course_code,
           d.name as department_name
    FROM students s
    JOIN users u ON s.user_id = u.id
    JOIN courses c ON s.course_id = c.id
    JOIN departments d ON s.department_id = d.id
    WHERE s.id = ?
  `).get(targetStudentId);

  if (!student) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const marksList = db.prepare(`
    SELECT em.*, sub.code as subject_code, sub.name as subject_name, sub.credits, sub.type as subject_type
    FROM exam_marks em
    JOIN subjects sub ON em.subject_id = sub.id
    JOIN examinations ex ON em.exam_id = ex.id
    WHERE em.student_id = ?
    ORDER BY sub.code ASC
  `).all(student.id);

  let totalCredits = 0;
  let weightedPoints = 0;

  marksList.forEach(m => {
    totalCredits += m.credits;
    weightedPoints += (m.grade_points * m.credits);
  });

  const sgpa = totalCredits > 0 ? Number((weightedPoints / totalCredits).toFixed(2)) : student.current_cgpa;

  res.json({
    institution: {
      name: 'Guru Tegh Bahadur Institute of Technology (GTBIT)',
      affiliate: 'Guru Gobind Singh Indraprastha University (GGSIPU), New Delhi',
      accreditation: 'Approved by AICTE, NAAC Accredited'
    },
    student: {
      id: student.id,
      name: student.student_name,
      roll_no: student.roll_no,
      enrollment_no: student.enrollment_no,
      course: student.course_name,
      department: student.department_name,
      semester: student.semester,
      section: student.section,
      current_cgpa: student.current_cgpa
    },
    academic_metrics: {
      semester_credits: totalCredits,
      semester_sgpa: sgpa,
      cumulative_cgpa: student.current_cgpa,
      status: sgpa >= 5.0 ? 'PASSED' : 'REAPPEAR'
    },
    subjects: marksList
  });
});

module.exports = router;
