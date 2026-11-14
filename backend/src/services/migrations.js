/**
 * Idempotent start-up maintenance. Each step runs once (tracked in the counters
 * collection as `migration:<name>`), except the cheap refreshes at the end.
 */
const db = require('../db/database');
const { Counter, InstitutionSetting } = db;
const { DEFAULT_GRADING_SCALE, invalidatePolicy } = require('./policy');
const { regradeAllMarks, recomputeCgpa } = require('./academicRecord');
const { recomputeMerit } = require('./merit');
const { refreshFees } = require('./feeLedger');

async function once(name, fn) {
  const key = `migration:${name}`;
  const done = await Counter.findById(key).lean();
  if (done) return false;
  const result = await fn();
  await Counter.updateOne({ _id: key }, { $set: { seq: 1 } }, { upsert: true });
  console.log(`[migrate] ${name}${result !== undefined ? `: ${JSON.stringify(result)}` : ''}`);
  return true;
}

/**
 * Numeric ids come from per-collection counters. If data was imported or seeded
 * without advancing a counter, the next insert collides with an existing id — so
 * on every boot each counter is raised to at least the collection's highest id.
 */
async function syncCounters() {
  const models = Object.values(db).filter((m) => m && m.modelName && m.schema?.path('id') && m.collection?.collectionName);
  let fixed = 0;
  for (const model of models) {
    const name = model.collection.collectionName;
    const top = await model.findOne({}, 'id').sort({ id: -1 }).lean();
    if (!top?.id) continue;
    const r = await Counter.updateOne({ _id: name, seq: { $lt: top.id } }, { $set: { seq: top.id } });
    if (r.modifiedCount) fixed += 1;
    else if (!(await Counter.exists({ _id: name }))) {
      await Counter.updateOne({ _id: name }, { $set: { seq: top.id } }, { upsert: true });
      fixed += 1;
    }
  }
  if (fixed) console.log(`[migrate] advanced ${fixed} id counters to match existing data`);
}

async function runMigrations() {
  // 1. The original seed stored a non-GGSIPU scale (A+ from 80, no P band). Replace it
  //    only if an admin hasn't customised it, then re-grade marks and recompute CGPAs.
  await once('ggsipu-grading-scale', async () => {
    const row = await InstitutionSetting.findOne({ setting_key: 'grading_scale' }).lean();
    let parsed = null;
    try { parsed = JSON.parse(row?.setting_value || 'null'); } catch { parsed = null; }
    const isOldSeed = parsed && parsed['A+']?.min === 80 && !parsed.P;
    if (!row || isOldSeed) {
      await InstitutionSetting.updateOne(
        { setting_key: 'grading_scale' },
        { $set: { setting_value: JSON.stringify(DEFAULT_GRADING_SCALE), description: 'Official GGSIPU 10-point absolute grading scheme', category: 'Academic', updated_at: new Date() } },
        { upsert: true }
      );
      invalidatePolicy();
    }
    return { replaced: Boolean(!row || isOldSeed), regraded: await regradeAllMarks() };
  });

  // 2. CGPA was seeded as a static number; derive it from declared end-term results.
  await once('cgpa-from-declared-results', async () => ({ students: await recomputeCgpa() }));

  // Cheap refreshes on every boot
  await syncCounters();
  await refreshFees({}, { force: true });
  await recomputeMerit();
}

module.exports = { runMigrations };
