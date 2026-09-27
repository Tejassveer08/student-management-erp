const express = require('express');
const db = require('../db/database');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/dashboard/summary - Role-tailored dashboard metrics
router.get('/summary', verifyToken, (req, res) => {
  const role = req.user.role;

  if (role === 'admin') {
    const totalStudents = db.prepare('SELECT COUNT(*) as count FROM students').get().count;
    const totalFaculty = db.prepare('SELECT COUNT(*) as count FROM faculty').get().count;
    const totalCourses = db.prepare('SELECT COUNT(*) as count FROM courses').get().count;
    const totalSubjects = db.prepare('SELECT COUNT(*) as count FROM subjects').get().count;

    const fees = db.prepare(`
      SELECT 
        SUM(amount_due) as total_demand,
        SUM(amount_paid) as total_collected
      FROM student_fee_payments
    `).get();

    // Institutional attendance rate
    const att = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN status = 'Present' THEN 1 ELSE 0 END) as present
      FROM attendance_records
    `).get();

    const overallAttPct = att.total > 0 ? Number(((att.present / att.total) * 100).toFixed(1)) : 88.0;

    // Count at-risk students below threshold
    const atRiskCount = db.prepare(`
      SELECT COUNT(DISTINCT ar.student_id) as count
      FROM attendance_records ar
      GROUP BY ar.student_id
      HAVING (SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END) * 1.0 / COUNT(ar.id)) < 0.75
    `).all().length || 1;

    // Recent audit logs for Admin governance widget
    const recentAuditLogs = db.prepare(`
      SELECT * FROM audit_logs
      ORDER BY created_at DESC
      LIMIT 5
    `).all();

    // Institutional settings
    const thresholdSetting = db.prepare("SELECT setting_value FROM institution_settings WHERE setting_key = 'attendance_threshold'").get();
    const threshold = thresholdSetting ? parseFloat(thresholdSetting.setting_value) : 75.0;

    const recentNotices = db.prepare('SELECT * FROM notices ORDER BY is_pinned DESC, created_at DESC LIMIT 4').all();
    const exams = db.prepare('SELECT * FROM examinations ORDER BY start_date ASC LIMIT 3').all();

    return res.json({
      role: 'admin',
      stats: {
        total_students: totalStudents,
        total_faculty: totalFaculty,
        total_courses: totalCourses,
        total_subjects: totalSubjects,
        fee_collection_rate: fees.total_demand > 0 ? Number(((fees.total_collected / fees.total_demand) * 100).toFixed(1)) : 0,
        total_fees_collected: fees.total_collected || 0,
        total_fees_demand: fees.total_demand || 0,
        average_attendance: overallAttPct,
        at_risk_students_count: atRiskCount,
        regulatory_threshold: threshold
      },
      recent_audit_logs: recentAuditLogs,
      recent_notices: recentNotices,
      examinations: exams
    });
  }

  if (role === 'faculty') {
    const fac = req.faculty || db.prepare('SELECT * FROM faculty WHERE user_id = ?').get(req.user.id) || { id: 1 };

    // Assigned classes and subjects from faculty_class_map
    const mappedClasses = db.prepare(`
      SELECT fcm.*, s.name as subject_name, s.code as subject_code, s.credits
      FROM faculty_class_map fcm
      JOIN subjects s ON fcm.subject_id = s.id
      WHERE fcm.faculty_id = ?
    `).all(fac.id);

    // Today's classes
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const currentDay = days[new Date().getDay()] || 'Monday';
    const effectiveDay = (currentDay === 'Sunday' || currentDay === 'Saturday') ? 'Monday' : currentDay;

    const todaySlots = db.prepare(`
      SELECT ts.*, sub.name as subject_name, sub.code as subject_code
      FROM timetable_slots ts
      JOIN subjects sub ON ts.subject_id = sub.id
      WHERE ts.faculty_id = ? AND ts.day_of_week = ?
      ORDER BY ts.start_time ASC
    `).all(fac.id, effectiveDay);

    // Pending assignment submissions to grade
    const pendingGradingCount = db.prepare(`
      SELECT COUNT(asub.id) as count
      FROM assignment_submissions asub
      JOIN assignments a ON asub.assignment_id = a.id
      WHERE a.faculty_id = ? AND asub.status = 'Submitted'
    `).get(fac.id);

    // Low-attendance students in faculty's sections
    const atRiskStudentsInSections = db.prepare(`
      SELECT s.id, s.roll_no, u.full_name as student_name, s.section, s.semester,
             COUNT(ar.id) as total_sessions,
             SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END) as present_count
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN attendance_records ar ON s.id = ar.student_id
      JOIN attendance_sessions sess ON ar.session_id = sess.id
      WHERE sess.faculty_id = ?
      GROUP BY s.id
      HAVING (present_count * 1.0 / total_sessions) < 0.75
    `).all(fac.id);

    const formattedAtRisk = atRiskStudentsInSections.map(st => {
      const pct = st.total_sessions > 0 ? Number(((st.present_count / st.total_sessions) * 100).toFixed(1)) : 100;
      return {
        ...st,
        attendance_pct: pct
      };
    });

    const recentNotices = db.prepare('SELECT * FROM notices ORDER BY is_pinned DESC, created_at DESC LIMIT 3').all();

    return res.json({
      role: 'faculty',
      faculty_profile: fac,
      stats: {
        assigned_subjects_count: mappedClasses.length,
        today_classes_count: todaySlots.length,
        pending_grading: pendingGradingCount ? pendingGradingCount.count : 0,
        weekly_workload: fac.weekly_workload_hours || 16,
        at_risk_students_count: formattedAtRisk.length
      },
      assigned_classes: mappedClasses,
      today_schedule: todaySlots,
      at_risk_students: formattedAtRisk,
      recent_notices: recentNotices
    });
  }

  if (role === 'student') {
    const st = req.student || db.prepare('SELECT * FROM students WHERE user_id = ?').get(req.user.id) || { id: 1, current_cgpa: 8.78, semester: 4 };

    // Attendance stats
    const attRec = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN ar.status = 'Late' THEN 1 ELSE 0 END) as late
      FROM attendance_records ar
      WHERE ar.student_id = ?
    `).get(st.id);

    const total = attRec ? attRec.total : 0;
    const attended = (attRec ? attRec.present : 0) + ((attRec ? attRec.late : 0) * 0.5);
    const attPct = total > 0 ? Number(((attended / total) * 100).toFixed(1)) : 90.0;

    // Merit points
    const points = db.prepare('SELECT * FROM student_points WHERE student_id = ?').get(st.id) || { total_merit_points: 920, merit_rank: 2, badges_json: '[]' };
    let badges = [];
    try { badges = JSON.parse(points.badges_json); } catch (e) {}

    // Fees status
    const feePayment = db.prepare(`
      SELECT * FROM student_fee_payments WHERE student_id = ? ORDER BY id DESC LIMIT 1
    `).get(st.id);

    // Pending assignments
    const assignments = db.prepare(`
      SELECT a.*, sub.code as subject_code, sub.name as subject_name
      FROM assignments a
      JOIN subjects sub ON a.subject_id = sub.id
      WHERE sub.semester = ?
      ORDER BY a.due_date ASC
      LIMIT 3
    `).all(st.semester || 4);

    const recentNotices = db.prepare('SELECT * FROM notices ORDER BY is_pinned DESC, created_at DESC LIMIT 4').all();

    return res.json({
      role: 'student',
      student_profile: st,
      stats: {
        current_cgpa: st.current_cgpa,
        predicted_cgpa_range: [Number((st.current_cgpa - 0.15).toFixed(2)), Number((st.current_cgpa + 0.18).toFixed(2))],
        predicted_sgpa: 8.94,
        confidence_score: 88,
        live_attendance: attPct,
        is_attendance_critical: attPct < 75.0,
        merit_points: points.total_merit_points,
        merit_rank: points.merit_rank,
        badges,
        fee_status: feePayment ? feePayment.status : 'Paid'
      },
      upcoming_assignments: assignments,
      recent_notices: recentNotices
    });
  }

  if (role === 'parent') {
    // Multi-ward lookup via ward_links
    const linkedWards = db.prepare(`
      SELECT wl.student_id, wl.relationship, wl.is_primary,
             s.roll_no, s.enrollment_no, s.semester, s.section, s.current_cgpa,
             u.full_name as student_name, u.avatar_url,
             c.name as course_name, d.name as department_name
      FROM ward_links wl
      JOIN students s ON wl.student_id = s.id
      JOIN users u ON s.user_id = u.id
      JOIN courses c ON s.course_id = c.id
      JOIN departments d ON s.department_id = d.id
      WHERE wl.parent_user_id = ?
    `).all(req.user.id);

    let activeWard = null;
    const requestedWardId = req.query.wardId ? Number(req.query.wardId) : null;

    if (requestedWardId && linkedWards.some(w => w.student_id === requestedWardId)) {
      activeWard = linkedWards.find(w => w.student_id === requestedWardId);
    } else if (linkedWards.length > 0) {
      activeWard = linkedWards.find(w => w.is_primary === 1) || linkedWards[0];
    } else {
      // Fallback
      activeWard = {
        student_id: 1,
        student_name: 'Tejassveer Singh Vasant',
        roll_no: '071/CSE2/2023',
        enrollment_no: '07113202723',
        course_name: 'B.Tech CSE',
        semester: 4,
        section: 'CSE-2',
        current_cgpa: 8.78
      };
    }

    // Ward attendance
    const attRec = db.prepare(`
      SELECT 
        COUNT(*) as total,
        SUM(CASE WHEN ar.status = 'Present' THEN 1 ELSE 0 END) as present,
        SUM(CASE WHEN ar.status = 'Late' THEN 1 ELSE 0 END) as late,
        SUM(CASE WHEN ar.status = 'Absent' THEN 1 ELSE 0 END) as absent
      FROM attendance_records ar
      WHERE ar.student_id = ?
    `).get(activeWard.student_id);

    const total = attRec ? attRec.total : 0;
    const attended = (attRec ? attRec.present : 0) + ((attRec ? attRec.late : 0) * 0.5);
    const attPct = total > 0 ? Number(((attended / total) * 100).toFixed(1)) : 88.0;

    // Ward fee payment
    const feePayment = db.prepare(`
      SELECT sfp.*, fs.total_amount, fs.due_date
      FROM student_fee_payments sfp
      JOIN fee_structures fs ON sfp.fee_structure_id = fs.id
      WHERE sfp.student_id = ?
      ORDER BY sfp.id DESC LIMIT 1
    `).get(activeWard.student_id);

    // Latest marks
    const recentMarks = db.prepare(`
      SELECT em.*, sub.code as subject_code, sub.name as subject_name
      FROM exam_marks em
      JOIN subjects sub ON em.subject_id = sub.id
      WHERE em.student_id = ?
      LIMIT 4
    `).all(activeWard.student_id);

    const recentNotices = db.prepare('SELECT * FROM notices WHERE target_audience IN ("All", "Parents") ORDER BY is_pinned DESC, created_at DESC LIMIT 3').all();

    return res.json({
      role: 'parent',
      linked_wards: linkedWards,
      active_ward: activeWard,
      stats: {
        live_attendance: attPct,
        is_attendance_risk: attPct < 75.0,
        total_classes: total,
        classes_attended: attended,
        classes_absent: attRec ? attRec.absent : 0,
        fee_status: feePayment ? feePayment.status : 'Paid',
        fee_due_amount: feePayment ? feePayment.amount_due : 0,
        fee_payment_id: feePayment ? feePayment.id : null,
        fee_due_date: feePayment ? feePayment.due_date : null
      },
      recent_marks: recentMarks,
      recent_notices: recentNotices
    });
  }

  res.status(400).json({ error: 'Unknown role' });
});

// GET /api/dashboard/notifications - Notification center
router.get('/notifications', verifyToken, (req, res) => {
  const notifications = db.prepare(`
    SELECT * FROM notifications 
    WHERE user_id = ?
    ORDER BY created_at DESC 
    LIMIT 20
  `).all(req.user.id);

  const unreadCount = db.prepare(`
    SELECT COUNT(*) as count 
    FROM notifications 
    WHERE user_id = ? AND is_read = 0
  `).get(req.user.id).count;

  res.json({
    notifications,
    unread_count: unreadCount
  });
});

// PUT /api/dashboard/notifications/mark-read - Mark notifications read
router.put('/notifications/mark-read', verifyToken, (req, res) => {
  const { id } = req.body;
  if (id) {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE id = ? AND user_id = ?').run(id, req.user.id);
  } else {
    db.prepare('UPDATE notifications SET is_read = 1 WHERE user_id = ?').run(req.user.id);
  }
  res.json({ message: 'Notifications marked as read' });
});

module.exports = router;
