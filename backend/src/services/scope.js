/**
 * Shared data-scoping rules so every module answers "whose record may this user see?"
 * the same way:
 *   student → only their own record
 *   parent  → only wards linked through WardLink (primary ward by default)
 *   faculty → only students in a semester/section they are mapped to teach
 *   admin   → anyone
 */
const { Student, WardLink, FacultyClassMap, Subject } = require('../db/database');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/** Send an HttpError (or any error) as JSON */
function sendError(res, err) {
  const status = err.status || 500;
  if (status >= 500) console.error(err);
  return res.status(status).json({ error: err.message || 'Internal Server Error' });
}

async function wardIdsFor(parentUserId) {
  const links = await WardLink.find({ parent_user_id: parentUserId }).sort({ is_primary: -1, id: 1 }).lean();
  return links.map((l) => l.student_id);
}

/** Sections (semester + section pairs) a faculty member teaches */
async function facultySections(facultyId) {
  const maps = await FacultyClassMap.find({ faculty_id: facultyId }).lean();
  const seen = new Map();
  for (const m of maps) seen.set(`${m.semester}|${m.section}`, { semester: m.semester, section: m.section });
  return [...seen.values()];
}

async function facultyCanSee(req, student) {
  if (!req.faculty) return false;
  const maps = req.facultyClassMap || (await FacultyClassMap.find({ faculty_id: req.faculty.id }).lean());
  return maps.some((m) => m.semester === student.semester && m.section === student.section);
}

/**
 * Resolve which student a request is about and enforce access.
 * `requested` may be a number, a numeric string, 'me', or empty.
 * Returns the Student document (lean).
 */
async function resolveStudent(req, requested) {
  const role = req.user?.role;
  const raw = requested === undefined || requested === null || requested === '' || requested === 'me' ? null : Number(requested);
  if (raw !== null && !Number.isFinite(raw)) throw new HttpError(400, 'Invalid student id');

  if (role === 'student') {
    if (!req.student) throw new HttpError(404, 'Student record not found');
    if (raw !== null && raw !== req.student.id) throw new HttpError(403, 'Access denied: students can only view their own records.');
    const st = await Student.findOne({ id: req.student.id }).lean();
    if (!st) throw new HttpError(404, 'Student record not found');
    return st;
  }

  if (role === 'parent') {
    const wards = await wardIdsFor(req.user.id);
    if (!wards.length) throw new HttpError(404, 'No linked wards found for this account.');
    const id = raw ?? wards[0];
    if (!wards.includes(id)) throw new HttpError(403, 'Access denied: you can only view your linked wards.');
    const st = await Student.findOne({ id }).lean();
    if (!st) throw new HttpError(404, 'Student not found');
    return st;
  }

  if (raw === null) throw new HttpError(400, 'A student id is required');
  const st = await Student.findOne({ id: raw }).lean();
  if (!st) throw new HttpError(404, 'Student not found');

  if (role === 'faculty' && !(await facultyCanSee(req, st))) {
    throw new HttpError(403, 'Access denied: this student is not in a section you teach.');
  }
  if (role !== 'admin' && role !== 'faculty') throw new HttpError(403, 'Access denied');
  return st;
}

/**
 * Subjects a student actually studies this semester: their own programme's
 * subjects, falling back to the common (CSE) curriculum for shared first years.
 */
async function subjectsForStudent(student, { theoryOnly = false, semester } = {}) {
  const sem = semester ?? student.semester;
  const base = { semester: sem };
  if (theoryOnly) base.type = 'Theory';
  let subs = await Subject.find({ ...base, course_id: student.course_id }).sort({ code: 1 }).lean();
  if (!subs.length) subs = await Subject.find({ ...base, course_id: 1 }).sort({ code: 1 }).lean();
  return subs;
}

/** Batch version: map of `${course_id}|${semester}` → subjects (with the same fallback) */
async function subjectIndex({ theoryOnly = false } = {}) {
  const subs = await Subject.find(theoryOnly ? { type: 'Theory' } : {}).sort({ code: 1 }).lean();
  const idx = {};
  for (const s of subs) (idx[`${s.course_id}|${s.semester}`] ||= []).push(s);
  return (courseId, semester) => idx[`${courseId}|${semester}`] || idx[`1|${semester}`] || [];
}

module.exports = {
  HttpError,
  sendError,
  wardIdsFor,
  facultySections,
  facultyCanSee,
  resolveStudent,
  subjectsForStudent,
  subjectIndex
};
