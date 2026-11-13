const express = require('express');
const {
  Assignment,
  AssignmentSubmission,
  StudyMaterial,
  Subject,
  Faculty,
  Student,
  User,
  WardLink,
  FacultyClassMap,
  getNextId
} = require('../db/database');
const { verifyToken, requirePermission } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/assignments - List assignments with role-based scoping
router.get('/', verifyToken, requirePermission('assignments', 'read'), async (req, res) => {
  try {
    const { subjectId, semester } = req.query;

    const filter = {};
    if (subjectId) filter.subject_id = Number(subjectId);

    let assignments = await Assignment.find(filter).sort({ due_date: 1 }).lean();
    if (assignments.length === 0) return res.json([]);

    const subjectIds = [...new Set(assignments.map(a => a.subject_id))];
    const facultyIds = [...new Set(assignments.map(a => a.faculty_id))];
    const assignmentIds = assignments.map(a => a.id);

    const [subjects, faculties, allSubmissions] = await Promise.all([
      Subject.find({ id: { $in: subjectIds } }).lean(),
      Faculty.find({ id: { $in: facultyIds } }).lean(),
      AssignmentSubmission.find({ assignment_id: { $in: assignmentIds } }).lean()
    ]);

    const userIds = [...new Set(faculties.map(f => f.user_id))];
    const users = await User.find({ id: { $in: userIds } }).lean();

    const subMap = Object.fromEntries(subjects.map(s => [s.id, s]));
    const facMap = Object.fromEntries(faculties.map(f => [f.id, f]));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    let studentId = null;
    if (req.user.role === 'student') {
      studentId = req.student ? req.student.id : null;
    } else if (req.user.role === 'parent') {
      const firstWard = await WardLink.findOne({ parent_user_id: req.user.id }).sort({ is_primary: -1 }).lean();
      studentId = firstWard ? firstWard.student_id : null;
    }

    const subCountMap = {};
    const mySubMap = {};
    for (const s of allSubmissions) {
      subCountMap[s.assignment_id] = (subCountMap[s.assignment_id] || 0) + 1;
      if (studentId && s.student_id === studentId) {
        mySubMap[s.assignment_id] = s;
      }
    }

    const result = assignments
      .map(a => {
        const sub = subMap[a.subject_id];
        const fac = facMap[a.faculty_id];
        const u = fac ? userMap[fac.user_id] : null;
        if (!sub || !fac || !u) return null;
        if (semester && sub.semester !== Number(semester)) return null;
        return {
          ...a,
          subject_code: sub.code,
          subject_name: sub.name,
          semester: sub.semester,
          faculty_name: u.full_name,
          total_submissions: subCountMap[a.id] || 0,
          my_submission: mySubMap[a.id] || null
        };
      })
      .filter(Boolean);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/assignments - Create new assignment (Faculty & Admin)
router.post('/', verifyToken, requirePermission('assignments', 'create'), async (req, res) => {
  try {
    const { subjectId, title, description, maxMarks, dueDate, attachmentUrl } = req.body;

    let facultyId = null;
    if (req.user.role === 'faculty') {
      if (!req.faculty) return res.status(403).json({ error: 'Faculty profile not found' });
      facultyId = req.faculty.id;

      const isMapped = await FacultyClassMap.findOne({
        faculty_id: facultyId,
        subject_id: Number(subjectId)
      }).lean();

      if (!isMapped) {
        return res.status(403).json({
          error: 'Forbidden: You are not assigned to create assignments for this subject.'
        });
      }
    } else {
      facultyId = req.body.facultyId ? Number(req.body.facultyId) : 1;
    }

    if (!subjectId || !title || !dueDate) {
      return res.status(400).json({ error: 'Subject ID, title, and due date are required' });
    }

    const id = await getNextId('assignments');
    await Assignment.create({
      id,
      subject_id: Number(subjectId),
      faculty_id: facultyId,
      title,
      description: description || '',
      max_marks: maxMarks || 20,
      due_date: dueDate,
      attachment_url: attachmentUrl || null
    });

    res.status(201).json({ message: 'Assignment published successfully', assignmentId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/assignments/:id - Delete assignment
router.delete('/:id', verifyToken, requirePermission('assignments', 'delete'), async (req, res) => {
  try {
    const assignmentId = Number(req.params.id);
    const assignment = await Assignment.findOne({ id: assignmentId }).lean();
    if (!assignment) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    if (req.user.role === 'faculty' && assignment.faculty_id !== req.faculty?.id) {
      return res.status(403).json({ error: 'Forbidden: You can only delete your own assignments.' });
    }

    await Assignment.deleteOne({ id: assignmentId });
    res.json({ message: 'Assignment deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/assignments/:id/submit - Student submits assignment
router.post('/:id/submit', verifyToken, requirePermission('assignments', 'submit'), async (req, res) => {
  try {
    const { submissionText, fileUrl } = req.body;
    const assignmentId = Number(req.params.id);

    if (!req.student) {
      return res.status(404).json({ error: 'Student profile not found' });
    }

    const assignment = await Assignment.findOne({ id: assignmentId }).lean();
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    const isLate = new Date() > new Date(assignment.due_date);
    const status = isLate ? 'Late' : 'Submitted';
    const now = new Date().toISOString();

    const existing = await AssignmentSubmission.findOne({
      assignment_id: assignmentId,
      student_id: req.student.id
    }).lean();

    if (existing) {
      await AssignmentSubmission.updateOne(
        { id: existing.id },
        {
          $set: {
            submission_text: submissionText || 'Online Submission',
            file_url: fileUrl || null,
            submitted_at: now,
            status
          }
        }
      );
    } else {
      const id = await getNextId('assignment_submissions');
      await AssignmentSubmission.create({
        id,
        assignment_id: assignmentId,
        student_id: req.student.id,
        submission_text: submissionText || 'Online Submission',
        file_url: fileUrl || null,
        submitted_at: now,
        status
      });
    }

    res.json({ message: 'Assignment submitted successfully', status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/assignments/:id/submissions - View submissions (Faculty & Admin)
router.get('/:id/submissions', verifyToken, requirePermission('assignments', 'grade'), async (req, res) => {
  try {
    const assignmentId = Number(req.params.id);
    const assignment = await Assignment.findOne({ id: assignmentId }).lean();
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    if (req.user.role === 'faculty' && assignment.faculty_id !== req.faculty?.id) {
      return res.status(403).json({ error: 'Forbidden: You can only view submissions for your own assignments.' });
    }

    const subs = await AssignmentSubmission.find({ assignment_id: assignmentId })
      .sort({ submitted_at: -1 })
      .lean();
    if (subs.length === 0) return res.json([]);

    const studentIds = [...new Set(subs.map(s => s.student_id))];
    const students = await Student.find({ id: { $in: studentIds } }).lean();
    const userIds = [...new Set(students.map(s => s.user_id))];
    const users = await User.find({ id: { $in: userIds } }).lean();

    const stuMap = Object.fromEntries(students.map(s => [s.id, s]));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const result = subs
      .map(sub => {
        const s = stuMap[sub.student_id];
        const u = s ? userMap[s.user_id] : null;
        if (!s || !u) return null;
        return {
          ...sub,
          roll_no: s.roll_no,
          enrollment_no: s.enrollment_no,
          student_name: u.full_name
        };
      })
      .filter(Boolean);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/assignments/grade - Grade a student's submission
router.post('/grade', verifyToken, requirePermission('assignments', 'grade'), async (req, res) => {
  try {
    const { submissionId, marksObtained, feedback } = req.body;

    if (!submissionId || marksObtained === undefined) {
      return res.status(400).json({ error: 'Submission ID and marks obtained are required' });
    }

    const sub = await AssignmentSubmission.findOne({ id: Number(submissionId) }).lean();
    if (!sub) return res.status(404).json({ error: 'Submission not found' });

    const assignment = await Assignment.findOne({ id: sub.assignment_id }).lean();
    if (!assignment) return res.status(404).json({ error: 'Assignment not found' });

    if (req.user.role === 'faculty' && assignment.faculty_id !== req.faculty?.id) {
      return res.status(403).json({ error: 'Forbidden: You can only grade submissions for your own assignments.' });
    }

    await AssignmentSubmission.updateOne(
      { id: sub.id },
      {
        $set: {
          marks_obtained: Number(marksObtained),
          faculty_feedback: feedback || 'Graded by faculty',
          status: 'Graded'
        }
      }
    );

    res.json({ message: 'Submission graded successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/assignments/study-materials - Notes and lecture slides
router.get('/study-materials', verifyToken, requirePermission('assignments', 'read'), async (req, res) => {
  try {
    const { subjectId } = req.query;
    const filter = {};
    if (subjectId) filter.subject_id = Number(subjectId);

    const materials = await StudyMaterial.find(filter).sort({ uploaded_at: -1 }).lean();
    if (materials.length === 0) return res.json([]);

    const subjectIds = [...new Set(materials.map(m => m.subject_id))];
    const facultyIds = [...new Set(materials.map(m => m.faculty_id))];
    const [subjects, faculties] = await Promise.all([
      Subject.find({ id: { $in: subjectIds } }).lean(),
      Faculty.find({ id: { $in: facultyIds } }).lean()
    ]);
    const users = await User.find({ id: { $in: faculties.map(f => f.user_id) } }).lean();

    const subMap = Object.fromEntries(subjects.map(s => [s.id, s]));
    const facMap = Object.fromEntries(faculties.map(f => [f.id, f]));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const result = materials
      .map(sm => {
        const sub = subMap[sm.subject_id];
        const fac = facMap[sm.faculty_id];
        const u = fac ? userMap[fac.user_id] : null;
        if (!sub || !fac || !u) return null;
        return {
          ...sm,
          subject_code: sub.code,
          subject_name: sub.name,
          uploaded_by: u.full_name
        };
      })
      .filter(Boolean);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/assignments/study-materials - Upload note (Faculty & Admin)
router.post('/study-materials', verifyToken, requirePermission('assignments', 'create'), async (req, res) => {
  try {
    const { subjectId, title, unitName, fileType, fileUrl, fileSize } = req.body;

    let facultyId = null;
    if (req.user.role === 'faculty') {
      if (!req.faculty) return res.status(403).json({ error: 'Faculty profile not found' });
      facultyId = req.faculty.id;

      const isMapped = await FacultyClassMap.findOne({
        faculty_id: facultyId,
        subject_id: Number(subjectId)
      }).lean();

      if (!isMapped) {
        return res.status(403).json({ error: 'Forbidden: You are not assigned to upload materials for this subject.' });
      }
    } else {
      facultyId = req.body.facultyId ? Number(req.body.facultyId) : 1;
    }

    if (!subjectId || !title) {
      return res.status(400).json({ error: 'Subject ID and title are required' });
    }

    const id = await getNextId('study_materials');
    await StudyMaterial.create({
      id,
      subject_id: Number(subjectId),
      faculty_id: facultyId,
      title,
      unit_name: unitName || 'General',
      file_type: fileType || 'PDF',
      file_url: fileUrl || 'https://gtbit.ac.in/materials/sample_doc.pdf',
      file_size: fileSize || '3.5 MB'
    });

    res.status(201).json({ message: 'Study material uploaded successfully', materialId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
