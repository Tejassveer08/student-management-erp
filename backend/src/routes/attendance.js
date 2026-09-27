const express = require('express');
const db = require('../db/database');
const { verifyToken, requirePermission, requireRoles, logAudit } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/attendance/summary - Student attendance summary with 75% threshold analysis
router.get('/summary', verifyToken, requirePermission('attendance', 'read'), (req, res) => {
  let studentId = req.query.studentId || req.query.wardId;

  // DB-LEVEL SCOPING
  if (req.user.role === 'student') {
    if (!req.student) return res.status(404).json({ error: 'Student record not found' });
    studentId = req.student.id; // Force own ID
  } else if (req.user.role === 'parent') {
    if (studentId) {
      // Verify ward belongs to this parent
      const isWard = db.prepare('SELECT 1 FROM ward_links WHERE parent_user_id = ? AND student_id = ?').get(req.user.id, studentId);
      if (!isWard) {
        return res.status(403).json({ error: 'Access denied: You can only view attendance for your linked wards.' });
      }
    } else {
      // Default to first linked ward
      const firstWard = db.prepare('SELECT student_id FROM ward_links WHERE parent_user_id = ? ORDER BY is_primary DESC LIMIT 1').get(req.user.id);
      if (!firstWard) return res.status(404).json({ error: 'No linked wards found for this parent.' });
      studentId = firstWard.student_id;
    }
  }

  if (!studentId) {
    return res.status(400).json({ error: 'Student ID required' });
  }

  // Get student details
  const student = db.prepare(`
    SELECT s.*, u.full_name as student_name
    FROM students s
    JOIN users u ON s.user_id = u.id
    WHERE s.id = ?
  `).get(studentId);

  if (!student) return res.status(404).json({ error: 'Student not found' });

  // Get institutional threshold (default 75.0%)
  const thresholdSetting = db.prepare("SELECT setting_value FROM institution_settings WHERE setting_key = 'attendance_threshold'").get();
  const threshold = thresholdSetting ? parseFloat(thresholdSetting.setting_value) : 75.0;

  // Get subjects for this student's semester
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

    let classesToReachThreshold = 0;
    let safeToBunk = 0;

    const thresholdDec = threshold / 100.0;
    if (pct < threshold && total > 0) {
      classesToReachThreshold = Math.max(0, Math.ceil((thresholdDec * total - attended) / (1.0 - thresholdDec)));
    } else if (pct >= threshold && total > 0) {
      safeToBunk = Math.max(0, Math.floor((attended / thresholdDec) - total));
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
      is_below_threshold: pct < threshold,
      classes_needed_for_75: classesToReachThreshold,
      safe_leaves_allowed: safeToBunk
    };
  });

  const overallPercentage = overallTotal > 0 ? Number(((overallAttended / overallTotal) * 100).toFixed(1)) : 100.0;

  res.json({
    student_id: student.id,
    student_name: student.student_name,
    overall_percentage: overallPercentage,
    is_at_risk: overallPercentage < threshold,
    threshold: threshold,
    total_conducted: overallTotal,
    total_attended: overallAttended,
    subjects: subjectBreakdown
  });
});

// GET /api/attendance/trends - Attendance trend graph data with scoping
router.get('/trends', verifyToken, requirePermission('attendance', 'read'), (req, res) => {
  let studentId = req.query.studentId || req.query.wardId;

  if (req.user.role === 'student') {
    studentId = req.student ? req.student.id : null;
  } else if (req.user.role === 'parent') {
    if (studentId) {
      const isWard = db.prepare('SELECT 1 FROM ward_links WHERE parent_user_id = ? AND student_id = ?').get(req.user.id, studentId);
      if (!isWard) return res.status(403).json({ error: 'Access denied to this ward.' });
    } else {
      const firstWard = db.prepare('SELECT student_id FROM ward_links WHERE parent_user_id = ? ORDER BY is_primary DESC LIMIT 1').get(req.user.id);
      studentId = firstWard ? firstWard.student_id : null;
    }
  }

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

// POST /api/attendance/create-session - Faculty creates daily session (with dynamic QR token & DB Scoping)
router.post('/create-session', verifyToken, requirePermission('attendance', 'create'), (req, res) => {
  const { subjectId, section, semester, topicCovered, durationMinutes } = req.body;

  let facultyId = null;
  if (req.user.role === 'faculty') {
    if (!req.faculty) return res.status(403).json({ error: 'Faculty profile not found' });
    facultyId = req.faculty.id;

    // DB SCOPING: Verify faculty is mapped to this subject and class
    const isMapped = db.prepare(`
      SELECT 1 FROM faculty_class_map
      WHERE faculty_id = ? AND subject_id = ? AND semester = ? AND section = ?
    `).get(facultyId, subjectId, semester, section);

    if (!isMapped) {
      return res.status(403).json({
        error: `Forbidden: You are not assigned to teach subject ID ${subjectId} in Semester ${semester} (${section}).`
      });
    }
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

// POST /api/attendance/bulk-mark - Faculty one-tap bulk attendance marking (scoped)
router.post('/bulk-mark', verifyToken, requirePermission('attendance', 'update'), (req, res) => {
  const { sessionId, records } = req.body;

  if (!sessionId || !Array.isArray(records)) {
    return res.status(400).json({ error: 'Session ID and student records array required' });
  }

  const session = db.prepare('SELECT * FROM attendance_sessions WHERE id = ?').get(sessionId);
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  // DB scoping check for faculty
  if (req.user.role === 'faculty') {
    if (session.faculty_id !== req.faculty?.id) {
      return res.status(403).json({ error: 'Access denied: You can only mark attendance for sessions you created.' });
    }
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

  res.json({ message: `Successfully updated attendance for ${records.length} students` });
});

// PUT /api/attendance/override - Admin override with mandatory audit log
router.put('/override', verifyToken, requirePermission('attendance', 'override'), (req, res) => {
  const { recordId, sessionId, studentId, status, reason } = req.body;

  if (!reason || reason.trim().length < 5) {
    return res.status(400).json({ error: 'A valid mandatory reason (min 5 chars) is required for attendance override.' });
  }

  let record = null;
  if (recordId) {
    record = db.prepare('SELECT * FROM attendance_records WHERE id = ?').get(recordId);
  } else if (sessionId && studentId) {
    record = db.prepare('SELECT * FROM attendance_records WHERE session_id = ? AND student_id = ?').get(sessionId, studentId);
  }

  if (!record) {
    return res.status(404).json({ error: 'Attendance record not found' });
  }

  const oldStatus = record.status;
  db.prepare(`
    UPDATE attendance_records
    SET status = ?,
        method = 'Faculty_Manual',
        marked_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, record.id);

  // Mandatory Audit Log
  logAudit({
    userId: req.user.id,
    userRole: req.user.role,
    userEmail: req.user.email,
    action: 'ATTENDANCE_OVERRIDE',
    entityType: 'attendance_records',
    entityId: record.id,
    oldValue: { status: oldStatus },
    newValue: { status: status },
    reason: reason,
    ipAddress: req.ip
  });

  res.json({
    message: 'Attendance override successfully applied and recorded in institutional audit log.',
    recordId: record.id,
    previousStatus: oldStatus,
    newStatus: status
  });
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

  if (!req.student) {
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
    `).run(session.id, req.student.id);

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
router.get('/export', verifyToken, requirePermission('attendance', 'read'), (req, res) => {
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
