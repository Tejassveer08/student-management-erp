const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { User, Student, Faculty, Course, Department } = require('../db/database');
const { verifyToken, JWT_SECRET } = require('../middleware/authMiddleware');

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
    const ward = await Student.findOne({ parent_user_id: user.id }).lean();
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
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = await User.findOne({ email: email.toLowerCase().trim() }).lean();
  if (!user || !bcrypt.compareSync(password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  const context = await getFullUserContext(user);
  res.json({ message: 'Login successful', token, ...context });
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res) => {
  const context = await getFullUserContext(req.user);
  res.json(context);
});

// POST /api/auth/quick-switch
router.post('/quick-switch', async (req, res) => {
  const { role, email } = req.body;
  let user = null;

  if (email) {
    user = await User.findOne({ email }).lean();
  } else if (role) {
    if (role === 'admin') {
      user = await User.findOne({ role: 'admin' }).lean();
    } else if (role === 'faculty') {
      user = (await User.findOne({ email: 'faculty.nandi@gtbit.ac.in' }).lean()) || (await User.findOne({ role: 'faculty' }).lean());
    } else if (role === 'student') {
      user = (await User.findOne({ email: 'tejassveer@gtbit.ac.in' }).lean()) || (await User.findOne({ role: 'student' }).lean());
    } else if (role === 'parent') {
      user = await User.findOne({ role: 'parent' }).lean();
    }
  }

  if (!user) {
    return res.status(404).json({ error: 'User not found for role switch' });
  }

  const token = jwt.sign({ id: user.id, email: user.email, role: user.role }, JWT_SECRET, { expiresIn: '7d' });
  const context = await getFullUserContext(user);
  res.json({ message: `Switched to ${user.role} persona: ${user.full_name}`, token, ...context });
});

// POST /api/auth/reset-password
router.post('/reset-password', async (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required' });
  }

  const user = await User.findOne({ email }).lean();
  if (!user) {
    return res.status(404).json({ error: 'No account registered with that email' });
  }

  const passwordHash = bcrypt.hashSync(newPassword, bcrypt.genSaltSync(10));
  await User.updateOne({ id: user.id }, { $set: { password_hash: passwordHash } });
  res.json({ message: 'Password reset successful. You may now log in with your new password.' });
});

module.exports = router;
