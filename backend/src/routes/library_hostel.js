const express = require('express');
const { LibraryBook, LibraryIssue, HostelRoom, HostelAllocation, Student, User, getNextId } = require('../db/database');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/library/books
router.get('/books', verifyToken, async (req, res) => {
  const { search, category } = req.query;
  const filter = {};
  if (search) {
    const rx = new RegExp(search.trim(), 'i');
    filter.$or = [{ title: rx }, { author: rx }, { isbn: rx }];
  }
  if (category) filter.category = category;
  const books = await LibraryBook.find(filter).sort({ title: 1 }).lean();
  res.json(books);
});

// GET /api/library/my-issues
router.get('/my-issues', verifyToken, async (req, res) => {
  let studentId = req.query.studentId ? Number(req.query.studentId) : null;
  if (req.user.role === 'student') {
    const st = await Student.findOne({ user_id: req.user.id }, 'id').lean();
    studentId = st ? st.id : null;
  }
  if (!studentId) return res.status(400).json({ error: 'Student ID required' });

  const [issues, books] = await Promise.all([
    LibraryIssue.find({ student_id: studentId }).sort({ issue_date: -1 }).lean(),
    LibraryBook.find().lean()
  ]);
  const bMap = Object.fromEntries(books.map(b => [b.id, b]));
  res.json(issues.map(li => ({
    ...li,
    title: bMap[li.book_id]?.title,
    author: bMap[li.book_id]?.author,
    isbn: bMap[li.book_id]?.isbn,
    shelf_location: bMap[li.book_id]?.shelf_location
  })));
});

// POST /api/library/issue
router.post('/issue', verifyToken, requireRoles('admin', 'faculty'), async (req, res) => {
  const { bookId, studentId, days } = req.body;
  const book = await LibraryBook.findOne({ id: Number(bookId) }).lean();
  if (!book || book.available_copies <= 0) {
    return res.status(400).json({ error: 'Book is currently out of stock or unavailable' });
  }

  const issueDate = new Date().toISOString().split('T')[0];
  const dueDate = new Date(Date.now() + (days || 14) * 86400000).toISOString().split('T')[0];
  const id = await getNextId('library_issues');

  await LibraryIssue.create({
    id,
    book_id: Number(bookId),
    student_id: Number(studentId),
    issue_date: issueDate,
    due_date: dueDate,
    status: 'Issued'
  });
  await LibraryBook.updateOne({ id: Number(bookId) }, { $inc: { available_copies: -1 } });

  res.json({ message: 'Book issued successfully', dueDate });
});

// POST /api/library/return
router.post('/return', verifyToken, requireRoles('admin', 'faculty'), async (req, res) => {
  const { issueId } = req.body;
  const issue = await LibraryIssue.findOne({ id: Number(issueId) }).lean();
  if (!issue) return res.status(404).json({ error: 'Issue record not found' });

  const returnDate = new Date().toISOString().split('T')[0];
  const due = new Date(issue.due_date);
  const now = new Date();
  let fine = 0;
  if (now > due) {
    fine = Math.ceil((now - due) / (1000 * 60 * 60 * 24)) * 5.0;
  }

  await LibraryIssue.updateOne(
    { id: issue.id },
    { $set: { return_date: returnDate, fine_amount: fine, status: 'Returned' } }
  );
  await LibraryBook.updateOne({ id: issue.book_id }, { $inc: { available_copies: 1 } });

  res.json({ message: 'Book returned successfully', fine_amount: fine });
});

// GET /api/library/rooms (Hostel rooms)
router.get('/rooms', verifyToken, async (req, res) => {
  const [rooms, allocs, students, users] = await Promise.all([
    HostelRoom.find().sort({ block_name: 1, room_no: 1 }).lean(),
    HostelAllocation.find({ status: 'Allocated' }).lean(),
    Student.find({}, 'id user_id').lean(),
    User.find({ role: 'student' }, 'id full_name').lean()
  ]);

  const stMap = Object.fromEntries(students.map(s => [s.id, s]));
  const uMap = Object.fromEntries(users.map(u => [u.id, u]));

  res.json(rooms.map(hr => {
    const names = allocs
      .filter(a => a.room_id === hr.id)
      .map(a => uMap[stMap[a.student_id]?.user_id]?.full_name)
      .filter(Boolean);
    return { ...hr, occupants_names: names.join(', ') || null };
  }));
});

// POST /api/library/allocate
router.post('/allocate', verifyToken, requireRoles('admin'), async (req, res) => {
  const { roomId, studentId } = req.body;
  const room = await HostelRoom.findOne({ id: Number(roomId) }).lean();
  if (!room) return res.status(404).json({ error: 'Hostel room not found' });
  if (room.occupied_count >= room.capacity) {
    return res.status(400).json({ error: 'Room is already at full capacity' });
  }

  const allocDate = new Date().toISOString().split('T')[0];
  try {
    const existing = await HostelAllocation.findOne({ student_id: Number(studentId) }).lean();
    if (existing) {
      await HostelAllocation.updateOne(
        { id: existing.id },
        { $set: { room_id: Number(roomId), allocation_date: allocDate, status: 'Allocated' } }
      );
    } else {
      const id = await getNextId('hostel_allocations');
      await HostelAllocation.create({
        id,
        room_id: Number(roomId),
        student_id: Number(studentId),
        allocation_date: allocDate,
        status: 'Allocated'
      });
    }

    const occupied = await HostelAllocation.countDocuments({ room_id: Number(roomId), status: 'Allocated' });
    await HostelRoom.updateOne({ id: Number(roomId) }, { $set: { occupied_count: occupied } });

    res.json({ message: 'Hostel room allocated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
