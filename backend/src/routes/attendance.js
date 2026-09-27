const express = require('express');
const db = require('../db/database');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/attendance/summary - Student attendance summary with 75% threshold analysis
router.get('/summary', verifyToken, (req, res) => {
  let studentId = req.query.studentId;

  // If student is logged in, use their own id
  if (req.user.role === 'student') {
    const student = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
    if (!student) return res.status(404).json({ error: 'Student record not found' });
    studentId = student.id;
  } else if (req.user.role === 'parent') {
    const ward = db.prepare('SELECT id FROM students WHERE parent_user_id = ?').get(req.user.id);
    if (!ward) return res.status(404).json({ error: 'Ward record not found' });
    studentId = ward.id;
  }

  if (!studentId) {
    return res.status(400).json({ error: 'Student ID required' });
  }

  // Get all registered subjects for this student's semester
  const student = db.prepare('SELECT * FROM students WHERE id = ?').get(studentId);
  if (!student) return res.status(404).json({ error: 'Student not found' });

  const subjects = db.prepare(`
    SELECT s.id, s.code, s.name, s.credits, s.type, s.difficulty_index,
           u.full_name as faculty_name
    FROM subjects s
    LEFT JOIN faculty f ON s.faculty_id = f.id
    LEFT JOIN users u ON f.user_id = u.id
    WHERE s.semester = ?
    ORDER BY s.code ASC
  `).all(student.semester);

  let overallTotal = 0;
  let overallAttended = 0;

  const subjectBreakdown = subjects.map(sub => {
    const records = db.prepare(`
      SELECT 
        COUNT(*) as total_classes,
        SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END) as present_count,
        SUM(CASE WHEN ar.status = 'Late' THEN 1 ELSE 0 END) as late_count,
        SUM(CASE WHEN ar.status = 'Absent' THEN 1 ELSE 0 END) as absent_count
      FROM attendance_records ar
      JOIN attendance_sessions sess ON ar.session_id = sess.id
      WHERE ar.student_id = ? AND sess.subject_id = ?
    `).get(studentId, sub.id);

    const total = records.total_classes || 0;
    const attended = (records.present_count || 0) + ((records.late_count || 0) * 0.5);
    const pct = total > 0 ? Number(((attended / total) * 100).toFixed(1)) : 100.0;

    overallTotal += total;
    overallAttended += attended;

    // Calculate how many more classes needed to reach 75% if below
    // Formula: (attended + X) / (total + X) >= 0.75  =>  attended + X >= 0.75 * total + 0.75 * X
    // 0.25 * X >= 0.75 * total - attended  =>  X >= (0.75 * total - attended) / 0.25
    let classesToReach75 = 0;
    let safeToBunk = 0;

    if (pct < 75.0 && total > 0) {
      classesToReach75 = Math.max(0, Math.ceil((0.75 * total - attended) / 0.25));
    } else if (pct >= 75.0 && total > 0) {
      // Safe classes can miss: attended / (total + Y) >= 0.75 => Y <= (attended / 0.75) - total
      safeToBunk = Math.max(0, Math.floor((attended / 0.75) - total));
    }

    return {
      subject_id: sub.id,
      subject_code: sub.code,
      subject_name: sub.name,
      faculty_name: sub.faculty_name,
      credits: sub.credits,
      total_classes: total,
      present_count: records.present_count || 0,
      late_count: records.late_count || 0,
      absent_count: records.absent_count || 0,
      attendance_percentage: pct,
      is_below_threshold: pct < 75.0,
      classes_needed_for_75: classesToReach75,
      safe_leaves_allowed: safeToBunk
    };
  });

  const overallPercentage = overallTotal > 0 ? Number(((overallAttended / overallTotal) * 100).toFixed(1)) : 100.0;

  res.json({
    student_id: student.id,
    student_name: student.full_name,
    overall_percentage: overallPercentage,
    is_at_risk: overallPercentage < 75.0,
    threshold: 75.0,
    total_conducted: overallTotal,
    total_attended: overallAttended,
    subjects: subjectBreakdown
  });
});

