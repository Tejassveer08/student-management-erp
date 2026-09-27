import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import confetti from 'canvas-confetti';
import {
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  Download,
  Printer,
  DollarSign,
  QrCode,
  ShieldCheck,
  ArrowRight,
  Receipt,
  Sparkles,
  X
} from 'lucide-react';

export default function FeesView() {
  const { user, token } = useAuth();
  const [payments, setPayments] = useState([]);
  const [structures, setStructures] = useState([]);
  const [financialOverview, setFinancialOverview] = useState(null);
  const [loading, setLoading] = useState(true);

  // "Redirect to Payment Page" state
  const [checkoutPayment, setCheckoutPayment] = useState(null);
  const [paymentMethod, setPaymentMethod] = useState('UPI');
  const [isProcessing, setIsProcessing] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState(null);

  useEffect(() => {
    fetchFees();
  }, [token]);

  async function fetchFees() {
    if (!token) return;
    setLoading(true);

    try {
      const [pRes, sRes, fRes] = await Promise.all([
        fetch('/api/fees/student/me', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/fees/structures', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/fees/financial-overview', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (pRes.ok) setPayments(await pRes.json());
      if (sRes.ok) setStructures(await sRes.json());
      if (fRes.ok) setFinancialOverview(await fRes.json());
    } catch (err) {
      console.error('Error fetching fees:', err);
    } finally {
      setLoading(false);
    }
  }

  // Handle "Redirect to payment page"
  const handleRedirectToPayment = (payment) => {
    setCheckoutPayment(payment);
  };

  // Complete Payment Simulator
  const handleProcessPayment = async () => {
    if (!checkoutPayment) return;
    setIsProcessing(true);

    try {
      const res = await fetch('/api/fees/pay', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          paymentId: checkoutPayment.id,
          paymentMethod
        })
      });

      const data = await res.json();
      if (res.ok) {
        // Trigger celebratory confetti
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 }
        });

        // Fetch digital receipt
        const recRes = await fetch(`/api/fees/receipt/${data.receipt_no}`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (recRes.ok) {
          const recData = await recRes.json();
          setActiveReceipt(recData);
        }

        setCheckoutPayment(null);
        fetchFees();
      } else {
        alert(data.error || 'Payment failed');
      }
    } catch (err) {
      alert('Error processing payment: ' + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePrintReceipt = () => {
    window.print();
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem 2rem',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(79, 70, 229, 0.08) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div className="badge badge-success" style={{ marginBottom: '0.4rem' }}>
            Financial Management & Payments (Module 2.I)
          </div>
          <h1 style={{ fontSize: '1.75rem' }}>Fees & Online Payment Gateway</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Fee structures, dues tracking, redirect-to-payment portal, and digital fee receipts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <span className="badge badge-info">UPI / Card / NetBanking</span>
          <span className="badge badge-success">SSL Secured Payment Gateway</span>
        </div>
      </div>

      {/* Admin Financial Overview Bar */}
      {isAdmin && financialOverview && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem'
        }}>
          <div className="stat-card success">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>COLLECTION RATE</span>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{financialOverview.collection_percentage}%</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Rs. {financialOverview.total_collected.toLocaleString()} Received</div>
          </div>

          <div className="stat-card warning">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>PENDING INVOICES</span>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{financialOverview.pending_count} Invoices</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--danger)' }}>Rs. {financialOverview.overdue_amount.toLocaleString()} Overdue</div>
          </div>

          <div className="stat-card info">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL FEE DEMAND</span>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>Rs. {financialOverview.total_demand.toLocaleString()}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Semester 4 Session 2025-2026</div>
          </div>
        </div>
      )}

      {/* Student / Parent Fee Invoices */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Semester Fee Payment Invoices</h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {payments.map(p => {
            const isPaid = p.status === 'Paid';
            const totalDue = p.amount_due + (p.fine_amount || 0);

            return (
              <div key={p.id} style={{
                padding: '1.25rem 1.5rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface-subtle)',
                border: `1px solid ${isPaid ? 'var(--success-border)' : 'var(--danger-border)'}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem'
              }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4 style={{ fontSize: '1.05rem', fontWeight: 700 }}>
                      B.Tech CSE - Semester {p.semester} Tuition & Campus Fees
                    </h4>
                    <span className={`badge badge-${isPaid ? 'success' : 'danger'}`}>
                      {p.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                    Breakdown: Tuition Rs. {p.tuition_fee.toLocaleString()} • Lab Rs. {p.lab_development_fee.toLocaleString()} • Exam Rs. {p.exam_fee.toLocaleString()} • Sports Rs. {p.library_sports_fee.toLocaleString()}
                  </div>

                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Due Date: <strong>{p.due_date}</strong> {p.fine_amount > 0 && <span style={{ color: 'var(--danger)', fontWeight: 700 }}>(Late Fine: Rs. {p.fine_amount})</span>}
                  </div>
                </div>

                <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                  <div style={{ fontSize: '1.4rem', fontWeight: 800, color: isPaid ? 'var(--success)' : 'var(--danger)' }}>
                    Rs. {totalDue.toLocaleString()}
                  </div>

                  {isPaid ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                        Paid on {new Date(p.payment_date).toLocaleDateString()}
                      </span>
                      <button
                        onClick={async () => {
                          const r = await fetch(`/api/fees/receipt/${p.receipt_no}`, { headers: { 'Authorization': `Bearer ${token}` } });
                          if (r.ok) setActiveReceipt(await r.json());
                        }}
                        className="btn btn-secondary btn-sm"
                      >
                        <Receipt size={14} /> View Receipt
                      </button>
                    </div>
                  ) : (
                    /* The requested "redirect to payment page functionality" */
                    <button
                      onClick={() => handleRedirectToPayment(p)}
                      className="btn btn-danger btn-sm"
                      style={{ boxShadow: '0 4px 12px rgba(239, 68, 68, 0.3)' }}
                    >
                      <CreditCard size={15} /> Redirect to Payment Page
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Fee Structure by Course & Semester Table */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Approved Institutional Fee Structure</h3>
        <div className="table-container">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Programme</th>
                <th>Semester</th>
                <th>Tuition Fee</th>
                <th>Lab Development</th>
                <th>Exam Fee</th>
                <th>Library / Sports</th>
                <th>Total Semester Fee</th>
              </tr>
            </thead>
            <tbody>
              {structures.map(fs => (
                <tr key={fs.id}>
                  <td style={{ fontWeight: 700 }}>{fs.course_name}</td>
                  <td style={{ fontWeight: 600 }}>Semester {fs.semester}</td>
                  <td>Rs. {fs.tuition_fee.toLocaleString()}</td>
                  <td>Rs. {fs.lab_development_fee.toLocaleString()}</td>
                  <td>Rs. {fs.exam_fee.toLocaleString()}</td>
                  <td>Rs. {fs.library_sports_fee.toLocaleString()}</td>
                  <td style={{ fontWeight: 800, color: 'var(--primary)' }}>
                    Rs. {fs.total_amount.toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* "Redirect to Payment Page" Portal Modal */}
      {checkoutPayment && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '500px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShieldCheck size={22} color="var(--success)" />
                <h3 style={{ fontSize: '1.25rem' }}>GTBIT Secure Payment Gateway</h3>
              </div>
              <button onClick={() => setCheckoutPayment(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={18} />
              </button>
            </div>

            {/* Order summary */}
            <div style={{ padding: '1rem', background: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Fee Description:</span>
                <span style={{ fontWeight: 700 }}>B.Tech CSE Sem {checkoutPayment.semester} College Fee</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Base Fee Amount:</span>
                <span style={{ fontWeight: 600 }}>Rs. {checkoutPayment.amount_due.toLocaleString()}</span>
              </div>
              {checkoutPayment.fine_amount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.85rem', color: 'var(--danger)' }}>
                  <span>Late Submission Fine:</span>
                  <span style={{ fontWeight: 700 }}>+ Rs. {checkoutPayment.fine_amount.toLocaleString()}</span>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-subtle)', paddingTop: '0.5rem', marginTop: '0.5rem', fontSize: '1.1rem', fontWeight: 800 }}>
                <span>Total Payable:</span>
                <span style={{ color: 'var(--primary)' }}>
                  Rs. {(checkoutPayment.amount_due + (checkoutPayment.fine_amount || 0)).toLocaleString()}
                </span>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ marginBottom: '0.5rem' }}>Select Payment Method:</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                {['UPI / QR', 'Debit/Credit Card', 'Net Banking'].map(method => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    style={{
                      padding: '0.75rem 0.5rem',
                      borderRadius: 'var(--radius-md)',
                      border: `2px solid ${paymentMethod === method ? 'var(--primary)' : 'var(--border-subtle)'}`,
                      background: paymentMethod === method ? 'var(--primary-glow)' : 'var(--bg-surface)',
                      color: paymentMethod === method ? 'var(--primary)' : 'var(--text-primary)',
                      fontWeight: 700,
                      fontSize: '0.75rem',
                      cursor: 'pointer',
                      textAlign: 'center'
                    }}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>

            {paymentMethod === 'UPI / QR' && (
              <div style={{ textAlign: 'center', padding: '1rem', background: '#ffffff', borderRadius: '8px', marginBottom: '1.25rem' }}>
                <QrCode size={140} color="#0f172a" style={{ margin: '0 auto' }} />
                <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem', fontWeight: 600 }}>
                  Scan with Google Pay, PhonePe, Paytm or BHIM UPI
                </div>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setCheckoutPayment(null)} className="btn btn-secondary">
                Cancel
              </button>
              <button 
                onClick={handleProcessPayment} 
                disabled={isProcessing}
                className="btn btn-success"
              >
                {isProcessing ? 'Authorizing Payment...' : `Complete Rs. ${(checkoutPayment.amount_due + (checkoutPayment.fine_amount || 0)).toLocaleString()} Payment`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Official Printable Digital Fee Receipt Modal */}
      {activeReceipt && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px', background: '#ffffff', color: '#0f172a' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.15rem', color: '#1e293b' }}>Official Digital Fee Receipt</h3>
              <button onClick={() => setActiveReceipt(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ border: '2px solid #cbd5e1', padding: '1.5rem', borderRadius: '8px', marginBottom: '1.25rem' }}>
              {/* Receipt Header */}
              <div style={{ textAlign: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '1rem', marginBottom: '1rem' }}>
                <h4 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{activeReceipt.institution.name}</h4>
                <div style={{ fontSize: '0.78rem', color: '#475569' }}>{activeReceipt.institution.affiliate}</div>
                <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{activeReceipt.institution.address}</div>
                <div style={{ marginTop: '0.5rem', fontWeight: 800, fontSize: '0.9rem', color: '#059669' }}>
                  FEE PAYMENT RECEIPT • {activeReceipt.receipt.receipt_no}
                </div>
              </div>

              {/* Receipt Details */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.65rem', fontSize: '0.8rem', marginBottom: '1rem' }}>
                <div>
                  <span style={{ color: '#64748b' }}>Student Name:</span>
                  <div style={{ fontWeight: 700 }}>{activeReceipt.receipt.student_name}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Roll Number:</span>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{activeReceipt.receipt.roll_no}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Transaction ID:</span>
                  <div style={{ fontWeight: 700, fontFamily: 'monospace' }}>{activeReceipt.receipt.transaction_id}</div>
                </div>
                <div>
                  <span style={{ color: '#64748b' }}>Payment Mode:</span>
                  <div style={{ fontWeight: 700 }}>{activeReceipt.receipt.payment_method}</div>
                </div>
              </div>

              {/* Amount */}
              <div style={{
                background: '#f8fafc',
                padding: '0.85rem 1rem',
                borderRadius: '6px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                border: '1px solid #e2e8f0'
              }}>
                <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Amount Settled:</span>
                <span style={{ fontWeight: 800, fontSize: '1.25rem', color: '#059669' }}>
                  Rs. {activeReceipt.receipt.amount_paid.toLocaleString()}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setActiveReceipt(null)} className="btn btn-secondary">
                Close
              </button>
              <button onClick={handlePrintReceipt} className="btn btn-primary">
                <Printer size={16} /> Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
