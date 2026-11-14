const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const { User, Student, Faculty, Course, Department, WardLink } = require('../db/database');
const { verifyToken, JWT_SECRET, logAudit } = require('../middleware/authMiddleware');

const router = express.Router();

async function getFullUserContext(user) {
  let studentProfile = null;
  let facultyProfile = null;
  let parentProfile = null;

  if (user.role === 'student') {
    const st = await Student.findOne({ user_id: user.id }).lean();
    if (st) {
      const [c, d] = await Promise.all([
        Course.findOne({ id: st.course_id }, 'name').lean(),
        Department.findOne({ id: st.department_id }, 'name').lean()
      ]);
      studentProfile = { ...st, course_name: c?.name, department_name: d?.name };
    }
  } else if (user.role === 'faculty') {
    const fac = await Faculty.findOne({ user_id: user.id }).lean();
    if (fac) {
      const d = await Department.findOne({ id: fac.department_id }, 'name').lean();
      facultyProfile = { ...fac, department_name: d?.name };
    }
  } else if (user.role === 'parent') {
    const link = await WardLink.findOne({ parent_user_id: user.id }).sort({ is_primary: -1, id: 1 }).lean();
    const ward = link ? await Student.findOne({ id: link.student_id }).lean() : null;
    if (ward) {
      const [wu, c, d] = await Promise.all([
        User.findOne({ id: ward.user_id }, 'full_name avatar_url').lean(),
        Course.findOne({ id: ward.course_id }, 'name').lean(),
        Department.findOne({ id: ward.department_id }, 'name').lean()
      ]);
      parentProfile = {
        ward: {
          ...ward,
          student_name: wu?.full_name,
          student_avatar: wu?.avatar_url,
          course_name: c?.name,
          department_name: d?.name
        }
      };
    } else {
      parentProfile = { ward: null };
    }
  }

  return {
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.full_name,
      phone: user.phone,
      avatarUrl: user.avatar_url
    },
    student: studentProfile,
    faculty: facultyProfile,
    parent: parentProfile
  };
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'ID / Email and password are required' });
  }

  const rawId = String(email).trim();
  const key = attemptKey(req, rawId);
  if (isLocked(key)) {
    return res.status(429).json({ error: 'Too many failed attempts. Try again in 15 minutes or ask the administrator to reset your password.' });
  }
  let user = await User.findOne({ email: rawId.toLowerCase() }).lean();

  if (!user) {
    const escaped = rawId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const studentByRoll = await Student.findOne({
      $or: [
        { roll_no: { $regex: `^${escaped}$`, $options: 'i' } },
        { enrollment_no: rawId }
      ]
    }).lean();
    if (studentByRoll) {
      user = await User.findOne({ id: studentByRoll.user_id }).lean();
    }
  }

  if (!user) {
    const escaped = rawId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const facByEmp = await Faculty.findOne({
      employee_id: { $regex: `^${escaped}$`, $options: 'i' }
    }).lean();
    if (facByEmp) {
      user = await User.findOne({ id: facByEmp.user_id }).lean();
    }
  }

  if (!user || !bcrypt.compareSync(String(password), user.password_hash)) {
    recordFail(key);
    return res.status(401).json({ error: 'Invalid ID/email or password' });
  }

  attempts.delete(key);
  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  const context = await getFullUserContext(user);
  res.json({ message: 'Login successful', token, ...context });
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  const context = await getFullUserContext(req.user);
  res.json(context);
});

// Simple in-memory brute-force guard: 8 failed attempts per IP+ID locks that pair for 15 minutes
const attempts = new Map();
const WINDOW_MS = 15 * 60 * 1000;
const MAX_FAILS = 8;
function attemptKey(req, id) { return `${req.ip}|${String(id).toLowerCase()}`; }
function isLocked(key) {
  const a = attempts.get(key);
  if (!a) return false;
  if (Date.now() - a.first > WINDOW_MS) { attempts.delete(key); return false; }
  return a.count >= MAX_FAILS;
}
function recordFail(key) {
  const a = attempts.get(key);
  if (!a || Date.now() - a.first > WINDOW_MS) attempts.set(key, { first: Date.now(), count: 1 });
  else a.count += 1;
}

function validatePassword(pw) {
  if (typeof pw !== 'string' || pw.length < 8) return 'Password must be at least 8 characters long';
  if (!/[A-Za-z]/.test(pw) || !/d/.test(pw)) return 'Password must contain letters and numbers';
  return null;
}

// POST /api/auth/change-password — signed-in user changes their own password
router.post('/change-password', verifyToken, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  const user = await User.findOne({ id: req.user.id }).lean();
  if (!user || !bcrypt.compareSync(String(currentPassword || ''), user.password_hash)) {
    return res.status(400).json({ error: 'Your current password is incorrect' });
  }
  const problem = validatePassword(newPassword);
  if (problem) return res.status(400).json({ error: problem });
  if (currentPassword === newPassword) return res.status(400).json({ error: 'Choose a password different from the current one' });
  await User.updateOne({ id: user.id }, { $set: { password_hash: bcrypt.hashSync(newPassword, 10) } });
  await logAudit({ userId: user.id, userRole: user.role, userEmail: user.email, action: 'PASSWORD_CHANGE', entityType: 'users', entityId: user.id, reason: 'User changed own password', ipAddress: req.ip });
  res.json({ message: 'Password updated' });
});

// POST /api/auth/admin-reset — admin issues a temporary password for any account (audited)
router.post('/admin-reset', verifyToken, async (req, res) => {
  if (req.user.role !== 'admin') return res.status(403).json({ error: 'Only administrators can reset passwords' });
  const { userId, email, studentId, reason } = req.body || {};
  if (!reason || String(reason).trim().length < 5) return res.status(400).json({ error: 'A reason (min 5 characters) is required' });
  let target = null;
  if (userId) target = await User.findOne({ id: Number(userId) }).lean();
  else if (email) target = await User.findOne({ email: String(email).toLowerCase() }).lean();
  else if (studentId) {
    const st = await Student.findOne({ id: Number(studentId) }).lean();
    if (st) target = await User.findOne({ id: st.user_id }).lean();
  }
  if (!target) return res.status(404).json({ error: 'Account not found' });
  const temp = `GTB-${crypto.randomBytes(3).toString('hex')}-${crypto.randomInt(100, 999)}`;
  await User.updateOne({ id: target.id }, { $set: { password_hash: bcrypt.hashSync(temp, 10) } });
  await logAudit({ userId: req.user.id, userRole: req.user.role, userEmail: req.user.email, action: 'PASSWORD_RESET', entityType: 'users', entityId: target.id, newValue: { account: target.email }, reason, ipAddress: req.ip });
  res.json({ message: `Temporary password issued for ${target.email}`, email: target.email, temporaryPassword: temp });
});

module.exports = router;
