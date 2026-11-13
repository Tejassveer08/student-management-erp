const express = require('express');
const {
  Student,
  User,
  Subject,
  Course,
  Faculty,
  ExamMark,
  AttendanceRecord,
  AttendanceSession
} = require('../db/database');
const { verifyToken } = require('../middleware/authMiddleware');
const { predictCGPAWithPythonOrFallback, calculateSubjectDifficulty } = require('../services/cgpaCalculator');

const router = express.Router();

// Helper to gather all inputs for a student's subjects
async function getStudentPredictionInputs(studentId) {
  const numericId = Number(studentId);
  const student = await Student.findOne({ id: numericId }).lean();
  if (!student) return null;

  const [subjects, marks, attRecords] = await Promise.all([
    Subject.find({ semester: student.semester, type: 'Theory' }).sort({ code: 1 }).lean(),
    ExamMark.find({ student_id: numericId }).sort({ id: -1 }).lean(),
    AttendanceRecord.find({ student_id: numericId }).lean()
  ]);

  const sessionIds = [...new Set(attRecords.map(r => r.session_id))];
  const sessions = sessionIds.length
    ? await AttendanceSession.find({ id: { $in: sessionIds } }).lean()
    : [];
  const sessionSubMap = Object.fromEntries(sessions.map(s => [s.id, s.subject_id]));

  const markBySubject = {};
  for (const m of marks) {
    if (!markBySubject[m.subject_id]) markBySubject[m.subject_id] = m;
  }

  const attBySubject = {};
  for (const r of attRecords) {
    const subId = sessionSubMap[r.session_id];
    if (!subId) continue;
    if (!attBySubject[subId]) attBySubject[subId] = { total: 0, present: 0, late: 0 };
    attBySubject[subId].total += 1;
    if (r.status === 'Present') attBySubject[subId].present += 1;
    else if (r.status === 'Late') attBySubject[subId].late += 1;
  }

  const subjectData = subjects.map(sub => {
    const markRec = markBySubject[sub.id];
    const internalScore = markRec ? markRec.internal_assessment : 18;
    const assignmentScore = markRec ? markRec.assignment_score : 12;

    const attRec = attBySubject[sub.id] || { total: 0, present: 0, late: 0 };
    const totalClasses = attRec.total;
    const attended = attRec.present + attRec.late * 0.5;
    const liveAttendancePct = totalClasses > 0 ? Number(((attended / totalClasses) * 100).toFixed(1)) : 85.0;

    let diffIdx = sub.difficulty_index;
    if (diffIdx === null || diffIdx === undefined) {
      diffIdx = calculateSubjectDifficulty(sub.historical_pass_pct, sub.historical_avg_marks);
    }

    return {
      id: sub.id,
      code: sub.code,
      name: sub.name,
      credits: sub.credits,
      historical_pass_pct: sub.historical_pass_pct,
      historical_avg_marks: sub.historical_avg_marks,
      difficulty_index: diffIdx,
      internal_score: internalScore,
      max_internal: 25,
      assignment_score: assignmentScore,
      max_assignment: 15,
      attendance_pct: liveAttendancePct
    };
  });

  return {
    student,
    subjects: subjectData
  };
}

