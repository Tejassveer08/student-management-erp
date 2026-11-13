const express = require('express');
const { Notice, Department, getNextId } = require('../db/database');
const { verifyToken, requireRoles } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/notices
router.get('/', verifyToken, async (req, res) => {
  const { category, audience, search } = req.query;
  const filter = {};

  if (category) filter.category = category;
  if (audience && audience !== 'All') {
    filter.target_audience = { $in: [audience, 'All'] };
  }
  if (search) {
    const rx = new RegExp(search.trim(), 'i');
    filter.$or = [{ title: rx }, { content: rx }, { posted_by: rx }];
  }

  const [notices, depts] = await Promise.all([
    Notice.find(filter).sort({ is_pinned: -1, created_at: -1 }).lean(),
    Department.find().lean()
  ]);
  const deptMap = Object.fromEntries(depts.map(d => [d.id, d]));

  res.json(notices.map(n => ({
    ...n,
    department_name: deptMap[n.department_id]?.name || null,
    department_code: deptMap[n.department_id]?.code || null
  })));
});

// POST /api/notices
router.post('/', verifyToken, requireRoles('admin', 'faculty'), async (req, res) => {
  const { title, content, category, targetAudience, departmentId, isPinned } = req.body;
  if (!title || !content) {
    return res.status(400).json({ error: 'Title and content are required' });
  }

  const postedBy = req.user.full_name || (req.user.role === 'admin' ? 'Administration' : 'Faculty Member');
  try {
    const id = await getNextId('notices');
    await Notice.create({
      id,
      title: title.trim(),
      content: content.trim(),
      category: category || 'General',
      target_audience: targetAudience || 'All',
      department_id: departmentId || null,
      posted_by: postedBy,
      is_pinned: isPinned ? 1 : 0
    });
    res.status(201).json({ message: 'Notice published successfully', noticeId: id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/notices/:id
router.delete('/:id', verifyToken, requireRoles('admin', 'faculty'), async (req, res) => {
  await Notice.deleteOne({ id: Number(req.params.id) });
  res.json({ message: 'Notice deleted successfully' });
});

module.exports = router;
