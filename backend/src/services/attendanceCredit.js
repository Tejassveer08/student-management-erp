const {
  FacultyClassMap,
  Subject,
  AttendanceSession,
  AttendanceRecord,
  SocietyAttendanceRequest,
  Student,
  getNextId
} = require('../db/database');

async function findOwningFacultyId(subjectId, semester, section) {
  const mapped = await FacultyClassMap.findOne({ subject_id: subjectId, semester, section }).sort({ id: 1 }).lean();
  if (mapped) return mapped.faculty_id;

  const anyMapped = await FacultyClassMap.findOne({ subject_id: subjectId }).sort({ id: 1 }).lean();
  if (anyMapped) return anyMapped.faculty_id;

  const sub = await Subject.findOne({ id: subjectId }).lean();
  return sub ? sub.faculty_id : null;
}

async function facultyTeachesSubject(facultyId, subjectId) {
  if (!facultyId) return false;
  const mapped = await FacultyClassMap.findOne({ faculty_id: facultyId, subject_id: subjectId }).lean();
  if (mapped) return true;
  const owner = await Subject.findOne({ id: subjectId, faculty_id: facultyId }).lean();
  return !!owner;
}

async function findMatchingSessions(request, student) {
  const sessions = await AttendanceSession.find({
    subject_id: request.class_subject_id,
    section: student.section,
    session_date: request.date
  }).lean();

  if (request.session_period) {
    const wanted = String(request.session_period).trim().toLowerCase();
    const exact = sessions.filter(s => String(s.slot_time || '').trim().toLowerCase() === wanted);
    if (exact.length > 0) return exact;
  }
  return sessions;
}

async function applySocietyCredit(requestId) {
  const request = await SocietyAttendanceRequest.findOne({ id: requestId, status: 'approved' }).lean();
  if (!request) return 0;
  const student = await Student.findOne({ id: request.student_id }).lean();
  if (!student) return 0;

  const sessions = await findMatchingSessions(request, student);
  let credited = 0;

  for (const sess of sessions) {
    const existing = await AttendanceRecord.findOne({ session_id: sess.id, student_id: student.id }).lean();
    if (existing && existing.status === 'Present' && existing.credit_type === 'Regular') continue;

    if (existing) {
      await AttendanceRecord.updateOne(
        { id: existing.id },
        {
          $set: {
            status: 'Present',
            method: 'Faculty_Manual',
            marked_at: new Date(),
            credit_type: 'Society',
            society_request_id: request.id
          }
        }
      );
    } else {
      const id = await getNextId('attendance_records');
      await AttendanceRecord.create({
        id,
        session_id: sess.id,
        student_id: student.id,
        status: 'Present',
        method: 'Faculty_Manual',
        marked_at: new Date(),
        credit_type: 'Society',
        society_request_id: request.id
      });
    }
    credited++;
  }
  return credited;
}

async function reapplySocietyCreditsForSession(sessionId) {
  const session = await AttendanceSession.findOne({ id: sessionId }).lean();
  if (!session) return 0;

  const studentsInSection = await Student.find({ section: session.section }, 'id').lean();
  const sIds = studentsInSection.map(s => s.id);
  const requests = await SocietyAttendanceRequest.find({
    status: 'approved',
    class_subject_id: session.subject_id,
    date: session.session_date,
    student_id: { $in: sIds }
  }).lean();

  let total = 0;
  for (const r of requests) total += await applySocietyCredit(r.id);
  return total;
}

module.exports = {
  findOwningFacultyId,
  facultyTeachesSubject,
  applySocietyCredit,
  reapplySocietyCreditsForSession
};
