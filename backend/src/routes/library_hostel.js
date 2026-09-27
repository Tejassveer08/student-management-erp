const express = require('express');
const db = require('../db/database');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/library/books - List & search books
router.get('/books', verifyToken, (req, res) => {
  const { search, category } = req.query;

  let query = 'SELECT * FROM library_books WHERE 1=1';
  const params = [];

  if (search) {
    query += ' AND (title LIKE ? OR author LIKE ? OR isbn LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  if (category) {
    query += ' AND category = ?';
    params.push(category);
  }

  query += ' ORDER BY title ASC';
  const books = db.prepare(query).all(...params);
  res.json(books);
});

// GET /api/library/my-issues - Student's borrowed books
router.get('/my-issues', verifyToken, (req, res) => {
  let studentId = req.query.studentId;

  if (req.user.role === 'student') {
    const st = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
    studentId = st ? st.id : null;
  }

  if (!studentId) return res.status(400).json({ error: 'Student ID required' });

  const issues = db.prepare(`
    SELECT li.*, b.title, b.author, b.isbn, b.shelf_location
    FROM library_issues li
    JOIN library_books b ON li.book_id = b.id
    WHERE li.student_id = ?
    ORDER BY li.issue_date DESC
  `).all(studentId);

  res.json(issues);
});

// POST /api/library/issue - Issue book to student
router.post('/issue', verifyToken, requireRoles('admin', 'faculty'), (req, res) => {
  const { bookId, studentId, days } = req.body;

  const book = db.prepare('SELECT available_copies FROM library_books WHERE id = ?').get(bookId);
  if (!book || book.available_copies <= 0) {
    return res.status(400).json({ error: 'Book is currently out of stock or unavailable' });
  }

  const issueDate = new Date().toISOString().split('T')[0];
  const dueDate = new Date(Date.now() + (days || 14) * 86400000).toISOString().split('T')[0];

  const issueTxn = db.transaction(() => {
    db.prepare(`
      INSERT INTO library_issues (book_id, student_id, issue_date, due_date, status)
      VALUES (?, ?, ?, ?, 'Issued')
    `).run(bookId, studentId, issueDate, dueDate);

    db.prepare('UPDATE library_books SET available_copies = available_copies - 1 WHERE id = ?').run(bookId);
  });

  issueTxn();
  res.json({ message: 'Book issued successfully', dueDate });
});

// POST /api/library/return - Return book & compute late fine
router.post('/return', verifyToken, requireRoles('admin', 'faculty'), (req, res) => {
  const { issueId } = req.body;
  const issue = db.prepare('SELECT * FROM library_issues WHERE id = ?').get(issueId);
  if (!issue) return res.status(404).json({ error: 'Issue record not found' });

  const returnDate = new Date().toISOString().split('T')[0];
  const due = new Date(issue.due_date);
  const now = new Date();

  let fine = 0;
  if (now > due) {
    const diffDays = Math.ceil((now - due) / (1000 * 60 * 60 * 24));
    fine = diffDays * 5.0; // Rs. 5 per day overdue
  }

  const returnTxn = db.transaction(() => {
    db.prepare(`
      UPDATE library_issues
      SET return_date = ?,
          fine_amount = ?,
          status = 'Returned'
      WHERE id = ?
    `).run(returnDate, fine, issueId);

    db.prepare('UPDATE library_books SET available_copies = available_copies + 1 WHERE id = ?').run(issue.book_id);
  });

  returnTxn();
  res.json({ message: 'Book returned successfully', fine_amount: fine });
});

// GET /api/hostel/rooms - Hostel rooms and occupancy
router.get('/rooms', verifyToken, (req, res) => {
  const rooms = db.prepare(`
    SELECT hr.*,
           GROUP_CONCAT(u.full_name, ', ') as occupants_names
    FROM hostel_rooms hr
    LEFT JOIN hostel_allocations ha ON ha.room_id = hr.id AND ha.status = 'Allocated'
    LEFT JOIN students s ON ha.student_id = s.id
    LEFT JOIN users u ON s.user_id = u.id
    GROUP BY hr.id
    ORDER BY hr.block_name ASC, hr.room_no ASC
  `).all();

  res.json(rooms);
});

// POST /api/hostel/allocate - Allocate room to student
router.post('/allocate', verifyToken, requireRoles('admin'), (req, res) => {
  const { roomId, studentId } = req.body;

  const room = db.prepare('SELECT * FROM hostel_rooms WHERE id = ?').get(roomId);
  if (!room) return res.status(404).json({ error: 'Hostel room not found' });

  if (room.occupied_count >= room.capacity) {
    return res.status(400).json({ error: 'Room is already at full capacity' });
  }

  const allocDate = new Date().toISOString().split('T')[0];

  try {
    const allocTxn = db.transaction(() => {
      db.prepare(`
        INSERT INTO hostel_allocations (room_id, student_id, allocation_date, status)
        VALUES (?, ?, ?, 'Allocated')
        ON CONFLICT(student_id) DO UPDATE SET
          room_id = excluded.room_id,
          allocation_date = excluded.allocation_date,
          status = 'Allocated'
      `).run(roomId, studentId, allocDate);

      // Recalculate room occupancy
      db.prepare(`
        UPDATE hostel_rooms
        SET occupied_count = (SELECT COUNT(*) FROM hostel_allocations WHERE room_id = ? AND status = 'Allocated')
        WHERE id = ?
      `).run(roomId, roomId);
    });

    allocTxn();
    res.json({ message: 'Hostel room allocated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
