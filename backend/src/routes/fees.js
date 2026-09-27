const express = require('express');
const db = require('../db/database');
const { verifyToken } = require('../middleware/authMiddleware');

const router = express.Router();

// GET /api/fees/structures - Fee structures
router.get('/structures', verifyToken, (req, res) => {
  const structures = db.prepare(`
    SELECT fs.*, c.name as course_name, c.code as course_code
    FROM fee_structures fs
    JOIN courses c ON fs.course_id = c.id
    ORDER BY fs.semester ASC
  `).all();
  res.json(structures);
});

// GET /api/fees/student/:studentId - Get fees status for a student
router.get('/student/:studentId', verifyToken, (req, res) => {
  let targetId = req.params.studentId;

  if (targetId === 'me') {
    if (req.user.role === 'student') {
      const st = db.prepare('SELECT id FROM students WHERE user_id = ?').get(req.user.id);
      targetId = st ? st.id : null;
    } else if (req.user.role === 'parent') {
      const ward = db.prepare('SELECT id FROM students WHERE parent_user_id = ?').get(req.user.id);
      targetId = ward ? ward.id : null;
    }
  }

  if (!targetId) return res.status(400).json({ error: 'Student ID required' });

  const payments = db.prepare(`
    SELECT sfp.*, fs.semester, fs.academic_year, fs.due_date,
           fs.tuition_fee, fs.lab_development_fee, fs.exam_fee, fs.library_sports_fee,
           s.roll_no, s.enrollment_no, u.full_name as student_name
    FROM student_fee_payments sfp
    JOIN fee_structures fs ON sfp.fee_structure_id = fs.id
    JOIN students s ON sfp.student_id = s.id
    JOIN users u ON s.user_id = u.id
    WHERE sfp.student_id = ?
    ORDER BY fs.semester DESC
  `).all(targetId);

  res.json(payments);
});

// POST /api/fees/checkout-session - Initiates "Redirect to payment page" checkout session
router.post('/checkout-session', verifyToken, (req, res) => {
  const { paymentId } = req.body;
  if (!paymentId) return res.status(400).json({ error: 'Payment ID is required' });

  const payment = db.prepare(`
    SELECT sfp.*, fs.semester, fs.total_amount, fs.academic_year,
           s.roll_no, u.full_name as student_name, u.email as student_email
    FROM student_fee_payments sfp
    JOIN fee_structures fs ON sfp.fee_structure_id = fs.id
    JOIN students s ON sfp.student_id = s.id
    JOIN users u ON s.user_id = u.id
    WHERE sfp.id = ?
  `).get(paymentId);

  if (!payment) return res.status(404).json({ error: 'Fee payment record not found' });

  const totalPayable = payment.amount_due + (payment.fine_amount || 0);

  // Generate a mock gateway checkout token
  const checkoutSessionId = `PAY_SESS_${Date.now()}_${Math.random().toString(36).substring(2, 9).toUpperCase()}`;

  res.json({
    checkoutSessionId,
    payment_id: payment.id,
    student_name: payment.student_name,
    roll_no: payment.roll_no,
    semester: payment.semester,
    amount_due: payment.amount_due,
    fine_amount: payment.fine_amount,
    total_payable: totalPayable,
    gateway_url: `/payment-gateway?session=${checkoutSessionId}&paymentId=${payment.id}`
  });
});