// GET /api/cgpa/analysis/:studentId - Run CGPA Probability Engine
router.get('/analysis/:studentId', verifyToken, async (req, res) => {
  try {
    let targetStudentId = req.params.studentId;

    if (targetStudentId === 'me') {
      if (req.user.role === 'student') {
        const st = await Student.findOne({ user_id: req.user.id }).lean();
        if (!st) return res.status(404).json({ error: 'Student record not found' });
        targetStudentId = st.id;
      } else if (req.user.role === 'parent') {
        const ward = await Student.findOne({ parent_user_id: req.user.id }).lean();
        if (!ward) return res.status(404).json({ error: 'Ward record not found' });
        targetStudentId = ward.id;
      } else {
        targetStudentId = 1;
      }
    }

    const inputs = await getStudentPredictionInputs(targetStudentId);
    if (!inputs) {
      return res.status(404).json({ error: 'Student not found or no subjects in semester' });
    }

    const payload = {
      current_cgpa: inputs.student.current_cgpa,
      previous_credits: inputs.student.total_credits_earned,
      subjects: inputs.subjects,
      what_if_adjustments: {}
    };

    const predictionResult = await predictCGPAWithPythonOrFallback(payload);
    res.json({
      student_id: inputs.student.id,
      current_cgpa: inputs.student.current_cgpa,
      total_credits_earned: inputs.student.total_credits_earned,
      ...predictionResult
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/cgpa/simulate - Interactive "What-If" Simulator
router.post('/simulate', verifyToken, async (req, res) => {
  try {
    const { studentId, whatIfAdjustments } = req.body;

    let targetId = studentId;
    if (!targetId || targetId === 'me') {
      if (req.user.role === 'student') {
        const st = await Student.findOne({ user_id: req.user.id }).lean();
        targetId = st ? st.id : 1;
      } else if (req.user.role === 'parent') {
        const ward = await Student.findOne({ parent_user_id: req.user.id }).lean();
        targetId = ward ? ward.id : 1;
      } else {
        targetId = 1;
      }
    }

    const inputs = await getStudentPredictionInputs(targetId);
    if (!inputs) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const payload = {
      current_cgpa: inputs.student.current_cgpa,
      previous_credits: inputs.student.total_credits_earned,
      subjects: inputs.subjects,
      what_if_adjustments: whatIfAdjustments || {}
    };

    const result = await predictCGPAWithPythonOrFallback(payload);
    res.json({
      student_id: targetId,
      current_cgpa: inputs.student.current_cgpa,
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cgpa/subject-difficulties - Subject difficulty analysis & historical indices
router.get('/subject-difficulties', verifyToken, async (req, res) => {
  try {
    const [subjects, courses, faculties] = await Promise.all([
      Subject.find({}).sort({ difficulty_index: -1 }).lean(),
      Course.find({}).lean(),
      Faculty.find({}).lean()
    ]);

    const facUserIds = [...new Set(faculties.map(f => f.user_id))];
    const users = facUserIds.length ? await User.find({ id: { $in: facUserIds } }).lean() : [];

    const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));
    const facMap = Object.fromEntries(faculties.map(f => [f.id, f]));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const formatted = subjects
      .filter(s => courseMap[s.course_id])
      .map(s => {
        const fac = s.faculty_id ? facMap[s.faculty_id] : null;
        const u = fac ? userMap[fac.user_id] : null;
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
          faculty_name: u ? u.full_name : null,
          difficulty_level: s.difficulty_index >= 0.70 ? 'High' : (s.difficulty_index >= 0.45 ? 'Moderate' : 'Low'),
          risk_level_color: s.difficulty_index >= 0.70 ? '#EF4444' : (s.difficulty_index >= 0.45 ? '#F59E0B' : '#10B981')
        };
      });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/cgpa/at-risk-cohort - Proactive warning cohort for faculty and admin
router.get('/at-risk-cohort', verifyToken, async (req, res) => {
  try {
    const [students, subjects, allMarks, allRecords, allSessions] = await Promise.all([
      Student.find({ status: 'Active' }).sort({ roll_no: 1 }).lean(),
      Subject.find({ type: 'Theory' }).sort({ code: 1 }).lean(),
      ExamMark.find({}).sort({ id: -1 }).lean(),
      AttendanceRecord.find({}).lean(),
      AttendanceSession.find({}).lean()
    ]);

    const userIds = [...new Set(students.map(s => s.user_id))];
    const users = userIds.length ? await User.find({ id: { $in: userIds } }).lean() : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const sessionSubMap = Object.fromEntries(allSessions.map(s => [s.id, s.subject_id]));

    const subjectsBySem = {};
    for (const sub of subjects) {
      if (!subjectsBySem[sub.semester]) subjectsBySem[sub.semester] = [];
      subjectsBySem[sub.semester].push(sub);
    }

    const marksByStudentSub = {};
    for (const m of allMarks) {
      const k = `${m.student_id}_${m.subject_id}`;
      if (!marksByStudentSub[k]) marksByStudentSub[k] = m;
    }

    const attByStudentSub = {};
    for (const r of allRecords) {
      const subId = sessionSubMap[r.session_id];
      if (!subId) continue;
      const k = `${r.student_id}_${subId}`;
      if (!attByStudentSub[k]) attByStudentSub[k] = { total: 0, present: 0, late: 0 };
      attByStudentSub[k].total += 1;
      if (r.status === 'Present') attByStudentSub[k].present += 1;
      else if (r.status === 'Late') attByStudentSub[k].late += 1;
    }

    const atRiskStudents = [];

    for (const st of students) {
      const u = userMap[st.user_id];
      if (!u) continue;
      const semSubs = subjectsBySem[st.semester] || [];
      if (semSubs.length === 0) continue;

      const subjectData = semSubs.map(sub => {
        const markRec = marksByStudentSub[`${st.id}_${sub.id}`];
        const attRec = attByStudentSub[`${st.id}_${sub.id}`] || { total: 0, present: 0, late: 0 };
        const attended = attRec.present + attRec.late * 0.5;
        const liveAttendancePct = attRec.total > 0 ? Number(((attended / attRec.total) * 100).toFixed(1)) : 85.0;
        let diffIdx = sub.difficulty_index;
        if (diffIdx === null || diffIdx === undefined) {
          diffIdx = calculateSubjectDifficulty(sub.historical_pass_pct, sub.historical_avg_marks);
        }
        return {
          id: sub.id,
          code: sub.code,
          name: sub.name,
          credits: sub.credits,
          historical_pass_pct: sub.historical_pass_pct,
          historical_avg_marks: sub.historical_avg_marks,
          difficulty_index: diffIdx,
          internal_score: markRec ? markRec.internal_assessment : 18,
          max_internal: 25,
          assignment_score: markRec ? markRec.assignment_score : 12,
          max_assignment: 15,
          attendance_pct: liveAttendancePct
        };
      });

      const pred = await predictCGPAWithPythonOrFallback({
        current_cgpa: st.current_cgpa,
        previous_credits: st.total_credits_earned,
        subjects: subjectData,
        what_if_adjustments: {}
      });

      if (pred.at_risk_count > 0 || pred.predicted_sgpa < 6.5) {
        atRiskStudents.push({
          student_id: st.id,
          roll_no: st.roll_no,
          full_name: u.full_name,
          semester: st.semester,
          section: st.section,
          current_cgpa: st.current_cgpa,
          predicted_sgpa: pred.predicted_sgpa,
          confidence: pred.confidence_score,
          at_risk_subjects: pred.at_risk_subjects
        });
      }
    }

    res.json(atRiskStudents);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
