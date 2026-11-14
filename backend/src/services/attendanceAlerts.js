/**
 * Keeps attendance alerts truthful.
 *
 * Runs at start-up and once a day:
 *   - students below the threshold in any subject (with at least 4 classes held) get an
 *     alert naming those subjects and how many consecutive classes would recover them —
 *     at most once a week, guardians included;
 *   - existing attendance alerts for students who are no longer below the threshold
 *     (e.g. stale seeded text) are marked read and reworded as resolved, with the
 *     student's current figures.
 */
const { Student, User, WardLink, AttendanceRecord, AttendanceSession, Subject, Notification } = require('../db/database');
const { getPolicy } = require('./policy');
const { notifyUsers } = require('./notify');

const MIN_CLASSES = 4;
const REPEAT_DAYS = 7;

async function computeShortfalls() {
  const policy = await getPolicy();
  const t = policy.attendanceThreshold / 100;
  const [students, sessions, subjects, agg] = await Promise.all([
    Student.find({ status: 'Active' }, 'id user_id').lean(),
    AttendanceSession.find({}, 'id subject_id').lean(),
    Subject.find({}, 'id code name').lean(),
    AttendanceRecord.aggregate([{ $group: { _id: { s: '$student_id', sess: '$session_id', st: '$status' }, n: { $sum: 1 } } }])
  ]);
  const sessSub = new Map(sessions.map((s) => [s.id, s.subject_id]));
  const subMap = new Map(subjects.map((s) => [s.id, s]));
  const stats = new Map(); // studentId -> Map(subjectId -> {total, attended})
  const overall = new Map();
  for (const row of agg) {
    const sub = sessSub.get(row._id.sess);
    if (!sub) continue;
    const per = stats.get(row._id.s) || new Map();
    stats.set(row._id.s, per);
    const a = per.get(sub) || { total: 0, attended: 0 };
    per.set(sub, a);
    const o = overall.get(row._id.s) || { total: 0, attended: 0 };
    overall.set(row._id.s, o);
    const credit = row._id.st === 'Present' ? 1 : row._id.st === 'Late' ? 0.5 : 0;
    a.total += row.n;
    a.attended += credit * row.n;
    o.total += row.n;
    o.attended += credit * row.n;
  }
  const result = new Map();
  for (const st of students) {
    const per = stats.get(st.id) || new Map();
    const low = [];
    for (const [subId, a] of per) {
      if (a.total < MIN_CLASSES) continue;
      const pct = (a.attended / a.total) * 100;
      if (pct < policy.attendanceThreshold) {
        const need = Math.max(0, Math.ceil((t * a.total - a.attended) / (1 - t)));
        low.push({ code: subMap.get(subId)?.code, name: subMap.get(subId)?.name, pct, need });
      }
    }
    const o = overall.get(st.id);
    result.set(st.id, { student: st, low: low.sort((x, y) => x.pct - y.pct), overall: o && o.total ? (o.attended / o.total) * 100 : null });
  }
  return { result, threshold: policy.attendanceThreshold };
}

async function syncAttendanceAlerts() {
  const { result, threshold } = await computeShortfalls();
  const links = await WardLink.find({}, 'parent_user_id student_id').lean();
  const guardiansOf = new Map();
  for (const l of links) guardiansOf.set(l.student_id, [...(guardiansOf.get(l.student_id) || []), l.parent_user_id]);
  const wardsOf = new Map();
  for (const l of links) wardsOf.set(l.parent_user_id, [...(wardsOf.get(l.parent_user_id) || []), l.student_id]);
  const userToStudent = new Map([...result.values()].map((r) => [r.student.user_id, r.student.id]));

  const existing = await Notification.find({ type: 'attendance_alert' }).lean();
  const since = Date.now() - REPEAT_DAYS * 86400000;
  const recentlyAlerted = new Set(existing.filter((n) => new Date(n.created_at).getTime() >= since && !/^Resolved/.test(n.title)).map((n) => n.user_id));

  // 1. Retire alerts that are no longer true
  const resolveOps = [];
  for (const n of existing) {
    if (/^Resolved/.test(n.title)) continue;
    const sid = userToStudent.get(n.user_id);
    const ids = sid !== undefined ? [sid] : wardsOf.get(n.user_id) || [];
    const rs = ids.map((id) => result.get(id)).filter(Boolean);
    if (!rs.length || rs.some((r) => r.low.length)) continue;
    const r = rs[0];
    const pct = rs.length > 1 ? 'for every linked ward' : r.overall === null ? 'no classes recorded yet' : `${r.overall.toFixed(1)}% overall`;
    resolveOps.push({
      updateOne: {
        filter: { id: n.id },
        update: { $set: { is_read: 1, title: 'Resolved · attendance is on track', message: `Every subject is at or above ${threshold}% (${pct}). This earlier warning no longer applies.` } }
      }
    });
  }
  if (resolveOps.length) await Notification.bulkWrite(resolveOps, { ordered: false });

  // 2. Raise alerts that are true but haven't been sent recently
  let raised = 0;
  const names = new Map((await User.find({ id: { $in: [...result.values()].map((r) => r.student.user_id) } }, 'id full_name').lean()).map((u) => [u.id, u.full_name]));
  for (const r of result.values()) {
    if (!r.low.length || recentlyAlerted.has(r.student.user_id)) continue;
    const worst = r.low[0];
    const list = r.low.slice(0, 3).map((x) => `${x.code} ${x.pct.toFixed(1)}%`).join(', ');
    raised += await notifyUsers([r.student.user_id], {
      title: `Attendance below ${threshold}% in ${r.low.length} subject${r.low.length > 1 ? 's' : ''}`,
      message: `${list}${r.low.length > 3 ? '…' : ''}. Attend the next ${worst.need} ${worst.code} classes in a row to get back above the rule.`,
      type: 'attendance_alert',
      link: '/attendance'
    });
    const guardians = (guardiansOf.get(r.student.id) || []).filter((g) => !recentlyAlerted.has(g));
    if (guardians.length) {
      raised += await notifyUsers(guardians, {
        title: `Ward attendance below ${threshold}%`,
        message: `${names.get(r.student.user_id) || 'Your ward'} is under ${threshold}% in ${list}.`,
        type: 'attendance_alert',
        link: '/attendance'
      });
    }
  }
  return { resolved: resolveOps.length, raised };
}

let timer = null;
function scheduleDailyAlerts() {
  if (timer) return;
  timer = setInterval(() => syncAttendanceAlerts().catch((e) => console.warn('[attendance alerts]', e.message)), 24 * 60 * 60 * 1000);
  timer.unref();
}

module.exports = { syncAttendanceAlerts, scheduleDailyAlerts, computeShortfalls };
