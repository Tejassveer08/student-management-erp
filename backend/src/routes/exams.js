const express = require('express');
const {
  Examination,
  ExamMark,
  Subject,
  Student,
  User,
  Course,
  Department,
  WardLink,
  FacultyClassMap,
  getNextId
} = require('../db/database');
const { verifyToken, requirePermission, logAudit } = require('../middleware/authMiddleware');
const { marksToGradePoint } = require('../services/cgpaCalculator');

const router = express.Router();

// GET /api/exams - List all examinations
router.get('/', verifyToken, requirePermission('exams', 'read'), async (req, res) => {
  try {
    const exams = await Examination.find({}).sort({ start_date: -1 }).lean();
    res.json(exams);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exams - Schedule new exam (Admin only)
router.post('/', verifyToken, requirePermission('exams', 'create'), async (req, res) => {
  try {
    const { name, semester, academicYear, examType, startDate, endDate } = req.body;
    if (!name || !semester || !examType || !startDate || !endDate) {
      return res.status(400).json({ error: 'All exam fields are required' });
    }

    const id = await getNextId('examinations');
    await Examination.create({
      id,
      name,
      semester: Number(semester),
      academic_year: academicYear || '2025-2026',
      exam_type: examType,
      start_date: startDate,
      end_date: endDate,
      status: 'Scheduled'
    });

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      userEmail: req.user.email,
      action: 'EXAM_SCHEDULE_CREATE',
      entityType: 'examinations',
      entityId: id,
      oldValue: null,
      newValue: { name, semester, examType, startDate, endDate },
      reason: 'New examination schedule creation',
      ipAddress: req.ip
    });

    res.status(201).json({ message: 'Exam scheduled successfully', examId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exams/:id/publish - Publish final examination results (Admin only)
router.post('/:id/publish', verifyToken, requirePermission('exams', 'publish_results'), async (req, res) => {
  try {
    const examId = Number(req.params.id);
    const exam = await Examination.findOne({ id: examId }).lean();
    if (!exam) {
      return res.status(404).json({ error: 'Examination not found' });
    }

    await Examination.updateOne({ id: examId }, { $set: { status: 'Results_Declared' } });

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      userEmail: req.user.email,
      action: 'EXAM_RESULTS_PUBLISH',
      entityType: 'examinations',
      entityId: examId,
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
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/exams/marks - Fetch marks with DB scoping
router.get('/marks', verifyToken, requirePermission('exams', 'read'), async (req, res) => {
  try {
    const { examId, subjectId } = req.query;
    let studentId = req.query.studentId;

    if (req.user.role === 'student') {
      studentId = req.student ? req.student.id : 0;
    } else if (req.user.role === 'parent') {
      if (studentId) {
        const isWard = await WardLink.findOne({ parent_user_id: req.user.id, student_id: Number(studentId) }).lean();
        if (!isWard) return res.status(403).json({ error: 'Access denied: Not your linked ward.' });
      } else {
        const firstWard = await WardLink.findOne({ parent_user_id: req.user.id }).sort({ is_primary: -1 }).lean();
        studentId = firstWard ? firstWard.student_id : 0;
      }
    }

    const filter = {};
    if (examId) filter.exam_id = Number(examId);
    if (subjectId) filter.subject_id = Number(subjectId);
    if (studentId !== undefined && studentId !== '') filter.student_id = Number(studentId);

    if (req.user.role === 'faculty') {
      const maps = await FacultyClassMap.find({ faculty_id: req.faculty?.id || 0 }).lean();
      const allowedSubjectIds = maps.map(m => m.subject_id);
      if (filter.subject_id !== undefined) {
        if (!allowedSubjectIds.includes(filter.subject_id)) return res.json([]);
      } else {
        filter.subject_id = { $in: allowedSubjectIds };
      }
    }

    const marksDocs = await ExamMark.find(filter).lean();
    if (marksDocs.length === 0) return res.json([]);

    const subjectIds = [...new Set(marksDocs.map(m => m.subject_id))];
    const examIds = [...new Set(marksDocs.map(m => m.exam_id))];
    const studentIds = [...new Set(marksDocs.map(m => m.student_id))];

    const [subjects, exams, students] = await Promise.all([
      Subject.find({ id: { $in: subjectIds } }).lean(),
      Examination.find({ id: { $in: examIds } }).lean(),
      Student.find({ id: { $in: studentIds } }).lean()
    ]);

    const userIds = [...new Set(students.map(s => s.user_id))];
    const users = await User.find({ id: { $in: userIds } }).lean();

    const subMap = Object.fromEntries(subjects.map(s => [s.id, s]));
    const examMap = Object.fromEntries(exams.map(e => [e.id, e]));
    const stuMap = Object.fromEntries(students.map(s => [s.id, s]));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const enriched = marksDocs
      .map(em => {
        const sub = subMap[em.subject_id];
        const ex = examMap[em.exam_id];
        const s = stuMap[em.student_id];
        const u = s ? userMap[s.user_id] : null;
        if (!sub || !ex || !s || !u) return null;
        return {
          ...em,
          subject_code: sub.code,
          subject_name: sub.name,
          credits: sub.credits,
          exam_name: ex.name,
          exam_type: ex.exam_type,
          exam_status: ex.status,
          roll_no: s.roll_no,
          enrollment_no: s.enrollment_no,
          student_name: u.full_name
        };
      })
      .filter(Boolean)
      .sort((a, b) => String(a.roll_no).localeCompare(String(b.roll_no)));

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/exams/marks - Faculty marks entry with DB Scoping (internal/assignments)
router.post('/marks', verifyToken, requirePermission('exams', 'enter_marks'), async (req, res) => {
  try {
    const { examId, subjectId, studentId, internalAssessment, assignmentScore, externalExam, remarks, reason } = req.body;

    if (!examId || !subjectId || !studentId) {
      return res.status(400).json({ error: 'Exam ID, Subject ID, and Student ID are required' });
    }

    if (req.user.role === 'faculty') {
      const isMapped = await FacultyClassMap.findOne({
        faculty_id: req.faculty?.id,
        subject_id: Number(subjectId)
      }).lean();

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

    const existing = await ExamMark.findOne({
      exam_id: Number(examId),
      subject_id: Number(subjectId),
      student_id: Number(studentId)
    }).lean();

    if (existing) {
      await ExamMark.updateOne(
        { id: existing.id },
        {
          $set: {
            internal_assessment: internal,
            assignment_score: assignment,
            external_exam: external,
            total_score: total,
            letter_grade: gradeInfo.grade,
            grade_points: gradeInfo.gp,
            remarks: remarks || ''
          }
        }
      );
    } else {
      const id = await getNextId('exam_marks');
      await ExamMark.create({
        id,
        exam_id: Number(examId),
        subject_id: Number(subjectId),
        student_id: Number(studentId),
        internal_assessment: internal,
        assignment_score: assignment,
        external_exam: external,
        total_score: total,
        letter_grade: gradeInfo.grade,
        grade_points: gradeInfo.gp,
        remarks: remarks || ''
      });
    }

    if (req.user.role === 'admin' && existing) {
      await logAudit({
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
router.get('/report-card/:studentId', verifyToken, requirePermission('exams', 'read'), async (req, res) => {
  try {
    const targetStudentId = Number(req.params.studentId);

    if (req.user.role === 'student') {
      if (!req.student || req.student.id !== targetStudentId) {
        return res.status(403).json({ error: 'Access denied: Students can only view their own marksheet.' });
      }
    } else if (req.user.role === 'parent') {
      const isWard = await WardLink.findOne({ parent_user_id: req.user.id, student_id: targetStudentId }).lean();
      if (!isWard) {
        return res.status(403).json({ error: 'Access denied: You can only view marksheets of your linked wards.' });
      }
    }

    const s = await Student.findOne({ id: targetStudentId }).lean();
    if (!s) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const selectedSemester = req.query.semester ? Number(req.query.semester) : (s.semester || 4);

    const [u, c, d, marksDocs] = await Promise.all([
      User.findOne({ id: s.user_id }).lean(),
      Course.findOne({ id: s.course_id }).lean(),
      Department.findOne({ id: s.department_id }).lean(),
      ExamMark.find({ student_id: s.id }).lean()
    ]);

    const subjectIds = [...new Set(marksDocs.map(m => m.subject_id))];
    const examIds = [...new Set(marksDocs.map(m => m.exam_id))];
    const [subjects, exams] = await Promise.all([
      Subject.find({ id: { $in: subjectIds } }).lean(),
      Examination.find({ id: { $in: examIds } }).lean()
    ]);

    const subMap = Object.fromEntries(subjects.map(sub => [sub.id, sub]));
    const examSet = new Set(exams.map(ex => ex.id));

    const marksList = marksDocs
      .filter(em => {
        const sub = subMap[em.subject_id];
        return sub && examSet.has(em.exam_id) && sub.semester === selectedSemester;
      })
      .map(em => {
        const sub = subMap[em.subject_id];
        return {
          ...em,
          subject_code: sub.code,
          subject_name: sub.name,
          credits: sub.credits,
          subject_type: sub.type,
          semester: sub.semester
        };
      })
      .sort((a, b) => String(a.subject_code).localeCompare(String(b.subject_code)));

    let totalCredits = 0;
    let weightedPoints = 0;

    marksList.forEach(m => {
      totalCredits += m.credits;
      weightedPoints += (m.grade_points * m.credits);
    });

    const sgpa = totalCredits > 0 ? Number((weightedPoints / totalCredits).toFixed(2)) : s.current_cgpa;

    res.json({
      selected_semester: selectedSemester,
      available_semesters: [1, 2, 3, 4, 5, 6],
      institution: {
        name: 'Guru Tegh Bahadur Institute of Technology (GTBIT)',
        affiliate: 'Guru Gobind Singh Indraprastha University (GGSIPU), New Delhi',
        accreditation: 'Approved by AICTE, NAAC Accredited'
      },
      student: {
        id: s.id,
        name: u?.full_name || '',
        roll_no: s.roll_no,
        enrollment_no: s.enrollment_no,
        course: c?.name || '',
        department: d?.name || '',
        semester: s.semester,
        section: s.section,
        current_cgpa: s.current_cgpa
      },
      academic_metrics: {
        semester_credits: totalCredits,
        semester_sgpa: sgpa,
        cumulative_cgpa: s.current_cgpa,
        status: sgpa >= 5.0 ? 'PASSED' : 'REAPPEAR'
      },
      subjects: marksList
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
