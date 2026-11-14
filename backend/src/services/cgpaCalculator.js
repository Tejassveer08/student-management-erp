/**
 * CGPA Probability engine.
 *
 * One model, two implementations that must stay in step:
 *   - python_service/cgpa_engine.py — run as a single long-lived worker process
 *     (newline-delimited JSON over stdin/stdout) so batches of hundreds of students
 *     are scored in one round trip;
 *   - the JavaScript port below, used automatically whenever Python is unavailable
 *     (or when CGPA_ENGINE=js).
 *
 * The model reads the institution's live policy: the attendance threshold, the
 * grading scale and the CGPA model weights from the Governance console.
 *
 * Per subject (marks are out of 100 = internal 25 + assignment 15 + external 60):
 *   coursework% = 0.65·internal% + 0.35·assignment%
 *   ease%       = (1 − difficulty)·100
 *   external%   = (w_i·coursework% + w_a·attendance% + w_d·ease%) / (w_i + w_a + w_d)
 *                 × attendance penalty when below the threshold
 *   predicted   = internal + assignment (actual, or projected from coursework) + 0.60·external% + what-if
 *   band        = ± (2.5 + 4·difficulty + 0.12·shortfall below threshold + 3.5–5 if no internals yet)
 *   prior       = without internals: 60% the student's own CGPA level, 40% the subject's historical average
 *   confidence  = 40 + 57 × (0.55·evidence + 0.15·attendance coverage + 0.30·SGPA-band tightness)
 *                 evidence = share of credits with recorded internals (+45% credit for the rest if the
 *                 student has a CGPA history); attendance coverage saturates at 10 classes per subject
 */
const { spawn } = require('child_process');
const path = require('path');
const readline = require('readline');
const { gradeFor, passMark, DEFAULT_WEIGHTS, normaliseScale, DEFAULT_GRADING_SCALE } = require('./policy');

const MAX_INTERNAL = 25;
const MAX_ASSIGNMENT = 15;
const EXTERNAL_SHARE = 60;

function calculateSubjectDifficulty(passPct, avgMarks) {
  const normPass = Math.max(0, Math.min(100, Number(passPct))) / 100.0;
  const normMarks = Math.max(0, Math.min(100, Number(avgMarks))) / 100.0;
  const rawDifficulty = 1.0 - (0.55 * normMarks + 0.45 * normPass);
  return Number(Math.max(0.10, Math.min(0.90, rawDifficulty)).toFixed(3));
}

const round1 = (v) => Math.round(v * 10) / 10;
const round2 = (v) => Math.round(v * 100) / 100;
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

function predictSubject(item, policy, adjustment = 0, ctx = {}) {
  const scale = policy.scale;
  const threshold = policy.threshold;
  const w = policy.weights;
  const wSum = (w.internal_weight + w.attendance_weight + w.difficulty_weight) || 1;

  const hasMarks = item.internal_score !== null && item.internal_score !== undefined;
  const maxInternal = Number(item.max_internal || MAX_INTERNAL);
  const maxAssignment = Number(item.max_assignment || MAX_ASSIGNMENT);
  // Without recorded internals, lean on the student's own record (CGPA) blended with the subject's history
  const hist = clamp(Number(item.historical_avg_marks ?? 70), 0, 100) / 100;
  const own = ctx.cgpa > 0 ? clamp(ctx.cgpa * 10 - 5, 0, 100) / 100 : null;
  const prior = own !== null ? 0.6 * own + 0.4 * hist : hist;
  const internal = hasMarks ? Number(item.internal_score) : prior * maxInternal;
  const assignment = item.assignment_score !== null && item.assignment_score !== undefined ? Number(item.assignment_score) : prior * maxAssignment;

  const internalPct = maxInternal > 0 ? (internal / maxInternal) * 100 : 70;
  const assignmentPct = maxAssignment > 0 ? (assignment / maxAssignment) * 100 : 70;
  const coursework = 0.65 * internalPct + 0.35 * assignmentPct;

  const difficulty = Number(item.difficulty_index ?? calculateSubjectDifficulty(item.historical_pass_pct ?? 85, item.historical_avg_marks ?? 70));
  const att = clamp(Number(item.attendance_pct ?? 100), 0, 100);
  const ease = (1 - difficulty) * 100;

  let externalPct = (w.internal_weight * coursework + w.attendance_weight * att + w.difficulty_weight * ease) / wSum;
  if (att < threshold) externalPct *= Math.max(0.6, 1 - 0.012 * (threshold - att));

  const courseworkMarks = (internal / maxInternal) * MAX_INTERNAL + (assignment / maxAssignment) * MAX_ASSIGNMENT;
  const raw = courseworkMarks + (externalPct / 100) * EXTERNAL_SHARE + Number(adjustment || 0);
  const predicted = round1(clamp(raw, 0, 100));

  const margin = 2.5 + difficulty * 4 + Math.max(0, threshold - att) * 0.12 + (hasMarks ? 0 : ctx.cgpa > 0 ? 3.5 : 5);
  const lo = round1(clamp(predicted - margin, 0, 100));
  const hi = round1(clamp(predicted + margin, 0, 100));

  const exp = gradeFor(predicted, scale);
  const pass = passMark(scale);

  let warning = null;
  if (att < threshold) warning = `Low attendance (${att.toFixed(1)}%) breaches the ${threshold}% eligibility rule`;
  else if (difficulty >= 0.65 && coursework < 60) warning = `High-difficulty subject (${difficulty.toFixed(2)}) with weak coursework (${coursework.toFixed(1)}%)`;
  else if (predicted < pass + 10) warning = `Projected score ${predicted.toFixed(1)} is close to the pass mark (${pass})`;

  return {
    subject_id: item.id,
    subject_code: item.code,
    subject_name: item.name,
    credits: Number(item.credits || 4),
    predicted_score: predicted,
    score_range: [lo, hi],
    predicted_grade_point: exp.gp,
    predicted_grade: exp.grade,
    grade_range: [gradeFor(lo, scale).grade, gradeFor(hi, scale).grade],
    difficulty_index: round2(difficulty),
    attendance_pct: round1(att),
    coursework_score: round1(coursework),
    has_internal_marks: hasMarks,
    classes_held: Number(item.classes_held || 0),
    hypothetical_adjustment: Number(adjustment || 0),
    is_at_risk: Boolean(warning),
    warning_reason: warning
  };
}

