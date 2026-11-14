const express = require('express');
const {
  Examination,
  ExamMark,
  Subject,
  Student,
  User,
  Course,
  Department,
  FacultyClassMap,
  getNextId
} = require('../db/database');
const { verifyToken, requirePermission, logAudit } = require('../middleware/authMiddleware');
const { resolveStudent, sendError, HttpError } = require('../services/scope');
const { getPolicy, gradeFor } = require('../services/policy');
const { recomputeCgpa } = require('../services/academicRecord');
const { invalidatePredictions } = require('../services/predictions');
const { notifyStudents } = require('../services/notify');
const { invalidateMerit } = require('../services/merit');

const router = express.Router();
const LIMITS = { internal: 25, assignment: 15, external: 60 };
const isLearner = (req) => req.user.role === 'student' || req.user.role === 'parent';

// GET /api/exams — examinations (students/parents see their own semester's and declared ones)
router.get('/', verifyToken, requirePermission('exams', 'read'), async (req, res) => {
  try {
    const exams = await Examination.find({}).sort({ start_date: -1 }).lean();
    res.json(exams);
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/exams — schedule an examination (admin)
router.post('/', verifyToken, requirePermission('exams', 'create'), async (req, res) => {
  try {
    const { name, semester, academicYear, examType, startDate, endDate } = req.body;
    if (!name || !semester || !examType || !startDate || !endDate) throw new HttpError(400, 'All exam fields are required');
    if (endDate < startDate) throw new HttpError(400, 'The end date cannot be before the start date');
    const policy = await getPolicy();
    const id = await getNextId('examinations');
    await Examination.create({
      id,
      name: String(name).trim(),
      semester: Number(semester),
      academic_year: academicYear || policy.academicSession,
      exam_type: examType,
      start_date: startDate,
      end_date: endDate,
      status: 'Scheduled'
    });
    await logAudit({
      userId: req.user.id, userRole: req.user.role, userEmail: req.user.email,
      action: 'EXAM_SCHEDULE_CREATE', entityType: 'examinations', entityId: id,
      newValue: { name, semester, examType, startDate, endDate }, reason: 'New examination schedule', ipAddress: req.ip
    });
    const students = await Student.find({ semester: Number(semester), status: 'Active' }, 'id').lean();
    await notifyStudents(students.map((s) => s.id), {
      title: `${name} scheduled`,
      message: `${examType} examination for semester ${semester} runs ${startDate} to ${endDate}.`,
      type: 'exam_result',
      link: '/exams'
    });
    res.status(201).json({ message: 'Exam scheduled successfully', examId: id });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/exams/:id/publish — declare results: recomputes CGPAs and notifies students and guardians
router.post('/:id/publish', verifyToken, requirePermission('exams', 'publish_results'), async (req, res) => {
  try {
    const examId = Number(req.params.id);
    const exam = await Examination.findOne({ id: examId }).lean();
    if (!exam) throw new HttpError(404, 'Examination not found');
    if (exam.status === 'Results_Declared') throw new HttpError(409, 'Results for this examination are already declared');
    const studentIds = await ExamMark.distinct('student_id', { exam_id: examId });
    if (!studentIds.length) throw new HttpError(400, 'No marks have been entered for this examination yet');

    await Examination.updateOne({ id: examId }, { $set: { status: 'Results_Declared' } });
    const updated = exam.exam_type === 'Major' ? await recomputeCgpa(studentIds) : 0;
    invalidatePredictions();
    invalidateMerit();

    await logAudit({
      userId: req.user.id, userRole: req.user.role, userEmail: req.user.email,
      action: 'EXAM_RESULTS_PUBLISH', entityType: 'examinations', entityId: examId,
      oldValue: { status: exam.status }, newValue: { status: 'Results_Declared', students: studentIds.length, cgpa_recomputed: updated },
      reason: 'Official release of examination results', ipAddress: req.ip
    });
    await notifyStudents(studentIds, {
      title: 'Results declared',
      message: `Results for "${exam.name}" are out. Open your marksheet to see your grades.`,
      type: 'exam_result',
      link: '/exams'
    }, { includeGuardians: true, guardianPayload: { title: 'Ward results declared', message: `Results for "${exam.name}" have been declared.`, type: 'exam_result', link: '/exams' } });

    res.json({
      message: `Results for "${exam.name}" declared. ${studentIds.length} students notified${updated ? `, ${updated} CGPAs recalculated` : ''}.`,
      examId,
      status: 'Results_Declared',
      students: studentIds.length,
      cgpa_recalculated: updated
    });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/exams/marks — marks register (scoped; students/parents only see declared results)
router.get('/marks', verifyToken, requirePermission('exams', 'read'), async (req, res) => {
  try {
    const { examId, subjectId } = req.query;
    const filter = {};
    if (examId) filter.exam_id = Number(examId);
    if (subjectId) filter.subject_id = Number(subjectId);

    if (isLearner(req)) {
      const st = await resolveStudent(req, req.query.studentId);
      filter.student_id = st.id;
      const declared = await Examination.distinct('id', { status: 'Results_Declared' });
      filter.exam_id = filter.exam_id ? (declared.includes(filter.exam_id) ? filter.exam_id : -1) : { $in: declared };
    } else if (req.query.studentId) {
      filter.student_id = Number(req.query.studentId);
    }

    if (req.user.role === 'faculty') {
      const allowed = (req.facultyClassMap || []).map((m) => m.subject_id);
      if (filter.subject_id !== undefined) {
        if (!allowed.includes(filter.subject_id)) return res.json([]);
      } else {
        filter.subject_id = { $in: allowed };
      }
    }

    if (req.query.semester) {
      const subIds = await Subject.distinct('id', { semester: Number(req.query.semester) });
      if (filter.subject_id === undefined) filter.subject_id = { $in: subIds };
      else if (typeof filter.subject_id === 'number') { if (!subIds.includes(filter.subject_id)) return res.json([]); }
      else filter.subject_id = { $in: filter.subject_id.$in.filter((id) => subIds.includes(id)) };
    }

    const marksDocs = await ExamMark.find(filter).lean();
    if (!marksDocs.length) return res.json([]);

    const [subjects, exams, students] = await Promise.all([
      Subject.find({ id: { $in: [...new Set(marksDocs.map((m) => m.subject_id))] } }).lean(),
      Examination.find({ id: { $in: [...new Set(marksDocs.map((m) => m.exam_id))] } }).lean(),
      Student.find({ id: { $in: [...new Set(marksDocs.map((m) => m.student_id))] } }).lean()
    ]);
    const users = await User.find({ id: { $in: students.map((s) => s.user_id) } }, 'id full_name').lean();
    const subMap = Object.fromEntries(subjects.map((s) => [s.id, s]));
    const examMap = Object.fromEntries(exams.map((e) => [e.id, e]));
    const stuMap = Object.fromEntries(students.map((s) => [s.id, s]));
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));

    res.json(
      marksDocs
        .map((em) => {
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
            section: s.section,
            student_name: u.full_name
          };
        })
        .filter(Boolean)
        .sort((a, b) => String(a.roll_no).localeCompare(String(b.roll_no)))
    );
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/exams/marks — enter or moderate marks (faculty: own subject & section, before declaration)
router.post('/marks', verifyToken, requirePermission('exams', 'enter_marks'), async (req, res) => {
  try {
    const { examId, subjectId, studentId, internalAssessment, assignmentScore, externalExam, remarks, reason } = req.body;
    if (!examId || !subjectId || !studentId) throw new HttpError(400, 'Exam, subject and student are required');

    const [exam, student, subject] = await Promise.all([
      Examination.findOne({ id: Number(examId) }).lean(),
      Student.findOne({ id: Number(studentId) }).lean(),
      Subject.findOne({ id: Number(subjectId) }).lean()
    ]);
    if (!exam || !student || !subject) throw new HttpError(404, 'Exam, student or subject not found');
    if (subject.semester !== exam.semester) throw new HttpError(400, `${subject.code} is not part of the semester ${exam.semester} examination`);

    if (req.user.role === 'faculty') {
      const mapped = await FacultyClassMap.findOne({ faculty_id: req.faculty?.id, subject_id: subject.id, section: student.section }).lean();
      if (!mapped) throw new HttpError(403, 'Forbidden: you do not teach this subject to this student\'s section.');
      if (exam.status === 'Results_Declared') throw new HttpError(403, 'Results are already declared. Ask the examination cell (admin) to moderate these marks.');
    }

    const vals = { internal: Number(internalAssessment || 0), assignment: Number(assignmentScore || 0), external: Number(externalExam || 0) };
    for (const [k, v] of Object.entries(vals)) {
      if (!Number.isFinite(v) || v < 0 || v > LIMITS[k]) throw new HttpError(400, `${k[0].toUpperCase() + k.slice(1)} marks must be between 0 and ${LIMITS[k]}`);
    }
    const total = Math.round((vals.internal + vals.assignment + vals.external) * 10) / 10;
    const policy = await getPolicy();
    const g = gradeFor(total, policy.gradingScale);

    const key = { exam_id: exam.id, subject_id: subject.id, student_id: student.id };
    const existing = await ExamMark.findOne(key).lean();
    const set = { internal_assessment: vals.internal, assignment_score: vals.assignment, external_exam: vals.external, total_score: total, letter_grade: g.grade, grade_points: g.gp, remarks: remarks || '' };
    if (existing) await ExamMark.updateOne({ id: existing.id }, { $set: set });
    else await ExamMark.create({ id: await getNextId('exam_marks'), ...key, ...set });

    if (existing && (req.user.role === 'admin' || exam.status === 'Results_Declared')) {
      await logAudit({
        userId: req.user.id, userRole: req.user.role, userEmail: req.user.email,
        action: 'EXAM_MARKS_MODERATION', entityType: 'exam_marks', entityId: `${exam.id}_${subject.id}_${student.id}`,
        oldValue: { internal: existing.internal_assessment, assignment: existing.assignment_score, external: existing.external_exam, total: existing.total_score, grade: existing.letter_grade },
        newValue: { internal: vals.internal, assignment: vals.assignment, external: vals.external, total, grade: g.grade },
        reason: reason || 'Marks moderation', ipAddress: req.ip
      });
    }
    if (exam.status === 'Results_Declared' && exam.exam_type === 'Major') await recomputeCgpa([student.id]);
    invalidatePredictions();
    invalidateMerit();

    res.json({ message: 'Marks recorded', total_score: total, letter_grade: g.grade, grade_points: g.gp });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/exams/report-card/:studentId?semester=&examId= — official marksheet
router.get('/report-card/:studentId', verifyToken, requirePermission('exams', 'read'), async (req, res) => {
  try {
    const s = await resolveStudent(req, req.params.studentId);
    const learner = isLearner(req);
    const [u, c, d, marksDocs, allExams] = await Promise.all([
      User.findOne({ id: s.user_id }).lean(),
      Course.findOne({ id: s.course_id }).lean(),
      Department.findOne({ id: s.department_id }).lean(),
      ExamMark.find({ student_id: s.id }).lean(),
      Examination.find({}).lean()
    ]);
    const visibleExams = allExams.filter((e) => !learner || e.status === 'Results_Declared');
    const examMap = Object.fromEntries(visibleExams.map((e) => [e.id, e]));
    const marks = marksDocs.filter((m) => examMap[m.exam_id]);
    const subjects = await Subject.find({ id: { $in: [...new Set(marks.map((m) => m.subject_id))] } }).lean();
    const subMap = Object.fromEntries(subjects.map((x) => [x.id, x]));

    const semesters = [...new Set(marks.map((m) => subMap[m.subject_id]?.semester).filter(Boolean))].sort((a, b) => a - b);
    const selectedSemester = req.query.semester ? Number(req.query.semester) : (semesters.includes(s.semester) ? s.semester : semesters[semesters.length - 1] || s.semester);

    // Exams of this semester the student has marks in; default to the declared end-term, else the latest
    const semExamIds = [...new Set(marks.filter((m) => subMap[m.subject_id]?.semester === selectedSemester).map((m) => m.exam_id))];
    const semExams = semExamIds.map((id) => examMap[id]).sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
    const preferred = semExams.find((e) => e.exam_type === 'Major' && e.status === 'Results_Declared') || semExams[0];
    const selectedExam = req.query.examId ? semExams.find((e) => e.id === Number(req.query.examId)) || preferred : preferred;

    const marksList = selectedExam
      ? marks
          .filter((m) => m.exam_id === selectedExam.id && subMap[m.subject_id]?.semester === selectedSemester)
          .map((m) => {
            const sub = subMap[m.subject_id];
            return { ...m, subject_code: sub.code, subject_name: sub.name, credits: sub.credits, subject_type: sub.type, semester: sub.semester };
          })
          .sort((a, b) => String(a.subject_code).localeCompare(String(b.subject_code)))
      : [];

    let credits = 0;
    let points = 0;
    for (const m of marksList) {
      credits += m.credits;
      points += m.grade_points * m.credits;
    }
    const sgpa = credits ? Math.round((points / credits) * 100) / 100 : null;
    const failed = marksList.filter((m) => m.grade_points === 0).length;

    res.json({
      selected_semester: selectedSemester,
      available_semesters: semesters,
      exams: semExams.map((e) => ({ id: e.id, name: e.name, exam_type: e.exam_type, status: e.status })),
      selected_exam: selectedExam ? { id: selectedExam.id, name: selectedExam.name, exam_type: selectedExam.exam_type, status: selectedExam.status, academic_year: selectedExam.academic_year } : null,
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
        semester_credits: credits,
        semester_sgpa: sgpa,
        cumulative_cgpa: s.current_cgpa,
        status: !marksList.length ? 'NO RESULT' : failed ? `REAPPEAR (${failed})` : selectedExam?.status === 'Results_Declared' ? 'PASSED' : 'PROVISIONAL'
      },
      subjects: marksList
    });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
