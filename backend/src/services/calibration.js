/**
 * Self-calibration of the CGPA engine against the institution's own declared results.
 *
 * For every declared end-term result whose internal and assignment marks were known
 * before the external exam (the situation the engine forecasts), compare the engine's
 * raw external projection with the external mark actually obtained, and fit
 *     external% ≈ a + b × projection          (ordinary least squares)
 * Then choose a band multiplier k so that about 80% of declared subject totals fall
 * inside the predicted band. The result is stored as the `cgpa_calibration` policy
 * (visible in Governance) and refitted at start-up and whenever results are published.
 */
const { Examination, ExamMark, Student, InstitutionSetting } = require('../db/database');
const { getPolicy, invalidatePolicy } = require('./policy');
const { calculateCGPAPredictionJS } = require('./cgpaCalculator');

const IDENTITY = { a: 0, b: 1, k: 1 };
const COVERAGE = 0.8;
const r3 = (v) => Math.round(v * 1000) / 1000;

/** Pairs of (engine output, declared mark) for students whose own semester has declared end-term results */
async function collectPairs(semesters) {
  const { buildPayloads } = require('./predictions');
  const declared = await Examination.find({ status: 'Results_Declared', exam_type: 'Major' }).lean();
  const semExam = Object.fromEntries(declared.filter((e) => !semesters || semesters.includes(e.semester)).map((e) => [e.semester, e]));
  const sems = Object.keys(semExam).map(Number);
  if (!sems.length) return [];
  const students = await Student.find({ status: 'Active', semester: { $in: sems } }).lean();
  const payloads = await buildPayloads(students, {}, { calibration: IDENTITY });
  const marks = await ExamMark.find({ exam_id: { $in: Object.values(semExam).map((e) => e.id) }, student_id: { $in: students.map((s) => s.id) } }).lean();
  const idx = new Map(marks.map((m) => [`${m.student_id}|${m.subject_id}|${m.exam_id}`, m]));
  const pairs = [];
  students.forEach((st, i) => {
    const res = calculateCGPAPredictionJS(payloads[i]);
    const exam = semExam[st.semester];
    for (const s of res.subjects) {
      const m = idx.get(`${st.id}|${s.subject_id}|${exam.id}`);
      if (!m || !s.has_internal_marks) continue;
      pairs.push({
        x: s.external_projection,
        y: (m.external_exam / 60) * 100,
        coursework: s.coursework_marks,
        actualTotal: m.total_score,
        baseMargin: Math.max(0.5, Math.max(s.score_range[1] - s.predicted_score, s.predicted_score - s.score_range[0])),
        semester: st.semester,
        student_id: st.id
      });
    }
  });
  return pairs;
}

function fit(pairs) {
  if (pairs.length < 30) return { ...IDENTITY, n: pairs.length };
  const n = pairs.length;
  const mx = pairs.reduce((a, p) => a + p.x, 0) / n;
  const my = pairs.reduce((a, p) => a + p.y, 0) / n;
  let sxy = 0;
  let sxx = 0;
  for (const p of pairs) {
    sxy += (p.x - mx) * (p.y - my);
    sxx += (p.x - mx) ** 2;
  }
  const b = Math.max(0.3, Math.min(1.6, sxx > 0 ? sxy / sxx : 1));
  const a = my - b * mx;
  const ratios = pairs
    .map((p) => {
      const pred = p.coursework + (Math.max(0, Math.min(100, a + b * p.x)) / 100) * 60;
      return Math.abs(p.actualTotal - pred) / p.baseMargin;
    })
    .sort((u, v) => u - v);
  const k = Math.max(0.6, Math.min(3, ratios[Math.floor(COVERAGE * (ratios.length - 1))]));
  const rmse = Math.sqrt(pairs.reduce((acc, p) => acc + (p.y - Math.max(0, Math.min(100, a + b * p.x))) ** 2, 0) / n);
  return { a: r3(a), b: r3(b), k: r3(k), n, external_rmse_pct: r3(rmse) };
}

async function fitCalibration(semesters) {
  return fit(await collectPairs(semesters));
}

/** Fit on every declared result and store it as the live policy */
async function refreshCalibration() {
  const c = await fitCalibration();
  if (c.n < 30) return c;
  const value = JSON.stringify({ a: c.a, b: c.b, k: c.k });
  await InstitutionSetting.updateOne(
    { setting_key: 'cgpa_calibration' },
    {
      $set: {
        setting_value: value,
        description: `Auto-fitted on ${c.n} declared end-term results (external ≈ a + b × projection; band × k for ~80% coverage). Refits when results are published.`,
        category: 'Analytics',
        updated_at: new Date()
      }
    },
    { upsert: true }
  );
  invalidatePolicy();
  require('./predictions').invalidatePredictions();
  await getPolicy();
  return c;
}

module.exports = { fitCalibration, refreshCalibration, collectPairs, fit, IDENTITY };
