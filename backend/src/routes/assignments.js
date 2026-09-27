const express = require('express');
const db = require('../db/database');
const { verifyToken, requirePermission, logAudit } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/assignments - List assignments with role-based scoping
router.get('/', verifyToken, requirePermission('assignments', 'read'), (req, res) => {
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

  // If student is logged in, attach their submission status
  let studentId = null;
  if (req.user.role === 'student') {
    studentId = req.student ? req.student.id : null;
  } else if (req.user.role === 'parent') {
    const firstWard = db.prepare('SELECT student_id FROM ward_links WHERE parent_user_id = ? ORDER BY is_primary DESC LIMIT 1').get(req.user.id);
    studentId = firstWard ? firstWard.student_id : null;
  }

  query += ' ORDER BY a.due_date ASC';

  const assignments = db.prepare(query).all(...params);

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

// POST /api/assignments - Create new assignment (Faculty & Admin)
router.post('/', verifyToken, requirePermission('assignments', 'create'), (req, res) => {
  const { subjectId, title, description, maxMarks, dueDate, attachmentUrl } = req.body;

  let facultyId = null;
  if (req.user.role === 'faculty') {
    if (!req.faculty) return res.status(403).json({ error: 'Faculty profile not found' });
    facultyId = req.faculty.id;

    // DB SCOPING: Verify faculty is assigned to this subject
    const isMapped = db.prepare(`
      SELECT 1 FROM faculty_class_map 
      WHERE faculty_id = ? AND subject_id = ?
    `).get(facultyId, subjectId);

    if (!isMapped) {
      return res.status(403).json({
        error: 'Forbidden: You are not assigned to create assignments for this subject.'
      });
    }
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

// DELETE /api/assignments/:id - Delete assignment
router.delete('/:id', verifyToken, requirePermission('assignments', 'delete'), (req, res) => {
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  if (!assignment) {
    return res.status(404).json({ error: 'Assignment not found' });
  }

  if (req.user.role === 'faculty' && assignment.faculty_id !== req.faculty?.id) {
    return res.status(403).json({ error: 'Forbidden: You can only delete your own assignments.' });
  }

  db.prepare('DELETE FROM assignments WHERE id = ?').run(req.params.id);
  res.json({ message: 'Assignment deleted successfully' });
});

// POST /api/assignments/:id/submit - Student submits assignment
router.post('/:id/submit', verifyToken, requirePermission('assignments', 'submit'), (req, res) => {
  const { submissionText, fileUrl } = req.body;
  const assignmentId = req.params.id;

  if (!req.student) {
    return res.status(404).json({ error: 'Student profile not found' });
  }

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
    `).run(assignmentId, req.student.id, submissionText || 'Online Submission', fileUrl || null, status);

    res.json({ message: 'Assignment submitted successfully', status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/assignments/:id/submissions - View submissions (Faculty & Admin)
router.get('/:id/submissions', verifyToken, requirePermission('assignments', 'grade'), (req, res) => {
  const assignment = db.prepare('SELECT * FROM assignments WHERE id = ?').get(req.params.id);
  if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

  if (req.user.role === 'faculty' && assignment.faculty_id !== req.faculty?.id) {
    return res.status(403).json({ error: 'Forbidden: You can only view submissions for your own assignments.' });
  }

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
router.post('/grade', verifyToken, requirePermission('assignments', 'grade'), (req, res) => {
  const { submissionId, marksObtained, feedback } = req.body;

  if (!submissionId || marksObtained === undefined) {
    return res.status(400).json({ error: 'Submission ID and marks obtained are required' });
  }

  const sub = db.prepare(`
    SELECT sub.*, a.faculty_id, a.max_marks
    FROM assignment_submissions sub
    JOIN assignments a ON sub.assignment_id = a.id
    WHERE sub.id = ?
  `).get(submissionId);

  if (!sub) return res.status(404).json({ error: 'Submission not found' });

  if (req.user.role === 'faculty' && sub.faculty_id !== req.faculty?.id) {
    return res.status(403).json({ error: 'Forbidden: You can only grade submissions for your own assignments.' });
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
router.get('/study-materials', verifyToken, requirePermission('assignments', 'read'), (req, res) => {
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

// POST /api/assignments/study-materials - Upload note (Faculty & Admin)
router.post('/study-materials', verifyToken, requirePermission('assignments', 'create'), (req, res) => {
  const { subjectId, title, unitName, fileType, fileUrl, fileSize } = req.body;

  let facultyId = null;
  if (req.user.role === 'faculty') {
    if (!req.faculty) return res.status(403).json({ error: 'Faculty profile not found' });
    facultyId = req.faculty.id;

    const isMapped = db.prepare(`
      SELECT 1 FROM faculty_class_map 
      WHERE faculty_id = ? AND subject_id = ?
    `).get(facultyId, subjectId);

    if (!isMapped) {
      return res.status(403).json({ error: 'Forbidden: You are not assigned to upload materials for this subject.' });
    }
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
