import React, { useMemo, useState } from 'react';
import { ArrowRight, Eye, EyeOff, AlertCircle, ShieldCheck, Sparkles, KeyRound, UserRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

function detectId(v) {
  const s = v.trim();
  if (!s) return null;
  if (s.includes('@')) return 'Institutional email';
  if (/^FAC-/i.test(s)) return 'Faculty employee ID';
  if (/^\d{3}\/[A-Z0-9-]+\/\d{4}$/i.test(s)) return 'Student roll number';
  if (/^\d{9,12}$/.test(s)) return 'Enrollment number';
  return null;
}

const ROLES = [
  { id: 'student', label: 'Student', placeholder: '071/CSE2/2023', fine: <>Use your roll number like <code>071/CSE2/2023</code> or your 11-digit enrollment number.</> },
  { id: 'faculty', label: 'Faculty', placeholder: 'FAC-CSE-001', fine: <>Use your employee ID such as <code>FAC-CSE-001</code>, or your institutional email.</> },
  { id: 'parent', label: 'Parent', placeholder: 'guardian@email.com', fine: <>Guardians sign in with the email registered at admission. Every linked ward shows up on one dashboard.</> },
  { id: 'admin', label: 'Admin', placeholder: 'dean@gtbit.ac.in', fine: <>Dean’s office and registry accounts. Every privileged action is written to the audit trail.</> },
];

const MODULES = ['Smart Attendance', 'CGPA Probability', 'Exams & Results', 'Fees & Receipts', 'Societies', 'Campus Forum', 'Placements', 'Library & Hostel', 'Merit Leaderboard', 'Governance & Audit'];

export default function LoginView() {
  const { login } = useAuth();
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [role, setRole] = useState('student');
  const kind = useMemo(() => detectId(id), [id]);
  const r = ROLES.find((x) => x.id === role);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await login(id.trim(), password);
    } catch (err) {
      setError(err.message || 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth">
      <div className="auth-aurora" aria-hidden="true"><span /><span /><span /></div>
      <div className="auth-noise" aria-hidden="true" />

      <nav className="auth-nav">
        <span className="brand"><span className="brand-tile">G</span>GTBIT</span>
        <span className="auth-pill hide-sm">Guru Tegh Bahadur Institute of Technology</span>
        <div className="links">
          <span className="auth-pill"><span className="dot live" /> Session 2025–26</span>
        </div>
      </nav>

      <main className="auth-main">
        <section className="stack gap-24">
          <span className="auth-pill rise" style={{ width: 'fit-content' }}><Sparkles size={13} color="#b8f03a" /> One portal for the whole campus</span>
          <h1 className="auth-headline rise d1">Your campus,<br /><span>beautifully in sync.</span></h1>
          <p className="auth-lede rise d2">
            QR attendance, a CGPA forecast with confidence bands, fees, societies and placements, all in one place.
            Each role sees only what it needs.
          </p>
          <div className="auth-feats rise d3 hide-sm">
            <div className="auth-feat"><div className="v">905</div><div className="l">students across 5 programmes</div></div>
            <div className="auth-feat"><div className="v">75%</div><div className="l">attendance rule, tracked live</div></div>
            <div className="auth-feat"><div className="v">29</div><div className="l">societies with duty-leave credit</div></div>
          </div>
        </section>

        <section className="auth-card auth-form rise d2">
          <div className="row-between" style={{ marginBottom: 6 }}>
            <h2>Sign in</h2>
            <span className="row gap-6 xs" style={{ color: '#8d92b6' }}><ShieldCheck size={14} /> Secure</span>
          </div>
          <p className="auth-fine" style={{ marginBottom: 20 }}>Pick who you are, then use your institutional ID.</p>

          <div className="auth-roles" role="radiogroup" aria-label="Account type" style={{ marginBottom: 20 }}>
            {ROLES.map((x) => (
              <button key={x.id} type="button" role="radio" aria-checked={role === x.id} className={`auth-role${role === x.id ? ' active' : ''}`} onClick={() => setRole(x.id)}>
                {x.label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="stack gap-16" noValidate>
            {error && (
              <div className="callout callout-danger" role="alert">
                <AlertCircle size={16} />
                <div>{error}</div>
              </div>
            )}

            <div className="field">
              <div className="row-between">
                <label className="label" htmlFor="login-id">Login ID</label>
                {kind && <span className="auth-detect">● {kind}</span>}
              </div>
              <div className="input-wrap">
                <UserRound size={16} />
                <input id="login-id" className="input" value={id} onChange={(e) => setId(e.target.value)} placeholder={r.placeholder} autoComplete="username" autoFocus required />
              </div>
            </div>

            <div className="field">
              <label className="label" htmlFor="login-pw">Password</label>
              <div className="input-wrap">
                <KeyRound size={16} />
                <input
                  id="login-pw" className="input" style={{ paddingRight: 48 }} type={show ? 'text' : 'password'}
                  value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Your password" autoComplete="current-password" required
                />
                <button type="button" className="icon-btn input-suffix" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'}>
                  {show ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button type="submit" className="auth-submit" disabled={busy || !id.trim() || !password} style={{ marginTop: 4 }}>
              {busy ? <><span className="spinner" style={{ width: 15, height: 15 }} /> Verifying…</> : <>Continue <ArrowRight size={17} /></>}
            </button>
          </form>

          <p className="auth-fine" style={{ marginTop: 16 }}>{r.fine}</p>
        </section>
      </main>

      <div className="auth-marquee" aria-hidden="true">
        <div className="track">
          {[...MODULES, ...MODULES].map((m, i) => <span key={i} className="item">{m}</span>)}
        </div>
      </div>
      <footer className="auth-foot">
        <span>B.Tech CSE project by Tejassveer Singh Vasant, Dev Sharma, Krishmeet Singh and Hargun Kaur · guided by Ms. Basanti Pal Nandi</span>
        <span>GGSIPU, New Delhi · 2026</span>
      </footer>
    </div>
  );
}
