/**
 * Re-homes attendance that was recorded against another section's classes.
 *
 * The original seed created one set of sessions per semester (all in section CSE-2)
 * and attached every student of that semester to them, whatever their section or
 * programme. That leaves IT/ECE/AI students with attendance in CSE subjects, and
 * breaks section exports, rosters and alerts.
 *
 * For every (template session × section) pair this creates the section's own session
 * on the same date and slot, mapped to that programme's equivalent subject and its
 * mapped teacher, and moves each affected student's record onto it. Statuses are
 * untouched, so each student's attendance history is preserved exactly. The original
 * record → session links are copied to `attendance_records_backup` first.
 *
 * Idempotent: does nothing when every record already sits in the student's own section.
 */
const crypto = require('crypto');
const { mongoose, Student, AttendanceSession, AttendanceRecord, Subject, FacultyClassMap, Counter } = require('../db/database');
const { subjectIndex } = require('./scope');

async function rehomeAttendance() {
  const [students, sessions, subjects, maps] = await Promise.all([
    Student.find({}, 'id course_id semester section').lean(),
    AttendanceSession.find({}).lean(),
    Subject.find({}, 'id code course_id semester faculty_id').lean(),
    FacultyClassMap.find({}).lean()
  ]);
  const stMap = new Map(students.map((s) => [s.id, s]));
  const sessMap = new Map(sessions.map((s) => [s.id, s]));
  const subMap = new Map(subjects.map((s) => [s.id, s]));

  const records = await AttendanceRecord.find({}, 'id session_id student_id').lean();
  const misplaced = records.filter((r) => {
    const s = sessMap.get(r.session_id);
    const st = stMap.get(r.student_id);
    return s && st && (s.section !== st.section || s.semester !== st.semester);
  });
  if (!misplaced.length) return { moved: 0, sessionsCreated: 0 };

  // 1. Backup the original links so the change can be reversed
  await mongoose.connection.collection('attendance_records_backup').insertMany(
    misplaced.map((r) => ({ record_id: r.id, session_id: r.session_id, student_id: r.student_id, backed_up_at: new Date() })),
    { ordered: false }
  );

  // Subjects each template semester actually used, in code order (for index mapping)
  const templateSubjects = {};
  for (const s of sessions) (templateSubjects[s.semester] ||= new Set()).add(s.subject_id);
  const templateOrder = Object.fromEntries(
    Object.entries(templateSubjects).map(([sem, set]) => [sem, [...set].sort((a, b) => String(subMap.get(a)?.code).localeCompare(String(subMap.get(b)?.code)))])
  );
  const subjectsFor = await subjectIndex();

  const targetSubject = (tpl, st) => {
    const own = subjectsFor(st.course_id, st.semester).filter((x) => x.type !== 'Practical');
    const pool = own.length ? own : subjectsFor(st.course_id, st.semester);
    if (!pool.length || pool.some((x) => x.id === tpl.subject_id)) return tpl.subject_id;
    const order = templateOrder[tpl.semester] || [tpl.subject_id];
    const i = Math.max(0, order.indexOf(tpl.subject_id));
    return pool[i % pool.length].id;
  };
  const teacherFor = (subjectId, st, tpl) =>
    maps.find((m) => m.subject_id === subjectId && m.section === st.section && m.semester === st.semester)?.faculty_id ||
    maps.find((m) => m.subject_id === subjectId)?.faculty_id ||
    subMap.get(subjectId)?.faculty_id ||
    tpl.faculty_id;

  // 2. Plan one new session per (template, semester, section)
  const plan = new Map();
  for (const r of misplaced) {
    const tpl = sessMap.get(r.session_id);
    const st = stMap.get(r.student_id);
    const key = `${tpl.id}|${st.semester}|${st.section}`;
    if (!plan.has(key)) {
      const subjectId = targetSubject(tpl, st);
      plan.set(key, {
        subject_id: subjectId,
        faculty_id: teacherFor(subjectId, st, tpl),
        section: st.section,
        semester: st.semester,
        session_date: tpl.session_date,
        slot_time: tpl.slot_time,
        topic_covered: tpl.topic_covered,
        session_token: crypto.randomBytes(24).toString('hex'),
        qr_expires_at: tpl.qr_expires_at || new Date(`${tpl.session_date}T00:00:00`).toISOString(),
        qr_rotate_seconds: 30,
        created_at: tpl.created_at || new Date()
      });
    }
  }

  // 3. Reserve a block of ids and create the sessions
  const counter = await Counter.findByIdAndUpdate('attendance_sessions', { $inc: { seq: plan.size } }, { returnDocument: 'after', upsert: true });
  const top = await AttendanceSession.findOne({}, 'id').sort({ id: -1 }).lean();
  let next = Math.max(counter.seq - plan.size, top?.id || 0) + 1;
  if (next + plan.size - 1 > counter.seq) await Counter.updateOne({ _id: 'attendance_sessions' }, { $set: { seq: next + plan.size - 1 } });
  const docs = [];
  for (const [key, s] of plan) {
    s.id = next++;
    plan.set(key, s);
    docs.push(s);
  }
  for (let i = 0; i < docs.length; i += 1000) await AttendanceSession.insertMany(docs.slice(i, i + 1000), { ordered: false });

  // 4. Move each record onto its section's session
  const ops = misplaced.map((r) => {
    const tpl = sessMap.get(r.session_id);
    const st = stMap.get(r.student_id);
    return { updateOne: { filter: { id: r.id }, update: { $set: { session_id: plan.get(`${tpl.id}|${st.semester}|${st.section}`).id } } } };
  });
  for (let i = 0; i < ops.length; i += 2000) await AttendanceRecord.bulkWrite(ops.slice(i, i + 2000), { ordered: false });

  return { moved: misplaced.length, sessionsCreated: docs.length };
}

module.exports = { rehomeAttendance };
