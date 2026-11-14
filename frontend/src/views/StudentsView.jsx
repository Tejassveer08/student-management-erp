import React, { useMemo, useState } from 'react';
import {
  GraduationCap, Plus, UploadCloud, Pencil, Trash2, Mail, Phone, MapPin, Droplet, Cake, KeyRound, Copy, ChevronLeft,
  ChevronRight, ArrowUpDown, AlertTriangle, Users, Award, CreditCard, Activity, User, FileSpreadsheet, CheckCircle2, Download,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi, asList } from '../lib/api';
import { useLoader, useDebounced } from '../lib/hooks';
import { pct, attTone, fmtDate, inr, gradeClass, statusTone, num } from '../lib/format';
import { SECTIONS, SEMESTERS } from '../config/campus';
import {
  PageHeader, Card, Badge, Progress, Avatar, Modal, Field, EmptyState, ErrorState, PageSkeleton, SearchInput, Tabs,
  KV, Callout, Skeleton, Stat, Segmented, useToast, cx,
} from '../components/ui';

const PAGE = 25;

export default function StudentsView() {
  const { user } = useAuth();
  if (user?.role === 'student' || user?.role === 'parent') return <OwnProfiles />;
  return <Directory />;
}

/* ====================================================================== */
/* Student / parent: their own dossier(s)                                  */
/* ====================================================================== */
function OwnProfiles() {
  const { user } = useAuth();
  const { data, loading, error, hardReload } = useLoader((api) => api('/students'));
  const list = asList(data);
  const [pick, setPick] = useState(0);
  if (loading) return <PageSkeleton stats={0} rows={2} />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;
  if (!list.length) return <div className="card"><EmptyState title="No student record linked to this account" /></div>;
  const st = list[Math.min(pick, list.length - 1)];
  return (
    <>
      <PageHeader eyebrow="Academic registry" title={user?.role === 'parent' ? <>Ward <em>dossier</em></> : <>My <em>dossier</em></>}
        description="Official enrolment record held by the institute. Contact the academic office to correct any detail."
        actions={list.length > 1 && <Segmented value={pick} onChange={setPick} options={list.map((s, i) => ({ value: i, label: s.full_name.split(' ')[0] }))} />} />
      <DossierBody id={st.id} />
    </>
  );
}

