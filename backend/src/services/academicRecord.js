/**
 * Official academic record: SGPA per semester and cumulative CGPA computed from
 * declared end-term (Major) results, using the institution's grading scale.
 * Recomputed whenever results are published or marks are moderated afterwards.
 */
const { Student, ExamMark, Examination, Subject } = require('../db/database');
const { getPolicy, gradeFor } = require('./policy');

/** Declared exams that count towards CGPA, keyed by semester (Major preferred) */
async function countingExams() {
  const exams = await Examination.find({ status: 'Results_Declared' }).lean();
  const bySem = {};
  for (const e of exams) (bySem[e.semester] ||= []).push(e);
  const out = new Set();
  for (const list of Object.values(bySem)) {
    const majors = list.filter((e) => e.exam_type === 'Major');
    for (const e of majors.length ? majors : []) out.add(e.id);
  }
  return out;
}

/** Recompute CGPA + earned credits for the given students (all when omitted). Returns count updated. */
async function recomputeCgpa(studentIds) {
  const policy = await getPolicy();
  const examIds = [...(await countingExams())];
  if (!examIds.length) return 0;
  const filter = { exam_id: { $in: examIds } };
  if (studentIds) filter.student_id = { $in: studentIds.map(Number) };
  const [marks, subjects] = await Promise.all([
    ExamMark.find(filter, 'student_id subject_id total_score').lean(),
    Subject.find({}, 'id credits').lean()
  ]);
  const credits = Object.fromEntries(subjects.map((s) => [s.id, s.credits || 4]));
  const agg = {};
  for (const m of marks) {
    const c = credits[m.subject_id] || 4;
    const g = gradeFor(m.total_score, policy.gradingScale);
    const a = (agg[m.student_id] ||= { pts: 0, cr: 0, earned: 0 });
    a.pts += g.gp * c;
    a.cr += c;
    if (g.gp > 0) a.earned += c;
  }
  const ops = Object.entries(agg)
    .filter(([, a]) => a.cr > 0)
    .map(([sid, a]) => ({
      updateOne: {
        filter: { id: Number(sid) },
        update: { $set: { current_cgpa: Math.round((a.pts / a.cr) * 100) / 100, total_credits_earned: a.earned } }
      }
    }));
  if (ops.length) await Student.bulkWrite(ops, { ordered: false });
  return ops.length;
}

/** Re-grade stored marks with the current scale (after the grading policy changes) */
async function regradeAllMarks() {
  const policy = await getPolicy();
  const marks = await ExamMark.find({}, 'id total_score letter_grade grade_points').lean();
  const ops = [];
  for (const m of marks) {
    const g = gradeFor(m.total_score, policy.gradingScale);
    if (g.grade !== m.letter_grade || g.gp !== m.grade_points) {
      ops.push({ updateOne: { filter: { id: m.id }, update: { $set: { letter_grade: g.grade, grade_points: g.gp } } } });
    }
  }
  for (let i = 0; i < ops.length; i += 2000) await ExamMark.bulkWrite(ops.slice(i, i + 2000), { ordered: false });
  return ops.length;
}

module.exports = { recomputeCgpa, regradeAllMarks, countingExams };