function resolvePolicy(p = {}) {
  return {
    threshold: Number(p.threshold ?? 75),
    weights: { ...DEFAULT_WEIGHTS, ...(p.weights || {}) },
    scale: p.scale && p.scale.length ? p.scale : normaliseScale(DEFAULT_GRADING_SCALE)
  };
}

/** Pure-JS scoring of one student payload */
function calculateCGPAPredictionJS(payload) {
  const policy = resolvePolicy(payload.policy);
  const currentCgpa = Number(payload.current_cgpa || 0);
  const previousCredits = Number(payload.previous_credits || 0);
  const whatIf = payload.what_if_adjustments || {};

  const hasHistory = previousCredits > 0 && currentCgpa > 0;
  const subjects = (payload.subjects || []).map((it) => predictSubject(it, policy, whatIf[String(it.id)] || 0, { cgpa: hasHistory ? currentCgpa : 0 }));
  let credits = 0;
  let exp = 0;
  let lo = 0;
  let hi = 0;
  for (const s of subjects) {
    credits += s.credits;
    exp += s.predicted_grade_point * s.credits;
    lo += gradeFor(s.score_range[0], policy.scale).gp * s.credits;
    hi += gradeFor(s.score_range[1], policy.scale).gp * s.credits;
  }
  const sgpa = credits ? round2(exp / credits) : currentCgpa;
  const sgpaLo = credits ? round2(lo / credits) : currentCgpa;
  const sgpaHi = credits ? round2(hi / credits) : currentCgpa;
  const total = previousCredits + credits;
  const blend = (v) => (total ? round2((currentCgpa * previousCredits + v * credits) / total) : v);

  // Confidence = how much real evidence backs the forecast, and how tight it is
  const cr = credits || 1;
  const markedCredits = subjects.reduce((a, s) => a + (s.has_internal_marks ? s.credits : 0), 0);
  const internalCoverage = markedCredits / cr;
  const attendanceCoverage = subjects.reduce((a, s) => a + s.credits * Math.min(1, s.classes_held / 10), 0) / cr;
  const evidence = internalCoverage + (1 - internalCoverage) * (hasHistory ? 0.45 : 0);
  const tightness = clamp(1 - (sgpaHi - sgpaLo) / 3, 0, 1);
  const confidence = Math.round(clamp(40 + 57 * (0.55 * evidence + 0.15 * attendanceCoverage + 0.3 * tightness), 40, 97));
  const atRisk = subjects.filter((s) => s.is_at_risk).map((s) => ({
    subject_code: s.subject_code,
    subject_name: s.subject_name,
    reason: s.warning_reason,
    predicted_grade: s.predicted_grade,
    predicted_score: s.predicted_score
  }));

  return {
    engine: 'JavaScript weighted model',
    predicted_sgpa: sgpa,
    sgpa_range: [sgpaLo, sgpaHi],
    predicted_cgpa: blend(sgpa),
    cgpa_range: [blend(sgpaLo), blend(sgpaHi)],
    confidence_score: confidence,
    confidence_level: confidence >= 80 ? 'High' : confidence >= 65 ? 'Moderate' : 'Low',
    confidence_basis: {
      internal_coverage: round2(internalCoverage),
      attendance_coverage: round2(attendanceCoverage),
      sgpa_band: round2(sgpaHi - sgpaLo),
      uses_cgpa_history: hasHistory
    },
    total_semester_credits: credits,
    at_risk_count: atRisk.length,
    at_risk_subjects: atRisk,
    model: { weights: policy.weights, attendance_threshold: policy.threshold },
    subjects
  };
}

