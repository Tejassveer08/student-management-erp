const express = require('express');
const { Notice, Department, User, getNextId } = require('../db/database');
const { verifyToken, requireRoles, logAudit } = require('../middleware/authMiddleware');
const { sendError, HttpError } = require('../services/scope');
const { notifyUsers } = require('../services/notify');

const router = express.Router();
const AUDIENCE_FOR_ROLE = { student: 'Students', faculty: 'Faculty', parent: 'Parents' };
const ROLE_FOR_AUDIENCE = { Students: ['student'], Faculty: ['faculty'], Parents: ['parent'], All: ['student', 'faculty', 'parent'] };
const escapeRx = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// GET /api/notices — each role only sees notices addressed to it (admins see everything)
router.get('/', verifyToken, async (req, res) => {
  try {
    const { category, audience, search } = req.query;
    const filter = {};
    if (category) filter.category = category;
    const mine = AUDIENCE_FOR_ROLE[req.user.role];
    if (mine) filter.target_audience = { $in: ['All', mine] };
    else if (audience && audience !== 'All') filter.target_audience = { $in: [audience, 'All'] };
    if (search && String(search).trim()) {
      const rx = new RegExp(escapeRx(String(search).trim().slice(0, 80)), 'i');
      filter.$or = [{ title: rx }, { content: rx }, { posted_by: rx }];
    }
    const [notices, depts] = await Promise.all([Notice.find(filter).sort({ is_pinned: -1, created_at: -1 }).lean(), Department.find().lean()]);
    const deptMap = Object.fromEntries(depts.map((d) => [d.id, d]));
    res.json(
      notices.map((n) => ({
        ...n,
        can_delete: req.user.role === 'admin' || (req.user.role === 'faculty' && n.author_user_id === req.user.id),
        department_name: deptMap[n.department_id]?.name || null,
        department_code: deptMap[n.department_id]?.code || null
      }))
    );
  } catch (err) {
    sendError(res, err);
  }
});

// POST /api/notices — publish; urgent or pinned notices also go out as alerts to the audience
router.post('/', verifyToken, requireRoles('admin', 'faculty'), async (req, res) => {
  try {
    const { title, content, category, targetAudience, departmentId, isPinned } = req.body;
    if (!title || !content) throw new HttpError(400, 'Title and content are required');
    const audience = ROLE_FOR_AUDIENCE[targetAudience] ? targetAudience : 'All';
    const pinned = req.user.role === 'admin' && isPinned ? 1 : 0;
    const id = await getNextId('notices');
    await Notice.create({
      id,
      title: String(title).trim(),
      content: String(content).trim(),
      category: category || 'General',
      target_audience: audience,
      department_id: departmentId || null,
      posted_by: req.user.full_name || (req.user.role === 'admin' ? 'Administration' : 'Faculty'),
      author_user_id: req.user.id,
      is_pinned: pinned
    });
    let alerted = 0;
    if (category === 'Urgent' || pinned) {
      const users = await User.find({ role: { $in: ROLE_FOR_AUDIENCE[audience] } }, 'id').lean();
      alerted = await notifyUsers(users.map((u) => u.id).filter((uid) => uid !== req.user.id), {
        title: `${category === 'Urgent' ? 'Urgent: ' : ''}${String(title).trim()}`,
        message: String(content).trim().slice(0, 160),
        type: 'general',
        link: '/notices'
      });
    }
    res.status(201).json({ message: alerted ? `Notice published and ${alerted} people alerted` : 'Notice published', noticeId: id });
  } catch (err) {
    sendError(res, err);
  }
});

// DELETE /api/notices/:id — admins delete any notice; faculty only their own
router.delete('/:id', verifyToken, requireRoles('admin', 'faculty'), async (req, res) => {
  try {
    const notice = await Notice.findOne({ id: Number(req.params.id) }).lean();
    if (!notice) throw new HttpError(404, 'Notice not found');
    if (req.user.role === 'faculty' && notice.author_user_id !== req.user.id) throw new HttpError(403, 'You can only delete notices you posted.');
    await Notice.deleteOne({ id: notice.id });
    if (req.user.role === 'admin' && notice.author_user_id !== req.user.id) {
      await logAudit({ userId: req.user.id, userRole: req.user.role, userEmail: req.user.email, action: 'NOTICE_DELETE', entityType: 'notices', entityId: notice.id, oldValue: { title: notice.title, posted_by: notice.posted_by }, reason: 'Notice removed by administration', ipAddress: req.ip });
    }
    res.json({ message: 'Notice deleted' });
  } catch (err) {
    sendError(res, err);
  }
});

module.exports = router;
