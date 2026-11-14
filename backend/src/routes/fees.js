const express = require('express');
const {
  FeeStructure,
  StudentFeePayment,
  Course,
  Student,
  User,
  WardLink,
  Notification,
  getNextId
} = require('../db/database');
const { verifyToken, requirePermission, requireRoles, logAudit } = require('../middleware/authMiddleware');
const { refreshFees, nextReceiptNo } = require('../services/feeLedger');
const { notifyStudents } = require('../services/notify');

const router = express.Router();

// GET /api/fees/structures - Fee structures catalog
router.get('/structures', verifyToken, requirePermission('fees', 'read'), async (req, res) => {
  try {
    const [structures, courses] = await Promise.all([
      FeeStructure.find({}).sort({ semester: 1 }).lean(),
      Course.find({}).lean()
    ]);
    const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));
    const result = structures
      .filter(fs => courseMap[fs.course_id])
      .map(fs => ({
        ...fs,
        course_name: courseMap[fs.course_id].name,
        course_code: courseMap[fs.course_id].code
      }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/fees/student/:studentId - Get fees status for a student (with DB Scoping)
router.get('/student/:studentId', verifyToken, requirePermission('fees', 'read'), async (req, res) => {
  try {
    let targetId = req.params.studentId;

    if (targetId === 'me') {
      if (req.user.role === 'student') {
        targetId = req.student ? req.student.id : null;
      } else if (req.user.role === 'parent') {
        const firstWard = await WardLink.findOne({ parent_user_id: req.user.id }).sort({ is_primary: -1 }).lean();
        targetId = firstWard ? firstWard.student_id : null;
      }
    } else {
      targetId = Number(targetId);
    }

    if (req.user.role === 'student') {
      if (!req.student || req.student.id !== targetId) {
        return res.status(403).json({ error: 'Access denied: Students can only view their own fee ledgers.' });
      }
    } else if (req.user.role === 'parent') {
      const isWard = await WardLink.findOne({ parent_user_id: req.user.id, student_id: targetId }).lean();
      if (!isWard) {
        return res.status(403).json({ error: 'Access denied: You can only view fee records of your linked wards.' });
      }
    }

    if (!targetId) return res.status(400).json({ error: 'Student ID required' });

    await refreshFees({ student_id: targetId });
    const payments = await StudentFeePayment.find({ student_id: targetId }).lean();
    if (payments.length === 0) return res.json([]);

    const [structures, student] = await Promise.all([
      FeeStructure.find({ id: { $in: payments.map(p => p.fee_structure_id) } }).lean(),
      Student.findOne({ id: targetId }).lean()
    ]);
    const user = student ? await User.findOne({ id: student.user_id }).lean() : null;
    const fsMap = Object.fromEntries(structures.map(fs => [fs.id, fs]));

    const result = payments
      .map(sfp => {
        const fs = fsMap[sfp.fee_structure_id];
        if (!fs || !student || !user) return null;
        return {
          ...sfp,
          semester: fs.semester,
          academic_year: fs.academic_year,
          due_date: fs.due_date,
          tuition_fee: fs.tuition_fee,
          lab_development_fee: fs.lab_development_fee,
          exam_fee: fs.exam_fee,
          library_sports_fee: fs.library_sports_fee,
          roll_no: student.roll_no,
          enrollment_no: student.enrollment_no,
          student_name: user.full_name
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.semester - a.semester);

    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fees/checkout-session - Initiates "Redirect to payment page" checkout session
router.post('/checkout-session', verifyToken, requirePermission('fees', 'pay'), async (req, res) => {
  try {
    const { paymentId } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'Payment ID is required' });

    const sfp = await StudentFeePayment.findOne({ id: Number(paymentId) }).lean();
    if (!sfp) return res.status(404).json({ error: 'Fee payment record not found' });

    const [fs, student] = await Promise.all([
      FeeStructure.findOne({ id: sfp.fee_structure_id }).lean(),
      Student.findOne({ id: sfp.student_id }).lean()
    ]);
    const user = student ? await User.findOne({ id: student.user_id }).lean() : null;

    if (!fs || !student || !user) {
      return res.status(404).json({ error: 'Fee payment record not found' });
    }

    if (req.user.role === 'parent') {
      const isWard = await WardLink.findOne({ parent_user_id: req.user.id, student_id: sfp.student_id }).lean();
      if (!isWard) {
        return res.status(403).json({ error: 'Access denied: Cannot pay fees for an unlinked student.' });
      }
    }

    const totalPayable = sfp.amount_due + (sfp.fine_amount || 0);
    const checkoutSessionId = `PAY_SESS_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

    res.json({
      checkoutSessionId,
      payment_id: sfp.id,
      student_name: user.full_name,
      roll_no: student.roll_no,
      semester: fs.semester,
      amount_due: sfp.amount_due,
      fine_amount: sfp.fine_amount,
      total_payable: totalPayable,
      gateway_url: `/payment-gateway?session=${checkoutSessionId}&paymentId=${sfp.id}`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/fees/pay — record a payment (full or part) and issue a sequential receipt
router.post('/pay', verifyToken, requirePermission('fees', 'pay'), async (req, res) => {
  try {
    const { paymentId, paymentMethod, transactionRef } = req.body;
    if (!paymentId) return res.status(400).json({ error: 'Payment ID is required' });
    await refreshFees({ id: Number(paymentId) }, { force: true });
    const payment = await StudentFeePayment.findOne({ id: Number(paymentId) }).lean();
    if (!payment) return res.status(404).json({ error: 'Fee record not found' });
    if (req.user.role === 'parent') {
      const isWard = await WardLink.findOne({ parent_user_id: req.user.id, student_id: payment.student_id }).lean();
      if (!isWard) return res.status(403).json({ error: 'Access denied: you can only pay for your linked wards.' });
    }
    const payable = payment.amount_due + (payment.fine_amount || 0);
    const outstanding = Math.max(0, payable - (payment.amount_paid || 0));
    if (payment.status === 'Paid' || outstanding <= 0) return res.status(409).json({ error: 'This invoice is already fully paid.' });

    const amount = req.body.amount !== undefined && req.body.amount !== null && req.body.amount !== '' ? Math.round(Number(req.body.amount)) : outstanding;
    if (!Number.isFinite(amount) || amount < 1 || amount > outstanding) {
      return res.status(400).json({ error: `Enter an amount between ₹1 and ₹${outstanding.toLocaleString('en-IN')}` });
    }
    const receiptNo = await nextReceiptNo();
    const txnId = String(transactionRef || `TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`).slice(0, 64);
    const paidAt = new Date();
    const newPaid = (payment.amount_paid || 0) + amount;
    const status = newPaid >= payable ? 'Paid' : 'Partial';
    const method = paymentMethod || 'UPI';

    await StudentFeePayment.updateOne(
      { id: payment.id },
      {
        $set: { amount_paid: newPaid, status, payment_method: method, transaction_id: txnId, receipt_no: receiptNo, payment_date: paidAt },
        $push: { payments: { amount, method, transaction_id: txnId, receipt_no: receiptNo, paid_at: paidAt, by_user: req.user.id } }
      }
    );
    await logAudit({
      userId: req.user.id, userRole: req.user.role, userEmail: req.user.email,
      action: 'FEE_PAYMENT', entityType: 'student_fee_payments', entityId: payment.id,
      oldValue: { status: payment.status, amount_paid: payment.amount_paid || 0 }, newValue: { status, amount_paid: newPaid, receipt_no: receiptNo },
      reason: `${method} payment of ₹${amount}`, ipAddress: req.ip
    });
    await notifyStudents([payment.student_id], {
      title: status === 'Paid' ? 'Fees paid in full' : 'Part payment received',
      message: `₹${amount.toLocaleString('en-IN')} received (receipt ${receiptNo}).${status === 'Partial' ? ` ₹${(payable - newPaid).toLocaleString('en-IN')} still due.` : ''}`,
      type: 'fee_reminder',
      link: '/fees'
    }, { includeGuardians: true });

    res.json({ message: 'Payment recorded', receipt_no: receiptNo, transaction_id: txnId, amount_paid: amount, total_paid: newPaid, outstanding: Math.max(0, payable - newPaid), status, payment_date: paidAt });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/fees/override - Admin Fee & Fine Waiver Override (with audit log)
router.put('/override', verifyToken, requirePermission('fees', 'override'), async (req, res) => {
  try {
    const { paymentId, fineAmount, amountDue, status, reason } = req.body;

    if (!paymentId) return res.status(400).json({ error: 'Payment ID is required' });
    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ error: 'A mandatory reason (min 5 chars) is required for administrative fee override.' });
    }

    const existing = await StudentFeePayment.findOne({ id: Number(paymentId) }).lean();
    if (!existing) return res.status(404).json({ error: 'Fee payment record not found' });

    const updates = {};
    if (fineAmount !== undefined && fineAmount !== null && fineAmount !== '') { updates.fine_amount = Math.max(0, Number(fineAmount)); updates.fine_waived = true; }
    if (amountDue !== undefined && amountDue !== null && amountDue !== '') updates.amount_due = Math.max(0, Number(amountDue));
    if (status) {
      if (!['Paid', 'Pending', 'Overdue', 'Partial'].includes(status)) return res.status(400).json({ error: 'Invalid status' });
      updates.status = status;
    }

    if (Object.keys(updates).length > 0) {
      await StudentFeePayment.updateOne({ id: Number(paymentId) }, { $set: updates });
    }

    await logAudit({
      userId: req.user.id,
      userRole: req.user.role,
      userEmail: req.user.email,
      action: 'FEE_OVERRIDE_MODERATION',
      entityType: 'student_fee_payments',
      entityId: paymentId,
      oldValue: { fine: existing.fine_amount, amountDue: existing.amount_due, status: existing.status },
      newValue: { fine: fineAmount, amountDue, status },
      reason,
      ipAddress: req.ip
    });

    res.json({
      message: 'Fee override applied successfully and recorded in audit log.',
      paymentId
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/fees/receipt/:receiptNo - Official printable digital receipt
router.get('/receipt/:receiptNo', verifyToken, requirePermission('fees', 'read'), async (req, res) => {
  try {
    const sfp = await StudentFeePayment.findOne({ $or: [{ receipt_no: req.params.receiptNo }, { 'payments.receipt_no': req.params.receiptNo }] }).lean();
    if (!sfp) return res.status(404).json({ error: 'Receipt not found' });

    const [fs, student] = await Promise.all([
      FeeStructure.findOne({ id: sfp.fee_structure_id }).lean(),
      Student.findOne({ id: sfp.student_id }).lean()
    ]);
    const [user, course] = student
      ? await Promise.all([
          User.findOne({ id: student.user_id }).lean(),
          Course.findOne({ id: student.course_id }).lean()
        ])
      : [null, null];

    if (!fs || !student || !user || !course) {
      return res.status(404).json({ error: 'Receipt not found' });
    }

    if (req.user.role === 'student') {
      if (!req.student || req.student.id !== sfp.student_id) {
        return res.status(403).json({ error: 'Access denied: Cannot view another student receipt.' });
      }
    } else if (req.user.role === 'parent') {
      const isWard = await WardLink.findOne({ parent_user_id: req.user.id, student_id: sfp.student_id }).lean();
      if (!isWard) {
        return res.status(403).json({ error: 'Access denied: Cannot view receipt of non-ward.' });
      }
    }

    res.json({
      institution: {
        name: 'Guru Tegh Bahadur Institute of Technology (GTBIT)',
        affiliate: 'Affiliated to Guru Gobind Singh Indraprastha University (GGSIPU)',
        address: 'G-8 Area, Rajouri Garden, New Delhi, Delhi 110064',
        tax_reg: 'GTBIT-GGSIPU-ACAD-2026'
      },
      receipt: {
        ...sfp,
        semester: fs.semester,
        academic_year: fs.academic_year,
        tuition_fee: fs.tuition_fee,
        lab_development_fee: fs.lab_development_fee,
        exam_fee: fs.exam_fee,
        library_sports_fee: fs.library_sports_fee,
        roll_no: student.roll_no,
        enrollment_no: student.enrollment_no,
        student_name: user.full_name,
        student_email: user.email,
        course_name: course.name
      }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/fees/financial-overview - Consolidated financial stats (Admin only)
router.get('/financial-overview', verifyToken, requireRoles('admin'), async (req, res) => {
  try {
    await refreshFees();
    const payments = await StudentFeePayment.find({}).lean();
    let total_demand = 0;
    let total_collected = 0;
    let paid_invoices = 0;
    let pending_invoices = 0;
    let overdue_amount = 0;

    for (const p of payments) {
      total_demand += p.amount_due || 0;
      total_collected += p.amount_paid || 0;
      if (p.status === 'Paid') paid_invoices += 1;
      if (p.status === 'Pending' || p.status === 'Overdue') pending_invoices += 1;
      if (p.status === 'Overdue') overdue_amount += (p.amount_due || 0) + (p.fine_amount || 0);
    }

    res.json({
      total_demand,
      total_collected,
      collection_percentage: total_demand > 0 ? Number(((total_collected / total_demand) * 100).toFixed(1)) : 0,
      paid_count: paid_invoices,
      pending_count: pending_invoices,
      overdue_amount
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
