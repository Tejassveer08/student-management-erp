const express = require('express');
const {
  Assignment,
  AssignmentSubmission,
  StudyMaterial,
  Subject,
  Faculty,
  Student,
  User,
  FacultyClassMap,
  getNextId
} = require('../db/database');
const { verifyToken, requirePermission } = require('../middleware/authMiddleware');
const { resolveStudent, subjectsForStudent, sendError, HttpError } = require('../services/scope');
const { acceptFile, describe, removeByUrl } = require('../services/uploads');
const { notifyStudents, notifyUsers } = require('../services/notify');
const { invalidateMerit } = require('../services/merit');
const { localDate } = require('../services/time');

const router = express.Router();
const isLearner = (req) => req.user.role === 'student' || req.user.role === 'parent';

/** Faculty id that owns new content: the caller (faculty) or the mapped teacher (admin) */
async function owningFaculty(req, subjectId) {
  if (req.user.role === 'faculty') {
    if (!req.faculty) throw new HttpError(403, 'Faculty profile not found');
    const mapped = await FacultyClassMap.findOne({ faculty_id: req.faculty.id, subject_id: subjectId }).lean();
    if (!mapped) throw new HttpError(403, 'You are not assigned to teach this subject.');
    return req.faculty.id;
  }
  if (req.body.facultyId) return Number(req.body.facultyId);
  const mapped = await FacultyClassMap.findOne({ subject_id: subjectId }).lean();
  const subject = await Subject.findOne({ id: subjectId }, 'faculty_id').lean();
  const id = mapped?.faculty_id || subject?.faculty_id;
  if (!id) throw new HttpError(400, 'No faculty is mapped to this subject yet.');
  return id;
}

/** Students who take a subject (its semester, and its programme — or every programme for common subjects) */
async function studentsTaking(subject) {
  const filter = { semester: subject.semester, status: 'Active' };
  const ownCourse = await Subject.countDocuments({ semester: subject.semester, course_id: { $ne: subject.course_id } });
  if (subject.course_id !== 1 || ownCourse > 0) filter.course_id = subject.course_id;
  return Student.find(filter, 'id user_id section').lean();
}

const endOfDay = (d) => new Date(`${d}T23:59:59`);