// POST /api/fees/pay - Process simulated payment & generate official digital receipt
router.post('/pay', verifyToken, (req, res) => {
  const { paymentId, paymentMethod, transactionRef } = req.body;

  if (!paymentId) return res.status(400).json({ error: 'Payment ID is required' });

  const payment = db.prepare('SELECT * FROM student_fee_payments WHERE id = ?').get(paymentId);
  if (!payment) return res.status(404).json({ error: 'Fee record not found' });

  const receiptNo = `REC-GTB-2026-${Math.floor(1000 + Math.random() * 9000)}`;
  const txnId = transactionRef || `TXN_GTB_${Date.now()}_${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
  const totalPaid = payment.amount_due + (payment.fine_amount || 0);

  db.prepare(`
    UPDATE student_fee_payments
    SET amount_paid = ?,
        status = 'Paid',
        payment_method = ?,
        transaction_id = ?,
        receipt_no = ?,
        payment_date = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(totalPaid, paymentMethod || 'UPI / QR', txnId, receiptNo, paymentId);

  // Send confirmation notification
  const student = db.prepare('SELECT user_id, parent_user_id, roll_no FROM students WHERE id = ?').get(payment.student_id);
  if (student) {
    db.prepare(`
      INSERT INTO notifications (user_id, title, message, type, link_url)
      VALUES (?, 'Fee Payment Received', ?, 'fee_reminder', '/fees')
    `).run(student.user_id, `Payment of Rs. ${totalPaid.toLocaleString()} received successfully. Receipt No: ${receiptNo}.`);

    if (student.parent_user_id) {
      db.prepare(`
        INSERT INTO notifications (user_id, title, message, type, link_url)
        VALUES (?, 'Fee Payment Confirmed', ?, 'fee_reminder', '/fees')
      `).run(student.parent_user_id, `College fee payment for Roll No ${student.roll_no} confirmed. Receipt: ${receiptNo}.`);
    }
  }

  res.json({
    message: 'Payment processed successfully',
    receipt_no: receiptNo,
    transaction_id: txnId,
    amount_paid: totalPaid,
    payment_date: new Date().toISOString()
  });
});

// GET /api/fees/receipt/:receiptNo - Official printable digital receipt
router.get('/receipt/:receiptNo', verifyToken, (req, res) => {
  const receipt = db.prepare(`
    SELECT sfp.*, fs.semester, fs.academic_year,
           fs.tuition_fee, fs.lab_development_fee, fs.exam_fee, fs.library_sports_fee,
           s.roll_no, s.enrollment_no, u.full_name as student_name, u.email as student_email,
           c.name as course_name
    FROM student_fee_payments sfp
    JOIN fee_structures fs ON sfp.fee_structure_id = fs.id
    JOIN students s ON sfp.student_id = s.id
    JOIN users u ON s.user_id = u.id
    JOIN courses c ON s.course_id = c.id
    WHERE sfp.receipt_no = ?
  `).get(req.params.receiptNo);

  if (!receipt) return res.status(404).json({ error: 'Receipt not found' });

  res.json({
    institution: {
      name: 'Guru Tegh Bahadur Institute of Technology (GTBIT)',
      affiliate: 'Affiliated to Guru Gobind Singh Indraprastha University (GGSIPU)',
      address: 'G-8 Area, Rajouri Garden, New Delhi, Delhi 110064',
      tax_reg: 'GTBIT-GGSIPU-ACAD-2026'
    },
    receipt
  });
});

// GET /api/fees/financial-overview - Consolidated financial stats for Admin
router.get('/financial-overview', verifyToken, (req, res) => {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total_invoices,
      SUM(amount_due) as total_demand,
      SUM(amount_paid) as total_collected,
      SUM(CASE WHEN status = 'Paid' THEN 1 ELSE 0 END) as paid_invoices,
      SUM(CASE WHEN status IN ('Pending', 'Overdue') THEN 1 ELSE 0 END) as pending_invoices,
      SUM(CASE WHEN status = 'Overdue' THEN amount_due + fine_amount ELSE 0 END) as overdue_amount
    FROM student_fee_payments
  `).get();

  res.json({
    total_demand: stats.total_demand || 0,
    total_collected: stats.total_collected || 0,
    collection_percentage: stats.total_demand > 0 ? Number(((stats.total_collected / stats.total_demand) * 100).toFixed(1)) : 0,
    paid_count: stats.paid_invoices || 0,
    pending_count: stats.pending_invoices || 0,
    overdue_amount: stats.overdue_amount || 0
  });
});

module.exports = router;
