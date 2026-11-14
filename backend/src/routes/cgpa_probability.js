const express = require('express');
const { User, Subject, Course, Faculty } = require('../db/database');
const { verifyToken, requirePermission } = require('../middleware/authMiddleware');
const { resolveStudent, sendError, HttpError } = require('../services/scope');
const { predictStudent, predictCohort } = require('../services/predictions');
const { engineStatus } = require('../services/cgpaCalculator');

const router = express.Router();

// GET /api/cgpa/analysis/:studentId — run the probability engine for one student ('me' = self / primary ward)
router.get('/analysis/:studentId', verifyToken, requirePermission('cgpa_probability', 'read'), async (req, res) => {
  try {
    const student = await resolveStudent(req, req.params.studentId);
    res.json(await predictStudent(student));
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/cgpa/simulate — what-if simulation: { studentId, whatIfAdjustments: { [subjectId]: ±marks } }
router.post('/simulate', verifyToken, requirePermission('cgpa_probability', 'read'), async (req, res) => {
  try {
    const student = await resolveStudent(req, req.body.studentId);
    const raw = req.body.whatIfAdjustments || {};
    if (typeof raw !== 'object' || Array.isArray(raw)) throw new HttpError(400, 'whatIfAdjustments must be an object');
    const whatIf = {};
    for (const [k, v] of Object.entries(raw)) {
      const n = Number(v);
      if (Number.isFinite(n)) whatIf[String(k)] = Math.max(-40, Math.min(40, n));
    }
    res.json(await predictStudent(student, whatIf));
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/cgpa/subject-difficulties — subject difficulty indices from historical results
router.get('/subject-difficulties', verifyToken, requirePermission('cgpa_probability', 'read'), async (req, res) => {
  try {
    const [subjects, courses, faculties] = await Promise.all([
      Subject.find({}).sort({ difficulty_index: -1 }).lean(),
      Course.find({}).lean(),
      Faculty.find({}).lean()
    ]);
    const users = await User.find({ id: { $in: faculties.map((f) => f.user_id) } }, 'id full_name').lean();
    const courseMap = Object.fromEntries(courses.map((c) => [c.id, c]));
    const facMap = Object.fromEntries(faculties.map((f) => [f.id, f]));
    const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
    res.json(
      subjects
        .filter((s) => courseMap[s.course_id])
        .map((s) => {
          const fac = s.faculty_id ? facMap[s.faculty_id] : null;
          return {
            id: s.id,
            code: s.code,
            name: s.name,
            semester: s.semester,
            credits: s.credits,
            type: s.type,
            historical_pass_pct: s.historical_pass_pct,
            historical_avg_marks: s.historical_avg_marks,
            difficulty_index: s.difficulty_index,
            course_name: courseMap[s.course_id].name,
            faculty_name: fac ? userMap[fac.user_id]?.full_name || null : null,
            difficulty_level: s.difficulty_index >= 0.7 ? 'High' : s.difficulty_index >= 0.45 ? 'Moderate' : 'Low'
          };
        })
    );
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/cgpa/at-risk-cohort — early-warning list (faculty: their sections; admin: everyone)
router.get('/at-risk-cohort', verifyToken, async (req, res) => {
  try {
    if (!['admin', 'faculty'].includes(req.user.role)) throw new HttpError(403, 'Only faculty and administrators can view the risk cohort.');
    const cohort = await predictCohort();
    let rows = cohort;
    if (req.user.role === 'faculty') {
      const allowed = new Set((req.facultyClassMap || []).map((m) => `${m.semester}|${m.section}`));
      rows = cohort.filter((r) => allowed.has(`${r.student.semester}|${r.student.section}`));
    }
    res.json(
      rows
        .filter((r) => r.prediction.at_risk_count > 0 || r.prediction.predicted_sgpa < 6.5)
        .map((r) => ({
          student_id: r.student.id,
          roll_no: r.student.roll_no,
          full_name: r.name,
          semester: r.student.semester,
          section: r.student.section,
          current_cgpa: r.student.current_cgpa,
          predicted_sgpa: r.prediction.predicted_sgpa,
          confidence: r.prediction.confidence_score,
          at_risk_subjects: r.prediction.at_risk_subjects
        }))
    );
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/cgpa/engine — which engine is serving predictions
router.get('/engine', verifyToken, (req, res) => res.json(engineStatus()));

module.exports = router;