/* ------------------------------------------------------------------ */
/* Persistent Python worker                                            */
/* ------------------------------------------------------------------ */
const SCRIPT = path.resolve(__dirname, '../../python_service/cgpa_engine.py');
let worker = null;
let workerReady = false;
let disabledUntil = 0;
let seq = 0;
const pending = new Map();

function stopWorker(reason) {
  if (worker) {
    try { worker.kill(); } catch { /* already gone */ }
  }
  worker = null;
  workerReady = false;
  for (const [, p] of pending) p.reject(new Error(reason || 'Python worker stopped'));
  pending.clear();
}

function startWorker() {
  if (worker || Date.now() < disabledUntil) return;
  const bin = process.env.PYTHON_BIN || (process.platform === 'win32' ? 'python' : 'python3');
  try {
    worker = spawn(bin, ['-u', SCRIPT, '--serve'], { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true });
  } catch {
    disabledUntil = Date.now() + 5 * 60 * 1000;
    worker = null;
    return;
  }
  // Never let the worker keep Node alive on its own (scripts, tests, graceful shutdown)
  worker.unref();
  for (const stream of [worker.stdin, worker.stdout, worker.stderr]) stream?.unref?.();
  const rl = readline.createInterface({ input: worker.stdout });
  rl.on('line', (line) => {
    let msg;
    try { msg = JSON.parse(line); } catch { return; }
    if (msg.ready) { workerReady = true; return; }
    const p = pending.get(msg.id);
    if (!p) return;
    pending.delete(msg.id);
    if (msg.error) p.reject(new Error(msg.error));
    else p.resolve(msg.results);
  });
  worker.stderr.on('data', (d) => console.warn('[cgpa-python]', String(d).trim().slice(0, 300)));
  worker.on('error', () => {
    disabledUntil = Date.now() + 5 * 60 * 1000;
    stopWorker('Python unavailable');
  });
  worker.on('exit', () => {
    if (worker) stopWorker('Python worker exited');
  });
}

function pythonBatch(payloads, timeoutMs = 8000) {
  return new Promise((resolve, reject) => {
    if (!worker || !workerReady) return reject(new Error('Python worker not ready'));
    const id = ++seq;
    const timer = setTimeout(() => {
      pending.delete(id);
      reject(new Error('Python worker timed out'));
    }, timeoutMs);
    pending.set(id, {
      resolve: (r) => { clearTimeout(timer); resolve(r); },
      reject: (e) => { clearTimeout(timer); reject(e); }
    });
    worker.stdin.write(JSON.stringify({ id, batch: payloads }) + '\n');
  });
}

/** Score many students. Uses the Python worker when it is up, the JS model otherwise. */
async function predictBatch(payloads) {
  if (!payloads.length) return [];
  if (process.env.CGPA_ENGINE !== 'js') {
    startWorker();
    if (workerReady) {
      try {
        const results = await pythonBatch(payloads);
        if (Array.isArray(results) && results.length === payloads.length) {
          return results.map((r) => ({ ...r, engine: 'Python weighted model (persistent worker)' }));
        }
      } catch (err) {
        console.warn('[cgpa] Python engine failed, using JS model:', err.message);
        disabledUntil = Date.now() + 60 * 1000;
        stopWorker();
      }
    }
  }
  return payloads.map(calculateCGPAPredictionJS);
}

async function predictCGPAWithPythonOrFallback(payload) {
  const [r] = await predictBatch([payload]);
  return r;
}

function engineStatus() {
  return { python_worker: workerReady ? 'running' : worker ? 'starting' : 'stopped', mode: process.env.CGPA_ENGINE === 'js' ? 'js-only' : 'auto' };
}

// Warm the worker up at boot so the first request is fast
if (process.env.CGPA_ENGINE !== 'js') setTimeout(startWorker, 0);
process.on('exit', () => stopWorker());

/** Kept for callers that grade raw marks without a policy in hand */
function marksToGradePoint(score) {
  return gradeFor(score);
}

module.exports = {
  predictBatch,
  predictCGPAWithPythonOrFallback,
  calculateCGPAPredictionJS,
  calculateSubjectDifficulty,
  marksToGradePoint,
  engineStatus,
  MAX_INTERNAL,
  MAX_ASSIGNMENT
};
