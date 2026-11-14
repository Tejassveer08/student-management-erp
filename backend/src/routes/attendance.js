const express = require('express');
const crypto = require('crypto');
const {
  Student,
  User,
  Faculty,
  Subject,
  AttendanceSession,
  AttendanceRecord,
  FacultyClassMap,
  Notification,
  getNextId
} = require('../db/database');
const { verifyToken, requirePermission, requireRoles, logAudit } = require('../middleware/authMiddleware');
const { reapplySocietyCreditsForSession } = require('../services/attendanceCredit');
const { resolveStudent, subjectsForStudent, sendError, HttpError } = require('../services/scope');
const { getPolicy } = require('../services/policy');
const { localDate, localTime } = require('../services/time');
const { notifyStudents } = require('../services/notify');
const { invalidatePredictions } = require('../services/predictions');
const { invalidateMerit } = require('../services/merit');

const router = express.Router();
const STATUSES = ['Present', 'Absent', 'Late'];

const emptyStats = () => ({ total_classes: 0, present_count: 0, regular_present_count: 0, society_present_count: 0, late_count: 0, absent_count: 0 });
function tally(st, r) {
  st.total_classes += 1;
  if (r.status === 'Present') {
    st.present_count += 1;
    if (r.credit_type === 'Society') st.society_present_count += 1;
    else st.regular_present_count += 1;
  } else if (r.status === 'Late') st.late_count += 1;
  else if (r.status === 'Absent') st.absent_count += 1;
}

/* ------------------------------------------------------------------ */
/* Rotating QR codes                                                   */
/* ------------------------------------------------------------------ */
function windowIndex(session, at = Date.now()) {
  return Math.floor(at / ((session.qr_rotate_seconds || 30) * 1000));
}
function codeFor(session, idx) {
  return crypto.createHmac('sha256', session.session_token).update(String(idx)).digest('hex').slice(0, 6).toUpperCase();
}
function currentCode(session) {
  const idx = windowIndex(session);
  const period = (session.qr_rotate_seconds || 30) * 1000;
  return { code: `${session.id}-${codeFor(session, idx)}`, rotates_at: new Date((idx + 1) * period).toISOString() };
}
/** Accepts "<sessionId>-<CODE>" for the current or previous window (grace for slow scans) */
async function sessionFromCode(raw) {
  const value = String(raw || '').trim().toUpperCase();
  const m = value.match(/^(\d+)[-.\s]?([0-9A-F]{6})$/);
  if (m) {
    const session = await AttendanceSession.findOne({ id: Number(m[1]) }).lean();
    if (!session) return null;
    const idx = windowIndex(session);
    return [idx, idx - 1].some((i) => codeFor(session, i) === m[2]) ? session : { ...session, stale: true };
  }
  return null;
}

async function assertSessionOwner(req, session) {
  if (req.user.role === 'faculty' && session.faculty_id !== req.faculty?.id) {
    throw new HttpError(403, 'Access denied: you can only manage sessions you created.');
  }
}

/** After marking, warn students whose attendance in this subject has dropped below the threshold */
async function alertBelowThreshold(session, studentIds) {
  if (!studentIds.length) return;
  const policy = await getPolicy();
  const sessions = await AttendanceSession.find({ subject_id: session.subject_id, section: session.section }, 'id').lean();
  const records = await AttendanceRecord.find({ session_id: { $in: sessions.map((s) => s.id) }, student_id: { $in: studentIds } }, 'student_id status').lean();
  const stats = {};
  for (const r of records) {
    const s = (stats[r.student_id] ||= { total: 0, attended: 0 });
    s.total += 1;
    if (r.status === 'Present') s.attended += 1;
    else if (r.status === 'Late') s.attended += 0.5;
  }
  const subject = await Subject.findOne({ id: session.subject_id }, 'code name').lean();
  const low = Object.entries(stats).filter(([, s]) => s.total >= 4 && (s.attended / s.total) * 100 < policy.attendanceThreshold);
  if (!low.length) return;
  // At most one alert per student per subject every 3 days
  const since = new Date(Date.now() - 3 * 86400000);
  const students = await Student.find({ id: { $in: low.map(([id]) => Number(id)) } }, 'id user_id').lean();
  const recent = await Notification.find({ user_id: { $in: students.map((s) => s.user_id) }, type: 'attendance_alert', created_at: { $gte: since }, message: { $regex: subject.code } }, 'user_id').lean();
  const skip = new Set(recent.map((n) => n.user_id));
  for (const [sid, s] of low) {
    const st = students.find((x) => x.id === Number(sid));
    if (!st || skip.has(st.user_id)) continue;
    const pct = ((s.attended / s.total) * 100).toFixed(1);
    const need = Math.max(0, Math.ceil(((policy.attendanceThreshold / 100) * s.total - s.attended) / (1 - policy.attendanceThreshold / 100)));
    await notifyStudents([st.id], {
      title: `${subject.code} attendance below ${policy.attendanceThreshold}%`,
      message: `${subject.name} (${subject.code}) is at ${pct}%. Attend the next ${need} classes in a row to get back above the rule.`,
      type: 'attendance_alert',
      link: '/attendance'
    }, { includeGuardians: true, guardianPayload: { title: 'Ward attendance alert', message: `Your ward's attendance in ${subject.code} has dropped to ${pct}%.`, type: 'attendance_alert', link: '/attendance' } });
  }
}

