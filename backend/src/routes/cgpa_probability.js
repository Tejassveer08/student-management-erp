const express = require('express');
const db = require('../db/database');
const { verifyToken } = require('../middleware/authMiddleware');
const { predictCGPAWithPythonOrFallback, calculateSubjectDifficulty } = require('../services/cgpaCalculator');

const router = express.Router();

// Helper to gather all inputs for a student's subjects
function getStudentPredictionInputs(studentId) {
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
  if (!student) return null;

  const subjects = db.prepare(`
    SELECT s.id, s.code, s.name, s.credits, s.type,
           s.historical_pass_pct, s.historical_avg_marks, s.difficulty_index
    FROM subjects s
    WHERE s.semester = ? AND s.type = 'Theory'
    ORDER BY s.code ASC
  `).all(student.semester);

  const subjectData = subjects.map(sub => {
    // 1. Get internal assessment and assignment scores from marks or assignments table
    const markRec = db.prepare(`
      SELECT internal_assessment, assignment_score
      FROM exam_marks
      WHERE student_id = ? AND subject_id = ?
      ORDER BY id DESC LIMIT 1
    `).get(studentId, sub.id);

    const internalScore = markRec ? markRec.internal_assessment : 18;
    const assignmentScore = markRec ? markRec.assignment_score : 12;

    // 2. Get live attendance percentage from Smart Attendance Tracker
    const attRec = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN ar.status = 'Late' THEN 1 ELSE 0 END) as late
      FROM attendance_records ar
      JOIN attendance_sessions sess ON ar.session_id = sess.id
      WHERE ar.student_id = ? AND sess.subject_id = ?
    `).get(studentId, sub.id);

    const totalClasses = attRec.total || 0;
    const attended = (attRec.present || 0) + ((attRec.late || 0) * 0.5);
    const liveAttendancePct = totalClasses > 0 ? Number(((attended / totalClasses) * 100).toFixed(1)) : 85.0;

    // 3. Difficulty index
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
  let targetStudentId = req.params.studentId;

  if (targetStudentId === 'me') {
    if (req.user.role === 'student') {
      const st = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
      if (!st) return res.status(404).json({ error: 'Student record not found' });
      targetStudentId = st.id;
    } else if (req.user.role === 'parent') {
      const ward = db.prepare('SELECT id FROM students WHERE parent_user_id = ?').get(req.user.id);
      if (!ward) return res.status(404).json({ error: 'Ward record not found' });
      targetStudentId = ward.id;
    } else {
      targetStudentId = 1;
    }
  }

  const inputs = getStudentPredictionInputs(targetStudentId);
  if (!inputs) {
    return res.status(404).json({ error: 'Student not found or no subjects in semester' });
  }

  const payload = {
    current_cgpa: inputs.student.current_cgpa,
    previous_credits: inputs.student.total_credits_earned,
    subjects: inputs.subjects,
    what_if_adjustments: {}
  };

  try {
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
  const { studentId, whatIfAdjustments } = req.body;
  // whatIfAdjustments: { [subjectId]: +/- marks }

  let targetId = studentId;
  if (!targetId || targetId === 'me') {
    if (req.user.role === 'student') {
      const st = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
      targetId = st ? st.id : 1;
    } else if (req.user.role === 'parent') {
      const ward = db.prepare('SELECT id FROM students WHERE parent_user_id = ?').get(req.user.id);
      targetId = ward ? ward.id : 1;
    } else {
      targetId = 1;
    }
  }

  const inputs = getStudentPredictionInputs(targetId);
  if (!inputs) {
    return res.status(404).json({ error: 'Student not found' });
  }

  const payload = {
    current_cgpa: inputs.student.current_cgpa,
    previous_credits: inputs.student.total_credits_earned,
    subjects: inputs.subjects,
    what_if_adjustments: whatIfAdjustments || {}
  };

  try {
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
router.get('/subject-difficulties', verifyToken, (req, res) => {
  const subjects = db.prepare(`
    SELECT s.id, s.code, s.name, s.semester, s.credits, s.type,
           s.historical_pass_pct, s.historical_avg_marks, s.difficulty_index,
           c.name as course_name, u.full_name as faculty_name
    FROM subjects s
    JOIN courses c ON s.course_id = c.id
    LEFT JOIN faculty f ON s.faculty_id = f.id
    LEFT JOIN users u ON f.user_id = u.id
    ORDER BY s.difficulty_index DESC
  `).all();

  const formatted = subjects.map(s => ({
    ...s,
    difficulty_level: s.difficulty_index >= 0.70 ? 'High' : (s.difficulty_index >= 0.45 ? 'Moderate' : 'Low'),
    risk_level_color: s.difficulty_index >= 0.70 ? '#EF4444' : (s.difficulty_index >= 0.45 ? '#F59E0B' : '#10B981')
  }));

  res.json(formatted);
});

// GET /api/cgpa/at-risk-cohort - Proactive warning cohort for faculty and admin
router.get('/at-risk-cohort', verifyToken, async (req, res) => {
  const students = db.prepare(`
    SELECT s.id, s.roll_no, u.full_name, s.current_cgpa, s.semester, s.section
    FROM students s
    JOIN users u ON s.user_id = u.id
    WHERE s.status = 'Active'
    ORDER BY s.roll_no ASC
  `).all();

  const atRiskStudents = [];

  for (const st of students) {
    const inputs = getStudentPredictionInputs(st.id);
    if (!inputs) continue;

    const payload = {
      current_cgpa: st.current_cgpa,
      previous_credits: inputs.student.total_credits_earned,
      subjects: inputs.subjects,
      what_if_adjustments: {}
    };

    const pred = await predictCGPAWithPythonOrFallback(payload);
    if (pred.at_risk_count > 0 || pred.predicted_sgpa < 6.5) {
      atRiskStudents.push({
        student_id: st.id,
        roll_no: st.roll_no,
        full_name: st.full_name,
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
});

module.exports = router;
