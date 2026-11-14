const jwt = require('jsonwebtoken');
const { User, Faculty, FacultyClassMap, Subject, Student, WardLink, AuditLog, getNextId } = require('../db/database');
const permissions = require('../config/permissions.json');

const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'gtbit-erp-development-only-secret');
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in the environment when NODE_ENV=production');
}
if (!process.env.JWT_SECRET) console.warn('⚠️  JWT_SECRET is not set — using a development-only secret. Set it in backend/.env.');

async function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = await User.findOne({ id: decoded.id }, 'id email role full_name phone avatar_url').lean();
    if (!user) {
      return res.status(401).json({ error: 'User not found or account deactivated' });
    }
    req.user = user;

    if (user.role === 'faculty') {
      const fac = await Faculty.findOne({ user_id: user.id }, 'id employee_id department_id').lean();
      if (fac) {
        req.faculty = fac;
        const maps = await FacultyClassMap.find({ faculty_id: fac.id }).lean();
        const subIds = maps.map(m => m.subject_id);
        const subs = await Subject.find({ id: { $in: subIds } }, 'id name code').lean();
        const subMap = Object.fromEntries(subs.map(s => [s.id, s]));
        req.facultyClassMap = maps.map(m => ({
          ...m,
          subject_name: subMap[m.subject_id]?.name,
          subject_code: subMap[m.subject_id]?.code
        }));
      }
    } else if (user.role === 'student') {
      const st = await Student.findOne({ user_id: user.id }, 'id roll_no enrollment_no semester section department_id course_id').lean();
      if (st) {
        req.student = st;
      }
    } else if (user.role === 'parent') {
      const links = await WardLink.find({ parent_user_id: user.id }).lean();
      const sIds = links.map(l => l.student_id);
      const students = await Student.find({ id: { $in: sIds } }).lean();
      const uIds = students.map(s => s.user_id);
      const users = await User.find({ id: { $in: uIds } }, 'id full_name email').lean();
      const stMap = Object.fromEntries(students.map(s => [s.id, s]));
      const uMap = Object.fromEntries(users.map(u => [u.id, u]));
      req.parentWards = links.map(wl => {
        const s = stMap[wl.student_id] || {};
        const u = uMap[s.user_id] || {};
        return {
          student_id: wl.student_id,
          relationship: wl.relationship,
          is_primary: wl.is_primary,
          roll_no: s.roll_no,
          enrollment_no: s.enrollment_no,
          semester: s.semester,
          section: s.section,
          student_name: u.full_name,
          student_email: u.email
        };
      });
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

function requireRoles(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        error: `Access denied. Requires one of roles: ${allowedRoles.join(', ')}`,
        currentRole: req.user?.role || 'anonymous'
      });
    }
    next();
  };
}

function requirePermission(moduleName, action) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const role = req.user.role;
    const modulePerms = permissions[role]?.[moduleName] || [];
    if (!modulePerms.includes(action)) {
      return res.status(403).json({
        error: `Permission denied: Role "${role}" does not have "${action}" permission on module "${moduleName}".`,
        module: moduleName,
        requiredAction: action,
        role
      });
    }
    next();
  };
}

async function logAudit({ userId, userRole, userEmail, action, entityType, entityId, oldValue, newValue, reason, ipAddress }) {
  try {
    const id = await getNextId('audit_logs');
    await AuditLog.create({
      id,
      user_id: userId,
      user_role: userRole,
      user_email: userEmail,
      action,
      entity_type: entityType,
      entity_id: String(entityId),
      old_value: oldValue ? (typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue)) : null,
      new_value: newValue ? (typeof newValue === 'string' ? newValue : JSON.stringify(newValue)) : null,
      reason: reason || 'Administrative action',
      ip_address: ipAddress || '127.0.0.1'
    });
  } catch (err) {
    console.error('Failed to write audit log:', err.message);
  }
}

module.exports = {
  verifyToken,
  requireRoles,
  requirePermission,
  logAudit,
  JWT_SECRET
};