// GET /api/assignments — learners see their own semester's work; faculty their subjects; admin all
router.get('/', verifyToken, requirePermission('assignments', 'read'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.subjectId) filter.subject_id = Number(req.query.subjectId);
    let student = null;
    if (isLearner(req)) {
      student = await resolveStudent(req, req.query.studentId);
      const subs = await subjectsForStudent(student);
      const ids = subs.map((s) => s.id);
      filter.subject_id = filter.subject_id ? (ids.includes(filter.subject_id) ? filter.subject_id : -1) : { $in: ids };
    } else if (req.user.role === 'faculty') {
      filter.faculty_id = req.faculty?.id || -1;
    }

    const assignments = await Assignment.find(filter).sort({ due_date: 1 }).lean();
    if (!assignments.length) return res.json([]);
    const [subjects, faculties, counts, mine] = await Promise.all([
      Subject.find({ id: { $in: [...new Set(assignments.map((a) => a.subject_id))] } }).lean(),
      Faculty.find({ id: { $in: [...new Set(assignments.map((a) => a.faculty_id))] } }).lean(),
      AssignmentSubmission.aggregate([{ $match: { assignment_id: { $in: assignments.map((a) => a.id) } } }, { $group: { _id: '$assignment_id', n: { $sum: 1 }, graded: { $sum: { $cond: [{ $eq: ['$status', 'Graded'] }, 1, 0] } } } }]),
      student ? AssignmentSubmission.find({ student_id: student.id, assignment_id: { $in: assignments.map((a) => a.id) } }).lean() : []
    ]);
    const users = await User.find({ id: { $in: faculties.map((f) => f.user_id) } }, 'id full_name').lean();
    const subMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
    const facName = Object.fromEntries(faculties.map((f) => [f.id, users.find((u) => u.id === f.user_id)?.full_name || '']));
    const countMap = Object.fromEntries(counts.map((c) => [c._id, c]));
    const mineMap = Object.fromEntries(mine.map((s) => [s.assignment_id, s]));
    const semester = req.query.semester ? Number(req.query.semester) : null;

    res.json(
      assignments
        .map((a) => {
          const sub = subMap[a.subject_id];
          if (!sub || (semester && sub.semester !== semester)) return null;
          return {
            ...a,
            subject_code: sub.code,
            subject_name: sub.name,
            semester: sub.semester,
            faculty_name: facName[a.faculty_id] || '',
            total_submissions: countMap[a.id]?.n || 0,
            graded_submissions: countMap[a.id]?.graded || 0,
            my_submission: mineMap[a.id] || null
          };
        })
        .filter(Boolean)
    );
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/assignments — publish an assignment (optional brief file) and notify the class
router.post('/', verifyToken, requirePermission('assignments', 'create'), acceptFile('assignments'), async (req, res) => {
  try {
    const { title, description, dueDate } = req.body;
    const subjectId = Number(req.body.subjectId);
    const maxMarks = Number(req.body.maxMarks || 20);
    if (!subjectId || !title || !dueDate) throw new HttpError(400, 'Subject, title and due date are required');
    const facultyId = await owningFaculty(req, subjectId);
    const subject = await Subject.findOne({ id: subjectId }).lean();
    if (!subject) throw new HttpError(404, 'Subject not found');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || dueDate < localDate()) throw new HttpError(400, 'The due date must be today or later');
    if (!(maxMarks > 0 && maxMarks <= 100)) throw new HttpError(400, 'Maximum marks must be between 1 and 100');
    const file = describe(req.file, 'assignments');

    const id = await getNextId('assignments');
    await Assignment.create({
      id,
      subject_id: subjectId,
      faculty_id: facultyId,
      title: String(title).trim(),
      description: description || '',
      max_marks: maxMarks,
      due_date: dueDate,
      attachment_url: file?.url || req.body.attachmentUrl || null
    });
    const students = await studentsTaking(subject);
    await notifyStudents(students.map((s) => s.id), {
      title: `New assignment: ${subject.code}`,
      message: `"${title}" is due ${dueDate} (${maxMarks} marks).`,
      type: 'assignment_due',
      link: '/assignments'
    });
    res.status(201).json({ message: `Assignment published to ${students.length} students`, assignmentId: id });
  } catch (err) {
    if (req.file) removeByUrl(describe(req.file, 'assignments').url);
    sendError(res, err);
  }
});

