const express = require('express');
const bcrypt = require('bcryptjs');
const {
  Student,
  User,
  Course,
  Department,
  WardLink,
  FacultyClassMap,
  AttendanceRecord,
  StudentFeePayment,
  FeeStructure,
  ExamMark,
  Subject,
  Examination,
  StudentPoints,
  getNextId
} = require('../db/database');
const { verifyToken, requirePermission, logAudit } = require('../middleware/authMiddleware');

const { admitStudent } = require('../services/admissions');
const { invalidateMerit } = require('../services/merit');

const router = express.Router();

// GET /api/students - List students with DB-level scoping and filters
router.get('/', verifyToken, requirePermission('students', 'read'), async (req, res) => {
  try {
    const { search, semester, section, status, shift } = req.query;

    const filter = {};
    if (req.user.role === 'student') {
      filter.user_id = req.user.id;
    } else if (req.user.role === 'parent') {
      const wards = await WardLink.find({ parent_user_id: req.user.id }).lean();
      filter.id = { $in: wards.map(w => w.student_id) };
    } else if (req.user.role === 'faculty') {
      const facId = req.faculty ? req.faculty.id : 0;
      const maps = await FacultyClassMap.find({ faculty_id: facId }).lean();
      if (maps.length === 0) return res.json([]);
      filter.$or = maps.map(m => ({ semester: m.semester, section: m.section }));
    }

    if (semester) filter.semester = Number(semester);
    if (section) filter.section = section;
    if (status) filter.status = status;
    if (shift) filter.shift = shift;

    const [students, courses, departments] = await Promise.all([
      Student.find(filter).sort({ roll_no: 1 }).lean(),
      Course.find({}).lean(),
      Department.find({}).lean()
    ]);

    if (students.length === 0) return res.json([]);

    const userIds = [...new Set(students.map(s => s.user_id))];
    const studentIds = students.map(s => s.id);

    const [users, attAgg] = await Promise.all([
      User.find({ id: { $in: userIds } }).lean(),
      AttendanceRecord.aggregate([
        { $match: { student_id: { $in: studentIds } } },
        {
          $group: {
            _id: '$student_id',
            total_sessions: { $sum: 1 },
            present_count: { $sum: { $cond: [{ $eq: ['$status', 'Present'] }, 1, 0] } },
            late_count: { $sum: { $cond: [{ $eq: ['$status', 'Late'] }, 1, 0] } }
          }
        }
      ])
    ]);

    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));
    const deptMap = Object.fromEntries(departments.map(d => [d.id, d]));
    const attMap = Object.fromEntries(attAgg.map(a => [a._id, a]));

    const searchLower = search ? search.trim().toLowerCase() : null;

    const result = [];
    for (const st of students) {
      const u = userMap[st.user_id];
      const c = courseMap[st.course_id];
      const d = deptMap[st.department_id];
      if (!u || !c || !d) continue;

      if (searchLower) {
        const hit =
          u.full_name.toLowerCase().includes(searchLower) ||
          st.roll_no.toLowerCase().includes(searchLower) ||
          st.enrollment_no.toLowerCase().includes(searchLower) ||
          u.email.toLowerCase().includes(searchLower);
        if (!hit) continue;
      }

      const attStats = attMap[st.id] || { total_sessions: 0, present_count: 0, late_count: 0 };
      const total = attStats.total_sessions || 0;
      const attended = (attStats.present_count || 0) + (attStats.late_count ? attStats.late_count * 0.5 : 0);
      const attendancePct = total > 0 ? Number(((attended / total) * 100).toFixed(1)) : 100.0;

      result.push({
        ...st,
        full_name: u.full_name,
        email: u.email,
        phone: u.phone,
        avatar_url: u.avatar_url,
        course_name: c.name,
        course_code: c.code,
        department_name: d.name,
        department_code: d.code,
        live_attendance_pct: attendancePct,
        is_attendance_critical: attendancePct < 75.0
      });
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/students/:id - Detailed profile with DB scoping validation
router.get('/:id', verifyToken, requirePermission('students', 'read'), async (req, res) => {
  try {
    const targetId = Number(req.params.id);

    if (req.user.role === 'student') {
      if (!req.student || req.student.id !== targetId) {
        return res.status(403).json({ error: 'Access denied: Students can only view their own academic dossier.' });
      }
    } else if (req.user.role === 'parent') {
      const isLinkedWard = await WardLink.findOne({ parent_user_id: req.user.id, student_id: targetId }).lean();
      if (!isLinkedWard) {
        return res.status(403).json({ error: 'Access denied: You can only view dossiers of your own linked wards.' });
      }
    } else if (req.user.role === 'faculty') {
      const targetStudent = await Student.findOne({ id: targetId }).lean();
      if (targetStudent) {
        const isAssigned = await FacultyClassMap.findOne({
          faculty_id: req.faculty?.id,
          semester: targetStudent.semester,
          section: targetStudent.section
        }).lean();
        if (!isAssigned) {
          return res.status(403).json({ error: 'Access denied: Student is not in your assigned teaching sections.' });
        }
      }
    }

    const st = await Student.findOne({ id: targetId }).lean();
    if (!st) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const [u, c, d, p, attRecords, feeDocs, markDocs] = await Promise.all([
      User.findOne({ id: st.user_id }).lean(),
      Course.findOne({ id: st.course_id }).lean(),
      Department.findOne({ id: st.department_id }).lean(),
      st.parent_user_id ? User.findOne({ id: st.parent_user_id }).lean() : null,
      AttendanceRecord.find({ student_id: st.id }).lean(),
      StudentFeePayment.find({ student_id: st.id }).lean(),
      ExamMark.find({ student_id: st.id }).lean()
    ]);

    if (!u || !c || !d) return res.status(404).json({ error: 'Student not found' });

    const total = attRecords.length;
    const presentCount = attRecords.filter(r => r.status === 'Present').length;
    const lateCount = attRecords.filter(r => r.status === 'Late').length;
    const absentCount = attRecords.filter(r => r.status === 'Absent').length;
    const attended = presentCount + lateCount * 0.5;
    const attendancePct = total > 0 ? Number(((attended / total) * 100).toFixed(1)) : 100.0;

    const fsIds = [...new Set(feeDocs.map(f => f.fee_structure_id))];
    const subIds = [...new Set(markDocs.map(m => m.subject_id))];
    const examIds = [...new Set(markDocs.map(m => m.exam_id))];

    const [feeStructures, subjects, exams] = await Promise.all([
      fsIds.length ? FeeStructure.find({ id: { $in: fsIds } }).lean() : [],
      subIds.length ? Subject.find({ id: { $in: subIds } }).lean() : [],
      examIds.length ? Examination.find({ id: { $in: examIds } }).lean() : []
    ]);

    const fsMap = Object.fromEntries(feeStructures.map(fs => [fs.id, fs]));
    const subMap = Object.fromEntries(subjects.map(sub => [sub.id, sub]));
    const examMap = Object.fromEntries(exams.map(ex => [ex.id, ex]));

    const fees = feeDocs.map(sfp => ({
      ...sfp,
      total_amount: fsMap[sfp.fee_structure_id]?.total_amount || 0,
      academic_year: fsMap[sfp.fee_structure_id]?.academic_year || '',
      due_date: fsMap[sfp.fee_structure_id]?.due_date || null
    }));

    const marks = markDocs.map(em => ({
      ...em,
      subject_name: subMap[em.subject_id]?.name || '',
      subject_code: subMap[em.subject_id]?.code || '',
      credits: subMap[em.subject_id]?.credits || 0,
      exam_name: examMap[em.exam_id]?.name || '',
      exam_type: examMap[em.exam_id]?.exam_type || ''
    }));

    res.json({
      ...st,
      full_name: u.full_name,
      email: u.email,
      phone: u.phone,
      avatar_url: u.avatar_url,
      course_name: c.name,
      course_code: c.code,
      department_name: d.name,
      department_code: d.code,
      linked_parent_name: p ? p.full_name : null,
      linked_parent_email: p ? p.email : null,
      linked_parent_phone: p ? p.phone : null,
      attendance: {
        total_sessions: total,
        present_count: presentCount,
        late_count: lateCount,
        absent_count: absentCount,
        attendance_percentage: attendancePct,
        is_at_risk: attendancePct < 75.0
      },
      fees,
      marks
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/students - Admit a single student (login, record, fee invoice, optional guardian login)
router.post('/', verifyToken, requirePermission('students', 'create'), async (req, res) => {
  try {
    const result = await admitStudent(req.body || {});
    await logAudit({
      userId: req.user.id, userRole: req.user.role, userEmail: req.user.email,
      action: 'STUDENT_ADMISSION', entityType: 'students', entityId: result.studentId,
      newValue: { fullName: req.body.fullName, email: req.body.email, rollNo: req.body.rollNo, semester: req.body.semester, section: req.body.section, guardian: result.guardian?.email || null },
      reason: 'New student admission', ipAddress: req.ip
    });
    invalidateMerit();
    res.status(201).json({ message: 'Student admitted', ...result });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/students/batch - Bulk admission; each row is admitted independently
router.post('/batch', verifyToken, requirePermission('students', 'create'), async (req, res) => {
  const list = Array.isArray(req.body?.studentsList) ? req.body.studentsList : [];
  if (!list.length) return res.status(400).json({ error: 'studentsList must be a non-empty array' });
  if (list.length > 500) return res.status(400).json({ error: 'Admit at most 500 students per batch' });
  const admitted = [];
  const errors = [];
  for (const row of list) {
    try {
      const r = await admitStudent({ ...row, courseId: row.courseId || req.body.courseId, semester: row.semester || req.body.semester, section: row.section || req.body.section });
      admitted.push({ name: row.fullName, rollNo: row.rollNo, ...r });
    } catch (err) {
      errors.push(`${row.fullName || row.rollNo || 'Row'}: ${err.message}`);
    }
  }
  if (admitted.length) {
    await logAudit({ userId: req.user.id, userRole: req.user.role, userEmail: req.user.email, action: 'STUDENT_BATCH_ADMISSION', entityType: 'students', entityId: 'batch', newValue: { admitted: admitted.length, failed: errors.length }, reason: 'Bulk admission', ipAddress: req.ip });
    invalidateMerit();
  }
  res.status(admitted.length ? 201 : 400).json({
    message: `${admitted.length} admitted, ${errors.length} skipped`,
    insertedCount: admitted.length,
    credentials: admitted.map((a) => ({ name: a.name, rollNo: a.rollNo, ...a.loginCredentials, guardian: a.guardian })),
    errors
  });
});

// PUT /api/students/:id - Update a student record (audited)
router.put('/:id', verifyToken, requirePermission('students', 'update'), async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const { fullName, phone, semester, section, shift, currentCgpa, status, address, parentName, parentPhone, reason } = req.body;

    const student = await Student.findOne({ id: targetId }).lean();
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const user = await User.findOne({ id: student.user_id }).lean();

    const userUpdates = {};
    if (fullName !== undefined && fullName !== null) userUpdates.full_name = fullName;
    if (phone !== undefined && phone !== null) userUpdates.phone = phone;
    if (Object.keys(userUpdates).length > 0) {
      await User.updateOne({ id: student.user_id }, { $set: userUpdates });
    }

    const stuUpdates = {};
    if (semester !== undefined && semester !== null) stuUpdates.semester = Number(semester);
    if (section !== undefined && section !== null) stuUpdates.section = section;
    if (shift !== undefined && shift !== null) stuUpdates.shift = shift;
    if (currentCgpa !== undefined && currentCgpa !== null) stuUpdates.current_cgpa = Number(currentCgpa);
    if (status !== undefined && status !== null) stuUpdates.status = status;
    if (address !== undefined && address !== null) stuUpdates.address = address;
    if (parentName !== undefined && parentName !== null) stuUpdates.parent_name = parentName;
    if (parentPhone !== undefined && parentPhone !== null) stuUpdates.parent_phone = parentPhone;
    if (Object.keys(stuUpdates).length > 0) {
      await Student.updateOne({ id: targetId }, { $set: stuUpdates });
    }

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      userEmail: req.user.email,
      action: 'STUDENT_RECORD_UPDATE',
      entityType: 'students',
      entityId: targetId,
      oldValue: {
        fullName: user?.full_name,
        phone: user?.phone,
        semester: student.semester,
        section: student.section,
        currentCgpa: student.current_cgpa,
        status: student.status
      },
      newValue: { fullName, phone, semester, section, currentCgpa, status },
      reason: reason || 'Academic administration update',
      ipAddress: req.ip
    });

    res.json({ message: 'Student updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/students/:id - Delete student (Admin only with audit log)
router.delete('/:id', verifyToken, requirePermission('students', 'delete'), async (req, res) => {
  try {
    const targetId = Number(req.params.id);
    const student = await Student.findOne({ id: targetId }).lean();
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    const user = await User.findOne({ id: student.user_id }).lean();

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      userEmail: req.user.email,
      action: 'STUDENT_RECORD_DELETE',
      entityType: 'students',
      entityId: targetId,
      oldValue: { rollNo: student.roll_no, name: user?.full_name, email: user?.email },
      newValue: null,
      reason: req.body?.reason || 'Record de-registration by Admin',
      ipAddress: req.ip
    });

    await Promise.all([
      Student.deleteOne({ id: targetId }),
      User.deleteOne({ id: student.user_id }),
      WardLink.deleteMany({ student_id: targetId }),
      StudentPoints.deleteMany({ student_id: targetId })
    ]);

    res.json({ message: 'Student record deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
