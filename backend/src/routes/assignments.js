const express = require('express');
const db = require('../db/database');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/assignments - List assignments
router.get('/', verifyToken, (req, res) => {
  const { subjectId, semester } = req.query;

  let query = `
    SELECT a.*, sub.code as subject_code, sub.name as subject_name, sub.semester,
           u.full_name as faculty_name,
           (SELECT COUNT(*) FROM assignment_submissions WHERE assignment_id = a.id) as total_submissions
    FROM assignments a
    JOIN subjects sub ON a.subject_id = sub.id
    JOIN faculty f ON a.faculty_id = f.id
    JOIN users u ON f.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (subjectId) {
    query += ' AND a.subject_id = ?';
    params.push(Number(subjectId));
  }
  if (semester) {
    query += ' AND sub.semester = ?';
    params.push(Number(semester));
  }

  query += ' ORDER BY a.due_date ASC';

  const assignments = db.prepare(query).all(...params);

  // If student is logged in, attach their submission status
  let studentId = null;
  if (req.user.role === 'student') {
    const st = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
    studentId = st ? st.id : null;
  }

  const result = assignments.map(a => {
    let mySubmission = null;
    if (studentId) {
      mySubmission = db.prepare(`
        SELECT * FROM assignment_submissions 
        WHERE assignment_id = ? AND student_id = ?
      `).get(a.id, studentId);
    }
    return {
      ...a,
      my_submission: mySubmission || null
    };
  });

  res.json(result);
});

// POST /api/assignments - Create new assignment (Faculty only)
router.post('/', verifyToken, requireRoles('faculty', 'admin'), (req, res) => {
  const { subjectId, title, description, maxMarks, dueDate, attachmentUrl } = req.body;

  let facultyId = null;
  if (req.user.role === 'faculty') {
    const fac = db.prepare('SELECT id FROM faculty WHERE user_id = ?').get(req.user.id);
    facultyId = fac ? fac.id : 1;
  } else {
    facultyId = req.body.facultyId || 1;
  }

  if (!subjectId || !title || !dueDate) {
    return res.status(400).json({ error: 'Subject ID, title, and due date are required' });
  }

  try {
    const result = db.prepare(`
      INSERT INTO assignments (subject_id, faculty_id, title, description, max_marks, due_date, attachment_url)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(subjectId, facultyId, title, description || '', maxMarks || 20, dueDate, attachmentUrl || null);

    res.status(201).json({ message: 'Assignment published successfully', assignmentId: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/assignments/:id/submit - Student submits assignment
router.post('/:id/submit', verifyToken, requireRoles('student'), (req, res) => {
  const { submissionText, fileUrl } = req.body;
  const assignmentId = req.params.id;

  const student = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
  if (!student) return res.status(404).json({ error: 'Student record not found' });

  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(assignmentId);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  const isLate = new Date() > new Date(assignment.due_date);
  const status = isLate ? 'Late' : 'Submitted';

  try {
    db.prepare(`
      INSERT INTO assignment_submissions (
        assignment_id, student_id, submission_text, file_url, submitted_at, status
      ) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(assignment_id, student_id) DO UPDATE SET
        submission_text = excluded.submission_text,
        file_url = excluded.file_url,
        submitted_at = CURRENT_TIMESTAMP,
        status = excluded.status
    `).run(assignmentId, student.id, submissionText || 'Online Submission', fileUrl || null, status);

    res.json({ message: 'Assignment submitted successfully', status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/assignments/:id/submissions - View all submissions for an assignment (Faculty)
router.get('/:id/submissions', verifyToken, requireRoles('faculty', 'admin'), (req, res) => {
  const submissions = db.prepare(`
    SELECT sub.*, s.roll_no, s.enrollment_no, u.full_name as student_name
    FROM assignment_submissions sub
    JOIN students s ON sub.student_id = s.id
    JOIN users u ON s.user_id = u.id
    WHERE sub.assignment_id = ?
    ORDER BY sub.submitted_at DESC
  `).all(req.params.id);

  res.json(submissions);
});

// POST /api/assignments/grade - Grade a student's submission
router.post('/grade', verifyToken, requireRoles('faculty', 'admin'), (req, res) => {
  const { submissionId, marksObtained, feedback } = req.body;

  if (!submissionId || marksObtained === undefined) {
    return res.status(400).json({ error: 'Submission ID and marks obtained are required' });
  }

  db.prepare(`
    UPDATE assignment_submissions
    SET marks_obtained = ?,
        faculty_feedback = ?,
        status = 'Graded'
    WHERE id = ?
  `).run(marksObtained, feedback || 'Graded by faculty', submissionId);

  res.json({ message: 'Submission graded successfully' });
});

// GET /api/assignments/study-materials - Notes and lecture slides
router.get('/study-materials', verifyToken, (req, res) => {
  const { subjectId } = req.query;
  let query = `
    SELECT sm.*, sub.code as subject_code, sub.name as subject_name,
           u.full_name as uploaded_by
    FROM study_materials sm
    JOIN subjects sub ON sm.subject_id = sub.id
    JOIN faculty f ON sm.faculty_id = f.id
    JOIN users u ON f.user_id = u.id
    WHERE 1=1
  `;
  const params = [];

  if (subjectId) {
    query += ' AND sm.subject_id = ?';
    params.push(Number(subjectId));
  }

  query += ' ORDER BY sm.uploaded_at DESC';

  const materials = db.prepare(query).all(...params);
  res.json(materials);
});

// POST /api/assignments/study-materials - Upload note
router.post('/study-materials', verifyToken, requireRoles('faculty', 'admin'), (req, res) => {
  const { subjectId, title, unitName, fileType, fileUrl, fileSize } = req.body;

  let facultyId = null;
  if (req.user.role === 'faculty') {
    const fac = db.prepare('SELECT id FROM faculty WHERE user_id = ?').get(req.user.id);
    facultyId = fac ? fac.id : 1;
  } else {
    facultyId = req.body.facultyId || 1;
  }

  if (!subjectId || !title) {
    return res.status(400).json({ error: 'Subject ID and title are required' });
  }

  const result = db.prepare(`
    INSERT INTO study_materials (subject_id, faculty_id, title, unit_name, file_type, file_url, file_size)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(
    subjectId,
    facultyId,
    title,
    unitName || 'General',
    fileType || 'PDF',
    fileUrl || 'https://gtbit.ac.in/materials/sample_doc.pdf',
    fileSize || '3.5 MB'
  );

  res.status(201).json({ message: 'Study material uploaded successfully', materialId: result.lastInsertRowid });
});

module.exports = router;