/* ------------------------------------------------------------------ */
/* Reads                                                               */
/* ------------------------------------------------------------------ */

// GET /api/attendance/summary — subject-wise attendance against the institutional threshold
router.get('/summary', verifyToken, requirePermission('attendance', 'read'), async (req, res) => {
  try {
    const student = await resolveStudent(req, req.query.studentId || req.query.wardId);
    const policy = await getPolicy();
    const threshold = policy.attendanceThreshold;
    const [studentUser, subjects, records] = await Promise.all([
      User.findOne({ id: student.user_id }, 'full_name').lean(),
      subjectsForStudent(student),
      AttendanceRecord.find({ student_id: student.id }).lean()
    ]);
    const sessions = await AttendanceSession.find({ id: { $in: [...new Set(records.map((r) => r.session_id))] } }, 'id subject_id').lean();
    const sessionSub = Object.fromEntries(sessions.map((s) => [s.id, s.subject_id]));
    const bySubject = {};
    for (const r of records) {
      const sub = sessionSub[r.session_id];
      if (sub) tally((bySubject[sub] ||= emptyStats()), r);
    }

    const faculties = await Faculty.find({ id: { $in: [...new Set(subjects.map((s) => s.faculty_id).filter(Boolean))] } }, 'id user_id').lean();
    const facUsers = await User.find({ id: { $in: faculties.map((f) => f.user_id) } }, 'id full_name').lean();
    const facName = Object.fromEntries(faculties.map((f) => [f.id, facUsers.find((u) => u.id === f.user_id)?.full_name || null]));

    let overallTotal = 0;
    let overallAttended = 0;
    let overallSociety = 0;
    const t = threshold / 100;
    const breakdown = subjects.map((sub) => {
      const r = bySubject[sub.id] || emptyStats();
      const total = r.total_classes;
      const attended = r.present_count + r.late_count * 0.5;
      const pct = total > 0 ? Number(((attended / total) * 100).toFixed(1)) : 100.0;
      overallTotal += total;
      overallAttended += attended;
      overallSociety += r.society_present_count;
      return {
        subject_id: sub.id,
        subject_code: sub.code,
        subject_name: sub.name,
        subject_type: sub.type,
        faculty_name: facName[sub.faculty_id] || null,
        credits: sub.credits,
        ...r,
        attendance_percentage: pct,
        is_below_threshold: total > 0 && pct < threshold,
        classes_needed_for_75: total > 0 && pct < threshold ? Math.max(0, Math.ceil((t * total - attended) / (1 - t))) : 0,
        safe_leaves_allowed: total > 0 && pct >= threshold ? Math.max(0, Math.floor(attended / t - total)) : 0
      };
    });
    const overall = overallTotal > 0 ? Number(((overallAttended / overallTotal) * 100).toFixed(1)) : 100.0;
    res.json({
      student_id: student.id,
      student_name: studentUser?.full_name || '',
      overall_percentage: overall,
      is_at_risk: overallTotal > 0 && overall < threshold,
      threshold,
      total_conducted: overallTotal,
      total_attended: overallAttended,
      total_society_credited: overallSociety,
      subjects: breakdown
    });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/attendance/trends — daily attendance for a student, or for the sections a staff member can see
router.get('/trends', verifyToken, requirePermission('attendance', 'read'), async (req, res) => {
  try {
    const learner = req.user.role === 'student' || req.user.role === 'parent';
    let records;
    if (learner || req.query.studentId) {
      const st = await resolveStudent(req, req.query.studentId || req.query.wardId);
      records = await AttendanceRecord.find({ student_id: st.id }, 'session_id status credit_type').lean();
    } else {
      const sessionFilter = {};
      if (req.query.section) sessionFilter.section = req.query.section;
      if (req.user.role === 'faculty') {
        const pairs = (req.facultyClassMap || []).map((m) => ({ section: m.section, semester: m.semester }));
        if (!pairs.length) return res.json([]);
        sessionFilter.$or = pairs;
      }
      const days = await AttendanceSession.distinct('session_date', sessionFilter);
      const recentDays = days.sort().slice(-31);
      const sessionIds = await AttendanceSession.distinct('id', { ...sessionFilter, session_date: { $in: recentDays } });
      records = await AttendanceRecord.find({ session_id: { $in: sessionIds } }, 'session_id status credit_type').lean();
    }
    if (!records.length) return res.json([]);
    const sessions = await AttendanceSession.find({ id: { $in: [...new Set(records.map((r) => r.session_id))] } }, 'id session_date').lean();
    const dateOf = Object.fromEntries(sessions.map((s) => [s.id, s.session_date]));
    const byDate = {};
    for (const r of records) {
      const date = dateOf[r.session_id];
      if (!date) continue;
      const d = (byDate[date] ||= { date, total: 0, present: 0, society_present: 0, late: 0, absent: 0 });
      d.total += 1;
      if (r.status === 'Present') { d.present += 1; if (r.credit_type === 'Society') d.society_present += 1; }
      else if (r.status === 'Late') d.late += 1;
      else d.absent += 1;
    }
    res.json(
      Object.values(byDate)
        .sort((a, b) => a.date.localeCompare(b.date))
        .slice(-31)
        .map((d) => ({ ...d, percentage: d.total ? Number((((d.present + d.late * 0.5) / d.total) * 100).toFixed(1)) : 100 }))
    );
  } catch (err) {
    sendError(res, err);
  }
});

/* ------------------------------------------------------------------ */
/* Sessions                                                            */
/* ------------------------------------------------------------------ */

// POST /api/attendance/create-session — open a roll call with a rotating QR code
router.post('/create-session', verifyToken, requirePermission('attendance', 'create'), async (req, res) => {
  try {
    const { subjectId, section, topicCovered } = req.body;
    const semester = Number(req.body.semester);
    if (!subjectId || !section || !semester) throw new HttpError(400, 'Subject, semester and section are required');
    const subject = await Subject.findOne({ id: Number(subjectId) }).lean();
    if (!subject) throw new HttpError(404, 'Subject not found');
    if (subject.semester !== semester) throw new HttpError(400, `${subject.code} is a semester ${subject.semester} subject`);

    let facultyId;
    if (req.user.role === 'faculty') {
      if (!req.faculty) throw new HttpError(403, 'Faculty profile not found');
      const mapped = await FacultyClassMap.findOne({ faculty_id: req.faculty.id, subject_id: subject.id, semester, section }).lean();
      if (!mapped) throw new HttpError(403, `You are not assigned to teach ${subject.code} to ${section}.`);
      facultyId = req.faculty.id;
    } else {
      const mapped = await FacultyClassMap.findOne({ subject_id: subject.id, semester, section }).lean();
      facultyId = Number(req.body.facultyId) || mapped?.faculty_id || subject.faculty_id;
      if (!facultyId) throw new HttpError(400, 'No faculty is mapped to this class. Assign one in the Faculty module first.');
    }

    const minutes = Math.max(2, Math.min(120, Number(req.body.durationMinutes) || 15));
    const id = await getNextId('attendance_sessions');
    const session = {
      id,
      subject_id: subject.id,
      faculty_id: facultyId,
      section,
      semester,
      session_date: localDate(),
      slot_time: localTime(),
      topic_covered: topicCovered || 'Lecture',
      session_token: crypto.randomBytes(24).toString('hex'),
      qr_expires_at: new Date(Date.now() + minutes * 60000).toISOString(),
      qr_rotate_seconds: 30
    };
    await AttendanceSession.create(session);
    await reapplySocietyCreditsForSession(id);

    res.status(201).json({ message: 'Roll call opened', sessionId: id, expiresAt: session.qr_expires_at, rotateSeconds: 30, ...currentCode(session) });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/attendance/sessions/:id/live — current QR code and who has checked in (session owner / admin)
router.get('/sessions/:id/live', verifyToken, requirePermission('attendance', 'create'), async (req, res) => {
  try {
    const session = await AttendanceSession.findOne({ id: Number(req.params.id) }).lean();
    if (!session) throw new HttpError(404, 'Session not found');
    await assertSessionOwner(req, session);
    const open = new Date(session.qr_expires_at) > new Date();
    const records = await AttendanceRecord.find({ session_id: session.id }, 'student_id status method marked_at').lean();
    res.json({
      sessionId: session.id,
      open,
      expiresAt: session.qr_expires_at,
      ...(open ? currentCode(session) : { code: null, rotates_at: null }),
      records
    });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/attendance/sessions/:id/close — stop accepting QR check-ins
router.post('/sessions/:id/close', verifyToken, requirePermission('attendance', 'create'), async (req, res) => {
  try {
    const session = await AttendanceSession.findOne({ id: Number(req.params.id) }).lean();
    if (!session) throw new HttpError(404, 'Session not found');
    await assertSessionOwner(req, session);
    await AttendanceSession.updateOne({ id: session.id }, { $set: { qr_expires_at: new Date().toISOString() } });
    res.json({ message: 'QR check-in closed' });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/attendance/bulk-mark — faculty roll call (only students of the session's section)
router.post('/bulk-mark', verifyToken, requirePermission('attendance', 'update'), async (req, res) => {
  try {
    const { sessionId, records } = req.body;
    if (!sessionId || !Array.isArray(records) || !records.length) throw new HttpError(400, 'Session and a list of student records are required');
    const session = await AttendanceSession.findOne({ id: Number(sessionId) }).lean();
    if (!session) throw new HttpError(404, 'Session not found');
    await assertSessionOwner(req, session);

    const roster = await Student.find({ section: session.section, semester: session.semester }, 'id').lean();
    const allowed = new Set(roster.map((s) => s.id));
    const clean = [];
    for (const r of records) {
      const sid = Number(r.studentId);
      if (!allowed.has(sid)) throw new HttpError(400, `Student ${sid} is not in ${session.section}`);
      if (!STATUSES.includes(r.status)) throw new HttpError(400, `Invalid status "${r.status}"`);
      clean.push({ sid, status: r.status });
    }

    const existing = await AttendanceRecord.find({ session_id: session.id }, 'student_id method').lean();
    const existingMap = new Map(existing.map((r) => [r.student_id, r]));
    const now = new Date();
    const ops = [];
    for (const { sid, status } of clean) {
      if (existingMap.has(sid)) {
        ops.push({ updateOne: { filter: { session_id: session.id, student_id: sid }, update: { $set: { status, marked_at: now } } } });
      } else {
        ops.push({ insertOne: { document: { id: await getNextId('attendance_records'), session_id: session.id, student_id: sid, status, method: 'One_Tap', marked_at: now } } });
      }
    }
    if (ops.length) await AttendanceRecord.bulkWrite(ops, { ordered: false });
    await reapplySocietyCreditsForSession(session.id);
    invalidatePredictions();
    invalidateMerit();
    alertBelowThreshold(session, clean.filter((c) => c.status !== 'Present').map((c) => c.sid)).catch((e) => console.warn('[attendance alert]', e.message));

    res.json({ message: `Attendance saved for ${clean.length} students` });
  } catch (err) {
    sendError(res, err);
  }
});

// PUT /api/attendance/override — admin correction with mandatory audit reason
router.put('/override', verifyToken, requirePermission('attendance', 'override'), async (req, res) => {
  try {
    const { recordId, sessionId, studentId, status, reason } = req.body;
    if (!reason || reason.trim().length < 5) throw new HttpError(400, 'A reason (min 5 characters) is required for an attendance override.');
    if (!STATUSES.includes(status)) throw new HttpError(400, 'Status must be Present, Late or Absent');
    let record = null;
    if (recordId) record = await AttendanceRecord.findOne({ id: Number(recordId) }).lean();
    else if (sessionId && studentId) record = await AttendanceRecord.findOne({ session_id: Number(sessionId), student_id: Number(studentId) }).lean();
    if (!record) throw new HttpError(404, 'Attendance record not found');

    await AttendanceRecord.updateOne({ id: record.id }, { $set: { status, method: 'Faculty_Manual', marked_at: new Date() } });
    await logAudit({
      userId: req.user.id, userRole: req.user.role, userEmail: req.user.email,
      action: 'ATTENDANCE_OVERRIDE', entityType: 'attendance_records', entityId: record.id,
      oldValue: { status: record.status }, newValue: { status }, reason, ipAddress: req.ip
    });
    invalidatePredictions();
    invalidateMerit();
    res.json({ message: 'Override applied and recorded in the audit log.', recordId: record.id, previousStatus: record.status, newStatus: status });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/attendance/qr-checkin — a student checks in with the code shown on the projector
router.post('/qr-checkin', verifyToken, requireRoles('student'), async (req, res) => {
  try {
    if (!req.student) throw new HttpError(404, 'Student record not found');
    const session = await sessionFromCode(req.body.code || req.body.sessionToken);
    if (!session) throw new HttpError(404, 'That code does not match any roll call. Check it and try again.');
    if (session.stale) throw new HttpError(400, 'This code has rotated. Scan the QR again or type the code currently on screen.');
    if (new Date(session.qr_expires_at) < new Date()) throw new HttpError(400, 'Check-in for this class has closed.');
    if (session.section !== req.student.section || session.semester !== req.student.semester) {
      throw new HttpError(403, `This roll call is for ${session.section}. You can only check in to your own class.`);
    }

    const existing = await AttendanceRecord.findOne({ session_id: session.id, student_id: req.student.id }).lean();
    if (existing && existing.status === 'Present') {
      return res.json({ message: 'You are already marked present for this class.', already: true, subjectId: session.subject_id });
    }
    const now = new Date();
    if (existing) await AttendanceRecord.updateOne({ id: existing.id }, { $set: { status: 'Present', method: 'QR_Scan', marked_at: now } });
    else await AttendanceRecord.create({ id: await getNextId('attendance_records'), session_id: session.id, student_id: req.student.id, status: 'Present', method: 'QR_Scan', marked_at: now });
    invalidatePredictions();

    const subject = await Subject.findOne({ id: session.subject_id }, 'code name').lean();
    res.json({ message: `Checked in to ${subject?.code || 'class'} — ${subject?.name || ''}`, subjectId: session.subject_id, subject_code: subject?.code, timestamp: now.toISOString() });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/attendance/export?semester=&section= — attendance register (scoped by role)
router.get('/export', verifyToken, requirePermission('attendance', 'read'), async (req, res) => {
  try {
    let students;
    if (req.user.role === 'student' || req.user.role === 'parent') {
      students = [await resolveStudent(req, req.query.studentId)];
    } else {
      const semester = Number(req.query.semester);
      const section = req.query.section;
      if (!semester || !section) throw new HttpError(400, 'Semester and section are required');
      if (req.user.role === 'faculty' && !(req.facultyClassMap || []).some((m) => m.semester === semester && m.section === section)) {
        throw new HttpError(403, 'You can only export sections you teach.');
      }
      students = await Student.find({ semester, section }).sort({ roll_no: 1 }).lean();
    }
    if (!students.length) return res.json({ generated_at: new Date().toISOString(), records: [] });

    const first = students[0];
    const subjects = await subjectsForStudent(first);
    const sessions = await AttendanceSession.find({ section: first.section, semester: first.semester, subject_id: { $in: subjects.map((s) => s.id) } }, 'id subject_id').lean();
    const users = await User.find({ id: { $in: students.map((s) => s.user_id) } }, 'id full_name').lean();
    const userMap = Object.fromEntries(users.map((u) => [u.id, u.full_name]));
    const records = await AttendanceRecord.find({ session_id: { $in: sessions.map((s) => s.id) }, student_id: { $in: students.map((s) => s.id) } }).lean();
    const sessionSub = Object.fromEntries(sessions.map((s) => [s.id, s.subject_id]));
    const counts = {};
    for (const r of records) tally((counts[`${r.student_id}_${sessionSub[r.session_id]}`] ||= emptyStats()), r);

    const data = [];
    for (const s of students) {
      for (const sub of subjects) {
        const c = counts[`${s.id}_${sub.id}`] || emptyStats();
        data.push({
          roll_no: s.roll_no,
          enrollment_no: s.enrollment_no,
          student_name: userMap[s.user_id] || '',
          subject_code: sub.code,
          subject_name: sub.name,
          total_sessions: c.total_classes,
          present_count: c.present_count,
          regular_present_count: c.regular_present_count,
          society_present_count: c.society_present_count,
          late_count: c.late_count,
          absent_count: c.absent_count,
          percentage: c.total_classes ? Number((((c.present_count + c.late_count * 0.5) / c.total_classes) * 100).toFixed(1)) : null
        });
      }
    }
    res.json({ generated_at: new Date().toISOString(), semester: first.semester, section: first.section, records: data });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
