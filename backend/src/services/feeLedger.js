/**
 * Fee ledger maintenance: marks unpaid invoices Overdue once their due date passes
 * and accrues the late fine from the Governance policy (late_fee_per_day), capped
 * at 20% of the invoice. Waived fines (admin override) are respected via `fine_waived`.
 */
const { StudentFeePayment, FeeStructure, getNextId } = require('../db/database');
const { getPolicy } = require('./policy');
const { localDate, daysBetween } = require('./time');

let lastSweep = 0;

async function refreshFees(filter = {}, { force = false } = {}) {
  if (!force && !filter.student_id && Date.now() - lastSweep < 60 * 1000) return 0;
  const policy = await getPolicy();
  const today = localDate();
  const open = await StudentFeePayment.find({ ...filter, status: { $in: ['Pending', 'Overdue', 'Partial'] } }).lean();
  if (!open.length) return 0;
  const structures = await FeeStructure.find({ id: { $in: [...new Set(open.map((p) => p.fee_structure_id))] } }, 'id due_date').lean();
  const due = Object.fromEntries(structures.map((s) => [s.id, s.due_date]));
  const ops = [];
  for (const p of open) {
    const dueDate = due[p.fee_structure_id];
    if (!dueDate) continue;
    const late = Math.max(0, daysBetween(dueDate, today));
    const status = p.status === 'Partial' ? 'Partial' : late > 0 ? 'Overdue' : 'Pending';
    const fine = p.fine_waived ? p.fine_amount || 0 : Math.min(Math.round(p.amount_due * 0.2), late * policy.lateFeePerDay);
    if (status !== p.status || fine !== (p.fine_amount || 0)) {
      ops.push({ updateOne: { filter: { id: p.id }, update: { $set: { status, fine_amount: fine } } } });
    }
  }
  if (ops.length) await StudentFeePayment.bulkWrite(ops, { ordered: false });
  if (!filter.student_id) lastSweep = Date.now();
  return ops.length;
}

async function nextReceiptNo() {
  const seq = await getNextId('fee_receipts');
  return `REC-GTB-${new Date().getFullYear()}-${String(seq).padStart(6, '0')}`;
}

module.exports = { refreshFees, nextReceiptNo };
