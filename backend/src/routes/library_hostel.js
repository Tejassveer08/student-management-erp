const express = require('express');
const { LibraryBook, LibraryIssue, HostelRoom, HostelAllocation, Student, User, getNextId } = require('../db/database');
const { verifyToken, requireRoles, logAudit } = require('../middleware/authMiddleware');
const { resolveStudent, sendError, HttpError } = require('../services/scope');
const { notifyStudents } = require('../services/notify');
const { localDate, addDays, daysBetween } = require('../services/time');

const router = express.Router();
const FINE_PER_DAY = 5;
const MAX_ACTIVE_LOANS = 4;
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Flag loans past their due date as Overdue with the fine accrued so far */
async function refreshOverdue(filter = {}) {
  const today = localDate();
  const late = await LibraryIssue.find({ ...filter, status: { $in: ['Issued', 'Overdue'] }, due_date: { $lt: today } }, 'id due_date').lean();
  if (!late.length) return;
  await LibraryIssue.bulkWrite(
    late.map((i) => ({ updateOne: { filter: { id: i.id }, update: { $set: { status: 'Overdue', fine_amount: daysBetween(i.due_date, today) * FINE_PER_DAY } } } })),
    { ordered: false }
  );
}

// GET /api/library/books — catalogue search
router.get('/books', verifyToken, async (req, res) => {
  try {
    const { search, category } = req.query;
    const filter = {};
    if (search && String(search).trim()) {
      const rx = new RegExp(escapeRx(String(search).trim().slice(0, 80)), 'i');
      filter.$or = [{ title: rx }, { author: rx }, { isbn: rx }];
    }
    if (category) filter.category = category;
    res.json(await LibraryBook.find(filter).sort({ title: 1 }).lean());
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/library/my-issues — a student's loans (students: own; parents: ward; staff: any student)
router.get('/my-issues', verifyToken, async (req, res) => {
  try {
    const student = await resolveStudent(req, req.query.studentId);
    await refreshOverdue({ student_id: student.id });
    const issues = await LibraryIssue.find({ student_id: student.id }).sort({ issue_date: -1 }).lean();
    const books = await LibraryBook.find({ id: { $in: issues.map((i) => i.book_id) } }).lean();
    const bMap = Object.fromEntries(books.map((b) => [b.id, b]));
    res.json(issues.map((li) => ({ ...li, title: bMap[li.book_id]?.title, author: bMap[li.book_id]?.author, isbn: bMap[li.book_id]?.isbn, shelf_location: bMap[li.book_id]?.shelf_location })));
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/library/loans — circulation desk: all open loans (staff)
router.get('/loans', verifyToken, requireRoles('admin', 'faculty'), async (req, res) => {
  try {
    await refreshOverdue();
    const issues = await LibraryIssue.find({ status: { $in: ['Issued', 'Overdue'] } }).sort({ due_date: 1 }).lean();
    const [books, students] = await Promise.all([
      LibraryBook.find({ id: { $in: issues.map((i) => i.book_id) } }, 'id title author').lean(),
      Student.find({ id: { $in: issues.map((i) => i.student_id) } }, 'id user_id roll_no section').lean()
    ]);
    const users = await User.find({ id: { $in: students.map((s) => s.user_id) } }, 'id full_name').lean();
    const bMap = Object.fromEntries(books.map((b) => [b.id, b]));
    const sMap = Object.fromEntries(students.map((s) => [s.id, s]));
    const uMap = Object.fromEntries(users.map((u) => [u.id, u.full_name]));
    res.json(issues.map((i) => ({ ...i, title: bMap[i.book_id]?.title, author: bMap[i.book_id]?.author, roll_no: sMap[i.student_id]?.roll_no, section: sMap[i.student_id]?.section, student_name: uMap[sMap[i.student_id]?.user_id] })));
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/library/issue — issue a copy (atomic stock check, loan limit, no duplicate copies)
router.post('/issue', verifyToken, requireRoles('admin', 'faculty'), async (req, res) => {
  try {
    const bookId = Number(req.body.bookId);
    const days = Math.max(1, Math.min(60, Number(req.body.days) || 14));
    const student = await Student.findOne({ id: Number(req.body.studentId) }).lean();
    if (!student) throw new HttpError(404, 'Student not found');
    const active = await LibraryIssue.find({ student_id: student.id, status: { $in: ['Issued', 'Overdue'] } }).lean();
    if (active.length >= MAX_ACTIVE_LOANS) throw new HttpError(400, `Students can hold at most ${MAX_ACTIVE_LOANS} books at a time`);
    if (active.some((i) => i.book_id === bookId)) throw new HttpError(400, 'This student already has a copy of this book');
    if (active.some((i) => i.status === 'Overdue')) throw new HttpError(400, 'Return overdue books before issuing new ones');

    const book = await LibraryBook.findOneAndUpdate({ id: bookId, available_copies: { $gt: 0 } }, { $inc: { available_copies: -1 } }, { new: true }).lean();
    if (!book) throw new HttpError(400, 'No copies of this book are available');

    const issueDate = localDate();
    const dueDate = addDays(issueDate, days);
    await LibraryIssue.create({ id: await getNextId('library_issues'), book_id: bookId, student_id: student.id, issue_date: issueDate, due_date: dueDate, status: 'Issued' });
    await notifyStudents([student.id], { title: 'Book issued', message: `"${book.title}" is due back on ${dueDate}. Late returns cost ₹${FINE_PER_DAY}/day.`, type: 'general', link: '/library-hostel' });
    res.json({ message: `Issued "${book.title}" until ${dueDate}`, dueDate });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/library/return — return a loan (idempotent) and settle the fine
router.post('/return', verifyToken, requireRoles('admin', 'faculty'), async (req, res) => {
  try {
    const issue = await LibraryIssue.findOne({ id: Number(req.body.issueId) }).lean();
    if (!issue) throw new HttpError(404, 'Loan not found');
    if (issue.status === 'Returned') throw new HttpError(409, 'This book has already been returned');
    const today = localDate();
    const fine = Math.max(0, daysBetween(issue.due_date, today)) * FINE_PER_DAY;
    const r = await LibraryIssue.updateOne({ id: issue.id, status: { $ne: 'Returned' } }, { $set: { return_date: today, fine_amount: fine, status: 'Returned' } });
    if (r.modifiedCount) await LibraryBook.updateOne({ id: issue.book_id }, { $inc: { available_copies: 1 } });
    res.json({ message: fine ? `Returned — fine due ₹${fine}` : 'Returned on time', fine_amount: fine });
  } catch (err) {
    sendError(res, err);
  }
});

// GET /api/library/rooms — hostel rooms; occupant names only for admins, "my room" for students
router.get('/rooms', verifyToken, async (req, res) => {
  try {
    const [rooms, allocs] = await Promise.all([HostelRoom.find().sort({ block_name: 1, room_no: 1 }).lean(), HostelAllocation.find({ status: 'Allocated' }).lean()]);
    const isAdmin = req.user.role === 'admin';
    let names = {};
    if (isAdmin) {
      const students = await Student.find({ id: { $in: allocs.map((a) => a.student_id) } }, 'id user_id').lean();
      const users = await User.find({ id: { $in: students.map((s) => s.user_id) } }, 'id full_name').lean();
      const uMap = Object.fromEntries(users.map((u) => [u.id, u.full_name]));
      names = Object.fromEntries(students.map((s) => [s.id, uMap[s.user_id]]));
    }
    let mine = null;
    if (req.user.role === 'student' || req.user.role === 'parent') {
      const st = await resolveStudent(req, req.query.studentId).catch(() => null);
      mine = st ? allocs.find((a) => a.student_id === st.id)?.room_id ?? null : null;
    }
    res.json(
      rooms.map((hr) => {
        const here = allocs.filter((a) => a.room_id === hr.id);
        return {
          ...hr,
          occupied_count: here.length,
          is_mine: mine === hr.id,
          occupants_names: isAdmin ? here.map((a) => names[a.student_id]).filter(Boolean).join(', ') || null : undefined,
          occupants: isAdmin ? here.map((a) => ({ student_id: a.student_id, name: names[a.student_id] || '' })) : undefined
        };
      })
    );
  } catch (err) {
    sendError(res, err);
  }
});

async function syncOccupancy(roomIds) {
  for (const id of [...new Set(roomIds.filter(Boolean))]) {
    const n = await HostelAllocation.countDocuments({ room_id: id, status: 'Allocated' });
    await HostelRoom.updateOne({ id }, { $set: { occupied_count: n } });
  }
}

// POST /api/library/allocate — allocate or move a student (frees the previous room)
router.post('/allocate', verifyToken, requireRoles('admin'), async (req, res) => {
  try {
    const roomId = Number(req.body.roomId);
    const student = await Student.findOne({ id: Number(req.body.studentId) }).lean();
    if (!student) throw new HttpError(404, 'Student not found');
    const room = await HostelRoom.findOne({ id: roomId }).lean();
    if (!room) throw new HttpError(404, 'Hostel room not found');
    const current = await HostelAllocation.countDocuments({ room_id: roomId, status: 'Allocated' });
    const existing = await HostelAllocation.findOne({ student_id: student.id }).lean();
    if (existing?.status === 'Allocated' && existing.room_id === roomId) throw new HttpError(409, 'The student is already in this room');
    if (current >= room.capacity) throw new HttpError(400, 'Room is already full');

    const today = localDate();
    if (existing) await HostelAllocation.updateOne({ id: existing.id }, { $set: { room_id: roomId, allocation_date: today, status: 'Allocated' } });
    else await HostelAllocation.create({ id: await getNextId('hostel_allocations'), room_id: roomId, student_id: student.id, allocation_date: today, status: 'Allocated' });
    await syncOccupancy([roomId, existing?.status === 'Allocated' ? existing.room_id : null]);
    await logAudit({ userId: req.user.id, userRole: req.user.role, userEmail: req.user.email, action: 'HOSTEL_ALLOCATE', entityType: 'hostel_allocations', entityId: student.id, oldValue: existing ? { room_id: existing.room_id, status: existing.status } : null, newValue: { room_id: roomId }, reason: 'Hostel allocation', ipAddress: req.ip });
    await notifyStudents([student.id], { title: 'Hostel room allotted', message: `You have been allotted ${room.block_name} · Room ${room.room_no} (floor ${room.floor}).`, type: 'general', link: '/library-hostel' }, { includeGuardians: true });
    res.json({ message: `Allotted ${room.block_name} ${room.room_no}` });
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/library/vacate — free a student's room (admin)
router.post('/vacate', verifyToken, requireRoles('admin'), async (req, res) => {
  try {
    const alloc = await HostelAllocation.findOne({ student_id: Number(req.body.studentId), status: 'Allocated' }).lean();
    if (!alloc) throw new HttpError(404, 'This student has no active allocation');
    await HostelAllocation.updateOne({ id: alloc.id }, { $set: { status: 'Vacated' } });
    await syncOccupancy([alloc.room_id]);
    res.json({ message: 'Room vacated' });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
