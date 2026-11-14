import React, { useEffect, useState } from 'react';
import {
  CreditCard, Receipt, Printer, Wallet, AlertTriangle, CheckCircle2, Smartphone, Landmark, ShieldAlert, Layers, Users,
  Clock, BadgeIndianRupee, ArrowUpRight,
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { useApi, asList } from '../lib/api';
import { useLoader, settle, useChartColors } from '../lib/hooks';
import { inr, inrShort, fmtDate, fmtDateTime, daysUntil, statusTone, num, pct } from '../lib/format';
import { SECTIONS } from '../config/campus';
import BrandMark from '../components/layout/BrandMark';
import {
  PageHeader, Card, Badge, Stat, Modal, Field, EmptyState, ErrorState, PageSkeleton, Chips, Callout, Skeleton, ChartTip, Tabs, useToast,
} from '../components/ui';

const PARTS = [
  ['tuition_fee', 'Tuition', 'var(--accent)'],
  ['lab_development_fee', 'Lab & development', 'var(--violet)'],
  ['exam_fee', 'Examination', 'var(--saffron)'],
  ['library_sports_fee', 'Library & sports', 'var(--success)'],
];

export default function FeesView() {
  const { user } = useAuth();
  if (user?.role === 'admin') return <AdminFees />;
  if (user?.role === 'faculty') return <StructuresOnly />;
  return <PersonalFees />;
}

function StructuresOnly() {
  const [course, setCourse] = useState('all');
  const { data, loading, error, hardReload } = useLoader((api) => api('/fees/structures'));
  if (loading) return <PageSkeleton stats={0} rows={1} />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;
  const s = asList(data);
  const courses = [...new Set(s.map((x) => x.course_code))].sort();
  return (
    <>
      <PageHeader eyebrow="Finance" title={<>Fee <em>structures</em></>} description="Semester-wise fee structure for every B.Tech programme." />
      <div className="stack gap-12">
        <Chips value={course} onChange={setCourse} options={[{ value: 'all', label: 'All programmes' }, ...courses.map((x) => ({ value: x, label: x.replace('BTECH-', '') }))]} />
        <StructureTable rows={s.filter((x) => course === 'all' || x.course_code === course).sort((a, b) => a.course_id - b.course_id || a.semester - b.semester)} />
      </div>
    </>
  );
}

/* ====================================================================== */
function PersonalFees() {
  const { user, hasPermission, studentProfile } = useAuth();
  const canPay = hasPermission('fees', 'pay');
  const [pay, setPay] = useState(null);
  const [receiptNo, setReceiptNo] = useState(null);
  const { data, loading, error, hardReload, reload } = useLoader((api) => Promise.all([
    api('/fees/student/me'),
    settle(api('/fees/structures'), []),
  ]));
  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;
  const payments = [...asList(data[0])].sort((a, b) => (b.semester || 0) - (a.semester || 0));
  const current = payments[0];
  const courseId = studentProfile?.course_id;
  const structures = asList(data[1]).filter((s) => !courseId || s.course_id === courseId).sort((a, b) => a.semester - b.semester);

  return (
    <>
      <PageHeader eyebrow="Finance" title={<>Fees & <em>receipts</em></>}
        description={user?.role === 'parent' ? `Fee status, payments and receipts for ${current?.student_name || 'your ward'}.` : 'Your semester fee status, payment history and digital receipts.'} />
      {!current ? <div className="card"><EmptyState icon={Wallet} title="No fee records yet" /></div> : (
        <div className="stack gap-16">
          <CurrentFee p={current} canPay={canPay} onPay={() => setPay(current)} onReceipt={() => setReceiptNo(current.receipt_no)} isStudent={user?.role === 'student'} />
          <Ledger payments={payments} onReceipt={setReceiptNo} onPay={canPay ? setPay : null} />
          {structures.length > 0 && <StructureTable rows={structures} title="Fee structure for your programme" />}
        </div>
      )}
      <Checkout p={pay} onClose={() => setPay(null)} onPaid={(no) => { setPay(null); reload(); setReceiptNo(no); }} />
      <ReceiptModal no={receiptNo} onClose={() => setReceiptNo(null)} />
    </>
  );
}

const outstandingOf = (p) => Math.max(0, (p?.amount_due || 0) + (p?.fine_amount || 0) - (p?.amount_paid || 0));

function CurrentFee({ p, canPay, onPay, onReceipt, isStudent }) {
  const total = outstandingOf(p);
  const paid = p.status === 'Paid';
  const d = daysUntil(p.due_date);
  const parts = PARTS.map(([k, l, c]) => ({ k, l, c, v: p[k] || 0 }));
  const sum = parts.reduce((a, x) => a + x.v, 0) || 1;
  return (
    <section className="hero rise">
      <div className="row-between wrap" style={{ gap: 28, alignItems: 'flex-start' }}>
        <div style={{ flex: '1 1 320px' }}>
          <div className="eyebrow">Semester {p.semester} · {p.academic_year}</div>
          <div className="serif num" style={{ fontSize: 64, lineHeight: 1, color: '#fff', marginTop: 14 }}>{inr(paid ? p.amount_paid : total)}</div>
          <div className="row gap-8 wrap" style={{ marginTop: 12 }}>
            <Badge tone={paid ? 'success' : statusTone(p.status)} dot>{paid ? 'Paid in full' : p.status}</Badge>
            {!paid && <span className="small" style={{ color: d < 0 ? '#f87171' : 'var(--panel-muted)' }}>{d < 0 ? `Overdue by ${-d} days` : `Due ${fmtDate(p.due_date)} · ${d} days left`}</span>}
            {paid && <span className="small" style={{ color: 'var(--panel-muted)' }}>Paid {fmtDate(p.payment_date)} via {p.payment_method}</span>}
          </div>
          {p.fine_amount > 0 && <div className="small" style={{ color: '#fbbf24', marginTop: 8 }}>Includes late fine of {inr(p.fine_amount)}{p.fine_waived ? ' (set by accounts)' : ' — grows daily until paid'}</div>}
          {p.status === 'Partial' && <div className="small" style={{ color: 'var(--panel-muted)', marginTop: 8 }}>{inr(p.amount_paid)} paid so far · {inr(total)} remaining</div>}
          <div className="row gap-8" style={{ marginTop: 20 }}>
            {p.receipt_no && <button className="btn btn-ghost" onClick={onReceipt}><Receipt size={15} /> {paid ? 'View receipt' : 'Last receipt'}</button>}
            {!paid && canPay && <button className="btn btn-accent" onClick={onPay}><CreditCard size={15} /> Pay {inr(total)}</button>}
            {!paid && !canPay && isStudent && <span className="small" style={{ color: 'var(--panel-muted)' }}>Payments are made from the guardian portal or the accounts office.</span>}
          </div>
        </div>
        <div style={{ flex: '1 1 320px' }}>
          <div className="eyebrow" style={{ marginBottom: 12 }}>Breakdown</div>
          <div style={{ display: 'flex', height: 10, overflow: 'hidden', gap: 2 }}>
            {parts.map((x) => <div key={x.k} style={{ width: `${(x.v / sum) * 100}%`, background: x.c }} />)}
          </div>
          <div className="stack gap-8" style={{ marginTop: 16 }}>
            {parts.map((x) => (
              <div key={x.k} className="row-between small">
                <span className="row gap-8" style={{ color: '#d4d4d8' }}><span className="dot" style={{ background: x.c }} />{x.l}</span>
                <span className="mono" style={{ color: '#fff' }}>{inr(x.v)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function Ledger({ payments, onReceipt, onPay, title = 'Payment history' }) {
  return (
    <Card flush title={title} icon={Receipt}>
      {payments.length === 0 ? <EmptyState compact title="No payments" /> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Semester</th><th className="right">Amount due</th><th className="right">Fine</th><th className="right">Paid</th><th>Status</th><th>Method</th><th>Date</th><th className="right" /></tr></thead>
            <tbody>
              {payments.map((p) => (
                <tr key={p.id}>
                  <td><div className="strong">Semester {p.semester}</div><div className="xs muted">{p.academic_year}</div></td>
                  <td className="right mono">{inr(p.amount_due)}</td>
                  <td className="right mono">{p.fine_amount ? inr(p.fine_amount) : '—'}</td>
                  <td className="right mono strong">{inr(p.amount_paid)}</td>
                  <td><Badge tone={statusTone(p.status)} dot>{p.status}</Badge></td>
                  <td className="small">{p.payment_method || '—'}</td>
                  <td className="small">{p.payment_date ? fmtDate(p.payment_date) : <span className="muted">Due {fmtDate(p.due_date)}</span>}</td>
                  <td className="right">
                    <div className="row gap-6" style={{ justifyContent: 'flex-end' }}>
                      {p.receipt_no && <button className="btn btn-ghost btn-sm" onClick={() => onReceipt(p.receipt_no)}><Receipt size={13} /> Receipt</button>}
                      {p.status !== 'Paid' && onPay && <button className="btn btn-accent btn-sm" onClick={() => onPay(p)}><CreditCard size={13} /> Pay</button>}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function StructureTable({ rows, title = 'Fee structures' }) {
  return (
    <Card flush title={title} icon={Layers}>
      <div className="table-wrap">
        <table className="tbl">
          <thead><tr><th>Programme</th><th>Semester</th><th className="right">Tuition</th><th className="right">Lab & dev.</th><th className="right">Exam</th><th className="right">Library & sports</th><th className="right">Total</th><th>Due</th></tr></thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td><Badge tone="accent">{s.course_code?.replace('BTECH-', '')}</Badge></td>
                <td>Sem {s.semester} <span className="xs muted">· {s.academic_year}</span></td>
                <td className="right mono">{inr(s.tuition_fee)}</td><td className="right mono">{inr(s.lab_development_fee)}</td>
                <td className="right mono">{inr(s.exam_fee)}</td><td className="right mono">{inr(s.library_sports_fee)}</td>
                <td className="right mono strong">{inr(s.total_amount)}</td>
                <td className="small">{fmtDate(s.due_date)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

/* ====================================================================== */
function AdminFees() {
  const c = useChartColors();
  const [tab, setTab] = useState('overview');
  const [course, setCourse] = useState('all');
  const { data, loading, error, hardReload } = useLoader((api) => Promise.all([api('/fees/financial-overview'), api('/fees/structures')]));
  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;
  const [o, structs] = data;
  const s = asList(structs);
  const courses = [...new Set(s.map((x) => x.course_code))].sort();
  const pending = Math.max(0, (o.total_demand || 0) - (o.total_collected || 0));
  const donut = [
    { name: 'Collected', value: o.total_collected, color: c.success },
    { name: 'Overdue', value: o.overdue_amount, color: c.danger },
    { name: 'Pending (not yet due)', value: Math.max(0, pending - (o.overdue_amount || 0)), color: c.warning },
  ];

  return (
    <>
      <PageHeader eyebrow="Finance" title={<>Fee <em>ledger</em></>} description="Institution-wide collection, semester-wise fee structures for every programme, and a per-student ledger with payments and overrides." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'overview', label: 'Overview', icon: Wallet },
        { id: 'ledger', label: 'Student ledger', icon: Users },
        { id: 'structures', label: 'Fee structures', icon: Layers, count: s.length },
      ]} />

      {tab === 'overview' && (
        <div className="stack gap-16">
          <div className="grid-4">
            <Stat label="Total demand" value={inrShort(o.total_demand)} icon={BadgeIndianRupee} tone="accent" />
            <Stat label="Collected" value={inrShort(o.total_collected)} icon={CheckCircle2} tone="success" hint={`${pct(o.collection_percentage)} recovery`} />
            <Stat label="Overdue" value={inrShort(o.overdue_amount)} icon={AlertTriangle} tone="danger" />
            <Stat label="Accounts" value={num(o.paid_count)} unit={`/ ${num((o.paid_count || 0) + (o.pending_count || 0))} paid`} icon={Users} tone="info" hint={`${num(o.pending_count)} pending`} />
          </div>
          <div className="grid-main">
            <Card title="Collection status" subtitle="Current semester, all programmes" icon={Wallet}>
              <div className="row gap-24 wrap" style={{ alignItems: 'center' }}>
                <div style={{ width: 240, height: 240, position: 'relative' }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={donut} dataKey="value" nameKey="name" innerRadius={78} outerRadius={110} paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
                        {donut.map((d) => <Cell key={d.name} fill={d.color} />)}
                      </Pie>
                      <Tooltip content={<ChartTip format={(v) => inr(v)} />} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="ring-label" style={{ pointerEvents: 'none' }}><div><div className="serif num" style={{ fontSize: 36, lineHeight: 1 }}>{pct(o.collection_percentage, 0)}</div><div className="xs muted">collected</div></div></div>
                </div>
                <div className="stack gap-12 grow" style={{ minWidth: 220 }}>
                  {donut.map((d) => (
                    <div key={d.name} className="row-between">
                      <span className="row gap-8 small"><span className="dot" style={{ background: d.color }} />{d.name}</span>
                      <span className="mono strong">{inr(d.value)}</span>
                    </div>
                  ))}
                  <div className="divider" />
                  <div className="row-between"><span className="small muted">Total demand</span><span className="mono strong">{inr(o.total_demand)}</span></div>
                </div>
              </div>
            </Card>
            <Card title="Average semester fee by programme" icon={Layers}>
              <div className="stack gap-12">
                {courses.map((cc) => {
                  const xs = s.filter((x) => x.course_code === cc);
                  const avg = xs.reduce((a, x) => a + x.total_amount, 0) / (xs.length || 1);
                  const max = Math.max(...s.map((x) => x.total_amount));
                  return (
                    <div key={cc}>
                      <div className="row-between small" style={{ marginBottom: 6 }}><span className="strong">{cc.replace('BTECH-', 'B.Tech ')}</span><span className="mono">{inr(avg)}</span></div>
                      <div className="progress"><span style={{ width: `${(avg / max) * 100}%` }} /></div>
                    </div>
                  );
                })}
              </div>
            </Card>
          </div>
        </div>
      )}

      {tab === 'ledger' && <AdminLedger />}

      {tab === 'structures' && (
        <div className="stack gap-12">
          <Chips value={course} onChange={setCourse} options={[{ value: 'all', label: 'All programmes' }, ...courses.map((x) => ({ value: x, label: x.replace('BTECH-', '') }))]} />
          <StructureTable rows={s.filter((x) => course === 'all' || x.course_code === course).sort((a, b) => a.course_id - b.course_id || a.semester - b.semester)} />
        </div>
      )}
    </>
  );
}

function AdminLedger() {
  const [section, setSection] = useState('CSE-2');
  const [sid, setSid] = useState(null);
  const [pay, setPay] = useState(null);
  const [override, setOverride] = useState(null);
  const [receiptNo, setReceiptNo] = useState(null);
  const roster = useLoader((api) => api(`/students?section=${encodeURIComponent(section)}`), [section]);
  const students = asList(roster.data);
  useEffect(() => { if (students.length && !students.find((x) => x.id === sid)) setSid(students[0].id); }, [students, sid]);
  const ledger = useLoader((api) => (sid ? api(`/fees/student/${sid}`) : Promise.resolve([])), [sid]);
  const rows = asList(ledger.data);
  const st = students.find((x) => x.id === sid);

  return (
    <div className="stack gap-16">
      <div className="row gap-8 wrap">
        <select className="select" style={{ width: 120 }} value={section} onChange={(e) => { setSection(e.target.value); setSid(null); }} aria-label="Section">{SECTIONS.map((x) => <option key={x}>{x}</option>)}</select>
        <select className="select" style={{ width: 300 }} value={sid || ''} onChange={(e) => setSid(Number(e.target.value))} aria-label="Student" disabled={roster.loading}>
          {students.map((x) => <option key={x.id} value={x.id}>{x.full_name} · {x.roll_no}</option>)}
        </select>
      </div>
      {ledger.loading ? <Skeleton h={220} r={14} /> : ledger.error ? <ErrorState error={ledger.error} onRetry={ledger.hardReload} /> : (
        <>
          <Ledger payments={rows} title={st ? `${st.full_name} · ${st.roll_no}` : 'Ledger'} onReceipt={setReceiptNo} onPay={setPay} />
          {rows.length > 0 && (
            <div className="row gap-8 wrap">
              {rows.map((p) => <button key={p.id} className="btn btn-ghost btn-sm" onClick={() => setOverride(p)}><ShieldAlert size={13} /> Override semester {p.semester}</button>)}
            </div>
          )}
        </>
      )}
      <Checkout p={pay} onClose={() => setPay(null)} onPaid={(no) => { setPay(null); ledger.reload(); setReceiptNo(no); }} />
      <ReceiptModal no={receiptNo} onClose={() => setReceiptNo(null)} />
      <OverrideModal p={override} onClose={() => setOverride(null)} onDone={() => { setOverride(null); ledger.reload(); }} />
    </div>
  );
}

/* ====================================================================== */
function Checkout({ p, onClose, onPaid }) {
  const call = useApi();
  const toast = useToast();
  const { user } = useAuth();
  const office = user?.role === 'admin';
  const outstanding = outstandingOf(p);
  const [method, setMethod] = useState('UPI');
  const [amount, setAmount] = useState('');
  const [ref, setRef] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (p) { setAmount(String(outstandingOf(p))); setRef(''); setMethod(office ? 'Cash' : 'UPI'); } }, [p, office]);
  const amt = Math.round(Number(amount) || 0);
  const valid = amt >= 1 && amt <= outstanding;
  const pay = async () => {
    setBusy(true);
    try {
      const r = await call('/fees/pay', { method: 'POST', body: { paymentId: p.id, paymentMethod: method, amount: amt, transactionRef: ref.trim() || undefined } });
      if (r?.status === 'Paid') confetti({ particleCount: 90, spread: 70, origin: { y: 0.65 } });
      toast.success(r?.status === 'Paid' ? `Paid in full — receipt ${r.receipt_no}` : `${inr(amt)} recorded · ${inr(r?.outstanding)} still due`);
      onPaid(r?.receipt_no);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  const methods = office
    ? [['Cash', 'Paid at the accounts counter', Landmark], ['Cheque/DD', 'Enter the cheque or DD number', Receipt], ['UPI', 'Enter the UTR from the payer’s app', Smartphone], ['Net Banking', 'NEFT / RTGS / IMPS reference', Landmark]]
    : [['UPI', 'GPay, PhonePe, Paytm', Smartphone], ['Credit/Debit Card', 'Visa, Mastercard, RuPay', CreditCard], ['Net Banking', 'All major Indian banks', Landmark]];
  return (
    <Modal open={!!p} onClose={() => !busy && onClose()} title={office ? 'Record a payment' : 'Pay fees'} subtitle={p && `${p.student_name} · Semester ${p.semester}`} icon={CreditCard} size="sm"
      footer={<><button className="btn btn-ghost" onClick={onClose} disabled={busy}>Cancel</button><button className="btn btn-accent" onClick={pay} disabled={busy || !valid}>{busy ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Processing…</> : <>{office ? 'Record' : 'Pay'} {inr(amt)}</>}</button></>}>
      {p && (
        <div className="stack gap-12">
          <div className="tile" style={{ textAlign: 'center' }}>
            <div className="xs muted">Outstanding</div>
            <div className="serif num" style={{ fontSize: 42, lineHeight: 1.1 }}>{inr(outstanding)}</div>
            {p.fine_amount > 0 && <div className="xs t-warning">incl. {inr(p.fine_amount)} late fine</div>}
            {p.amount_paid > 0 && <div className="xs muted">{inr(p.amount_paid)} already paid</div>}
          </div>
          <Field label="Amount (₹)" hint={amt < outstanding && valid ? 'Part payment — the balance stays on the ledger' : undefined}>
            <input className="input mono" type="number" min="1" max={outstanding} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <div className="label">Payment method</div>
          <div className="stack gap-8">
            {methods.map(([k, d, Icon]) => (
              <label key={k} className="tile-sm row gap-12" style={{ cursor: 'pointer', borderColor: method === k ? 'var(--accent)' : undefined, background: method === k ? 'var(--accent-soft)' : undefined }}>
                <input type="radio" name="method" checked={method === k} onChange={() => setMethod(k)} style={{ accentColor: 'var(--accent)' }} />
                <Icon size={16} />
                <div className="grow"><div className="strong small">{k}</div><div className="xs muted">{d}</div></div>
                {method === k && <ArrowUpRight size={14} className="accent" />}
              </label>
            ))}
          </div>
          <Field label="Reference number" hint={office ? 'UTR, cheque/DD no. or counter slip — printed on the receipt' : 'Optional: your UPI / bank reference'}>
            <input className="input mono" value={ref} onChange={(e) => setRef(e.target.value)} placeholder={office ? 'e.g. 4312XXXXXX09' : 'Auto-generated if left blank'} />
          </Field>
          {!office && <p className="xs faint">No payment gateway is connected yet, so this records the payment against the reference above. The accounts office reconciles it.</p>}
        </div>
      )}
    </Modal>
  );
}

function ReceiptModal({ no, onClose }) {
  const { data, loading, error } = useLoader((api) => (no ? api(`/fees/receipt/${encodeURIComponent(no)}`) : Promise.resolve(null)), [no]);
  const r = data?.receipt;
  const inst = data?.institution;
  return (
    <Modal open={!!no} onClose={onClose} title="Fee receipt" subtitle={no} icon={Receipt} size="lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Close</button><button className="btn btn-primary" onClick={() => window.print()}><Printer size={14} /> Print / save PDF</button></>}>
      {loading ? <Skeleton h={360} /> : error ? <Callout tone="danger">{error.message}</Callout> : r && (
        <div>
          <div className="row-between wrap" style={{ gap: 16, paddingBottom: 18, borderBottom: '1px dashed var(--line-strong)' }}>
            <div className="row gap-12">
              <div className="brand-mark" style={{ width: 46, height: 46, background: "var(--brand-grad)", borderRadius: 14 }}><BrandMark size={24} /></div>
              <div>
                <div className="serif" style={{ fontSize: 21, lineHeight: 1.15 }}>{inst?.name}</div>
                <div className="xs muted">{inst?.address}</div>
                <div className="xs muted">{inst?.affiliate}</div>
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <Badge tone="success" dot>Paid</Badge>
              <div className="mono small" style={{ marginTop: 6 }}>{r.receipt_no}</div>
              <div className="xs muted">{fmtDateTime(r.payment_date)}</div>
            </div>
          </div>
          <div className="grid-2" style={{ padding: '18px 0', gap: 12 }}>
            <div><div className="xs muted">Received from</div><div className="strong">{r.student_name}</div><div className="xs muted mono">{r.roll_no} · {r.enrollment_no}</div></div>
            <div><div className="xs muted">Programme</div><div className="strong">{r.course_name}</div><div className="xs muted">Semester {r.semester} · {r.academic_year}</div></div>
          </div>
          <table className="tbl" style={{ border: '1px solid var(--line)' }}>
            <thead><tr><th>Particulars</th><th className="right">Amount</th></tr></thead>
            <tbody>
              {PARTS.map(([k, l]) => <tr key={k}><td>{l}</td><td className="right mono">{inr(r[k])}</td></tr>)}
              {r.fine_amount > 0 && <tr><td>Late fine</td><td className="right mono">{inr(r.fine_amount)}</td></tr>}
              <tr><td className="strong">Total paid</td><td className="right mono strong" style={{ fontSize: 16 }}>{inr(r.amount_paid)}</td></tr>
            </tbody>
          </table>
          <div className="row-between wrap xs muted" style={{ marginTop: 16, gap: 8 }}>
            <span>Method: <b className="ink-2">{r.payment_method}</b></span>
            <span>Transaction: <span className="mono ink-2">{r.transaction_id}</span></span>
            <span>Reg: {inst?.tax_reg}</span>
          </div>
          <div className="xs faint" style={{ marginTop: 14 }}>This is a computer-generated receipt and does not require a signature.</div>
        </div>
      )}
    </Modal>
  );
}

function OverrideModal({ p, onClose, onDone }) {
  const call = useApi();
  const toast = useToast();
  const [f, setF] = useState({ status: '', fineAmount: '', amountDue: '', reason: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (p) setF({ status: p.status, fineAmount: p.fine_amount ?? 0, amountDue: p.amount_due ?? 0, reason: '' }); }, [p]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async () => {
    setBusy(true);
    try {
      await call('/fees/override', { method: 'PUT', body: { paymentId: p.id, status: f.status, fineAmount: Number(f.fineAmount), amountDue: Number(f.amountDue), reason: f.reason } });
      toast.success('Fee record updated and logged');
      onDone();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!p} onClose={onClose} title="Fee override" subtitle={p && `${p.student_name} · Semester ${p.semester}`} icon={ShieldAlert}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-danger" onClick={submit} disabled={busy || f.reason.trim().length < 5}>{busy ? 'Applying…' : 'Apply override'}</button></>}>
      <div className="form-grid">
        <Field label="Status"><select className="select" value={f.status} onChange={set('status')}>{['Paid', 'Pending', 'Partial', 'Overdue', 'Waived'].map((x) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Amount due (₹)"><input className="input mono" type="number" min="0" value={f.amountDue} onChange={set('amountDue')} /></Field>
        <Field label="Fine (₹)"><input className="input mono" type="number" min="0" value={f.fineAmount} onChange={set('fineAmount')} /></Field>
        <div className="row" style={{ alignItems: 'flex-end' }}><span className="xs muted row gap-4"><Clock size={12} /> Written to the audit log</span></div>
        <Field label="Reason" className="full" hint="Required — at least 5 characters"><textarea className="textarea" value={f.reason} onChange={set('reason')} placeholder="e.g. Medical exemption approved by the Director" /></Field>
      </div>
    </Modal>
  );
}