// DELETE /api/assignments/:id — remove an assignment with its submissions and files
router.delete('/:id', verifyToken, requirePermission('assignments', 'delete'), async (req, res) => {
  try {
    const assignment = await Assignment.findOne({ id: Number(req.params.id) }).lean();
    if (!assignment) throw new HttpError(404, 'Assignment not found');
    if (req.user.role === 'faculty' && assignment.faculty_id !== req.faculty?.id) throw new HttpError(403, 'You can only delete your own assignments.');
    const subs = await AssignmentSubmission.find({ assignment_id: assignment.id }, 'file_url').lean();
    subs.forEach((s) => removeByUrl(s.file_url));
    removeByUrl(assignment.attachment_url);
    await Promise.all([Assignment.deleteOne({ id: assignment.id }), AssignmentSubmission.deleteMany({ assignment_id: assignment.id })]);
    invalidateMerit();
    res.json({ message: 'Assignment deleted' });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/assignments/:id/submit — student submits (multipart with optional file, or JSON with a link)
router.post('/:id/submit', verifyToken, requirePermission('assignments', 'submit'), acceptFile('submissions'), async (req, res) => {
  try {
    if (!req.student) throw new HttpError(404, 'Student profile not found');
    const assignment = await Assignment.findOne({ id: Number(req.params.id) }).lean();
    if (!assignment) throw new HttpError(404, 'Assignment not found');
    const student = await Student.findOne({ id: req.student.id }).lean();
    const mySubjects = await subjectsForStudent(student);
    if (!mySubjects.some((s) => s.id === assignment.subject_id)) throw new HttpError(403, 'This assignment is not part of your semester.');

    const existing = await AssignmentSubmission.findOne({ assignment_id: assignment.id, student_id: student.id }).lean();
    if (existing?.status === 'Graded') throw new HttpError(409, 'This submission has already been graded. Ask your teacher to reopen it.');

    const file = describe(req.file, 'submissions');
    const link = String(req.body.fileUrl || '').trim();
    if (link && !/^https?:\/\//i.test(link)) throw new HttpError(400, 'Links must start with http:// or https://');
    const text = String(req.body.submissionText || '').trim();
    if (!file && !link && !text) throw new HttpError(400, 'Attach a file, paste a link or write your answer');

    const status = new Date() > endOfDay(assignment.due_date) ? 'Late' : 'Submitted';
    const set = { submission_text: text || null, file_url: file?.url || link || existing?.file_url || null, file_name: file?.name || null, submitted_at: new Date(), status };
    if (existing) {
      if (file && existing.file_url !== file.url) removeByUrl(existing.file_url);
      await AssignmentSubmission.updateOne({ id: existing.id }, { $set: set });
    } else {
      await AssignmentSubmission.create({ id: await getNextId('assignment_submissions'), assignment_id: assignment.id, student_id: student.id, ...set });
    }
    invalidateMerit();
    res.json({ message: status === 'Late' ? 'Submitted after the due date — marked late' : 'Submitted', status, file_url: set.file_url });
  } catch (err) {
    if (req.file) removeByUrl(describe(req.file, 'submissions').url);
    sendError(res, err);
  }
});

// GET /api/assignments/:id/submissions — the class roster with each student's submission (owner / admin)
router.get('/:id/submissions', verifyToken, requirePermission('assignments', 'grade'), async (req, res) => {
  try {
    const assignment = await Assignment.findOne({ id: Number(req.params.id) }).lean();
    if (!assignment) throw new HttpError(404, 'Assignment not found');
    if (req.user.role === 'faculty' && assignment.faculty_id !== req.faculty?.id) throw new HttpError(403, 'You can only view submissions for your own assignments.');
    const subs = await AssignmentSubmission.find({ assignment_id: assignment.id }).sort({ submitted_at: -1 }).lean();
    const students = await Student.find({ id: { $in: subs.map((s) => s.student_id) } }).lean();
    const users = await User.find({ id: { $in: students.map((s) => s.user_id) } }, 'id full_name').lean();
    const stuMap = Object.fromEntries(students.map((s) => [s.id, s]));
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.full_name]));
    res.json(
      subs
        .map((sub) => {
          const s = stuMap[sub.student_id];
          if (!s) return null;
          return { ...sub, roll_no: s.roll_no, enrollment_no: s.enrollment_no, section: s.section, student_name: userMap[s.user_id] || '', max_marks: assignment.max_marks };
        })
        .filter(Boolean)
    );
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/assignments/grade — grade a submission (validated against max marks) and notify the student
router.post('/grade', verifyToken, requirePermission('assignments', 'grade'), async (req, res) => {
  try {
    const { submissionId, feedback } = req.body;
    const marks = Number(req.body.marksObtained);
    if (!submissionId || req.body.marksObtained === undefined || req.body.marksObtained === '') throw new HttpError(400, 'Submission and marks are required');
    const sub = await AssignmentSubmission.findOne({ id: Number(submissionId) }).lean();
    if (!sub) throw new HttpError(404, 'Submission not found');
    const assignment = await Assignment.findOne({ id: sub.assignment_id }).lean();
    if (!assignment) throw new HttpError(404, 'Assignment not found');
    if (req.user.role === 'faculty' && assignment.faculty_id !== req.faculty?.id) throw new HttpError(403, 'You can only grade your own assignments.');
    if (!Number.isFinite(marks) || marks < 0 || marks > assignment.max_marks) throw new HttpError(400, `Marks must be between 0 and ${assignment.max_marks}`);

    await AssignmentSubmission.updateOne({ id: sub.id }, { $set: { marks_obtained: marks, faculty_feedback: feedback || '', status: 'Graded' } });
    invalidateMerit();
    const st = await Student.findOne({ id: sub.student_id }, 'user_id').lean();
    if (st) {
      await notifyUsers([st.user_id], {
        title: 'Assignment graded',
        message: `"${assignment.title}": ${marks}/${assignment.max_marks}${feedback ? ` — ${String(feedback).slice(0, 120)}` : ''}`,
        type: 'assignment_due',
        link: '/assignments'
      });
    }
    res.json({ message: 'Graded' });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/assignments/study-materials — notes (learners: their subjects only)
router.get('/study-materials', verifyToken, requirePermission('assignments', 'read'), async (req, res) => {
  try {
    const filter = {};
    if (req.query.subjectId) filter.subject_id = Number(req.query.subjectId);
    if (isLearner(req)) {
      const student = await resolveStudent(req, req.query.studentId);
      const ids = (await subjectsForStudent(student)).map((s) => s.id);
      filter.subject_id = filter.subject_id ? (ids.includes(filter.subject_id) ? filter.subject_id : -1) : { $in: ids };
    }
    const materials = await StudyMaterial.find(filter).sort({ uploaded_at: -1 }).lean();
    if (!materials.length) return res.json([]);
    const [subjects, faculties] = await Promise.all([
      Subject.find({ id: { $in: [...new Set(materials.map((m) => m.subject_id))] } }).lean(),
      Faculty.find({ id: { $in: [...new Set(materials.map((m) => m.faculty_id))] } }).lean()
    ]);
    const users = await User.find({ id: { $in: faculties.map((f) => f.user_id) } }, 'id full_name').lean();
    const subMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
    const facName = Object.fromEntries(faculties.map((f) => [f.id, users.find((u) => u.id === f.user_id)?.full_name || '']));
    res.json(
      materials
        .map((m) => (subMap[m.subject_id] ? { ...m, subject_code: subMap[m.subject_id].code, subject_name: subMap[m.subject_id].name, uploaded_by: facName[m.faculty_id] || '' } : null))
        .filter(Boolean)
    );
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/assignments/study-materials — upload a real file (or share a link) for a subject
router.post('/study-materials', verifyToken, requirePermission('assignments', 'create'), acceptFile('materials'), async (req, res) => {
  try {
    const subjectId = Number(req.body.subjectId);
    const { title, unitName } = req.body;
    if (!subjectId || !title) throw new HttpError(400, 'Subject and title are required');
    const subject = await Subject.findOne({ id: subjectId }).lean();
    if (!subject) throw new HttpError(404, 'Subject not found');
    const facultyId = await owningFaculty(req, subjectId);
    const file = describe(req.file, 'materials');
    const link = String(req.body.fileUrl || '').trim();
    if (!file && !/^https?:\/\//i.test(link)) throw new HttpError(400, 'Attach a file or paste an http(s) link');

    const id = await getNextId('study_materials');
    await StudyMaterial.create({
      id,
      subject_id: subjectId,
      faculty_id: facultyId,
      title: String(title).trim(),
      unit_name: unitName || 'General',
      file_type: file?.type || req.body.fileType || 'LINK',
      file_url: file?.url || link,
      file_size: file?.size || '—'
    });
    const students = await studentsTaking(subject);
    await notifyStudents(students.map((s) => s.id), { title: `New notes: ${subject.code}`, message: `"${title}" was shared for ${subject.name}.`, type: 'general', link: '/assignments' });
    res.status(201).json({ message: 'Material shared', materialId: id });
  } catch (err) {
    if (req.file) removeByUrl(describe(req.file, 'materials').url);
    sendError(res, err);
  }
});

// DELETE /api/assignments/study-materials/:id — remove a material (owner / admin)
router.delete('/study-materials/:id', verifyToken, requirePermission('assignments', 'delete'), async (req, res) => {
  try {
    const m = await StudyMaterial.findOne({ id: Number(req.params.id) }).lean();
    if (!m) throw new HttpError(404, 'Material not found');
    if (req.user.role === 'faculty' && m.faculty_id !== req.faculty?.id) throw new HttpError(403, 'You can only remove your own materials.');
    removeByUrl(m.file_url);
    await StudyMaterial.deleteOne({ id: m.id });
    res.json({ message: 'Material removed' });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
