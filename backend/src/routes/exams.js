const express = require('express');
const db = require('../db/database');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');
const { marksToGradePoint } = require('../services/cgpaCalculator');

const router = express.Router();

// GET /api/exams - List all examinations
router.get('/', verifyToken, (req, res) => {
  const exams = db.prepare('SELECT * FROM examinations ORDER BY start_date DESC').all();
  res.json(exams);
});

// POST /api/exams - Schedule new exam (Admin only)
router.post('/', verifyToken, requireRoles('admin'), (req, res) => {
  const { name, semester, academicYear, examType, startDate, endDate } = req.body;
  if (!name || !semester || !examType || !startDate || !endDate) {
    return res.status(400).json({ error: 'All exam fields are required' });
  }

  const result = db.prepare(`
    INSERT INTO examinations (name, semester, academic_year, exam_type, start_date, end_date, status)
    VALUES (?, ?, ?, ?, ?, ?, 'Scheduled')
  `).run(name, semester, academicYear || '2025-2026', examType, startDate, endDate);

  res.status(201).json({ message: 'Exam scheduled successfully', examId: result.lastInsertRowid });
});

// GET /api/exams/marks - Fetch marks (by examId, subjectId, or studentId)
router.get('/marks', verifyToken, (req, res) => {
  const { examId, subjectId, studentId } = req.query;

  let query = `
    SELECT em.*, sub.code as subject_code, sub.name as subject_name, sub.credits,
           ex.name as exam_name, ex.exam_type,
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

  query += ' ORDER BY s.roll_no ASC';

  const marks = db.prepare(query).all(...params);
  res.json(marks);
});

// POST /api/exams/marks - Faculty marks entry (Internal assessment, assignments, external)
router.post('/marks', verifyToken, requireRoles('faculty', 'admin'), (req, res) => {
  const { examId, subjectId, studentId, internalAssessment, assignmentScore, externalExam, remarks } = req.body;

  if (!examId || !subjectId || !studentId) {
    return res.status(400).json({ error: 'Exam ID, Subject ID, and Student ID are required' });
  }

  const internal = Number(internalAssessment || 0);
  const assignment = Number(assignmentScore || 0);
  const external = Number(externalExam || 0);
  const total = Number((internal + assignment + external).toFixed(1));

  const gradeInfo = marksToGradePoint(total);

  try {
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

    // Notify student about new grade
    const student = db.prepare('SELECT user_id, roll_no FROM students WHERE id = ?').get(studentId);
    const subject = db.prepare('SELECT name, code FROM subjects WHERE id = ?').get(subjectId);
    if (student && subject) {
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type, link_url)
        VALUES (?, 'New Marks Posted', ?, 'exam_result', '/results')
      `).run(student.user_id, `Marks for ${subject.code} - ${subject.name} have been updated. Total Score: ${total}/100 (Grade: ${gradeInfo.grade}).`);
    }

    res.json({
      message: 'Marks updated successfully',
      total_score: total,
      letter_grade: gradeInfo.grade,
      grade_points: gradeInfo.gp
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exams/report-card/:studentId - Full official marksheet report
router.get('/report-card/:studentId', verifyToken, (req, res) => {
  const student = db.prepare(`
    SELECT s.*, u.full_name as student_name, u.email as student_email,
           c.name as course_name, c.code as course_code,
           d.name as department_name
    FROM students s
    JOIN users u ON s.user_id = u.id
    JOIN courses c ON s.course_id = c.id
    JOIN departments d ON s.department_id = d.id
    WHERE s.id = ?
  `).get(req.params.studentId);

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
