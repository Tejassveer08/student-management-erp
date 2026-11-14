/**
 * Builds CGPA-engine inputs from live data (this semester's subjects for the
 * student's own programme, their latest internal/assignment marks and per-subject
 * attendance) for one student or the whole cohort in a single pass, and caches
 * cohort-wide results until marks, attendance or policy change.
 */
const { Student, User, ExamMark, AttendanceRecord, AttendanceSession, Examination } = require('../db/database');
const { getPolicy } = require('./policy');
const { subjectIndex } = require('./scope');
const { predictBatch, calculateSubjectDifficulty, MAX_INTERNAL, MAX_ASSIGNMENT } = require('./cgpaCalculator');

let version = 0;
let cohortCache = null; // { version, at, data }
const COHORT_TTL_MS = 10 * 60 * 1000;

/** Call after any write that changes marks, attendance or policy */
function invalidatePredictions() {
  version += 1;
  cohortCache = null;
}

async function buildPayloads(students, whatIfByStudent = {}, policyOverride = {}) {
  if (!students.length) return [];
  const policy = await getPolicy();
  const subjectsFor = await subjectIndex({ theoryOnly: true });
  const ids = students.map((s) => s.id);

  const [marks, records, sessions, exams] = await Promise.all([
    ExamMark.find({ student_id: { $in: ids } }, 'student_id subject_id exam_id internal_assessment assignment_score').lean(),
    AttendanceRecord.find({ student_id: { $in: ids } }, 'student_id session_id status').lean(),
    AttendanceSession.find({}, 'id subject_id').lean(),
    Examination.find({}, 'id start_date').lean()
  ]);

  const examOrder = Object.fromEntries(exams.map((e) => [e.id, e.start_date || '']));
  const markIdx = {};
  for (const m of marks) {
    const k = `${m.student_id}|${m.subject_id}`;
    const prev = markIdx[k];
    if (!prev || (examOrder[m.exam_id] || '') > (examOrder[prev.exam_id] || '')) markIdx[k] = m;
  }

  const sessionSub = Object.fromEntries(sessions.map((s) => [s.id, s.subject_id]));
  const attIdx = {};
  for (const r of records) {
    const sub = sessionSub[r.session_id];
    if (!sub) continue;
    const k = `${r.student_id}|${sub}`;
    const a = (attIdx[k] ||= { total: 0, attended: 0 });
    a.total += 1;
    if (r.status === 'Present') a.attended += 1;
    else if (r.status === 'Late') a.attended += 0.5;
  }

  const enginePolicy = { threshold: policy.attendanceThreshold, weights: policy.cgpaWeights, scale: policy.gradingScale, calibration: policy.cgpaCalibration, ...policyOverride };

  return students.map((st) => {
    const subs = subjectsFor(st.course_id, st.semester);
    return {
      student_id: st.id,
      current_cgpa: st.current_cgpa,
      previous_credits: st.total_credits_earned,
      policy: enginePolicy,
      what_if_adjustments: whatIfByStudent[st.id] || {},
      subjects: subs.map((sub) => {
        const m = markIdx[`${st.id}|${sub.id}`];
        const a = attIdx[`${st.id}|${sub.id}`];
        return {
          id: sub.id,
          code: sub.code,
          name: sub.name,
          credits: sub.credits,
          historical_pass_pct: sub.historical_pass_pct,
          historical_avg_marks: sub.historical_avg_marks,
          difficulty_index: sub.difficulty_index ?? calculateSubjectDifficulty(sub.historical_pass_pct, sub.historical_avg_marks),
          internal_score: m ? m.internal_assessment : null,
          assignment_score: m ? m.assignment_score : null,
          max_internal: MAX_INTERNAL,
          max_assignment: MAX_ASSIGNMENT,
          attendance_pct: a && a.total ? Math.round((a.attended / a.total) * 1000) / 10 : 100,
          classes_held: a ? a.total : 0
        };
      })
    };
  });
}

/** Prediction for a single student (optionally with what-if adjustments) */
async function predictStudent(student, whatIf = {}) {
  const [payload] = await buildPayloads([student], { [student.id]: whatIf });
  const [result] = await predictBatch([payload]);
  return {
    student_id: student.id,
    current_cgpa: student.current_cgpa,
    total_credits_earned: student.total_credits_earned,
    ...result,
    subjects: result.subjects.map((s, i) => ({ ...s, classes_held: payload.subjects[i]?.classes_held ?? 0 }))
  };
}

/** Every active student's prediction (cached) */
async function predictCohort() {
  if (cohortCache && cohortCache.version === version && Date.now() - cohortCache.at < COHORT_TTL_MS) return cohortCache.data;
  const students = await Student.find({ status: 'Active' }).sort({ roll_no: 1 }).lean();
  const payloads = await buildPayloads(students);
  const results = await predictBatch(payloads);
  const users = await User.find({ id: { $in: students.map((s) => s.user_id) } }, 'id full_name').lean();
  const userMap = Object.fromEntries(users.map((u) => [u.id, u.full_name]));
  const data = students.map((st, i) => ({ student: st, name: userMap[st.user_id] || '', prediction: results[i] }));
  cohortCache = { version, at: Date.now(), data };
  return data;
}

module.exports = { buildPayloads, predictStudent, predictCohort, invalidatePredictions };