/* ====================================================================== */
/* Admin / faculty directory                                               */
/* ====================================================================== */
function Directory() {
  const { user } = useAuth();
  const call = useApi();
  const toast = useToast();
  const isAdmin = user?.role === 'admin';
  const canCreate = isAdmin;

  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [sem, setSem] = useState('');
  const [section, setSection] = useState('');
  const [riskOnly, setRiskOnly] = useState(false);
  const [sort, setSort] = useState({ key: 'roll_no', dir: 1 });
  const [page, setPage] = useState(0);

  const [view, setView] = useState(null);
  const [edit, setEdit] = useState(null);
  const [reset, setReset] = useState(null);
  const [del, setDel] = useState(null);
  const [admit, setAdmit] = useState(false);
  const [batch, setBatch] = useState(false);
  const [creds, setCreds] = useState(null);

  const { data, loading, error, hardReload, reload } = useLoader((api) => {
    const p = new URLSearchParams();
    if (dq) p.set('search', dq);
    if (sem) p.set('semester', sem);
    if (section) p.set('section', section);
    return api(`/students?${p}`);
  }, [dq, sem, section]);

  const rows = useMemo(() => {
    let r = asList(data);
    if (riskOnly) r = r.filter((s) => s.is_attendance_critical);
    const k = sort.key;
    return [...r].sort((a, b) => {
      const x = a[k] ?? '';
      const y = b[k] ?? '';
      return (typeof x === 'number' ? x - y : String(x).localeCompare(String(y))) * sort.dir;
    });
  }, [data, riskOnly, sort]);

  const all = asList(data);
  const atRisk = all.filter((s) => s.is_attendance_critical).length;
  const avgCgpa = all.length ? all.reduce((a, s) => a + (s.current_cgpa || 0), 0) / all.length : 0;
  const avgAtt = all.length ? all.reduce((a, s) => a + (s.live_attendance_pct || 0), 0) / all.length : 0;
  const pages = Math.max(1, Math.ceil(rows.length / PAGE));
  const cur = Math.min(page, pages - 1);
  const shown = rows.slice(cur * PAGE, cur * PAGE + PAGE);

  const sortBy = (key) => { setSort((s) => ({ key, dir: s.key === key ? -s.dir : 1 })); setPage(0); };
  const th = (k, children, className) => (
    <th className={className} key={k}><button className="row gap-4" onClick={() => sortBy(k)} style={{ background: 'none', border: 0, font: 'inherit', color: sort.key === k ? 'var(--ink)' : 'inherit', cursor: 'pointer', textTransform: 'inherit', letterSpacing: 'inherit', marginLeft: className === 'right' ? 'auto' : 0 }}>{children}<ArrowUpDown size={11} /></button></th>
  );

  const exportCSV = () => {
    const head = ['Roll no', 'Enrollment', 'Name', 'Email', 'Phone', 'Semester', 'Section', 'Attendance %', 'CGPA', 'Status', 'Guardian', 'Guardian phone'];
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [head, ...rows.map((s) => [s.roll_no, s.enrollment_no, s.full_name, s.email, s.phone, s.semester, s.section, s.live_attendance_pct, s.current_cgpa, s.status, s.parent_name, s.parent_phone])].map((r) => r.map(esc).join(',')).join('\n');
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv' })), download: 'students.csv' });
    a.click();
  };

  const doDelete = async () => {
    try {
      await call(`/students/${del.id}`, { method: 'DELETE' });
      toast.success(`${del.full_name} removed from the registry`);
      setDel(null);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader
        eyebrow="Academic registry"
        title={<>Student <em>directory</em></>}
        description={isAdmin ? 'Every enrolled student across five programmes and fifteen sections — profiles, admissions and login provisioning.' : 'Students in the sections mapped to you.'}
        actions={<>
          <button className="btn btn-ghost" onClick={exportCSV} disabled={!rows.length}><Download size={15} /> Export</button>
          {canCreate && <button className="btn btn-ghost" onClick={() => setBatch(true)}><UploadCloud size={15} /> Batch import</button>}
          {canCreate && <button className="btn btn-accent" onClick={() => setAdmit(true)}><Plus size={15} /> New admission</button>}
        </>}
      />

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Stat label="Students in view" value={loading ? '…' : num(all.length)} icon={Users} tone="accent" />
        <Stat label="Average attendance" value={loading ? '…' : pct(avgAtt)} icon={Activity} tone={attTone(avgAtt)} />
        <Stat label="Average CGPA" value={loading ? '…' : avgCgpa.toFixed(2)} icon={Award} tone="violet" />
        <Stat label="Below 75%" value={loading ? '…' : num(atRisk)} icon={AlertTriangle} tone="danger"
          hint={<button className={cx('btn btn-sm', riskOnly ? 'btn-danger-soft' : 'btn-quiet')} style={{ marginLeft: -10 }} onClick={() => { setRiskOnly((r) => !r); setPage(0); }}>{riskOnly ? 'Showing at-risk only' : 'Show only these'}</button>} />
      </div>

      <Card flush>
        <div className="row wrap" style={{ padding: 14, gap: 10, borderBottom: '1px solid var(--line)' }}>
          <SearchInput value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder="Search name, roll no or enrollment" style={{ flex: '1 1 260px' }} />
          <select className="select" style={{ width: 150 }} value={sem} onChange={(e) => { setSem(e.target.value); setPage(0); }} aria-label="Semester">
            <option value="">All semesters</option>
            {SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}
          </select>
          <select className="select" style={{ width: 140 }} value={section} onChange={(e) => { setSection(e.target.value); setPage(0); }} aria-label="Section">
            <option value="">All sections</option>
            {SECTIONS.map((s) => <option key={s}>{s}</option>)}
          </select>
        </div>

        {loading ? (
          <div className="stack gap-8" style={{ padding: 16 }}>{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} h={46} />)}</div>
        ) : error ? (
          <div style={{ padding: 16 }}><ErrorState error={error} onRetry={hardReload} /></div>
        ) : rows.length === 0 ? (
          <EmptyState icon={GraduationCap} title="No students match" description="Try a different search or clear the filters." />
        ) : (
          <>
            <div className="table-wrap">
              <table className="tbl">
                <thead>
                  <tr>
                    {th('full_name', 'Student')}
                    {th('roll_no', 'Roll / enrollment')}
                    {th('section', 'Class')}
                    {th('live_attendance_pct', 'Attendance')}
                    {th('current_cgpa', 'CGPA', 'right')}
                    <th>Guardian</th>
                    <th className="right" style={{ width: 90 }} />
                  </tr>
                </thead>
                <tbody>
                  {shown.map((s) => (
                    <tr key={s.id} className="clickable" onClick={() => setView(s)}>
                      <td>
                        <div className="row gap-10">
                          <Avatar src={s.avatar_url} name={s.full_name} size={34} />
                          <div style={{ minWidth: 0 }}><div className="strong truncate">{s.full_name}</div><div className="xs muted truncate">{s.email}</div></div>
                        </div>
                      </td>
                      <td><div className="mono small">{s.roll_no}</div><div className="mono xs faint">{s.enrollment_no}</div></td>
                      <td><Badge>{s.section}</Badge> <span className="xs muted">Sem {s.semester}</span></td>
                      <td style={{ minWidth: 150 }}>
                        <div className="row gap-8"><Progress value={s.live_attendance_pct} tone={attTone(s.live_attendance_pct)} className="grow" /><span className="mono xs" style={{ width: 38, textAlign: 'right' }}>{pct(s.live_attendance_pct, 0)}</span></div>
                      </td>
                      <td className="right mono strong">{Number(s.current_cgpa || 0).toFixed(2)}</td>
                      <td><div className="small">{s.parent_name || '—'}</div><div className="xs muted mono">{s.parent_phone}</div></td>
                      <td className="right" onClick={(e) => e.stopPropagation()}>
                        <div className="row gap-4" style={{ justifyContent: 'flex-end' }}>
                          {isAdmin && <button className="icon-btn" style={{ width: 30, height: 30 }} title="Edit" onClick={() => setEdit({ ...s })}><Pencil size={14} /></button>}
                          {isAdmin && <button className="icon-btn" style={{ width: 30, height: 30, color: 'var(--danger)' }} title="Delete" onClick={() => setDel(s)}><Trash2 size={14} /></button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="row-between" style={{ padding: '10px 16px', borderTop: '1px solid var(--line)' }}>
              <span className="small muted">{cur * PAGE + 1}–{Math.min(rows.length, (cur + 1) * PAGE)} of {num(rows.length)}</span>
              <div className="row gap-6">
                <button className="btn btn-ghost btn-sm btn-icon" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Previous page"><ChevronLeft size={15} /></button>
                <span className="mono xs muted">{cur + 1} / {pages}</span>
                <button className="btn btn-ghost btn-sm btn-icon" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Next page"><ChevronRight size={15} /></button>
              </div>
            </div>
          </>
        )}
      </Card>

      <Modal open={!!view} onClose={() => setView(null)} size="xl" title={view?.full_name} subtitle={view && `${view.roll_no} · ${view.section} · Semester ${view.semester}`} icon={User}
        footer={isAdmin && view && <><button className="btn btn-ghost" onClick={() => { setReset(view); setView(null); }}><KeyRound size={14} /> Reset password</button><button className="btn btn-ghost" onClick={() => { setEdit({ ...view }); setView(null); }}><Pencil size={14} /> Edit record</button></>}>
        {view && <DossierBody id={view.id} compact />}
      </Modal>

      {isAdmin && <EditModal student={edit} onClose={() => setEdit(null)} onSaved={() => { setEdit(null); reload(); }} />}
      {isAdmin && <ResetModal student={reset} onClose={() => setReset(null)} onDone={(c) => { setReset(null); setCreds(c); }} />}
      {canCreate && <AdmitModal open={admit} onClose={() => setAdmit(false)} onCreated={(c) => { setAdmit(false); setCreds(c); reload(); }} />}
      {canCreate && <BatchModal open={batch} onClose={() => setBatch(false)} onDone={reload} />}

      <Modal open={!!creds} onClose={() => setCreds(null)} title="Student admitted" subtitle="Share these sign-in details with the student." icon={KeyRound} size="sm"
        footer={<button className="btn btn-primary" onClick={() => setCreds(null)}>Done</button>}>
        {creds && (
          <div className="stack gap-12">
            <Callout tone="success" title={creds.fullName}>Portal access is active now. The password is shown only once — they can change it from the account menu.{creds.feeInvoiceCreated ? ' This semester’s fee invoice has been raised.' : ''}</Callout>
            {[['Email', creds.email], ['Roll number', creds.rollNo], ['Temporary password', creds.password], creds.guardian && ['Guardian login', creds.guardian.email], creds.guardian?.temporaryPassword && ['Guardian password', creds.guardian.temporaryPassword]].filter(Boolean).map(([k, v]) => (
              <div key={k} className="row-between tile-sm">
                <div><div className="xs muted">{k}</div><div className="mono strong">{v}</div></div>
                <button className="icon-btn" onClick={() => { navigator.clipboard?.writeText(v); toast.info(`${k} copied`); }} aria-label={`Copy ${k}`}><Copy size={14} /></button>
              </div>
            ))}
          </div>
        )}
      </Modal>

      <Modal open={!!del} onClose={() => setDel(null)} title="Remove student?" size="sm" icon={Trash2}
        footer={<><button className="btn btn-ghost" onClick={() => setDel(null)}>Cancel</button><button className="btn btn-danger" onClick={doDelete}>Delete permanently</button></>}>
        <p className="ink-2">This permanently removes <b>{del?.full_name}</b> ({del?.roll_no}) and their login from the registry. This can’t be undone.</p>
      </Modal>
    </>
  );
}

/* ====================================================================== */
/* Dossier                                                                 */
/* ====================================================================== */
function DossierBody({ id, compact }) {
  const [tab, setTab] = useState('overview');
  const { data: s, loading, error, hardReload } = useLoader((api) => api(`/students/${id}`), [id]);
  if (loading) return <div className="stack gap-12"><Skeleton h={90} /><Skeleton h={220} /></div>;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;
  if (!s) return null;
  const att = s.attendance || {};
  const marks = s.marks || [];
  const byExam = marks.reduce((m, x) => { (m[x.exam_name] = m[x.exam_name] || []).push(x); return m; }, {});
  const fees = s.fees || [];

  return (
    <div className="stack gap-16">
      <div className={cx(!compact && 'card')} style={!compact ? { padding: 20 } : undefined}>
        <div className="row gap-16 wrap">
          <Avatar src={s.avatar_url} name={s.full_name} size={72} />
          <div className="grow" style={{ minWidth: 220 }}>
            {!compact && <div className="serif" style={{ fontSize: 30, lineHeight: 1.1 }}>{s.full_name}</div>}
            <div className="small muted">{s.course_name}</div>
            <div className="row wrap gap-6" style={{ marginTop: 8 }}>
              <Badge tone="accent">{s.section}</Badge><Badge>Semester {s.semester}</Badge><Badge>{s.shift} shift</Badge>
              <Badge tone={statusTone(s.status)} dot>{s.status}</Badge>
            </div>
          </div>
          <div className="row gap-24">
            <div><div className="xs muted">CGPA</div><div className="serif num" style={{ fontSize: 32, lineHeight: 1.1 }}>{s.current_cgpa}</div><div className="xs faint">{s.total_credits_earned} credits</div></div>
            <div><div className="xs muted">Attendance</div><div className={`serif num t-${attTone(att.attendance_percentage)}`} style={{ fontSize: 32, lineHeight: 1.1 }}>{pct(att.attendance_percentage, 0)}</div><div className="xs faint">{att.present_count}/{att.total_sessions} sessions</div></div>
          </div>
        </div>
      </div>

      <Tabs value={tab} onChange={setTab} style={{ marginBottom: 0 }} tabs={[
        { id: 'overview', label: 'Overview', icon: User },
        { id: 'marks', label: 'Marks', icon: Award, count: marks.length },
        { id: 'fees', label: 'Fees', icon: CreditCard, count: fees.length },
      ]} />

      {tab === 'overview' && (
        <div className="grid-2">
          <div className="tile">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Identity</div>
            <KV items={[
              ['Roll number', <span className="mono">{s.roll_no}</span>],
              ['Enrollment', <span className="mono">{s.enrollment_no}</span>],
              ['Department', s.department_name],
              ['Admitted', s.admission_year],
              [<span className="row gap-6"><Cake size={13} />Date of birth</span>, fmtDate(s.dob)],
              [<span className="row gap-6"><Droplet size={13} />Blood group</span>, s.blood_group],
            ]} />
          </div>
          <div className="tile">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Contact & guardian</div>
            <KV items={[
              [<span className="row gap-6"><Mail size={13} />Email</span>, <a href={`mailto:${s.email}`}>{s.email}</a>],
              [<span className="row gap-6"><Phone size={13} />Phone</span>, s.phone],
              [<span className="row gap-6"><MapPin size={13} />Address</span>, s.address],
              ['Guardian', s.linked_parent_name || s.parent_name],
              ['Guardian phone', s.linked_parent_phone || s.parent_phone],
              s.linked_parent_email && ['Guardian email', s.linked_parent_email],
            ]} />
          </div>
          <div className="tile span-2">
            <div className="eyebrow" style={{ marginBottom: 12 }}>Attendance snapshot</div>
            <div className="grid-4" style={{ gap: 10 }}>
              {[['Sessions', att.total_sessions], ['Present', att.present_count], ['Late', att.late_count], ['Absent', att.absent_count]].map(([k, v]) => (
                <div key={k}><div className="xs muted">{k}</div><div className="serif num" style={{ fontSize: 26 }}>{v ?? 0}</div></div>
              ))}
            </div>
            <Progress value={att.attendance_percentage} tone={attTone(att.attendance_percentage)} size="lg" style={{ marginTop: 10 }} />
          </div>
        </div>
      )}

      {tab === 'marks' && (marks.length === 0 ? <EmptyState compact title="No marks recorded" /> : (
        <div className="stack gap-12">
          {Object.entries(byExam).map(([exam, xs]) => (
            <div key={exam} className="card flush" style={{ boxShadow: 'none' }}>
              <div className="card-hd bordered"><div className="card-title">{exam}</div><Badge>{xs[0]?.exam_type}</Badge></div>
              <div className="table-wrap">
                <table className="tbl compact">
                  <thead><tr><th>Subject</th><th className="right">Int.</th><th className="right">Assign.</th><th className="right">Ext.</th><th className="right">Total</th><th className="center">Grade</th></tr></thead>
                  <tbody>
                    {xs.map((m) => (
                      <tr key={m.id}>
                        <td><span className="strong">{m.subject_name}</span> <span className="xs muted mono">{m.subject_code}</span></td>
                        <td className="right mono">{m.internal_assessment}</td><td className="right mono">{m.assignment_score}</td><td className="right mono">{m.external_exam}</td>
                        <td className="right mono strong">{m.total_score}</td>
                        <td className="center"><span className={`grade grade-${gradeClass(m.letter_grade)}`}>{m.letter_grade}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      ))}

      {tab === 'fees' && (fees.length === 0 ? <EmptyState compact title="No fee records" /> : (
        <div className="table-wrap card flush" style={{ boxShadow: 'none' }}>
          <table className="tbl">
            <thead><tr><th>Academic year</th><th className="right">Due</th><th className="right">Paid</th><th className="right">Fine</th><th>Status</th><th>Receipt</th><th>Paid on</th></tr></thead>
            <tbody>
              {fees.map((f) => (
                <tr key={f.id}>
                  <td>{f.academic_year}</td>
                  <td className="right mono">{inr(f.amount_due)}</td><td className="right mono">{inr(f.amount_paid)}</td><td className="right mono">{inr(f.fine_amount)}</td>
                  <td><Badge tone={statusTone(f.status)} dot>{f.status}</Badge></td>
                  <td className="mono xs">{f.receipt_no || '—'}</td>
                  <td className="small">{fmtDate(f.payment_date)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}

/* ====================================================================== */
/* Forms                                                                   */
/* ====================================================================== */
const blankAdmit = { fullName: '', email: '', phone: '', rollNo: '', enrollmentNo: '', semester: 1, section: 'CSE-1', dob: '', bloodGroup: 'B+', address: '', parentName: '', parentPhone: '', parentEmail: '', initialCgpa: 0, password: '' };

function AdmitModal({ open, onClose, onCreated }) {
  const call = useApi();
  const toast = useToast();
  const [f, setF] = useState(blankAdmit);
  const [busy, setBusy] = useState(false);
  const set = (k, num) => (e) => setF((x) => ({ ...x, [k]: num ? Number(e.target.value) : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await call('/students', { method: 'POST', body: f });
      onCreated({ fullName: f.fullName, email: r.loginCredentials?.email, rollNo: f.rollNo, password: r.loginCredentials?.temporaryPassword, guardian: r.guardian, feeInvoiceCreated: r.feeInvoiceCreated });
      setF(blankAdmit);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="New admission" subtitle="Creates the student record and provisions their portal login." icon={Plus} size="lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" form="admit-form" type="submit" disabled={busy}>{busy ? 'Admitting…' : 'Admit student'}</button></>}>
      <form id="admit-form" onSubmit={submit} className="form-grid">
        <Field label="Full name"><input className="input" required value={f.fullName} onChange={set('fullName')} placeholder="Jasleen Kaur" /></Field>
        <Field label="Institutional email"><input className="input" type="email" required value={f.email} onChange={set('email')} placeholder="jasleen.k@gtbit.ac.in" /></Field>
        <Field label="Roll number"><input className="input mono" required value={f.rollNo} onChange={set('rollNo')} placeholder="095/CSE2/2025" /></Field>
        <Field label="Enrollment number"><input className="input mono" required value={f.enrollmentNo} onChange={set('enrollmentNo')} placeholder="09513202725" /></Field>
        <Field label="Semester"><select className="select" value={f.semester} onChange={set('semester', true)}>{SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}</select></Field>
        <Field label="Section"><select className="select" value={f.section} onChange={set('section')}>{SECTIONS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={set('phone')} placeholder="+91 98111 00000" /></Field>
        <Field label="Date of birth"><input className="input" type="date" value={f.dob} onChange={set('dob')} /></Field>
        <Field label="Blood group"><select className="select" value={f.bloodGroup} onChange={set('bloodGroup')}>{['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((b) => <option key={b}>{b}</option>)}</select></Field>
        <Field label="Prior CGPA" hint="Leave 0 for first-semester admissions"><input className="input" type="number" min="0" max="10" step="0.01" value={f.initialCgpa} onChange={set('initialCgpa', true)} /></Field>
        <Field label="Address" className="full"><input className="input" value={f.address} onChange={set('address')} placeholder="Street, locality, city" /></Field>
        <Field label="Guardian name"><input className="input" value={f.parentName} onChange={set('parentName')} /></Field>
        <Field label="Guardian phone"><input className="input" value={f.parentPhone} onChange={set('parentPhone')} /></Field>
        <Field label="Guardian email" hint="Creates (or links) a guardian login for the parent portal"><input className="input" type="email" value={f.parentEmail} onChange={set('parentEmail')} placeholder="parent@email.com" /></Field>
        <Field label="Initial password" hint="Leave blank to generate a secure one"><input className="input mono" value={f.password} onChange={set('password')} placeholder="Auto-generated" minLength={8} /></Field>
      </form>
    </Modal>
  );
}

function EditModal({ student, onClose, onSaved }) {
  const call = useApi();
  const toast = useToast();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  if (student && (!f || f.id !== student.id)) setF({ ...student });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await call(`/students/${f.id}`, {
        method: 'PUT',
        body: {
          fullName: f.full_name, phone: f.phone, semester: Number(f.semester), section: f.section, currentCgpa: Number(f.current_cgpa),
          status: f.status, address: f.address, parentName: f.parent_name, parentPhone: f.parent_phone,
        },
      });
      toast.success('Student record updated');
      onSaved();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!student} onClose={onClose} title="Edit student" subtitle={student && `${student.roll_no} · ${student.enrollment_no}`} icon={Pencil} size="lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" form="edit-form" type="submit" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></>}>
      {f && (
        <form id="edit-form" onSubmit={submit} className="form-grid">
          <Field label="Full name"><input className="input" value={f.full_name || ''} onChange={set('full_name')} /></Field>
          <Field label="Phone"><input className="input" value={f.phone || ''} onChange={set('phone')} /></Field>
          <Field label="Semester"><select className="select" value={f.semester} onChange={set('semester')}>{SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}</select></Field>
          <Field label="Section"><select className="select" value={f.section} onChange={set('section')}>{SECTIONS.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="CGPA"><input className="input" type="number" step="0.01" min="0" max="10" value={f.current_cgpa ?? ''} onChange={set('current_cgpa')} /></Field>
          <Field label="Status"><select className="select" value={f.status || 'Active'} onChange={set('status')}>{['Active', 'Inactive', 'Graduated', 'Suspended', 'Detained'].map((x) => <option key={x}>{x}</option>)}</select></Field>
          <Field label="Address" className="full"><input className="input" value={f.address || ''} onChange={set('address')} /></Field>
          <Field label="Guardian name"><input className="input" value={f.parent_name || ''} onChange={set('parent_name')} /></Field>
          <Field label="Guardian phone"><input className="input" value={f.parent_phone || ''} onChange={set('parent_phone')} /></Field>
        </form>
      )}
    </Modal>
  );
}

function BatchModal({ open, onClose, onDone }) {
  const call = useApi();
  const toast = useToast();
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);

  const parsed = useMemo(() => text.trim().split('\n').map((l) => l.split(',').map((x) => x.trim())).filter((p) => p.length >= 4 && p[0]).map((p) => ({
    fullName: p[0], email: p[1], rollNo: p[2], enrollmentNo: p[3], semester: p[4] ? Number(p[4]) : 1, section: p[5] || 'CSE-1', phone: p[6] || '', initialCgpa: p[7] ? Number(p[7]) : 0, parentEmail: p[8] || '',
  })), [text]);

  const sample = () => setText(`Karan Malhotra, karan.m@gtbit.ac.in, 608/CSE2/2025, 08513202725, 1, CSE-2, 9811234567, 0
Jasleen Kaur, jasleen.k@gtbit.ac.in, 609/CSE2/2025, 08613202725, 1, CSE-2, 9811234568, 0
Aarav Sehgal, aarav.s@gtbit.ac.in, 610/CSE2/2025, 08713202725, 1, CSE-2, 9811234569, 0`);

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      const r = await call('/students/batch', { method: 'POST', body: { studentsList: parsed } });
      setResult(r);
      if (r?.insertedCount) { toast.success(r.message); onDone(); }
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={() => { onClose(); setResult(null); }} title="Batch import" subtitle="Paste one student per line. Each gets a unique temporary password, shown once below." icon={FileSpreadsheet} size="lg"
      footer={<><button className="btn btn-ghost" onClick={sample}>Load sample</button><span className="grow" /><button className="btn btn-ghost" onClick={onClose}>Close</button><button className="btn btn-accent" onClick={run} disabled={busy || !parsed.length}>{busy ? 'Importing…' : `Import ${parsed.length || ''} student${parsed.length === 1 ? '' : 's'}`}</button></>}>
      <div className="stack gap-12">
        <div className="code-box">Name, Email, Roll no, Enrollment no, Semester, Section, Phone, Prior CGPA, Guardian email (optional)</div>
        <textarea className="textarea mono" style={{ minHeight: 180, fontSize: 12.5 }} value={text} onChange={(e) => setText(e.target.value)} placeholder="Paste CSV rows here…" />
        {parsed.length > 0 && (
          <div className="table-wrap card flush" style={{ boxShadow: 'none', maxHeight: 200 }}>
            <table className="tbl compact">
              <thead><tr><th>Name</th><th>Email</th><th>Roll</th><th>Sem</th><th>Section</th></tr></thead>
              <tbody>{parsed.map((p, i) => <tr key={i}><td>{p.fullName}</td><td className="small">{p.email}</td><td className="mono small">{p.rollNo}</td><td>{p.semester}</td><td>{p.section}</td></tr>)}</tbody>
            </table>
          </div>
        )}
        {result && (
          <Callout tone={result.errors?.length ? 'warning' : 'success'} icon={result.errors?.length ? AlertTriangle : CheckCircle2} title={result.message}>
            {result.errors?.length > 0 && <ul style={{ paddingLeft: 16, marginTop: 4 }}>{result.errors.map((e, i) => <li key={i} className="small">{e}</li>)}</ul>}
            {result.credentials?.length > 0 && (
              <button className="btn btn-ghost btn-sm" style={{ marginTop: 8 }} onClick={() => {
                const rows = [['Name', 'Roll no', 'Email', 'Temporary password', 'Guardian email', 'Guardian password'], ...result.credentials.map((c) => [c.name, c.rollNo, c.email, c.temporaryPassword, c.guardian?.email || '', c.guardian?.temporaryPassword || ''])];
                const csv = rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
                const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                Object.assign(document.createElement('a'), { href: url, download: 'new-student-credentials.csv' }).click();
                URL.revokeObjectURL(url);
              }}>Download credentials (CSV)</button>
            )}
          </Callout>
        )}
      </div>
    </Modal>
  );
}

/** Admin issues a new temporary password (audited); the student changes it after signing in */
function ResetModal({ student, onClose, onDone }) {
  const call = useApi();
  const toast = useToast();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const go = async () => {
    setBusy(true);
    try {
      const r = await call('/auth/admin-reset', { method: 'POST', body: { studentId: student.id, reason } });
      onDone({ fullName: student.full_name, email: r.email, rollNo: student.roll_no, password: r.temporaryPassword });
      setReason('');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!student} onClose={onClose} title="Reset password" subtitle={student && `${student.full_name} · ${student.roll_no}`} icon={KeyRound} size="sm"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-danger" onClick={go} disabled={busy || reason.trim().length < 5}>{busy ? 'Resetting…' : 'Issue new password'}</button></>}>
      <div className="stack gap-12">
        <Callout tone="warning">Their current password stops working immediately. The reset is written to the audit trail.</Callout>
        <Field label="Reason" hint="At least 5 characters"><input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Student forgot password — verified ID at the office" autoFocus /></Field>
      </div>
    </Modal>
  );
}
