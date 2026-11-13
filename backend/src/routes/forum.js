const express = require('express');
const {
  ForumThread,
  ForumPost,
  ForumLike,
  Subject,
  Society,
  User,
  FacultyClassMap,
  getNextId
} = require('../db/database');
const { verifyToken, requirePermission } = require('../middleware/authMiddleware');
const { facultyTeachesSubject } = require('../services/attendanceCredit');

const router = express.Router();

async function getUserScopedSubjectIds(req) {
  if (req.user.role === 'admin') {
    const subs = await Subject.find({}, { id: 1 }).lean();
    return subs.map(r => r.id);
  }
  if (req.user.role === 'student' && req.student) {
    const subs = await Subject.find({ semester: req.student.semester }, { id: 1 }).lean();
    return subs.map(r => r.id);
  }
  if (req.user.role === 'faculty' && req.faculty) {
    const [maps, owned] = await Promise.all([
      FacultyClassMap.find({ faculty_id: req.faculty.id }, { subject_id: 1 }).lean(),
      Subject.find({ faculty_id: req.faculty.id }, { id: 1 }).lean()
    ]);
    return Array.from(new Set([...maps.map(r => r.subject_id), ...owned.map(r => r.id)]));
  }
  return [];
}

async function canAccessThread(req, thread, cachedAllowedSubjectIds = null) {
  if (!thread) return false;
  if (req.user.role === 'admin') return true;
  if (thread.scope === 'general') return true;
  if (thread.scope === 'subject') {
    const allowedSubjects = cachedAllowedSubjectIds || (await getUserScopedSubjectIds(req));
    return allowedSubjects.includes(thread.subject_id);
  }
  if (thread.scope === 'society') {
    if (thread.author_id === req.user.id) return true;
    const soc = await Society.findOne({ id: thread.society_id }).lean();
    if (!soc) return false;
    if (req.student && soc.coordinator_student_id === req.student.id) return true;
    if (req.faculty && soc.coordinator_faculty_id === req.faculty.id) return true;
    return false;
  }
  return false;
}

