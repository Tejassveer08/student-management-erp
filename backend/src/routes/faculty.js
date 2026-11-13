const express = require('express');
const bcrypt = require('bcryptjs');
const {
  Faculty,
  User,
  Department,
  Subject,
  FacultyClassMap,
  TimetableSlot,
  getNextId
} = require('../db/database');
const { verifyToken, requirePermission, logAudit } = require('../middleware/authMiddleware');

const router = express.Router();
const DAY_ORDER = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };

// GET /api/faculty
router.get('/', verifyToken, requirePermission('faculty', 'read'), async (req, res) => {
  const [facultyList, users, depts, subjects, maps, slots] = await Promise.all([
    Faculty.find().sort({ employee_id: 1 }).lean(),
    User.find({ role: 'faculty' }, 'id full_name email phone avatar_url').lean(),
    Department.find().lean(),
    Subject.find().lean(),
    FacultyClassMap.find().lean(),
    TimetableSlot.find({}, 'faculty_id').lean()
  ]);

  const uMap = Object.fromEntries(users.map(u => [u.id, u]));
  const dMap = Object.fromEntries(depts.map(d => [d.id, d]));
  const subMap = Object.fromEntries(subjects.map(s => [s.id, s]));

  const facultyWithSubjects = facultyList.map(fac => {
    const u = uMap[fac.user_id] || {};
    const d = dMap[fac.department_id] || {};
    const facMaps = maps.filter(m => m.faculty_id === fac.id);
    const seen = new Set();
    const assigned_subjects = [];

    for (const m of facMaps) {
      const s = subMap[m.subject_id];
      if (s) {
        seen.add(s.id);
        assigned_subjects.push({
          id: s.id, code: s.code, name: s.name, credits: s.credits, semester: s.semester, type: s.type,
          section: m.section, mapped_semester: m.semester
        });
      }
    }
    for (const s of subjects) {
      if (s.faculty_id === fac.id && !seen.has(s.id)) {
        assigned_subjects.push({
          id: s.id, code: s.code, name: s.name, credits: s.credits, semester: s.semester, type: s.type,
          section: null, mapped_semester: null
        });
      }
    }

    return {
      ...fac,
      full_name: u.full_name,
      email: u.email,
      phone: u.phone,
      avatar_url: u.avatar_url,
      department_name: d.name,
      department_code: d.code,
      assigned_subjects,
      scheduled_slots_count: slots.filter(sl => sl.faculty_id === fac.id).length
    };
  });

  res.json(facultyWithSubjects);
});

// GET /api/faculty/:id
router.get('/:id', verifyToken, requirePermission('faculty', 'read'), async (req, res) => {
  const facId = Number(req.params.id);
  const fac = await Faculty.findOne({ id: facId }).lean();
  if (!fac) return res.status(404).json({ error: 'Faculty member not found' });

  const [u, d, maps, slots, subjects] = await Promise.all([
    User.findOne({ id: fac.user_id }, 'full_name email phone avatar_url').lean(),
    Department.findOne({ id: fac.department_id }).lean(),
    FacultyClassMap.find({ faculty_id: fac.id }).lean(),
    TimetableSlot.find({ faculty_id: fac.id }).lean(),
    Subject.find().lean()
  ]);

  const subMap = Object.fromEntries(subjects.map(s => [s.id, s]));
  const assigned_classes = maps.map(m => ({
    ...m,
    subject_name: subMap[m.subject_id]?.name,
    subject_code: subMap[m.subject_id]?.code,
    credits: subMap[m.subject_id]?.credits
  }));

  const timetable = slots.map(ts => ({
    ...ts,
    subject_name: subMap[ts.subject_id]?.name,
    subject_code: subMap[ts.subject_id]?.code
  })).sort((a, b) => {
    const dDiff = (DAY_ORDER[a.day_of_week] || 9) - (DAY_ORDER[b.day_of_week] || 9);
    return dDiff !== 0 ? dDiff : String(a.start_time).localeCompare(String(b.start_time));
  });

  res.json({
    ...fac,
    full_name: u?.full_name,
    email: u?.email,
    phone: u?.phone,
    avatar_url: u?.avatar_url,
    department_name: d?.name,
    department_code: d?.code,
    assigned_classes,
    timetable
  });
});

// POST /api/faculty
router.post('/', verifyToken, requirePermission('faculty', 'create'), async (req, res) => {
  const { fullName, email, phone, employeeId, departmentId, designation, qualification, weeklyWorkloadHours, officeRoom } = req.body;
  if (!fullName || !email || !employeeId) {
    return res.status(400).json({ error: 'Full name, email, and employee ID are required' });
  }

  const defaultPass = bcrypt.hashSync('faculty123', bcrypt.genSaltSync(10));
  try {
    const userId = await getNextId('users');
    await User.create({
      id: userId,
      email: email.toLowerCase().trim(),
      password_hash: defaultPass,
      role: 'faculty',
      full_name: fullName,
      phone: phone || null,
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'
    });

    const facId = await getNextId('faculty');
    await Faculty.create({
      id: facId,
      user_id: userId,
      employee_id: employeeId,
      department_id: departmentId || 1,
      designation: designation || 'Assistant Professor',
      qualification: qualification || 'M.Tech, Ph.D (Pursuing)',
      weekly_workload_hours: weeklyWorkloadHours || 16,
      office_room: officeRoom || 'Room 302',
      status: 'Active'
    });

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      userEmail: req.user.email,
      action: 'FACULTY_ONBOARD',
      entityType: 'faculty',
      entityId: facId,
      oldValue: null,
      newValue: { fullName, email, employeeId, designation },
      reason: 'New faculty member onboarding',
      ipAddress: req.ip
    });

    res.status(201).json({ message: 'Faculty registered successfully', facultyId: facId });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ error: 'A user with this email or employee ID already exists.' });
    }
    res.status(500).json({ error: err.message });
  }
});

// POST /api/faculty/assign-class
router.post('/assign-class', verifyToken, requirePermission('faculty', 'assign_classes'), async (req, res) => {
  const { facultyId, subjectId, courseId, departmentId, semester, section } = req.body;
  if (!facultyId || !subjectId || !semester || !section) {
    return res.status(400).json({ error: 'Faculty ID, Subject ID, Semester, and Section are required.' });
  }

  try {
    let mapping = await FacultyClassMap.findOne({
      faculty_id: Number(facultyId),
      subject_id: Number(subjectId),
      semester: Number(semester),
      section
    }).lean();

    let mappingId = mapping?.id || null;
    if (!mapping) {
      mappingId = await getNextId('faculty_class_map');
      await FacultyClassMap.create({
        id: mappingId,
        faculty_id: Number(facultyId),
        subject_id: Number(subjectId),
        course_id: courseId || 1,
        department_id: departmentId || 1,
        semester: Number(semester),
        section,
        academic_year: '2025-2026'
      });
    }

    await Subject.updateOne({ id: Number(subjectId) }, { $set: { faculty_id: Number(facultyId) } });

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      userEmail: req.user.email,
      action: 'FACULTY_CLASS_ASSIGNMENT',
      entityType: 'faculty_class_map',
      entityId: mappingId || `${facultyId}_${subjectId}`,
      oldValue: null,
      newValue: { facultyId, subjectId, semester, section },
      reason: 'Administrative faculty-to-class workload assignment',
      ipAddress: req.ip
    });

    res.status(201).json({ message: 'Faculty class assignment mapped successfully.', mappingId });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
