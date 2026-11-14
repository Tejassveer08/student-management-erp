const express = require('express');
const { InstitutionSetting, AuditLog, User } = require('../db/database');
const { verifyToken, requirePermission, logAudit } = require('../middleware/authMiddleware');
const { invalidatePolicy, normaliseScale } = require('../services/policy');
const { invalidatePredictions } = require('../services/predictions');
const { invalidateMerit } = require('../services/merit');
const { regradeAllMarks, recomputeCgpa } = require('../services/academicRecord');

/** Validate a policy value before it is stored; returns an error string or null */
function validateSetting(key, value) {
  const num = Number(value);
  const parse = () => (typeof value === 'object' ? value : JSON.parse(value));
  try {
    if (key === 'attendance_threshold' && !(num >= 50 && num <= 100)) return 'Attendance threshold must be between 50 and 100';
    if (key === 'late_fee_per_day' && !(num >= 0 && num <= 10000)) return 'Late fee must be between 0 and 10,000';
    if (key === 'cgpa_probability_weights') {
      const w = parse();
      const vals = ['internal_weight', 'difficulty_weight', 'attendance_weight'].map((k) => Number(w[k]));
      if (vals.some((v) => !(v >= 0 && v <= 1))) return 'Each weight must be between 0 and 1';
      if (Math.abs(vals.reduce((a, b) => a + b, 0) - 1) > 0.011) return 'Model weights must add up to 1.0';
    }
    if (key === 'grading_scale') {
      const list = normaliseScale(parse());
      if (list.length < 2 || list[list.length - 1].min !== 0) return 'The grading scale needs at least two bands and one starting at 0';
    }
  } catch {
    return 'Value is not valid JSON';
  }
  return null;
}

const router = express.Router();

// GET /api/settings
router.get('/', verifyToken, requirePermission('settings', 'read'), async (req, res) => {
  const [settings, users] = await Promise.all([
    InstitutionSetting.find().sort({ category: 1, setting_key: 1 }).lean(),
    User.find({}, 'id full_name email').lean()
  ]);
  const userMap = Object.fromEntries(users.map(u => [u.id, u]));

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
      updated_by: userMap[s.updated_by]?.full_name || 'System'
    };
  });

  if (req.query.format === 'map') {
    const map = {};
    formattedArray.forEach(item => { map[item.setting_key] = item; });
    return res.json(map);
  }
  res.json(formattedArray);
});

// PUT /api/settings/:key
router.put('/:key', verifyToken, requirePermission('settings', 'update'), async (req, res) => {
  const { key } = req.params;
  const { value, reason } = req.body;

  if (value === undefined || value === null) {
    return res.status(400).json({ error: 'Setting value is required' });
  }

  const existing = await InstitutionSetting.findOne({ setting_key: key }).lean();
  if (!existing) {
    return res.status(404).json({ error: `Setting with key "${key}" not found` });
  }

  const problem = validateSetting(key, value);
  if (problem) return res.status(400).json({ error: problem });
  const stringVal = typeof value === 'object' ? JSON.stringify(value) : String(value);
  await InstitutionSetting.updateOne(
    { setting_key: key },
    { $set: { setting_value: stringVal, updated_by: req.user.id, updated_at: new Date() } }
  );

  await logAudit({
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

  // Make the new policy live everywhere
  invalidatePolicy();
  invalidatePredictions();
  invalidateMerit();
  let effect = '';
  if (key === 'grading_scale') {
    const regraded = await regradeAllMarks();
    const cgpas = await recomputeCgpa();
    effect = ` ${regraded} marks re-graded and ${cgpas} CGPAs recalculated.`;
  }
  res.json({ message: `Setting "${key}" updated.${effect}`, key, value });
});

// GET /api/settings/audit-logs
router.get('/audit-logs', verifyToken, requirePermission('audit_logs', 'read'), async (req, res) => {
  const { limit = 100, offset = 0, action } = req.query;
  const filter = {};
  if (action && action !== 'ALL') filter.action = action;

  const [logs, total] = await Promise.all([
    AuditLog.find(filter).sort({ created_at: -1, id: -1 }).skip(Number(offset)).limit(Number(limit)).lean(),
    AuditLog.countDocuments(filter)
  ]);

  const formattedLogs = logs.map(l => ({
    ...l,
    old_value: l.old_value ? (() => { try { return JSON.parse(l.old_value); } catch (e) { return l.old_value; } })() : null,
    new_value: l.new_value ? (() => { try { return JSON.parse(l.new_value); } catch (e) { return l.new_value; } })() : null
  }));

  res.setHeader('X-Total-Count', total);
  if (req.query.format === 'object') {
    return res.json({ total, logs: formattedLogs });
  }
  res.json(formattedLogs);
});

module.exports = router;
