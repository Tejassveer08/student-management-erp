const express = require('express');
const {
  Society,
  SocietyMember,
  SocietyAttendanceRequest,
  Student,
  Faculty,
  User,
  Subject,
  WardLink,
  FacultyClassMap,
  ForumThread,
  ForumPost,
  Notification,
  getNextId
} = require('../db/database');
const { verifyToken, requirePermission, requireRoles, logAudit } = require('../middleware/authMiddleware');
const { findOwningFacultyId, facultyTeachesSubject, applySocietyCredit } = require('../services/attendanceCredit');

const router = express.Router();

async function createNotification(userId, title, message, linkUrl) {
  if (!userId) return;
  try {
    const id = await getNextId('notifications');
    await Notification.create({
      id,
      user_id: userId,
      title,
      message,
      type: 'general',
      link_url: linkUrl || '/societies',
      is_read: 0
    });
  } catch (err) {
    console.warn('Notification insert skipped:', err.message);
  }
}

// GET /api/societies - List all GTBIT societies with coordinator & membership info
router.get('/', verifyToken, requirePermission('societies', 'read'), async (req, res) => {
  try {
    const [societies, allMembers] = await Promise.all([
      Society.find({}).sort({ name: 1 }).lean(),
      SocietyMember.find({}).lean()
    ]);

    const coordStuIds = [...new Set(societies.map(s => s.coordinator_student_id).filter(Boolean))];
    const coordFacIds = [...new Set(societies.map(s => s.coordinator_faculty_id).filter(Boolean))];

    const [coordStudents, coordFaculties] = await Promise.all([
      coordStuIds.length ? Student.find({ id: { $in: coordStuIds } }).lean() : [],
      coordFacIds.length ? Faculty.find({ id: { $in: coordFacIds } }).lean() : []
    ]);

    const userIds = [
      ...new Set([
        ...coordStudents.map(s => s.user_id),
        ...coordFaculties.map(f => f.user_id)
      ])
    ];
    const users = userIds.length ? await User.find({ id: { $in: userIds } }).lean() : [];

    const stuMap = Object.fromEntries(coordStudents.map(s => [s.id, s]));
    const facMap = Object.fromEntries(coordFaculties.map(f => [f.id, f]));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const approvedCounts = {};
    const pendingCounts = {};
    const myMemberships = {};

    for (const m of allMembers) {
      if (m.status === 'approved') approvedCounts[m.society_id] = (approvedCounts[m.society_id] || 0) + 1;
      if (m.status === 'pending') pendingCounts[m.society_id] = (pendingCounts[m.society_id] || 0) + 1;
      if (req.student && m.student_id === req.student.id) {
        myMemberships[m.society_id] = m;
      }
    }

    const enriched = societies.map(s => {
      const cs = s.coordinator_student_id ? stuMap[s.coordinator_student_id] : null;
      const csu = cs ? userMap[cs.user_id] : null;
      const cf = s.coordinator_faculty_id ? facMap[s.coordinator_faculty_id] : null;
      const cfu = cf ? userMap[cf.user_id] : null;
      return {
        ...s,
        coordinator_student_roll: cs ? cs.roll_no : null,
        coordinator_student_name: csu ? csu.full_name : null,
        coordinator_student_email: csu ? csu.email : null,
        coordinator_faculty_name: cfu ? cfu.full_name : null,
        approved_member_count: approvedCounts[s.id] || 0,
        pending_applications_count: pendingCounts[s.id] || 0,
        my_membership: myMemberships[s.id] || null,
        is_coordinator: !!(req.student && s.coordinator_student_id === req.student.id)
      };
    });

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/societies/:id - Admin updates society description, category, or coordinators
router.put('/:id', verifyToken, requireRoles('admin'), async (req, res) => {
  try {
    const societyId = Number(req.params.id);
    const existing = await Society.findOne({ id: societyId }).lean();
    if (!existing) return res.status(404).json({ error: 'Society not found' });

    const { description, category, coordinatorStudentId, coordinatorFacultyId } = req.body;

    const updates = {
      coordinator_student_id:
        coordinatorStudentId !== undefined
          ? (coordinatorStudentId ? Number(coordinatorStudentId) : null)
          : existing.coordinator_student_id,
      coordinator_faculty_id:
        coordinatorFacultyId !== undefined
          ? (coordinatorFacultyId ? Number(coordinatorFacultyId) : null)
          : existing.coordinator_faculty_id
    };
    if (description !== undefined && description !== null) updates.description = description;
    if (category !== undefined && category !== null) updates.category = category;

    await Society.updateOne({ id: societyId }, { $set: updates });

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      userEmail: req.user.email,
      action: 'SOCIETY_UPDATED',
      entityType: 'societies',
      entityId: societyId,
      oldValue: existing,
      newValue: req.body,
      reason: 'Admin society configuration update',
      ipAddress: req.ip
    });

    res.json({ message: 'Society updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/societies/:id/apply - Student applies to join a society
router.post('/:id/apply', verifyToken, requirePermission('societies', 'apply'), async (req, res) => {
  try {
    if (!req.student) return res.status(403).json({ error: 'Student profile required to apply' });

    const societyId = Number(req.params.id);
    const society = await Society.findOne({ id: societyId }).lean();
    if (!society) return res.status(404).json({ error: 'Society not found' });

    const existing = await SocietyMember.findOne({
      society_id: societyId,
      student_id: req.student.id
    }).lean();
    if (existing && existing.status === 'approved') {
      return res.status(400).json({ error: 'You are already an approved member of this society' });
    }

    const message =
      (req.body.applicationMessage || '').trim() ||
      'Interested in joining and contributing to society activities.';
    const now = new Date().toISOString();

    if (existing) {
      await SocietyMember.updateOne(
        { id: existing.id },
        {
          $set: {
            status: 'pending',
            application_message: message,
            applied_at: now,
            decided_at: null,
            decided_by: null
          }
        }
      );
    } else {
      const id = await getNextId('society_members');
      await SocietyMember.create({
        id,
        society_id: societyId,
        student_id: req.student.id,
        status: 'pending',
        application_message: message,
        applied_at: now,
        decided_at: null,
        decided_by: null
      });
    }

    if (society.coordinator_student_id) {
      const coord = await Student.findOne({ id: society.coordinator_student_id }).lean();
      if (coord) {
        await createNotification(
          coord.user_id,
          `New Application: ${society.name}`,
          `${req.user.full_name} (${req.student.roll_no}) applied to join ${society.name}.`,
          '/societies'
        );
      }
    }

    res.status(201).json({ message: `Application submitted to ${society.name}`, status: 'pending' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/societies/:id/applications - Coordinator or Admin views membership applications
router.get('/:id/applications', verifyToken, requirePermission('societies', 'read'), async (req, res) => {
  try {
    const societyId = Number(req.params.id);
    const society = await Society.findOne({ id: societyId }).lean();
    if (!society) return res.status(404).json({ error: 'Society not found' });

    const isCoordinator = req.student && society.coordinator_student_id === req.student.id;
    if (req.user.role !== 'admin' && !isCoordinator) {
      return res.status(403).json({
        error: 'Forbidden: Only the designated student coordinator or admin can view applications.'
      });
    }

    const members = await SocietyMember.find({ society_id: societyId }).lean();
    if (members.length === 0) return res.json([]);

    const studentIds = [...new Set(members.map(m => m.student_id))];
    const students = await Student.find({ id: { $in: studentIds } }).lean();
    const users = await User.find({ id: { $in: students.map(s => s.user_id) } }).lean();

    const stuMap = Object.fromEntries(students.map(s => [s.id, s]));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const statusRank = { pending: 0, approved: 1, rejected: 2 };

    const applications = members
      .map(sm => {
        const s = stuMap[sm.student_id];
        const u = s ? userMap[s.user_id] : null;
        if (!s || !u) return null;
        return {
          ...sm,
          roll_no: s.roll_no,
          enrollment_no: s.enrollment_no,
          semester: s.semester,
          section: s.section,
          applicant_user_id: u.id,
          student_name: u.full_name,
          student_email: u.email,
          avatar_url: u.avatar_url
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const ra = statusRank[a.status] ?? 3;
        const rb = statusRank[b.status] ?? 3;
        if (ra !== rb) return ra - rb;
        return String(b.applied_at).localeCompare(String(a.applied_at));
      });

    res.json(applications);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/societies/applications/:applicationId/decide - Coordinator or Admin approves/rejects application
router.put('/applications/:applicationId/decide', verifyToken, requirePermission('societies', 'decide_membership'), async (req, res) => {
  try {
    const applicationId = Number(req.params.applicationId);
    const { status } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "approved" or "rejected"' });
    }

    const appDoc = await SocietyMember.findOne({ id: applicationId }).lean();
    if (!appDoc) return res.status(404).json({ error: 'Application not found' });

    const [soc, st] = await Promise.all([
      Society.findOne({ id: appDoc.society_id }).lean(),
      Student.findOne({ id: appDoc.student_id }).lean()
    ]);
    if (!soc || !st) return res.status(404).json({ error: 'Application not found' });

    const isCoordinator = req.student && soc.coordinator_student_id === req.student.id;
    if (req.user.role !== 'admin' && !isCoordinator) {
      return res.status(403).json({
        error: 'Forbidden: Only the designated coordinator for this society or admin can decide applications.'
      });
    }

    await SocietyMember.updateOne(
      { id: applicationId },
      {
        $set: {
          status,
          decided_at: new Date().toISOString(),
          decided_by: req.user.id
        }
      }
    );

    await createNotification(
      st.user_id,
      `Society Application ${status === 'approved' ? 'Approved' : 'Rejected'}`,
      `Your application to ${soc.name} has been ${status}.`,
      '/societies'
    );

    res.json({ message: `Application ${status}`, applicationId, status });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/societies/:id/contact - Direct-contact thread between applicant and society coordinator (reuses Forum)
router.post('/:id/contact', verifyToken, requirePermission('forum', 'create'), async (req, res) => {
  try {
    const societyId = Number(req.params.id);
    const society = await Society.findOne({ id: societyId }).lean();
    if (!society) return res.status(404).json({ error: 'Society not found' });

    const body = (req.body.message || '').trim();
    if (!body) return res.status(400).json({ error: 'Message body is required' });

    let thread = await ForumThread.findOne({
      scope: 'society',
      society_id: societyId,
      author_id: req.user.id
    })
      .sort({ id: -1 })
      .lean();

    const now = new Date().toISOString();
    if (!thread) {
      const threadId = await getNextId('forum_threads');
      thread = await ForumThread.create({
        id: threadId,
        author_id: req.user.id,
        author_role: req.user.role,
        scope: 'society',
        subject_id: null,
        society_id: societyId,
        title: `${society.name} — Applicant Inquiry (${req.user.full_name})`,
        last_activity_at: now
      });
    } else {
      await ForumThread.updateOne({ id: thread.id }, { $set: { last_activity_at: now } });
    }

    const postId = await getNextId('forum_posts');
    await ForumPost.create({
      id: postId,
      thread_id: thread.id,
      parent_post_id: null,
      author_id: req.user.id,
      author_role: req.user.role,
      body,
      is_faculty_answer: 0
    });

    if (society.coordinator_student_id) {
      const coord = await Student.findOne({ id: society.coordinator_student_id }).lean();
      if (coord && coord.user_id !== req.user.id) {
        await createNotification(
          coord.user_id,
          `Society Message: ${society.name}`,
          `${req.user.full_name} sent a message regarding ${society.name}.`,
          '/forum'
        );
      }
    }

    res.status(201).json({
      threadId: thread.id,
      postId,
      message: 'Message sent via society forum thread'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// =====================================================================
// SOCIETY-DUTY ATTENDANCE EXEMPTION REQUESTS
// =====================================================================

// GET /api/societies/attendance-requests
router.get('/attendance-requests', verifyToken, requirePermission('societies', 'read'), async (req, res) => {
  try {
    const { status, wardId } = req.query;
    const filter = {};

    if (req.user.role === 'student') {
      if (!req.student) return res.status(404).json({ error: 'Student profile not found' });
      filter.student_id = req.student.id;
    } else if (req.user.role === 'faculty') {
      if (!req.faculty) return res.status(404).json({ error: 'Faculty profile not found' });
      const maps = await FacultyClassMap.find({ faculty_id: req.faculty.id }).lean();
      const mappedSubjectIds = maps.map(m => m.subject_id);
      filter.$or = [
        { assigned_faculty_id: req.faculty.id },
        { class_subject_id: { $in: mappedSubjectIds } }
      ];
    } else if (req.user.role === 'parent') {
      let targetWardId = wardId ? Number(wardId) : null;
      if (targetWardId) {
        const isWard = await WardLink.findOne({
          parent_user_id: req.user.id,
          student_id: targetWardId
        }).lean();
        if (!isWard) return res.status(403).json({ error: 'Access denied to this ward' });
      } else {
        const firstWard = await WardLink.findOne({ parent_user_id: req.user.id })
          .sort({ is_primary: -1 })
          .lean();
        if (!firstWard) return res.json([]);
        targetWardId = firstWard.student_id;
      }
      filter.student_id = targetWardId;
    }

    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      filter.status = status;
    }

    const reqs = await SocietyAttendanceRequest.find(filter).lean();
    if (reqs.length === 0) return res.json([]);

    const societyIds = [...new Set(reqs.map(r => r.society_id))];
    const subjectIds = [...new Set(reqs.map(r => r.class_subject_id))];
    const studentIds = [...new Set(reqs.map(r => r.student_id))];
    const facultyIds = [
      ...new Set([
        ...reqs.map(r => r.assigned_faculty_id).filter(Boolean),
        ...reqs.map(r => r.reviewed_by_faculty_id).filter(Boolean)
      ])
    ];

    const [societies, subjects, students, faculties] = await Promise.all([
      Society.find({ id: { $in: societyIds } }).lean(),
      Subject.find({ id: { $in: subjectIds } }).lean(),
      Student.find({ id: { $in: studentIds } }).lean(),
      facultyIds.length ? Faculty.find({ id: { $in: facultyIds } }).lean() : []
    ]);

    const userIds = [
      ...new Set([
        ...students.map(s => s.user_id),
        ...faculties.map(f => f.user_id)
      ])
    ];
    const users = userIds.length ? await User.find({ id: { $in: userIds } }).lean() : [];

    const socMap = Object.fromEntries(societies.map(s => [s.id, s]));
    const subMap = Object.fromEntries(subjects.map(s => [s.id, s]));
    const stuMap = Object.fromEntries(students.map(s => [s.id, s]));
    const facMap = Object.fromEntries(faculties.map(f => [f.id, f]));
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const rows = reqs
      .map(sar => {
        const soc = socMap[sar.society_id];
        const sub = subMap[sar.class_subject_id];
        const s = stuMap[sar.student_id];
        const su = s ? userMap[s.user_id] : null;
        if (!soc || !sub || !s || !su) return null;
        const af = sar.assigned_faculty_id ? facMap[sar.assigned_faculty_id] : null;
        const afu = af ? userMap[af.user_id] : null;
        const rf = sar.reviewed_by_faculty_id ? facMap[sar.reviewed_by_faculty_id] : null;
        const rfu = rf ? userMap[rf.user_id] : null;

        return {
          ...sar,
          society_name: soc.name,
          subject_code: sub.code,
          subject_name: sub.name,
          roll_no: s.roll_no,
          enrollment_no: s.enrollment_no,
          semester: s.semester,
          section: s.section,
          student_name: su.full_name,
          assigned_faculty_name: afu ? afu.full_name : null,
          reviewed_by_faculty_name: rfu ? rfu.full_name : null
        };
      })
      .filter(Boolean)
      .sort((a, b) => {
        const pa = a.status === 'pending' ? 0 : 1;
        const pb = b.status === 'pending' ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return String(b.created_at).localeCompare(String(a.created_at));
      });

    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/societies/attendance-requests - Student submits society-duty exemption request
router.post('/attendance-requests', verifyToken, requirePermission('societies', 'request_attendance'), async (req, res) => {
  try {
    if (!req.student) return res.status(403).json({ error: 'Student profile required' });

    const { societyId, classSubjectId, date, sessionPeriod, activityTitle, reason } = req.body;
    if (!societyId || !classSubjectId || !date || !activityTitle) {
      return res.status(400).json({ error: 'Society, subject, date, and activity title are required' });
    }

    const [society, subject] = await Promise.all([
      Society.findOne({ id: Number(societyId) }).lean(),
      Subject.findOne({ id: Number(classSubjectId) }).lean()
    ]);

    if (!society) return res.status(404).json({ error: 'Society not found' });
    if (!subject) return res.status(404).json({ error: 'Subject not found' });

    const assignedFacultyId = await findOwningFacultyId(subject.id, req.student.semester, req.student.section);

    const id = await getNextId('society_attendance_requests');
    await SocietyAttendanceRequest.create({
      id,
      student_id: req.student.id,
      society_id: society.id,
      class_subject_id: subject.id,
      date,
      session_period: sessionPeriod || null,
      activity_title: activityTitle.trim(),
      reason: (reason || '').trim() || null,
      status: 'pending',
      assigned_faculty_id: assignedFacultyId
    });

    if (assignedFacultyId) {
      const fac = await Faculty.findOne({ id: assignedFacultyId }).lean();
      if (fac) {
        await createNotification(
          fac.user_id,
          `Society Duty Request: ${subject.code}`,
          `${req.user.full_name} (${req.student.roll_no}) requested society attendance exemption for ${society.name} on ${date}.`,
          '/societies'
        );
      }
    }

    res.status(201).json({
      id,
      status: 'pending',
      assignedFacultyId,
      message: `Society duty request submitted for ${subject.code} and routed to subject faculty.`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/societies/attendance-requests/:id/decide - Faculty or Admin approves/rejects request
router.put('/attendance-requests/:id/decide', verifyToken, requirePermission('societies', 'decide_attendance'), async (req, res) => {
  try {
    const reqId = Number(req.params.id);
    const { status, remarks } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be "approved" or "rejected"' });
    }

    const sar = await SocietyAttendanceRequest.findOne({ id: reqId }).lean();
    if (!sar) return res.status(404).json({ error: 'Society attendance request not found' });

    const [sub, soc, st] = await Promise.all([
      Subject.findOne({ id: sar.class_subject_id }).lean(),
      Society.findOne({ id: sar.society_id }).lean(),
      Student.findOne({ id: sar.student_id }).lean()
    ]);

    let reviewerFacultyId = null;
    if (req.user.role === 'faculty') {
      if (!req.faculty) return res.status(403).json({ error: 'Faculty profile not found' });
      const teaches = await facultyTeachesSubject(req.faculty.id, sar.class_subject_id);
      const allowed = sar.assigned_faculty_id === req.faculty.id || teaches;
      if (!allowed) {
        return res.status(403).json({
          error: 'Forbidden: You can only review society attendance requests for subjects you teach.'
        });
      }
      reviewerFacultyId = req.faculty.id;
    }

    await SocietyAttendanceRequest.updateOne(
      { id: reqId },
      {
        $set: {
          status,
          reviewed_by_faculty_id: reviewerFacultyId,
          reviewer_remarks: remarks || null,
          reviewed_at: new Date().toISOString()
        }
      }
    );

    let sessionsCredited = 0;
    if (status === 'approved') {
      sessionsCredited = await applySocietyCredit(reqId);
    }

    if (st && soc && sub) {
      await createNotification(
        st.user_id,
        `Society Attendance ${status === 'approved' ? 'Approved' : 'Rejected'}`,
        `Your ${soc.name} duty request for ${sub.code} on ${sar.date} was ${status}.`,
        '/societies'
      );
    }

    res.json({
      id: reqId,
      status,
      sessionsCredited,
      message:
        status === 'approved'
          ? `Approved! Marked Present (Society Duty) for ${sessionsCredited} matching session(s).`
          : 'Society attendance request rejected.'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
