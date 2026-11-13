const express = require('express');
const { Department, Course, Subject, Faculty, User, TimetableSlot, getNextId } = require('../db/database');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

const DAY_ORDER = { Monday: 1, Tuesday: 2, Wednesday: 3, Thursday: 4, Friday: 5, Saturday: 6, Sunday: 7 };

// GET /api/academics/departments
router.get('/departments', verifyToken, async (req, res) => {
  const depts = await Department.find().sort({ name: 1 }).lean();
  res.json(depts);
});

// GET /api/academics/courses
router.get('/courses', verifyToken, async (req, res) => {
  const [courses, depts] = await Promise.all([
    Course.find().sort({ name: 1 }).lean(),
    Department.find().lean()
  ]);
  const dMap = Object.fromEntries(depts.map(d => [d.id, d]));
  res.json(courses.map(c => ({
    ...c,
    department_name: dMap[c.department_id]?.name,
    department_code: dMap[c.department_id]?.code
  })));
});

// GET /api/academics/subjects
router.get('/subjects', verifyToken, async (req, res) => {
  const { semester, departmentId } = req.query;
  const filter = {};
  if (semester) filter.semester = Number(semester);

  const [subjects, courses, faculties, users] = await Promise.all([
    Subject.find(filter).sort({ code: 1 }).lean(),
    Course.find().lean(),
    Faculty.find().lean(),
    User.find({ role: 'faculty' }, 'id full_name').lean()
  ]);

  const cMap = Object.fromEntries(courses.map(c => [c.id, c]));
  const fMap = Object.fromEntries(faculties.map(f => [f.id, f]));
  const uMap = Object.fromEntries(users.map(u => [u.id, u]));

  let list = subjects;
  if (departmentId) {
    const dId = Number(departmentId);
    list = list.filter(s => cMap[s.course_id]?.department_id === dId);
  }

  res.json(list.map(s => {
    const fac = fMap[s.faculty_id];
    return {
      ...s,
      course_name: cMap[s.course_id]?.name,
      faculty_name: fac ? uMap[fac.user_id]?.full_name : null,
      faculty_employee_id: fac ? fac.employee_id : null
    };
  }));
});

// POST /api/academics/subjects
router.post('/subjects', verifyToken, requireRoles('admin'), async (req, res) => {
  const { courseId, code, name, semester, credits, type, facultyId, syllabusOutline, difficultyIndex } = req.body;
  if (!code || !name || !semester) {
    return res.status(400).json({ error: 'Subject code, name, and semester are required' });
  }

  try {
    const id = await getNextId('subjects');
    await Subject.create({
      id,
      course_id: courseId || 1,
      code: code.toUpperCase().trim(),
      name: name.trim(),
      semester: Number(semester),
      credits: credits || 4,
      type: type || 'Theory',
      faculty_id: facultyId || null,
      syllabus_outline: syllabusOutline || '',
      difficulty_index: difficultyIndex || 0.50
    });
    res.status(201).json({ message: 'Subject created successfully', subjectId: id });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/academics/timetable
router.get('/timetable', verifyToken, async (req, res) => {
  const { semester, section, facultyId, day } = req.query;
  const filter = {};
  if (semester) filter.semester = Number(semester);
  if (section) filter.section = section;
  if (facultyId) filter.faculty_id = Number(facultyId);
  if (day) filter.day_of_week = day;

  const [slots, subjects, faculties, users] = await Promise.all([
    TimetableSlot.find(filter).lean(),
    Subject.find().lean(),
    Faculty.find().lean(),
    User.find({ role: 'faculty' }, 'id full_name').lean()
  ]);

  const subMap = Object.fromEntries(subjects.map(s => [s.id, s]));
  const facMap = Object.fromEntries(faculties.map(f => [f.id, f]));
  const uMap = Object.fromEntries(users.map(u => [u.id, u]));

  const result = slots.map(ts => {
    const sub = subMap[ts.subject_id] || {};
    const fac = facMap[ts.faculty_id] || {};
    return {
      ...ts,
      subject_name: sub.name,
      subject_code: sub.code,
      subject_type: sub.type,
      faculty_name: uMap[fac.user_id]?.full_name
    };
  });

  result.sort((a, b) => {
    const dDiff = (DAY_ORDER[a.day_of_week] || 9) - (DAY_ORDER[b.day_of_week] || 9);
    return dDiff !== 0 ? dDiff : String(a.start_time).localeCompare(String(b.start_time));
  });

  res.json(result);
});

// POST /api/academics/timetable
router.post('/timetable', verifyToken, requireRoles('admin', 'faculty'), async (req, res) => {
  const { subjectId, facultyId, semester, section, dayOfWeek, startTime, endTime, roomNo } = req.body;
  if (!subjectId || !facultyId || !dayOfWeek || !startTime || !endTime || !roomNo) {
    return res.status(400).json({ error: 'All schedule slot fields are required' });
  }

  try {
    const id = await getNextId('timetable_slots');
    await TimetableSlot.create({
      id,
      subject_id: Number(subjectId),
      faculty_id: Number(facultyId),
      semester: semester || 4,
      section: section || 'CSE-2',
      day_of_week: dayOfWeek,
      start_time: startTime,
      end_time: endTime,
      room_no: roomNo
    });
    res.status(201).json({ message: 'Timetable slot created successfully', slotId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
