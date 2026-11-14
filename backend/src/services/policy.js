/**
 * Institution policy service.
 *
 * Every governance setting an admin can edit in the Governance console is read
 * through here, so a change takes effect everywhere (attendance eligibility,
 * grading, late fines, CGPA model weights) within a few seconds.
 */
const { InstitutionSetting } = require('../db/database');

// Official GGSIPU 10-point absolute grading scheme
const DEFAULT_GRADING_SCALE = {
  O: { min: 90, points: 10, label: 'Outstanding' },
  'A+': { min: 75, points: 9, label: 'Excellent' },
  A: { min: 65, points: 8, label: 'Very Good' },
  'B+': { min: 55, points: 7, label: 'Good' },
  B: { min: 50, points: 6, label: 'Above Average' },
  C: { min: 45, points: 5, label: 'Average' },
  P: { min: 40, points: 4, label: 'Pass' },
  F: { min: 0, points: 0, label: 'Fail' }
};

const DEFAULT_WEIGHTS = { internal_weight: 0.45, difficulty_weight: 0.35, attendance_weight: 0.2 };

const TTL_MS = 15 * 1000;
let cache = null;
let cachedAt = 0;

function parseJson(value, fallback) {
  try {
    const v = JSON.parse(value);
    return v && typeof v === 'object' ? v : fallback;
  } catch {
    return fallback;
  }
}

/** Grading scale as a list sorted from the highest band down */
function normaliseScale(scaleObj) {
  const list = Object.entries(scaleObj || {})
    .map(([grade, v]) => ({ grade, min: Number(v.min), points: Number(v.points), label: v.label || grade }))
    .filter((g) => Number.isFinite(g.min) && Number.isFinite(g.points))
    .sort((a, b) => b.min - a.min);
  return list.length ? list : normaliseScale(DEFAULT_GRADING_SCALE);
}

async function load() {
  const rows = await InstitutionSetting.find({}).lean();
  const map = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
  const threshold = Number.parseFloat(map.attendance_threshold);
  const lateFee = Number.parseFloat(map.late_fee_per_day);
  const weights = { ...DEFAULT_WEIGHTS, ...parseJson(map.cgpa_probability_weights, {}) };
  const scaleObj = parseJson(map.grading_scale, DEFAULT_GRADING_SCALE);
  return {
    attendanceThreshold: Number.isFinite(threshold) ? threshold : 75,
    lateFeePerDay: Number.isFinite(lateFee) ? lateFee : 100,
    academicSession: map.academic_session || '2025-2026',
    cgpaWeights: {
      internal_weight: Number(weights.internal_weight) || 0,
      difficulty_weight: Number(weights.difficulty_weight) || 0,
      attendance_weight: Number(weights.attendance_weight) || 0
    },
    gradingScale: normaliseScale(scaleObj)
  };
}

/** Current policy (cached for a few seconds) */
async function getPolicy() {
  if (!cache || Date.now() - cachedAt > TTL_MS) {
    cache = await load();
    cachedAt = Date.now();
  }
  return cache;
}

function invalidatePolicy() {
  cache = null;
}

/** Letter grade + grade points for a 0-100 score under the given scale */
function gradeFor(score, scale) {
  const s = Number(score) || 0;
  const list = scale || normaliseScale(DEFAULT_GRADING_SCALE);
  const band = list.find((g) => s >= g.min) || list[list.length - 1];
  return { grade: band.grade, gp: band.points, desc: band.label };
}

/** Lowest passing mark under the scale (first band with points > 0, from the bottom) */
function passMark(scale) {
  const list = scale || normaliseScale(DEFAULT_GRADING_SCALE);
  const passing = list.filter((g) => g.points > 0);
  return passing.length ? passing[passing.length - 1].min : 40;
}

module.exports = {
  DEFAULT_GRADING_SCALE,
  DEFAULT_WEIGHTS,
  getPolicy,
  invalidatePolicy,
  gradeFor,
  passMark,
  normaliseScale
};
