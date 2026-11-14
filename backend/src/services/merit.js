/**
 * Merit leaderboard computed from live data instead of seeded numbers.
 *   academic   (max 500) = CGPA × 50
 *   attendance (max 300) = overall attendance % × 3 (late counts as half)
 *   coursework (max 300) = 2 × average graded assignment % + 100 × on-time submission ratio
 *   society    (max  50) = 25 per approved society membership
 * Badges are awarded from the same figures. Results are persisted to student_points
 * and recomputed at most every few minutes or after marks/attendance change.
 */
const {
  Student,
  StudentPoints,
  AttendanceRecord,
  Assignment,
  AssignmentSubmission,
  SocietyMember,
  Society
} = require('../db/database');

const TTL_MS = 5 * 60 * 1000;
let lastRun = 0;
let running = null;
let dirty = true;

function invalidateMerit() {
  dirty = true;
}

async function compute() {
  const [students, attAgg, assignments, submissions, memberships, coordinators] = await Promise.all([
    Student.find({ status: 'Active' }, 'id current_cgpa').lean(),
    AttendanceRecord.aggregate([
      { $group: { _id: { s: '$student_id', st: '$status' }, n: { $sum: 1 } } }
    ]),
    Assignment.find({}, 'id max_marks due_date').lean(),
    AssignmentSubmission.find({}, 'assignment_id student_id marks_obtained submitted_at status').lean(),
    SocietyMember.find({ status: 'approved' }, 'student_id').lean(),
    Society.find({ coordinator_student_id: { $ne: null } }, 'coordinator_student_id').lean()
  ]);

  const att = {};
  for (const row of attAgg) {
    const a = (att[row._id.s] ||= { total: 0, attended: 0 });
    a.total += row.n;
    if (row._id.st === 'Present') a.attended += row.n;
    else if (row._id.st === 'Late') a.attended += row.n * 0.5;
  }
  const asgMap = Object.fromEntries(assignments.map((a) => [a.id, a]));
  const work = {};
  for (const sub of submissions) {
    const a = asgMap[sub.assignment_id];
    if (!a) continue;
    const w = (work[sub.student_id] ||= { graded: 0, pctSum: 0, submitted: 0, onTime: 0 });
    w.submitted += 1;
    const due = a.due_date ? new Date(`${a.due_date}T23:59:59`) : null;
    if (!due || new Date(sub.submitted_at) <= due) w.onTime += 1;
    if (sub.marks_obtained !== null && sub.marks_obtained !== undefined && a.max_marks > 0) {
      w.graded += 1;
      w.pctSum += Math.min(100, (sub.marks_obtained / a.max_marks) * 100);
    }
  }
  const societies = {};
  for (const m of memberships) societies[m.student_id] = (societies[m.student_id] || 0) + 1;
  const coordinatorSet = new Set(coordinators.map((c) => c.coordinator_student_id));

  const rows = students.map((s) => {
    const a = att[s.id];
    const attPct = a && a.total ? (a.attended / a.total) * 100 : 0;
    const w = work[s.id] || { graded: 0, pctSum: 0, submitted: 0, onTime: 0 };
    const avgGrade = w.graded ? w.pctSum / w.graded : 0;
    const onTimeRatio = w.submitted ? w.onTime / w.submitted : 0;
    const academic = Math.round((s.current_cgpa || 0) * 50);
    const attendance = Math.round(attPct * 3);
    const coursework = Math.round(Math.min(300, 2 * avgGrade + 100 * onTimeRatio));
    const society = Math.min(50, (societies[s.id] || 0) * 25);
    const badges = [];
    if ((s.current_cgpa || 0) >= 9) badges.push('Dean’s Scholar');
    if ((s.current_cgpa || 0) >= 8 && attPct >= 85) badges.push('Consistent Achiever');
    if (attPct >= 95 && a?.total >= 10) badges.push('Perfect Attendance');
    if (avgGrade >= 90 && w.graded >= 2) badges.push('Assignment Ace');
    if (coordinatorSet.has(s.id)) badges.push('Society Lead');
    else if (societies[s.id]) badges.push('Society Member');
    return { student_id: s.id, academic_score: academic, attendance_score: attendance, assignment_score: coursework, society_score: society, total: academic + attendance + coursework + society, badges };
  });

  rows.sort((x, y) => y.total - x.total || y.academic_score - x.academic_score);
  rows.forEach((r, i) => {
    r.rank = i + 1;
    if (r.rank <= 10) r.badges.unshift('Top 10');
  });

  const ops = rows.map((r) => ({
    updateOne: {
      filter: { student_id: r.student_id },
      update: {
        $set: {
          academic_score: r.academic_score,
          attendance_score: r.attendance_score,
          assignment_score: r.assignment_score,
          total_merit_points: r.total,
          merit_rank: r.rank,
          badges_json: JSON.stringify(r.badges)
        },
        $setOnInsert: { id: r.student_id }
      },
      upsert: true
    }
  }));
  for (let i = 0; i < ops.length; i += 1000) await StudentPoints.bulkWrite(ops.slice(i, i + 1000), { ordered: false });
  lastRun = Date.now();
  dirty = false;
  return rows.length;
}

/** Make sure student_points reflects current data (cheap when fresh) */
async function ensureMeritFresh() {
  if (!dirty && Date.now() - lastRun < TTL_MS) return;
  if (!running) running = compute().finally(() => { running = null; });
  await running;
}

module.exports = { ensureMeritFresh, invalidateMerit, recomputeMerit: compute };
