const express = require('express');
const db = require('../db/database');
const { verifyToken, requirePermission, logAudit } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/settings - Fetch institutional settings (Admin only)
router.get('/', verifyToken, requirePermission('settings', 'read'), (req, res) => {
  const settings = db.prepare(`
    SELECT s.*, u.full_name as updated_by_name, u.email as updated_by_email
    FROM institution_settings s
    LEFT JOIN users u ON s.updated_by = u.id
    ORDER BY s.category ASC, s.setting_key ASC
  `).all();

  const formattedArray = settings.map(s => {
    let dataType = 'string';
    if (!isNaN(Number(s.setting_value)) && !isNaN(parseFloat(s.setting_value))) {
      dataType = 'number';
    } else {
      try {
        const parsed = JSON.parse(s.setting_value);
        if (typeof parsed === 'object') dataType = 'json';
      } catch (e) {}
    }

    return {
      setting_key: s.setting_key,
      setting_value: s.setting_value,
      description: s.description,
      category: s.category || 'General',
      data_type: dataType,
      updated_at: s.updated_at,
      updated_by: s.updated_by_name || 'System'
    };
  });

  // If query specifies format=map, return key-value map for backwards compatibility
  if (req.query.format === 'map') {
    const map = {};
    formattedArray.forEach(item => {
      map[item.setting_key] = item;
    });
    return res.json(map);
  }

  res.json(formattedArray);
});

// PUT /api/settings/:key - Update an institutional setting (Admin only with audit logging)
router.put('/:key', verifyToken, requirePermission('settings', 'update'), (req, res) => {
  const { key } = req.params;
  const { value, reason } = req.body;

  if (value === undefined || value === null) {
    return res.status(400).json({ error: 'Setting value is required' });
  }

  const existing = db.prepare('SELECT * FROM institution_settings WHERE setting_key = ?').get(key);
  if (!existing) {
    return res.status(404).json({ error: `Setting with key "${key}" not found` });
  }

  const stringVal = typeof value === 'object' ? JSON.stringify(value) : String(value);

  db.prepare(`
    UPDATE institution_settings
    SET setting_value = ?,
        updated_by = ?,
        updated_at = CURRENT_TIMESTAMP
    WHERE setting_key = ?
  `).run(stringVal, req.user.id, key);

  // Mandatory Audit Log
  logAudit({
    userId: req.user.id,
    userRole: req.user.role,
    userEmail: req.user.email,
    action: 'SETTINGS_UPDATE',
    entityType: 'institution_settings',
    entityId: key,
    oldValue: existing.setting_value,
    newValue: stringVal,
    reason: reason || 'Administrative policy update via Governance Console',
    ipAddress: req.ip
  });

  res.json({
    message: `Setting "${key}" updated successfully.`,
    key,
    value
  });
});

// GET /api/settings/audit-logs - View system audit logs (Admin only)
router.get('/audit-logs', verifyToken, requirePermission('audit_logs', 'read'), (req, res) => {
  const { limit = 100, offset = 0, action } = req.query;

  let query = `
    SELECT * FROM audit_logs
    WHERE 1=1
  `;
  const params = [];

  if (action && action !== 'ALL') {
    query += ` AND action = ?`;
    params.push(action);
  }

  query += ` ORDER BY created_at DESC LIMIT ? OFFSET ?`;
  params.push(Number(limit), Number(offset));

  const logs = db.prepare(query).all(...params);
  const total = db.prepare('SELECT COUNT(*) as count FROM audit_logs').get().count;

  const formattedLogs = logs.map(l => ({
    ...l,
    old_value: l.old_value ? (() => { try { return JSON.parse(l.old_value); } catch(e) { return l.old_value; } })() : null,
    new_value: l.new_value ? (() => { try { return JSON.parse(l.new_value); } catch(e) { return l.new_value; } })() : null
  }));

  res.setHeader('X-Total-Count', total);
  if (req.query.format === 'object') {
    return res.json({ total, logs: formattedLogs });
  }
  res.json(formattedLogs);
});

module.exports = router;
