const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('../db/database');
const { verifyToken, JWT_SECRET } = require('../middleware/authMiddleware');

const router = express.Router();

function getFullUserContext(user) {
  let studentProfile = null;
  let facultyProfile = null;
  let parentProfile = null;

  if (user.role === 'student') {
    studentProfile = db.prepare(`
      SELECT s.*, c.name as course_name, d.name as department_name
      FROM students s
      JOIN courses c ON s.course_id = c.id
      JOIN departments d ON s.department_id = d.id
      WHERE s.user_id = ?
    `).get(user.id);
  } else if (user.role === 'faculty') {
    facultyProfile = db.prepare(`
      SELECT f.*, d.name as department_name
      FROM faculty f
      JOIN departments d ON f.department_id = d.id
      WHERE f.user_id = ?
    `).get(user.id);
  } else if (user.role === 'parent') {
    // Find student associated with this parent
    const ward = db.prepare(`
      SELECT s.*, u.full_name as student_name, u.avatar_url as student_avatar,
             c.name as course_name, d.name as department_name
      FROM students s
      JOIN users u ON s.user_id = u.id
      JOIN courses c ON s.course_id = c.id
      JOIN departments d ON s.department_id = d.id
      WHERE s.parent_user_id = ?
    `).get(user.id);

    parentProfile = {
      ward: ward || null
    };
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
router.post('/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase().trim());
  if (!user) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const isMatch = bcrypt.compareSync(password, user.password_hash);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const context = getFullUserContext(user);
  res.json({
    message: 'Login successful',
    token,
    ...context
  });
});

// GET /api/auth/me
router.get('/me', verifyToken, (req, res) => {
  const context = getFullUserContext(req.user);
  res.json(context);
});

// POST /api/auth/quick-switch
// Allows examiners and testers to effortlessly switch between Admin, Faculty, Student, and Parent roles
router.post('/quick-switch', (req, res) => {
  const { role, email } = req.body;

  let user = null;
  if (email) {
    user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  } else if (role) {
    // Pick standard representative user for this role
    if (role === 'admin') {
      user = db.prepare('SELECT * FROM users WHERE role = ? LIMIT 1').get('admin');
    } else if (role === 'faculty') {
      user = db.prepare('SELECT * FROM users WHERE email = ? OR role = ? LIMIT 1').get('faculty.nandi@gtbit.ac.in', 'faculty');
    } else if (role === 'student') {
      user = db.prepare('SELECT * FROM users WHERE email = ? OR role = ? LIMIT 1').get('tejassveer@gtbit.ac.in', 'student');
    } else if (role === 'parent') {
      user = db.prepare('SELECT * FROM users WHERE role = ? LIMIT 1').get('parent');
    }
  }

  if (!user) {
    return res.status(404).json({ error: 'User not found for role switch' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    JWT_SECRET,
    { expiresIn: '7d' }
  );

  const context = getFullUserContext(user);
  res.json({
    message: `Switched to ${user.role} persona: ${user.full_name}`,
    token,
    ...context
  });
});

// POST /api/auth/reset-password
router.post('/reset-password', (req, res) => {
  const { email, newPassword } = req.body;
  if (!email || !newPassword) {
    return res.status(400).json({ error: 'Email and new password are required' });
  }

  const user = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (!user) {
    return res.status(404).json({ error: 'No account registered with that email' });
  }

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync(newPassword, salt);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(passwordHash, user.id);

  res.json({ message: 'Password reset successful. You may now log in with your new password.' });
});

module.exports = router;
