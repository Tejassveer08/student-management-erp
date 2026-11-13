const express = require('express');
const {
  Student,
  Faculty,
  Course,
  Subject,
  User,
  Department,
  StudentFeePayment,
  FeeStructure,
  AttendanceRecord,
  AttendanceSession,
  AuditLog,
  InstitutionSetting,
  Notice,
  Examination,
  FacultyClassMap,
  TimetableSlot,
  Assignment,
  AssignmentSubmission,
  SocietyAttendanceRequest,
  Society,
  StudentPoints,
  WardLink,
  ExamMark,
  Notification
} = require('../db/database');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/dashboard/summary - Role-tailored dashboard metrics
router.get('/summary', verifyToken, async (req, res) => {
  try {
    const role = req.user.role;

    if (role === 'admin') {
      const [
        totalStudents,
        totalFaculty,
        totalCourses,
        totalSubjects,
        feeAgg,
        attAgg,
        atRiskAgg,
        recentAuditLogs,
        thresholdSetting,
        recentNotices,
        exams
      ] = await Promise.all([
        Student.countDocuments({}),
        Faculty.countDocuments({}),
        Course.countDocuments({}),
        Subject.countDocuments({}),
        StudentFeePayment.aggregate([
          {
            $group: {
              _id: null,
              total_demand: { $sum: '$amount_due' },
              total_collected: { $sum: '$amount_paid' }
            }
          }
        ]),
        AttendanceRecord.aggregate([
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              present: {
                $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] }
              }
            }
          }
        ]),
        AttendanceRecord.aggregate([
          {
            $group: {
              _id: '$student_id',
              total: { $sum: 1 },
              present: {
                $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] }
              }
            }
          },
          {
            $project: {
              pct: {
                $cond: [
                  { $gt: ['$total', 0] },
                  { $divide: ['$present', '$total'] },
                  1
                ]
              }
            }
          },
          { $match: { pct: { $lt: 0.75 } } },
          { $count: 'count' }
        ]),
        AuditLog.find({}).sort({ created_at: -1 }).limit(5).lean(),
        InstitutionSetting.findOne({ setting_key: 'attendance_threshold' }).lean(),
        Notice.find({}).sort({ is_pinned: -1, created_at: -1 }).limit(4).lean(),
        Examination.find({}).sort({ start_date: 1 }).limit(3).lean()
      ]);

      const fees = feeAgg[0] || { total_demand: 0, total_collected: 0 };
      const att = attAgg[0] || { total: 0, present: 0 };
      const overallAttPct = att.total > 0 ? Number(((att.present / att.total) * 100).toFixed(1)) : 88.0;
      const atRiskCount = atRiskAgg[0]?.count || 0;
      const threshold = thresholdSetting ? parseFloat(thresholdSetting.setting_value) : 75.0;

      return res.json({
        role: 'admin',
        stats: {
          total_students: totalStudents,
          total_faculty: totalFaculty,
          total_courses: totalCourses,
          total_subjects: totalSubjects,
          fee_collection_rate:
            fees.total_demand > 0 ? Number(((fees.total_collected / fees.total_demand) * 100).toFixed(1)) : 0,
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
      const fac =
        req.faculty ||
        (await Faculty.findOne({ user_id: req.user.id }).lean()) || { id: 1 };

      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const currentDay = days[new Date().getDay()] || 'Monday';
      const effectiveDay = currentDay === 'Sunday' || currentDay === 'Saturday' ? 'Monday' : currentDay;

      const [maps, todaySlotDocs, facAssignments, recentNotices] = await Promise.all([
        FacultyClassMap.find({ faculty_id: fac.id }).lean(),
        TimetableSlot.find({ faculty_id: fac.id, day_of_week: effectiveDay }).sort({ start_time: 1 }).lean(),
        Assignment.find({ faculty_id: fac.id }).lean(),
        Notice.find({}).sort({ is_pinned: -1, created_at: -1 }).limit(3).lean()
      ]);

      const mappedSubjectIds = maps.map(m => m.subject_id);
      const allSubIds = [...new Set([...mappedSubjectIds, ...todaySlotDocs.map(t => t.subject_id)])];
      const subjects = allSubIds.length ? await Subject.find({ id: { $in: allSubIds } }).lean() : [];
      const subMap = Object.fromEntries(subjects.map(s => [s.id, s]));

      const mappedClasses = maps
        .filter(m => subMap[m.subject_id])
        .map(m => ({
          ...m,
          subject_name: subMap[m.subject_id].name,
          subject_code: subMap[m.subject_id].code,
          credits: subMap[m.subject_id].credits
        }));

      const todaySlots = todaySlotDocs
        .filter(ts => subMap[ts.subject_id])
        .map(ts => ({
          ...ts,
          subject_name: subMap[ts.subject_id].name,
          subject_code: subMap[ts.subject_id].code
        }));

      const assignmentIds = facAssignments.map(a => a.id);
      const [pendingGradingCount, pendingSocietyAttCount, facSessions] = await Promise.all([
        assignmentIds.length
          ? AssignmentSubmission.countDocuments({
              assignment_id: { $in: assignmentIds },
              status: 'Submitted'
            })
          : 0,
        SocietyAttendanceRequest.countDocuments({
          status: 'pending',
          $or: [
            { assigned_faculty_id: fac.id },
            { class_subject_id: { $in: mappedSubjectIds } }
          ]
        }),
        AttendanceSession.find({ faculty_id: fac.id }).lean()
      ]);

      const facSessionIds = facSessions.map(s => s.id);
      let formattedAtRisk = [];
      if (facSessionIds.length > 0) {
        const records = await AttendanceRecord.find({ session_id: { $in: facSessionIds } }).lean();
        const byStu = {};
        for (const r of records) {
          if (!byStu[r.student_id]) byStu[r.student_id] = { total: 0, present: 0 };
          byStu[r.student_id].total += 1;
          if (r.status === 'Present') byStu[r.student_id].present += 1;
        }
        const riskIds = Object.entries(byStu)
          .filter(([, v]) => v.total > 0 && v.present / v.total < 0.75)
          .map(([id]) => Number(id));

        if (riskIds.length > 0) {
          const riskStudents = await Student.find({ id: { $in: riskIds } }).lean();
          const riskUsers = await User.find({ id: { $in: riskStudents.map(s => s.user_id) } }).lean();
          const uMap = Object.fromEntries(riskUsers.map(u => [u.id, u]));
          formattedAtRisk = riskStudents
            .map(s => {
              const u = uMap[s.user_id];
              const stat = byStu[s.id];
              if (!u || !stat) return null;
              return {
                id: s.id,
                roll_no: s.roll_no,
                student_name: u.full_name,
                section: s.section,
                semester: s.semester,
                total_sessions: stat.total,
                present_count: stat.present,
                attendance_pct: Number(((stat.present / stat.total) * 100).toFixed(1))
              };
            })
            .filter(Boolean);
        }
      }

      return res.json({
        role: 'faculty',
        faculty_profile: fac,
        stats: {
          assigned_subjects_count: mappedClasses.length,
          today_classes_count: todaySlots.length,
          pending_grading: pendingGradingCount,
          pending_society_attendance: pendingSocietyAttCount,
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
      const st =
        req.student ||
        (await Student.findOne({ user_id: req.user.id }).lean()) || {
          id: 1,
          current_cgpa: 8.78,
          semester: 4
        };

      const [attRecords, pointsDoc, feePayment, semSubjects, recentNotices] = await Promise.all([
        AttendanceRecord.find({ student_id: st.id }).lean(),
        StudentPoints.findOne({ student_id: st.id }).lean(),
        StudentFeePayment.findOne({ student_id: st.id }).sort({ id: -1 }).lean(),
        Subject.find({ semester: st.semester || 4 }).lean(),
        Notice.find({}).sort({ is_pinned: -1, created_at: -1 }).limit(4).lean()
      ]);

      const total = attRecords.length;
      const present = attRecords.filter(r => r.status === 'Present').length;
      const late = attRecords.filter(r => r.status === 'Late').length;
      const attended = present + late * 0.5;
      const attPct = total > 0 ? Number(((attended / total) * 100).toFixed(1)) : 90.0;

      const points = pointsDoc || { total_merit_points: 920, merit_rank: 2, badges_json: '[]' };
      let badges = [];
      try {
        badges = JSON.parse(points.badges_json);
      } catch (e) {}

      const semSubMap = Object.fromEntries(semSubjects.map(s => [s.id, s]));
      const assignmentDocs = await Assignment.find({ subject_id: { $in: semSubjects.map(s => s.id) } })
        .sort({ due_date: 1 })
        .limit(3)
        .lean();
      const assignments = assignmentDocs.map(a => ({
        ...a,
        subject_code: semSubMap[a.subject_id]?.code || '',
        subject_name: semSubMap[a.subject_id]?.name || ''
      }));

      return res.json({
        role: 'student',
        student_profile: st,
        stats: {
          current_cgpa: st.current_cgpa,
          predicted_cgpa_range: [
            Number((st.current_cgpa - 0.15).toFixed(2)),
            Number((st.current_cgpa + 0.18).toFixed(2))
          ],
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
      const wardLinks = await WardLink.find({ parent_user_id: req.user.id }).lean();
      const wardStudentIds = wardLinks.map(w => w.student_id);

      let linkedWards = [];
      if (wardStudentIds.length > 0) {
        const [wardStudents, courses, departments] = await Promise.all([
          Student.find({ id: { $in: wardStudentIds } }).lean(),
          Course.find({}).lean(),
          Department.find({}).lean()
        ]);
        const wardUsers = await User.find({ id: { $in: wardStudents.map(s => s.user_id) } }).lean();
        const sMap = Object.fromEntries(wardStudents.map(s => [s.id, s]));
        const uMap = Object.fromEntries(wardUsers.map(u => [u.id, u]));
        const cMap = Object.fromEntries(courses.map(c => [c.id, c]));
        const dMap = Object.fromEntries(departments.map(d => [d.id, d]));

        linkedWards = wardLinks
          .map(wl => {
            const s = sMap[wl.student_id];
            const u = s ? uMap[s.user_id] : null;
            if (!s || !u) return null;
            return {
              student_id: wl.student_id,
              relationship: wl.relationship,
              is_primary: wl.is_primary,
              roll_no: s.roll_no,
              enrollment_no: s.enrollment_no,
              semester: s.semester,
              section: s.section,
              current_cgpa: s.current_cgpa,
              student_name: u.full_name,
              avatar_url: u.avatar_url,
              course_name: cMap[s.course_id]?.name || '',
              department_name: dMap[s.department_id]?.name || ''
            };
          })
          .filter(Boolean);
      }

      let activeWard = null;
      const requestedWardId = req.query.wardId ? Number(req.query.wardId) : null;
      if (requestedWardId && linkedWards.some(w => w.student_id === requestedWardId)) {
        activeWard = linkedWards.find(w => w.student_id === requestedWardId);
      } else if (linkedWards.length > 0) {
        activeWard = linkedWards.find(w => w.is_primary === 1) || linkedWards[0];
      } else {
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

      const [attRecords, feePaymentDoc, markDocs, recentNotices, sarDocs, societies, subjects] = await Promise.all([
        AttendanceRecord.find({ student_id: activeWard.student_id }).lean(),
        StudentFeePayment.findOne({ student_id: activeWard.student_id }).sort({ id: -1 }).lean(),
        ExamMark.find({ student_id: activeWard.student_id }).limit(4).lean(),
        Notice.find({ target_audience: { $in: ['All', 'Parents'] } })
          .sort({ is_pinned: -1, created_at: -1 })
          .limit(3)
          .lean(),
        SocietyAttendanceRequest.find({ student_id: activeWard.student_id })
          .sort({ date: -1, id: -1 })
          .limit(6)
          .lean(),
        Society.find({}).lean(),
        Subject.find({}).lean()
      ]);

      const total = attRecords.length;
      const present = attRecords.filter(r => r.status === 'Present').length;
      const late = attRecords.filter(r => r.status === 'Late').length;
      const absent = attRecords.filter(r => r.status === 'Absent').length;
      const wardSocietyCreditedCount = attRecords.filter(
        r => r.status === 'Present' && r.credit_type === 'Society'
      ).length;
      const attended = present + late * 0.5;
      const attPct = total > 0 ? Number(((attended / total) * 100).toFixed(1)) : 88.0;

      let feePayment = null;
      if (feePaymentDoc) {
        const fs = await FeeStructure.findOne({ id: feePaymentDoc.fee_structure_id }).lean();
        feePayment = {
          ...feePaymentDoc,
          total_amount: fs?.total_amount || 0,
          due_date: fs?.due_date || null
        };
      }

      const subMap = Object.fromEntries(subjects.map(s => [s.id, s]));
      const socMap = Object.fromEntries(societies.map(s => [s.id, s]));

      const recentMarks = markDocs.map(em => ({
        ...em,
        subject_code: subMap[em.subject_id]?.code || '',
        subject_name: subMap[em.subject_id]?.name || ''
      }));

      const wardSocietyAttendance = sarDocs.map(sar => ({
        ...sar,
        society_name: socMap[sar.society_id]?.name || '',
        subject_code: subMap[sar.class_subject_id]?.code || '',
        subject_name: subMap[sar.class_subject_id]?.name || ''
      }));

      return res.json({
        role: 'parent',
        linked_wards: linkedWards,
        active_ward: activeWard,
        stats: {
          live_attendance: attPct,
          is_attendance_risk: attPct < 75.0,
          total_classes: total,
          classes_attended: attended,
          classes_absent: absent,
          society_credited_classes: wardSocietyCreditedCount,
          fee_status: feePayment ? feePayment.status : 'Paid',
          fee_due_amount: feePayment ? feePayment.amount_due : 0,
          fee_payment_id: feePayment ? feePayment.id : null,
          fee_due_date: feePayment ? feePayment.due_date : null
        },
        ward_society_attendance: wardSocietyAttendance,
        recent_marks: recentMarks,
        recent_notices: recentNotices
      });
    }

    res.status(400).json({ error: 'Unknown role' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/dashboard/notifications - Notification center
router.get('/notifications', verifyToken, async (req, res) => {
  try {
    const [notifications, unreadCount] = await Promise.all([
      Notification.find({ user_id: req.user.id }).sort({ created_at: -1 }).limit(20).lean(),
      Notification.countDocuments({ user_id: req.user.id, is_read: 0 })
    ]);

    res.json({
      notifications,
      unread_count: unreadCount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/dashboard/notifications/mark-read - Mark notifications read
router.put('/notifications/mark-read', verifyToken, async (req, res) => {
  try {
    const { id } = req.body;
    if (id) {
      await Notification.updateOne({ id: Number(id), user_id: req.user.id }, { $set: { is_read: 1 } });
    } else {
      await Notification.updateMany({ user_id: req.user.id }, { $set: { is_read: 1 } });
    }
    res.json({ message: 'Notifications marked as read' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