// GET /api/forum/my-subjects - Scoped subjects for filter & Ask-a-Doubt composer
router.get('/my-subjects', verifyToken, requirePermission('forum', 'read'), async (req, res) => {
  try {
    const ids = await getUserScopedSubjectIds(req);
    if (ids.length === 0) return res.json([]);
    const subjects = await Subject.find({ id: { $in: ids } }, { id: 1, code: 1, name: 1, semester: 1 })
      .sort({ code: 1 })
      .lean();
    res.json(subjects);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/forum/threads - List threads visible to the authenticated user
router.get('/threads', verifyToken, requirePermission('forum', 'read'), async (req, res) => {
  try {
    const { scope, subjectId, societyId, search } = req.query;

    const filter = {};
    if (scope && ['general', 'subject', 'society'].includes(scope)) filter.scope = scope;
    if (subjectId) filter.subject_id = Number(subjectId);
    if (societyId) filter.society_id = Number(societyId);

    const threads = await ForumThread.find(filter).sort({ last_activity_at: -1, id: -1 }).lean();
    if (threads.length === 0) return res.json([]);

    const authorIds = [...new Set(threads.map(t => t.author_id))];
    const subIds = [...new Set(threads.map(t => t.subject_id).filter(Boolean))];
    const socIds = [...new Set(threads.map(t => t.society_id).filter(Boolean))];
    const threadIds = threads.map(t => t.id);

    const [users, subjects, societies, posts, allowedSubjects] = await Promise.all([
      User.find({ id: { $in: authorIds } }).lean(),
      subIds.length ? Subject.find({ id: { $in: subIds } }).lean() : [],
      socIds.length ? Society.find({ id: { $in: socIds } }).lean() : [],
      ForumPost.find({ thread_id: { $in: threadIds } }).sort({ id: 1 }).lean(),
      getUserScopedSubjectIds(req)
    ]);

    const userMap = Object.fromEntries(users.map(u => [u.id, u]));
    const subMap = Object.fromEntries(subjects.map(s => [s.id, s]));
    const socMap = Object.fromEntries(societies.map(s => [s.id, s]));

    const postStats = {};
    for (const p of posts) {
      if (!postStats[p.thread_id]) {
        postStats[p.thread_id] = { post_count: 0, verified_count: 0, opening_body: p.body };
      }
      postStats[p.thread_id].post_count += 1;
      if (p.is_faculty_answer) postStats[p.thread_id].verified_count += 1;
    }

    const searchLower = search && search.trim() ? search.trim().toLowerCase() : null;
    const enriched = [];

    for (const ft of threads) {
      const u = userMap[ft.author_id];
      if (!u) continue;
      if (searchLower) {
        const matchTitle = ft.title.toLowerCase().includes(searchLower);
        const matchAuthor = u.full_name.toLowerCase().includes(searchLower);
        if (!matchTitle && !matchAuthor) continue;
      }
      if (!(await canAccessThread(req, ft, allowedSubjects))) continue;

      const sub = ft.subject_id ? subMap[ft.subject_id] : null;
      const soc = ft.society_id ? socMap[ft.society_id] : null;
      const ps = postStats[ft.id] || { post_count: 0, verified_count: 0, opening_body: '' };

      enriched.push({
        ...ft,
        author_name: u.full_name,
        author_avatar: u.avatar_url,
        subject_code: sub ? sub.code : null,
        subject_name: sub ? sub.name : null,
        society_name: soc ? soc.name : null,
        post_count: ps.post_count,
        verified_count: ps.verified_count,
        opening_body: ps.opening_body
      });
    }

    res.json(enriched);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/forum/threads - Create a new thread + opening post
router.post('/threads', verifyToken, requirePermission('forum', 'create'), async (req, res) => {
  try {
    const { title, body, scope, subjectId, societyId } = req.body;
    if (!title || !title.trim() || !body || !body.trim()) {
      return res.status(400).json({ error: 'Title and message body are required' });
    }

    const effectiveScope = scope || (subjectId ? 'subject' : (societyId ? 'society' : 'general'));
    if (!['general', 'subject', 'society'].includes(effectiveScope)) {
      return res.status(400).json({ error: 'Invalid thread scope' });
    }

    let resolvedSubjectId = null;
    let resolvedSocietyId = null;

    if (effectiveScope === 'subject') {
      resolvedSubjectId = Number(subjectId);
      if (!resolvedSubjectId) return res.status(400).json({ error: 'Subject ID required for subject-scoped thread' });
      const allowed = await getUserScopedSubjectIds(req);
      if (!allowed.includes(resolvedSubjectId)) {
        return res.status(403).json({ error: 'Forbidden: You are not enrolled in or teaching this subject.' });
      }
    } else if (effectiveScope === 'society') {
      resolvedSocietyId = Number(societyId);
      if (!resolvedSocietyId) return res.status(400).json({ error: 'Society ID required for society-scoped thread' });
    }

    const threadId = await getNextId('forum_threads');
    await ForumThread.create({
      id: threadId,
      author_id: req.user.id,
      author_role: req.user.role,
      scope: effectiveScope,
      subject_id: resolvedSubjectId,
      society_id: resolvedSocietyId,
      title: title.trim()
    });

    const postId = await getNextId('forum_posts');
    await ForumPost.create({
      id: postId,
      thread_id: threadId,
      parent_post_id: null,
      author_id: req.user.id,
      author_role: req.user.role,
      body: body.trim(),
      is_faculty_answer: 0
    });

    res.status(201).json({ threadId, postId, message: 'Thread posted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/forum/threads/:id - Thread detail with all posts & like counts
router.get('/threads/:id', verifyToken, requirePermission('forum', 'read'), async (req, res) => {
  try {
    const threadId = Number(req.params.id);
    const ft = await ForumThread.findOne({ id: threadId }).lean();
    if (!ft) return res.status(404).json({ error: 'Thread not found' });

    if (!(await canAccessThread(req, ft))) {
      return res.status(403).json({ error: 'Forbidden: You do not have access to this thread.' });
    }

    const [author, sub, soc, postDocs] = await Promise.all([
      User.findOne({ id: ft.author_id }).lean(),
      ft.subject_id ? Subject.findOne({ id: ft.subject_id }).lean() : null,
      ft.society_id ? Society.findOne({ id: ft.society_id }).lean() : null,
      ForumPost.find({ thread_id: threadId }).sort({ is_faculty_answer: -1, created_at: 1, id: 1 }).lean()
    ]);

    const thread = {
      ...ft,
      author_name: author?.full_name || '',
      author_avatar: author?.avatar_url || null,
      subject_code: sub ? sub.code : null,
      subject_name: sub ? sub.name : null,
      society_name: soc ? soc.name : null
    };

    const postAuthorIds = [...new Set(postDocs.map(p => p.author_id))];
    const postIds = postDocs.map(p => p.id);
    const [postUsers, likes] = await Promise.all([
      postAuthorIds.length ? User.find({ id: { $in: postAuthorIds } }).lean() : [],
      postIds.length ? ForumLike.find({ post_id: { $in: postIds } }).lean() : []
    ]);

    const uMap = Object.fromEntries(postUsers.map(u => [u.id, u]));
    const likeCounts = {};
    const userLiked = new Set();
    for (const l of likes) {
      likeCounts[l.post_id] = (likeCounts[l.post_id] || 0) + 1;
      if (l.user_id === req.user.id) userLiked.add(l.post_id);
    }

    const posts = postDocs.map(fp => {
      const pu = uMap[fp.author_id];
      return {
        ...fp,
        author_name: pu?.full_name || '',
        author_avatar: pu?.avatar_url || null,
        like_count: likeCounts[fp.id] || 0,
        user_has_liked: userLiked.has(fp.id) ? 1 : 0
      };
    });

    res.json({ thread, posts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/forum/threads/:id/posts - Reply to a thread (supports nested parentPostId)
router.post('/threads/:id/posts', verifyToken, requirePermission('forum', 'reply'), async (req, res) => {
  try {
    const threadId = Number(req.params.id);
    const { body, parentPostId } = req.body;

    if (!body || !body.trim()) {
      return res.status(400).json({ error: 'Reply body is required' });
    }

    const thread = await ForumThread.findOne({ id: threadId }).lean();
    if (!thread) return res.status(404).json({ error: 'Thread not found' });
    if (!(await canAccessThread(req, thread))) {
      return res.status(403).json({ error: 'Forbidden: You cannot reply to this thread.' });
    }

    const id = await getNextId('forum_posts');
    await ForumPost.create({
      id,
      thread_id: threadId,
      parent_post_id: parentPostId ? Number(parentPostId) : null,
      author_id: req.user.id,
      author_role: req.user.role,
      body: body.trim(),
      is_faculty_answer: 0
    });

    await ForumThread.updateOne({ id: threadId }, { $set: { last_activity_at: new Date().toISOString() } });

    res.status(201).json({ id, message: 'Reply posted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/forum/posts/:postId/like - Toggle like on a post
router.post('/posts/:postId/like', verifyToken, requirePermission('forum', 'like'), async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    const post = await ForumPost.findOne({ id: postId }).lean();
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const thread = await ForumThread.findOne({ id: post.thread_id }).lean();
    if (!(await canAccessThread(req, thread))) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const existing = await ForumLike.findOne({ post_id: postId, user_id: req.user.id }).lean();
    let liked = false;
    if (existing) {
      await ForumLike.deleteOne({ id: existing.id });
    } else {
      const id = await getNextId('forum_likes');
      await ForumLike.create({
        id,
        post_id: postId,
        user_id: req.user.id,
        user_role: req.user.role
      });
      liked = true;
    }

    const likeCount = await ForumLike.countDocuments({ post_id: postId });
    res.json({ postId, liked, likeCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/forum/posts/:postId/verify - Faculty or Admin marks/unmarks a post as accepted/verified answer
router.put('/posts/:postId/verify', verifyToken, requirePermission('forum', 'verify'), async (req, res) => {
  try {
    const postId = Number(req.params.postId);
    const post = await ForumPost.findOne({ id: postId }).lean();
    if (!post) return res.status(404).json({ error: 'Post not found' });

    const thread = await ForumThread.findOne({ id: post.thread_id }).lean();
    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    if (
      req.user.role === 'faculty' &&
      thread.scope === 'subject' &&
      !(await facultyTeachesSubject(req.faculty?.id, thread.subject_id))
    ) {
      return res.status(403).json({ error: 'Forbidden: You can only verify answers in subjects you teach.' });
    }

    const nextState = post.is_faculty_answer ? 0 : 1;
    await ForumPost.updateOne({ id: postId }, { $set: { is_faculty_answer: nextState } });

    const anyVerified = await ForumPost.findOne({ thread_id: thread.id, is_faculty_answer: 1 }).lean();
    await ForumThread.updateOne({ id: thread.id }, { $set: { is_resolved: anyVerified ? 1 : 0 } });

    res.json({ postId, is_faculty_answer: nextState, is_resolved: anyVerified ? 1 : 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/forum/threads/:id - Delete thread (Admin or Author)
router.delete('/threads/:id', verifyToken, async (req, res) => {
  try {
    const threadId = Number(req.params.id);
    const thread = await ForumThread.findOne({ id: threadId }).lean();
    if (!thread) return res.status(404).json({ error: 'Thread not found' });

    if (req.user.role !== 'admin' && thread.author_id !== req.user.id) {
      return res.status(403).json({ error: 'Forbidden: Only admin or thread author can delete this thread.' });
    }

    const posts = await ForumPost.find({ thread_id: threadId }, { id: 1 }).lean();
    const postIds = posts.map(p => p.id);
    if (postIds.length) await ForumLike.deleteMany({ post_id: { $in: postIds } });
    await ForumPost.deleteMany({ thread_id: threadId });
    await ForumThread.deleteOne({ id: threadId });

    res.json({ message: 'Thread deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
