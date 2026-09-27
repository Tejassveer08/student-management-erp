const express = require('express');
const db = require('../db/database');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/notices - List notices with search and filters
router.get('/', verifyToken, (req, res) => {
  const { category, audience, search } = req.query;

  let query = `
    SELECT n.*, d.name as department_name, d.code as department_code
    FROM notices n
    LEFT JOIN departments d ON n.department_id = d.id
    WHERE 1=1
  `;
  const params = [];

  if (category) {
    query += ' AND n.category = ?';
    params.push(category);
  }

  if (audience && audience !== 'All') {
    query += ' AND (n.target_audience = ? OR n.target_audience = "All")';
    params.push(audience);
  }

  if (search) {
    query += ' AND (n.title LIKE ? OR n.content LIKE ? OR n.posted_by LIKE ?)';
    const s = `%${search}%`;
    params.push(s, s, s);
  }

  query += ' ORDER BY n.is_pinned DESC, n.created_at DESC';

  const notices = db.prepare(query).all(...params);
  res.json(notices);
});

// POST /api/notices - Publish notice (Admin/Faculty)
router.post('/', verifyToken, requireRoles('admin', 'faculty'), (req, res) => {
  const { title, content, category, targetAudience, departmentId, isPinned } = req.body;

  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const postedBy = req.user.fullName || (req.user.role === 'admin' ? 'Administration' : 'Faculty Member');

  try {
    const result = db.prepare(`
      INSERT INTO notices (title, content, category, target_audience, department_id, posted_by, is_pinned)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      title.trim(),
      content.trim(),
      category || 'General',
      targetAudience || 'All',
      departmentId || null,
      postedBy,
      isPinned ? 1 : 0
    );

    res.status(201).json({ message: 'Notice published successfully', noticeId: result.lastInsertRowid });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notices/:id - Delete notice
router.delete('/:id', verifyToken, requireRoles('admin', 'faculty'), (req, res) => {
  db.prepare('DELETE FROM notices WHERE id = ?').run(req.params.id);
  res.json({ message: 'Notice deleted successfully' });
});

module.exports = router;