// GET /api/attendance/trends - Attendance trend graph data
router.get('/trends', verifyToken, (req, res) => {
  let studentId = req.query.studentId;

  if (req.user.role === 'student') {
    const student = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
    studentId = student ? student.id : null;
  } else if (req.user.role === 'parent') {
    const ward = db.prepare('SELECT id FROM students WHERE parent_user_id = ?').get(req.user.id);
    studentId = ward ? ward.id : null;
  }

  // Group attendance by session date / week
  const sessions = db.prepare(`
    SELECT sess.session_date,
           COUNT(ar.id) as total_students,
           SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END) as present_count,
           SUM(CASE WHEN ar.status = 'Late' THEN 1 ELSE 0 END) as late_count,
           SUM(CASE WHEN ar.status = 'Absent' THEN 1 ELSE 0 END) as absent_count
    FROM attendance_sessions sess
    JOIN attendance_records ar ON sess.id = ar.session_id
    ${studentId ? 'WHERE ar.student_id = ?' : ''}
    GROUP BY sess.session_date
    ORDER BY sess.session_date ASC
  `).all(...(studentId ? [studentId] : []));

  const formattedTrends = sessions.map(s => {
    const attended = s.present_count + (s.late_count * 0.5);
    const pct = s.total_students > 0 ? Number(((attended / s.total_students) * 100).toFixed(1)) : 100;
    return {
      date: s.session_date,
      total: s.total_students,
      present: s.present_count,
      absent: s.absent_count,
      late: s.late_count,
      percentage: pct
    };
  });

  res.json(formattedTrends);
});

// POST /api/attendance/create-session - Faculty creates daily session (with dynamic QR token)
router.post('/create-session', verifyToken, requireRoles('faculty', 'admin'), (req, res) => {
  const { subjectId, section, semester, topicCovered, durationMinutes } = req.body;

  let facultyId = null;
  if (req.user.role === 'faculty') {
    const fac = db.prepare('SELECT id FROM faculty WHERE user_id = ?').get(req.user.id);
    facultyId = fac ? fac.id : 1;
  } else {
    facultyId = req.body.facultyId || 1;
  }

  if (!subjectId || !section) {
    return res.status(400).json({ error: 'Subject ID and section are required' });
  }

  const token = `GTB_ATT_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
  const expiryTime = new Date(Date.now() + (durationMinutes || 15) * 60000).toISOString();
  const todayStr = new Date().toISOString().split('T')[0];

  const result = db.prepare(`
    INSERT INTO attendance_sessions (
      subject_id, faculty_id, section, semester, session_date, slot_time, topic_covered, session_token, qr_expires_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    subjectId,
    facultyId,
    section,
    semester || 4,
    todayStr,
    new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    topicCovered || 'Daily Lecture & Problem Solving',
    token,
    expiryTime
  );

  res.status(201).json({
    message: 'Attendance session initialized with dynamic QR code',
    sessionId: result.lastInsertRowid,
    sessionToken: token,
    expiresAt: expiryTime
  });
});

