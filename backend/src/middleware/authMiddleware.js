const jwt = require('jsonwebtoken');
const db = require('../db/database');
const permissions = require('../config/permissions.json');

const JWT_SECRET = process.env.JWT_SECRET || 'erp_gtbit_jwt_secret_super_secure_key_2026';

/**
 * Verify JWT token from Authorization header and attach user context to req.user
 */
function verifyToken(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Authorization token required' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const user = db.prepare('SELECT id, email, role, full_name, phone, avatar_url FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(401).json({ error: 'User not found or account deactivated' });
    }
    req.user = user;

    // Attach role-specific scoping context
    if (user.role === 'faculty') {
      const fac = db.prepare('SELECT id, employee_id, department_id FROM faculty WHERE user_id = ?').get(user.id);
      if (fac) {
        req.faculty = fac;
        // Fetch all assigned class & subject mappings
        req.facultyClassMap = db.prepare(`
          SELECT fcm.*, s.name as subject_name, s.code as subject_code
          FROM faculty_class_map fcm
          JOIN subjects s ON fcm.subject_id = s.id
          WHERE fcm.faculty_id = ?
        `).all(fac.id);
      }
    } else if (user.role === 'student') {
      const st = db.prepare('SELECT id, roll_no, enrollment_no, semester, section, department_id, course_id FROM students WHERE user_id = ?').get(user.id);
      if (st) {
        req.student = st;
      }
    } else if (user.role === 'parent') {
      const wards = db.prepare(`
        SELECT wl.student_id, wl.relationship, wl.is_primary,
               s.roll_no, s.enrollment_no, s.semester, s.section,
               u.full_name as student_name, u.email as student_email
        FROM ward_links wl
        JOIN students s ON wl.student_id = s.id
        JOIN users u ON s.user_id = u.id
        WHERE wl.parent_user_id = ?
      `).all(user.id);
      req.parentWards = wards;
    }

    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired session token' });
  }
}

/**
 * RBAC Role Guard - checks if req.user has one of the allowed roles
 */
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

/**
 * RBAC Permission Guard - checks if user role has [action] permission for [module]
 * based on single source of truth permissions.json
 */
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
        role: role
      });
    }

    next();
  };
}

/**
 * Helper to record audit log entry for Admin overrides or destructive actions
 */
function logAudit({ userId, userRole, userEmail, action, entityType, entityId, oldValue, newValue, reason, ipAddress }) {
  try {
    const stmt = db.prepare(`
      INSERT INTO audit_logs (
        user_id, user_role, user_email, action,
        entity_type, entity_id, old_value, new_value,
        reason, ip_address
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.run(
      userId,
      userRole,
      userEmail,
      action,
      entityType,
      String(entityId),
      oldValue ? (typeof oldValue === 'string' ? oldValue : JSON.stringify(oldValue)) : null,
      newValue ? (typeof newValue === 'string' ? newValue : JSON.stringify(newValue)) : null,
      reason || 'Administrative action',
      ipAddress || '127.0.0.1'
    );
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
