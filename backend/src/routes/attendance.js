const express = require('express');
const {
  Student,
  User,
  Faculty,
  Subject,
  WardLink,
  InstitutionSetting,
  AttendanceSession,
  AttendanceRecord,
  FacultyClassMap,
  getNextId
} = require('../db/database');
const { verifyToken, requirePermission, requireRoles, logAudit } = require('../middleware/authMiddleware');
const { reapplySocietyCreditsForSession } = require('../services/attendanceCredit');

const router = express.Router();

// GET /api/attendance/summary - Student attendance summary with 75% threshold analysis
router.get('/summary', verifyToken, requirePermission('attendance', 'read'), async (req, res) => {
  try {
    let studentId = req.query.studentId || req.query.wardId;

    if (req.user.role === 'student') {
      if (!req.student) return res.status(404).json({ error: 'Student record not found' });
      studentId = req.student.id;
    } else if (req.user.role === 'parent') {
      if (studentId) {
        const isWard = await WardLink.findOne({ parent_user_id: req.user.id, student_id: Number(studentId) }).lean();
        if (!isWard) {
          return res.status(403).json({ error: 'Access denied: You can only view attendance for your linked wards.' });
        }
      } else {
        const firstWard = await WardLink.findOne({ parent_user_id: req.user.id }).sort({ is_primary: -1 }).lean();
        if (!firstWard) return res.status(404).json({ error: 'No linked wards found for this parent.' });
        studentId = firstWard.student_id;
      }
    }

    if (!studentId) {
      return res.status(400).json({ error: 'Student ID required' });
    }

    const numericStudentId = Number(studentId);
    const student = await Student.findOne({ id: numericStudentId }).lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    const [studentUser, thresholdSetting, subjects, studentRecords] = await Promise.all([
      User.findOne({ id: student.user_id }).lean(),
      InstitutionSetting.findOne({ setting_key: 'attendance_threshold' }).lean(),
      Subject.find({ semester: student.semester }).sort({ code: 1 }).lean(),
      AttendanceRecord.find({ student_id: numericStudentId }).lean()
    ]);

    const threshold = thresholdSetting ? parseFloat(thresholdSetting.setting_value) : 75.0;

    const facIds = [...new Set(subjects.map(s => s.faculty_id).filter(Boolean))];
    const faculties = facIds.length ? await Faculty.find({ id: { $in: facIds } }).lean() : [];
    const facUserIds = [...new Set(faculties.map(f => f.user_id))];
    const facUsers = facUserIds.length ? await User.find({ id: { $in: facUserIds } }).lean() : [];
    const facMap = Object.fromEntries(faculties.map(f => [f.id, f]));
    const facUserMap = Object.fromEntries(facUsers.map(u => [u.id, u]));

    const sessionIds = [...new Set(studentRecords.map(r => r.session_id))];
    const sessions = sessionIds.length
      ? await AttendanceSession.find({ id: { $in: sessionIds } }).lean()
      : [];
    const sessionSubjectMap = Object.fromEntries(sessions.map(s => [s.id, s.subject_id]));

    const statsBySubject = {};
    for (const ar of studentRecords) {
      const subId = sessionSubjectMap[ar.session_id];
      if (!subId) continue;
      if (!statsBySubject[subId]) {
        statsBySubject[subId] = {
          total_classes: 0,
          present_count: 0,
          regular_present_count: 0,
          society_present_count: 0,
          late_count: 0,
          absent_count: 0
        };
      }
      const st = statsBySubject[subId];
      st.total_classes += 1;
      if (ar.status === 'Present') {
        st.present_count += 1;
        if (ar.credit_type === 'Society') st.society_present_count += 1;
        else st.regular_present_count += 1;
      } else if (ar.status === 'Late') {
        st.late_count += 1;
      } else if (ar.status === 'Absent') {
        st.absent_count += 1;
      }
    }

    let overallTotal = 0;
    let overallAttended = 0;
    let overallSocietyCredited = 0;

    const subjectBreakdown = subjects.map(sub => {
      const fac = sub.faculty_id ? facMap[sub.faculty_id] : null;
      const facUser = fac ? facUserMap[fac.user_id] : null;
      const records = statsBySubject[sub.id] || {
        total_classes: 0,
        present_count: 0,
        regular_present_count: 0,
        society_present_count: 0,
        late_count: 0,
        absent_count: 0
      };

      const total = records.total_classes;
      const attended = records.present_count + records.late_count * 0.5;
      const pct = total > 0 ? Number(((attended / total) * 100).toFixed(1)) : 100.0;

      overallTotal += total;
      overallAttended += attended;
      overallSocietyCredited += records.society_present_count;

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
        faculty_name: facUser ? facUser.full_name : null,
        credits: sub.credits,
        total_classes: total,
        present_count: records.present_count,
        regular_present_count: records.regular_present_count,
        society_present_count: records.society_present_count,
        late_count: records.late_count,
        absent_count: records.absent_count,
        attendance_percentage: pct,
        is_below_threshold: pct < threshold,
        classes_needed_for_75: classesToReachThreshold,
        safe_leaves_allowed: safeToBunk
      };
    });

    const overallPercentage = overallTotal > 0 ? Number(((overallAttended / overallTotal) * 100).toFixed(1)) : 100.0;

    res.json({
      student_id: student.id,
      student_name: studentUser?.full_name || '',
      overall_percentage: overallPercentage,
      is_at_risk: overallPercentage < threshold,
      threshold,
      total_conducted: overallTotal,
      total_attended: overallAttended,
      total_society_credited: overallSocietyCredited,
      subjects: subjectBreakdown
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/attendance/trends - Attendance trend graph data with scoping
router.get('/trends', verifyToken, requirePermission('attendance', 'read'), async (req, res) => {
  try {
    let studentId = req.query.studentId || req.query.wardId;

    if (req.user.role === 'student') {
      studentId = req.student ? req.student.id : null;
    } else if (req.user.role === 'parent') {
      if (studentId) {
        const isWard = await WardLink.findOne({ parent_user_id: req.user.id, student_id: Number(studentId) }).lean();
        if (!isWard) return res.status(403).json({ error: 'Access denied to this ward.' });
      } else {
        const firstWard = await WardLink.findOne({ parent_user_id: req.user.id }).sort({ is_primary: -1 }).lean();
        studentId = firstWard ? firstWard.student_id : null;
      }
    }

    const recordFilter = studentId ? { student_id: Number(studentId) } : {};
    const records = await AttendanceRecord.find(recordFilter).lean();
    if (records.length === 0) return res.json([]);

    const sessionIds = [...new Set(records.map(r => r.session_id))];
    const sessions = await AttendanceSession.find({ id: { $in: sessionIds } }).lean();
    const sessionDateMap = Object.fromEntries(sessions.map(s => [s.id, s.session_date]));

    const byDate = {};
    for (const ar of records) {
      const date = sessionDateMap[ar.session_id];
      if (!date) continue;
      if (!byDate[date]) {
        byDate[date] = { date, total: 0, present: 0, society_present: 0, late: 0, absent: 0 };
      }
      const d = byDate[date];
      d.total += 1;
      if (ar.status === 'Present') {
        d.present += 1;
        if (ar.credit_type === 'Society') d.society_present += 1;
      } else if (ar.status === 'Late') {
        d.late += 1;
      } else if (ar.status === 'Absent') {
        d.absent += 1;
      }
    }

    const formattedTrends = Object.values(byDate)
      .sort((a, b) => a.date.localeCompare(b.date))
      .map(s => {
        const attended = s.present + s.late * 0.5;
        const pct = s.total > 0 ? Number(((attended / s.total) * 100).toFixed(1)) : 100;
        return {
          date: s.date,
          total: s.total,
          present: s.present,
          society_present: s.society_present,
          absent: s.absent,
          late: s.late,
          percentage: pct
        };
      });

    res.json(formattedTrends);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/attendance/create-session - Faculty creates daily session (with dynamic QR token & DB Scoping)
router.post('/create-session', verifyToken, requirePermission('attendance', 'create'), async (req, res) => {
  try {
    const { subjectId, section, semester, topicCovered, durationMinutes } = req.body;

    let facultyId = null;
    if (req.user.role === 'faculty') {
      if (!req.faculty) return res.status(403).json({ error: 'Faculty profile not found' });
      facultyId = req.faculty.id;

      const isMapped = await FacultyClassMap.findOne({
        faculty_id: facultyId,
        subject_id: Number(subjectId),
        semester: Number(semester),
        section
      }).lean();

      if (!isMapped) {
        return res.status(403).json({
          error: `Forbidden: You are not assigned to teach subject ID ${subjectId} in Semester ${semester} (${section}).`
        });
      }
    } else {
      facultyId = req.body.facultyId ? Number(req.body.facultyId) : 1;
    }

    if (!subjectId || !section) {
      return res.status(400).json({ error: 'Subject ID and section are required' });
    }

    const token = `GTB_ATT_${Date.now()}_${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
    const expiryTime = new Date(Date.now() + (durationMinutes || 15) * 60000).toISOString();
    const todayStr = new Date().toISOString().split('T')[0];

    const id = await getNextId('attendance_sessions');
    await AttendanceSession.create({
      id,
      subject_id: Number(subjectId),
      faculty_id: facultyId,
      section,
      semester: Number(semester || 4),
      session_date: todayStr,
      slot_time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      topic_covered: topicCovered || 'Daily Lecture & Problem Solving',
      session_token: token,
      qr_expires_at: expiryTime
    });

    await reapplySocietyCreditsForSession(id);

    res.status(201).json({
      message: 'Attendance session initialized with dynamic QR code',
      sessionId: id,
      sessionToken: token,
      expiresAt: expiryTime
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/attendance/bulk-mark - Faculty one-tap bulk attendance marking (scoped)
router.post('/bulk-mark', verifyToken, requirePermission('attendance', 'update'), async (req, res) => {
  try {
    const { sessionId, records } = req.body;

    if (!sessionId || !Array.isArray(records)) {
      return res.status(400).json({ error: 'Session ID and student records array required' });
    }

    const numericSessionId = Number(sessionId);
    const session = await AttendanceSession.findOne({ id: numericSessionId }).lean();
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (req.user.role === 'faculty') {
      if (session.faculty_id !== req.faculty?.id) {
        return res.status(403).json({ error: 'Access denied: You can only mark attendance for sessions you created.' });
      }
    }

    const existing = await AttendanceRecord.find({ session_id: numericSessionId }).lean();
    const existingSet = new Set(existing.map(r => r.student_id));
    const now = new Date().toISOString();

    const toUpdate = [];
    const toInsert = [];

    for (const r of records) {
      const sid = Number(r.studentId);
      if (existingSet.has(sid)) {
        toUpdate.push({
          updateOne: {
            filter: { session_id: numericSessionId, student_id: sid },
            update: { $set: { status: r.status, marked_at: now } }
          }
        });
      } else {
        const id = await getNextId('attendance_records');
        toInsert.push({
          id,
          session_id: numericSessionId,
          student_id: sid,
          status: r.status,
          method: 'One_Tap',
          marked_at: now
        });
      }
    }

    if (toUpdate.length) await AttendanceRecord.bulkWrite(toUpdate);
    if (toInsert.length) await AttendanceRecord.insertMany(toInsert);

    await reapplySocietyCreditsForSession(numericSessionId);

    res.json({ message: `Successfully updated attendance for ${records.length} students` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/attendance/override - Admin override with mandatory audit log
router.put('/override', verifyToken, requirePermission('attendance', 'override'), async (req, res) => {
  try {
    const { recordId, sessionId, studentId, status, reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ error: 'A valid mandatory reason (min 5 chars) is required for attendance override.' });
    }

    let record = null;
    if (recordId) {
      record = await AttendanceRecord.findOne({ id: Number(recordId) }).lean();
    } else if (sessionId && studentId) {
      record = await AttendanceRecord.findOne({
        session_id: Number(sessionId),
        student_id: Number(studentId)
      }).lean();
    }

    if (!record) {
      return res.status(404).json({ error: 'Attendance record not found' });
    }

    const oldStatus = record.status;
    await AttendanceRecord.updateOne(
      { id: record.id },
      {
        $set: {
          status,
          method: 'Faculty_Manual',
          marked_at: new Date().toISOString()
        }
      }
    );

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      userEmail: req.user.email,
      action: 'ATTENDANCE_OVERRIDE',
      entityType: 'attendance_records',
      entityId: record.id,
      oldValue: { status: oldStatus },
      newValue: { status },
      reason,
      ipAddress: req.ip
    });

    res.json({
      message: 'Attendance override successfully applied and recorded in institutional audit log.',
      recordId: record.id,
      previousStatus: oldStatus,
      newStatus: status
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/attendance/qr-checkin - Student scans QR code or enters OTP
router.post('/qr-checkin', verifyToken, requireRoles('student'), async (req, res) => {
  try {
    const { sessionToken } = req.body;
    if (!sessionToken) {
      return res.status(400).json({ error: 'QR Session token is required' });
    }

    const session = await AttendanceSession.findOne({ session_token: sessionToken.trim() }).lean();
    if (!session) {
      return res.status(404).json({ error: 'Invalid QR code or session not found' });
    }

    if (new Date(session.qr_expires_at) < new Date()) {
      return res.status(400).json({ error: 'This QR attendance session has expired' });
    }

    if (!req.student) {
      return res.status(404).json({ error: 'Student record not found' });
    }

    const now = new Date().toISOString();
    const existing = await AttendanceRecord.findOne({
      session_id: session.id,
      student_id: req.student.id
    }).lean();

    if (existing) {
      await AttendanceRecord.updateOne(
        { id: existing.id },
        { $set: { status: 'Present', method: 'QR_Scan', marked_at: now } }
      );
    } else {
      const id = await getNextId('attendance_records');
      await AttendanceRecord.create({
        id,
        session_id: session.id,
        student_id: req.student.id,
        status: 'Present',
        method: 'QR_Scan',
        marked_at: now
      });
    }

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
router.get('/export', verifyToken, requirePermission('attendance', 'read'), async (req, res) => {
  try {
    const semester = Number(req.query.semester || 4);
    const section = req.query.section || 'CSE-2';

    const [students, subjects, sessions] = await Promise.all([
      Student.find({ semester, section }).sort({ roll_no: 1 }).lean(),
      Subject.find({}).sort({ code: 1 }).lean(),
      AttendanceSession.find({ section }).lean()
    ]);

    const userIds = [...new Set(students.map(s => s.user_id))];
    const users = userIds.length ? await User.find({ id: { $in: userIds } }).lean() : [];
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const sessionIds = sessions.map(s => s.id);
    const studentIds = students.map(s => s.id);
    const records =
      sessionIds.length && studentIds.length
        ? await AttendanceRecord.find({
            session_id: { $in: sessionIds },
            student_id: { $in: studentIds }
          }).lean()
        : [];

    const sessionSubjectMap = Object.fromEntries(sessions.map(s => [s.id, s.subject_id]));
    const countMap = {};
    for (const r of records) {
      const subId = sessionSubjectMap[r.session_id];
      if (!subId) continue;
      const key = `${r.student_id}_${subId}`;
      if (!countMap[key]) {
        countMap[key] = {
          total_sessions: 0,
          present_count: 0,
          regular_present_count: 0,
          society_present_count: 0,
          late_count: 0,
          absent_count: 0
        };
      }
      const c = countMap[key];
      c.total_sessions += 1;
      if (r.status === 'Present') {
        c.present_count += 1;
        if (r.credit_type === 'Society') c.society_present_count += 1;
        else c.regular_present_count += 1;
      } else if (r.status === 'Late') {
        c.late_count += 1;
      } else if (r.status === 'Absent') {
        c.absent_count += 1;
      }
    }

    const data = [];
    for (const s of students) {
      const u = userMap[s.user_id];
      if (!u) continue;
      for (const sub of subjects) {
        const c = countMap[`${s.id}_${sub.id}`] || {
          total_sessions: 0,
          present_count: 0,
          regular_present_count: 0,
          society_present_count: 0,
          late_count: 0,
          absent_count: 0
        };
        data.push({
          roll_no: s.roll_no,
          enrollment_no: s.enrollment_no,
          student_name: u.full_name,
          subject_code: sub.code,
          subject_name: sub.name,
          ...c
        });
      }
    }

    res.json({
      generated_at: new Date().toISOString(),
      semester,
      section,
      records: data
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