// POST /api/attendance/bulk-mark - Faculty one-tap bulk attendance marking
router.post('/bulk-mark', verifyToken, requireRoles('faculty', 'admin'), (req, res) => {
  const { sessionId, records } = req.body; // records: [{ studentId, status: 'Present' | 'Absent' | 'Late' }]

  if (!sessionId || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Session ID and student records array required' });
  }

  const upsert = db.prepare(`
    INSERT INTO attendance_records (session_id, student_id, status, method, marked_at)
    VALUES (?, ?, ?, 'One_Tap', CURRENT_TIMESTAMP)
    ON CONFLICT(session_id, student_id) DO UPDATE SET
      status = excluded.status,
      marked_at = CURRENT_TIMESTAMP
  `);

  const markMany = db.transaction((recs) => {
    for (const r of recs) {
      upsert.run(sessionId, r.studentId, r.status);
    }
  });

  markMany(records);

  // Check if any student just breached <75% and trigger alerts
  for (const r of records) {
    const attStats = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN status = 'Late' THEN 1 ELSE 0 END) as late
      FROM attendance_records
      WHERE student_id = ?
    `).get(r.studentId);

    const total = attStats.total || 0;
    const attended = (attStats.present || 0) + ((attStats.late || 0) * 0.5);
    const pct = total > 0 ? (attended / total) * 100 : 100;

    if (pct < 75.0 && total >= 5) {
      const student = db.prepare('SELECT user_id, parent_user_id, roll_no FROM students WHERE id = ?').get(r.studentId);
      if (student) {
        // Send alert to student
        db.prepare(`
          INSERT INTO notifications (user_id, title, message, type, link_url)
          VALUES (?, 'Low Attendance Warning', ?, 'attendance_alert', '/attendance')
        `).run(student.user_id, `Your attendance has dropped to ${pct.toFixed(1)}%, which is below the mandatory 75% limit.`);

        // Send alert to parent if linked
        if (student.parent_user_id) {
          db.prepare(`
            INSERT INTO notifications (user_id, title, message, type, link_url)
            VALUES (?, 'Ward Low Attendance Alert', ?, 'attendance_alert', '/attendance')
          `).run(student.parent_user_id, `Attendance alert for Roll No ${student.roll_no}: current attendance is ${pct.toFixed(1)}% (Threshold: 75%).`);
        }
      }
    }
  }

  res.json({ message: `Successfully updated attendance for ${records.length} students` });
});

// POST /api/attendance/qr-checkin - Student scans QR code or enters OTP
router.post('/qr-checkin', verifyToken, requireRoles('student'), (req, res) => {
  const { sessionToken } = req.body;
  if (!sessionToken) {
    return res.status(400).json({ error: 'QR Session token is required' });
  }

  const session = db.prepare(`
    SELECT * FROM attendance_sessions 
    WHERE session_token = ?
  `).get(sessionToken.trim());

  if (!session) {
    return res.status(404).json({ error: 'Invalid QR code or session not found' });
  }

  if (new Date(session.qr_expires_at) < new Date()) {
    return res.status(400).json({ error: 'This QR attendance session has expired' });
  }

  const student = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
  if (!student) {
    return res.status(404).json({ error: 'Student record not found' });
  }

  try {
    db.prepare(`
      INSERT INTO attendance_records (session_id, student_id, status, method, marked_at)
      VALUES (?, ?, 'Present', 'QR_Scan', CURRENT_TIMESTAMP)
      ON CONFLICT(session_id, student_id) DO UPDATE SET
        status = 'Present',
        method = 'QR_Scan',
        marked_at = CURRENT_TIMESTAMP
    `).run(session.id, student.id);

    res.json({
      message: 'Attendance recorded successfully via QR check-in!',
      subjectId: session.subject_id,
      timestamp: new Date().toLocaleTimeString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance/export - Export attendance report
router.get('/export', verifyToken, (req, res) => {
  const { semester, section } = req.query;

  const data = db.prepare(`
    SELECT s.roll_no, s.enrollment_no, u.full_name as student_name,
           sub.code as subject_code, sub.name as subject_name,
           COUNT(ar.id) as total_sessions,
           SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END) as present_count,
           SUM(CASE WHEN ar.status = 'Late' THEN 1 ELSE 0 END) as late_count,
           SUM(CASE WHEN ar.status = 'Absent' THEN 1 ELSE 0 END) as absent_count
    FROM students s
    JOIN users u ON s.user_id = u.id
    CROSS JOIN subjects sub
    LEFT JOIN attendance_sessions sess ON sess.subject_id = sub.id AND sess.section = s.section
    LEFT JOIN attendance_records ar ON ar.session_id = sess.id AND ar.student_id = s.id
    WHERE s.semester = ? AND s.section = ?
    GROUP BY s.id, sub.id
    ORDER BY s.roll_no ASC, sub.code ASC
  `).all(semester || 4, section || 'CSE-2');

  res.json({
    generated_at: new Date().toISOString(),
    semester: semester || 4,
    section: section || 'CSE-2',
    records: data
  });
});

module.exports = router;
