import React, { useEffect, useMemo, useState } from 'react';
import {
  Flag, Users, Plus, Send, MessageSquare, Pencil, Inbox, CheckCircle2, XCircle, Clock, CalendarDays, UserCheck, Crown, GraduationCap,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi, asList } from '../lib/api';
import { useLoader, settle } from '../lib/hooks';
import { fmtDate, timeAgo, titleCase, statusTone } from '../lib/format';
import {
  PageHeader, Card, Badge, Avatar, Tabs, Modal, Field, EmptyState, ErrorState, PageSkeleton, Chips, SearchInput, Callout, Skeleton, Stat, useToast,
} from '../components/ui';

const CAT_HUE = { Technical: 228, Cultural: 330, Entrepreneurial: 32, Literary: 160, Sports: 10, Social: 190, General: 260 };
const hueOf = (c) => CAT_HUE[c] ?? 260;
const mono = (name = '') => name.replace(/^(The|GTBIT)\s+/i, '').split(/\s+/).filter((w) => /^[A-Za-z]/.test(w)).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

export default function SocietiesView({ onNavigate }) {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent';
  const isAdmin = user?.role === 'admin';
  const isFaculty = user?.role === 'faculty';
  const [tab, setTab] = useState(isParent || isFaculty ? 'duty' : 'directory');
  const [duty, setDuty] = useState(false);

  const { data, loading, error, hardReload, reload } = useLoader((api) => Promise.all([
    settle(api('/societies'), []),
    settle(api('/societies/attendance-requests'), []),
  ]));
  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;
  const societies = asList(data[0]);
  const requests = asList(data[1]);
  const coordinated = societies.filter((s) => s.is_coordinator);
  const pending = requests.filter((r) => r.status === 'pending').length;
  const canCoord = isAdmin || coordinated.length > 0;

  return (
    <>
      <PageHeader
        eyebrow="Student life"
        title={<>Societies & <em>duty leave</em></>}
        description={isParent
          ? 'Your ward’s society-duty attendance requests and their approval status.'
          : 'Twenty-nine GTBIT societies — join, message coordinators, and get class attendance credited for approved society work.'}
        actions={isStudent && <button className="btn btn-accent" onClick={() => setDuty(true)}><Plus size={15} /> Request duty leave</button>}
      />

      <Tabs value={tab} onChange={setTab} tabs={[
        !isParent && { id: 'directory', label: 'Directory', icon: Flag, count: societies.length },
        { id: 'duty', label: isFaculty ? 'Duty-leave queue' : 'Duty leave', icon: CalendarDays, count: pending || undefined },
        canCoord && { id: 'coord', label: 'Coordinator desk', icon: Inbox, count: coordinated.reduce((a, s) => a + (s.pending_applications_count || 0), 0) || undefined },
      ]} />

      {tab === 'directory' && <Directory societies={societies} reload={reload} onNavigate={onNavigate} />}
      {tab === 'duty' && <DutyQueue requests={requests} reload={reload} />}
      {tab === 'coord' && canCoord && <CoordinatorDesk societies={isAdmin ? societies : coordinated} reload={reload} />}

      {isStudent && <DutyModal open={duty} onClose={() => setDuty(false)} societies={societies} onDone={() => { setDuty(false); reload(); setTab('duty'); }} />}
    </>
  );
}

/* ---------------------------------------------------------------------- */
function Directory({ societies, reload, onNavigate }) {
  const { user } = useAuth();
  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin';
  const [cat, setCat] = useState('All');
  const [q, setQ] = useState('');
  const [apply, setApply] = useState(null);
  const [contact, setContact] = useState(null);
  const [edit, setEdit] = useState(null);
  const cats = useMemo(() => ['All', ...new Set(societies.map((s) => s.category || 'General'))], [societies]);
  const list = societies.filter((s) => (cat === 'All' || s.category === cat) && (!q || `${s.name} ${s.description}`.toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => (b.approved_member_count || 0) - (a.approved_member_count || 0) || a.name.localeCompare(b.name));
  const mine = societies.filter((s) => s.my_membership?.status === 'approved' || s.is_coordinator);

  return (
    <div className="stack gap-16">
      {isStudent && (
        <div className="grid-3">
          <Stat label="Societies on campus" value={societies.length} icon={Flag} tone="accent" />
          <Stat label="Your memberships" value={mine.length} icon={UserCheck} tone="success" hint={mine.map((s) => s.name).join(', ') || 'Apply to one below'} />
          <Stat label="Applications pending" value={societies.filter((s) => s.my_membership?.status === 'pending').length} icon={Clock} tone="warning" />
        </div>
      )}
      <div className="row-between wrap" style={{ gap: 10 }}>
        <Chips value={cat} onChange={setCat} options={cats.map((c) => ({ value: c, label: c, count: c === 'All' ? societies.length : societies.filter((s) => s.category === c).length }))} />
        <SearchInput value={q} onChange={setQ} placeholder="Search societies" style={{ width: 260 }} />
      </div>
      {list.length === 0 ? <div className="card"><EmptyState icon={Flag} title="No societies match" /></div> : (
        <div className="grid-auto" style={{ '--min': '320px' }}>
          {list.map((s) => {
            const m = s.my_membership;
            const h = hueOf(s.category);
            return (
              <Card key={s.id} className="rise">
                <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
                  <div style={{ width: 48, height: 48, flexShrink: 0, display: 'grid', placeItems: 'center', fontWeight: 700, fontSize: 15, color: `hsl(${h} 60% var(--mono-l))`, background: `hsl(${h} 70% 50% / 0.12)`, border: `1px solid hsl(${h} 60% 50% / 0.25)` }}>{mono(s.name)}</div>
                  <div className="grow">
                    <div className="strong" style={{ fontSize: 15 }}>{s.name}</div>
                    <div className="row gap-6 wrap" style={{ marginTop: 4 }}>
                      <Badge>{s.category || 'General'}</Badge>
                      {s.is_coordinator && <Badge tone="saffron"><Crown size={10} /> You coordinate</Badge>}
                      {!s.is_coordinator && m && <Badge tone={statusTone(m.status)} dot>{titleCase(m.status)}</Badge>}
                    </div>
                  </div>
                </div>
                <p className="small muted clamp-3" style={{ marginTop: 12, minHeight: 40 }}>{s.description}</p>
                <div className="tile-sm stack gap-4 xs" style={{ marginTop: 12 }}>
                  <div className="row-between"><span className="muted">Student coordinator</span><span className="strong">{s.coordinator_student_name || '—'}</span></div>
                  <div className="row-between"><span className="muted">Faculty mentor</span><span className="strong">{s.coordinator_faculty_name || '—'}</span></div>
                  <div className="row-between"><span className="muted">Members</span><span className="strong mono">{s.approved_member_count || 0}</span></div>
                </div>
                <div className="row gap-6 wrap" style={{ marginTop: 12 }}>
                  {isStudent && !s.is_coordinator && m?.status !== 'approved' && (
                    <button className="btn btn-accent btn-sm" disabled={m?.status === 'pending'} onClick={() => setApply(s)}>{m?.status === 'pending' ? 'Application sent' : m?.status === 'rejected' ? 'Re-apply' : 'Apply to join'}</button>
                  )}
                  {isStudent && s.coordinator_student_id && !s.is_coordinator && <button className="btn btn-ghost btn-sm" onClick={() => setContact(s)}><MessageSquare size={13} /> Message</button>}
                  {isAdmin && <button className="btn btn-ghost btn-sm" onClick={() => setEdit(s)}><Pencil size={13} /> Edit</button>}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <ApplyModal s={apply} onClose={() => setApply(null)} onDone={() => { setApply(null); reload(); }} />
      <ContactModal s={contact} onClose={() => setContact(null)} onDone={() => setContact(null)} onNavigate={onNavigate} />
      {isAdmin && <EditModal s={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
function DutyQueue({ requests, reload }) {
  const { user } = useAuth();
  const call = useApi();
  const toast = useToast();
  const canDecide = user?.role === 'faculty' || user?.role === 'admin';
  const [status, setStatus] = useState(canDecide ? 'pending' : 'all');
  const [remarks, setRemarks] = useState({});
  const [busy, setBusy] = useState(null);
  const list = requests.filter((r) => status === 'all' || r.status === status).sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const count = (s) => requests.filter((r) => r.status === s).length;

  const decide = async (r, st) => {
    setBusy(r.id);
    try {
      const d = await call(`/societies/attendance-requests/${r.id}/decide`, { method: 'PUT', body: { status: st, remarks: remarks[r.id] || '' } });
      toast.success(d?.message || `Request ${st}`);
      reload();
    } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="stack gap-16">
      <Callout tone="info">Approved duty leave marks the student <b>Present</b> for that lecture, so it counts towards the 75% attendance rule.</Callout>
      <Chips value={status} onChange={setStatus} options={[
        { value: 'all', label: 'All', count: requests.length },
        { value: 'pending', label: 'Pending', count: count('pending') },
        { value: 'approved', label: 'Approved', count: count('approved') },
        { value: 'rejected', label: 'Rejected', count: count('rejected') },
      ]} />
      {list.length === 0 ? <div className="card"><EmptyState icon={CalendarDays} title={status === 'pending' ? 'Queue is clear' : 'No requests'} description={status === 'pending' ? 'No duty-leave requests are waiting for review.' : undefined} /></div> : (
        <div className="stack gap-12">
          {list.map((r) => (
            <Card key={r.id}>
              <div className="row-between wrap" style={{ gap: 12, alignItems: 'flex-start' }}>
                <div className="grow" style={{ minWidth: 260 }}>
                  <div className="row gap-6 wrap">
                    <Badge tone="accent">{r.society_name}</Badge>
                    <Badge tone="outline">{r.subject_code} · {r.subject_name}</Badge>
                  </div>
                  <div className="strong" style={{ fontSize: 15.5, marginTop: 10 }}>{r.activity_title}</div>
                  {r.reason && <p className="small ink-2" style={{ marginTop: 4 }}>{r.reason}</p>}
                  <div className="row gap-12 wrap xs muted" style={{ marginTop: 10 }}>
                    <span className="row gap-4"><GraduationCap size={12} /> {r.student_name} · <span className="mono">{r.roll_no}</span> · {r.section}</span>
                    <span className="row gap-4"><CalendarDays size={12} /> {fmtDate(r.date)} {r.session_period && `· ${r.session_period}`}</span>
                    <span className="row gap-4"><Users size={12} /> Routed to {r.assigned_faculty_name || 'subject faculty'}</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <Badge tone={statusTone(r.status)} dot>{titleCase(r.status)}</Badge>
                  <div className="xs faint" style={{ marginTop: 6 }}>{timeAgo(r.created_at)}</div>
                </div>
              </div>
              {r.reviewer_remarks && <div className="tile-sm small" style={{ marginTop: 12 }}><span className="muted">{r.reviewed_by_faculty_name || 'Reviewer'}:</span> “{r.reviewer_remarks}”</div>}
              {canDecide && r.status === 'pending' && (
                <div className="row gap-8 wrap" style={{ marginTop: 14 }}>
                  <input className="input input-sm grow" style={{ minWidth: 220 }} placeholder="Remarks (optional)" value={remarks[r.id] || ''} onChange={(e) => setRemarks((x) => ({ ...x, [r.id]: e.target.value }))} />
                  <button className="btn btn-success-soft btn-sm" disabled={busy === r.id} onClick={() => decide(r, 'approved')}><CheckCircle2 size={14} /> Approve</button>
                  <button className="btn btn-danger-soft btn-sm" disabled={busy === r.id} onClick={() => decide(r, 'rejected')}><XCircle size={14} /> Reject</button>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
function CoordinatorDesk({ societies, reload }) {
  const call = useApi();
  const toast = useToast();
  const [sid, setSid] = useState(societies.find((s) => s.pending_applications_count)?.id || societies[0]?.id);
  const [busy, setBusy] = useState(null);
  const apps = useLoader((api) => (sid ? api(`/societies/${sid}/applications`) : Promise.resolve([])), [sid]);
  const list = asList(apps.data).sort((a, b) => (a.status === 'pending' ? -1 : 1) - (b.status === 'pending' ? -1 : 1));

  const decide = async (a, status) => {
    setBusy(a.id);
    try {
      await call(`/societies/applications/${a.id}/decide`, { method: 'PUT', body: { status } });
      toast.success(`${a.student_name} ${status}`);
      apps.reload();
      reload();
    } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <Card flush title="Membership applications" icon={Inbox}
      actions={<select className="select select-sm" style={{ width: 280 }} value={sid || ''} onChange={(e) => setSid(Number(e.target.value))}>
        {societies.map((s) => <option key={s.id} value={s.id}>{s.name}{s.pending_applications_count ? ` (${s.pending_applications_count} pending)` : ''}</option>)}
      </select>}>
      {apps.loading ? <div style={{ padding: 16 }}><Skeleton h={120} /></div> : apps.error ? <div style={{ padding: 16 }}><ErrorState error={apps.error} onRetry={apps.hardReload} /></div> : list.length === 0 ? <EmptyState icon={Inbox} title="No applications" /> : (
        <div className="list">
          {list.map((a) => (
            <div key={a.id} className="list-item" style={{ alignItems: 'flex-start' }}>
              <Avatar src={a.avatar_url} name={a.student_name} size={36} />
              <div className="grow">
                <div className="list-title">{a.student_name} <span className="mono xs muted">{a.roll_no} · {a.section}</span></div>
                <div className="small ink-2" style={{ marginTop: 2 }}>{a.application_message}</div>
                <div className="xs faint" style={{ marginTop: 4 }}>Applied {timeAgo(a.applied_at)}</div>
              </div>
              {a.status === 'pending' ? (
                <div className="row gap-6">
                  <button className="btn btn-success-soft btn-sm" disabled={busy === a.id} onClick={() => decide(a, 'approved')}><CheckCircle2 size={14} /> Accept</button>
                  <button className="btn btn-danger-soft btn-sm" disabled={busy === a.id} onClick={() => decide(a, 'rejected')}><XCircle size={14} /></button>
                </div>
              ) : <Badge tone={statusTone(a.status)} dot>{titleCase(a.status)}</Badge>}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/* ---------------------------------------------------------------------- */
function ApplyModal({ s, onClose, onDone }) {
  const call = useApi();
  const toast = useToast();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await call(`/societies/${s.id}/apply`, { method: 'POST', body: { applicationMessage: msg } });
      toast.success(r?.message || 'Application sent');
      setMsg('');
      onDone();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!s} onClose={onClose} title={`Join ${s?.name || ''}`} subtitle="The student coordinator reviews every application." icon={Flag} size="sm"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" onClick={submit} disabled={busy || !msg.trim()}><Send size={14} /> {busy ? 'Sending…' : 'Send application'}</button></>}>
      <Field label="Why do you want to join?"><textarea className="textarea" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Skills, past projects or events you’d like to contribute to" autoFocus /></Field>
    </Modal>
  );
}

function ContactModal({ s, onClose, onDone, onNavigate }) {
  const call = useApi();
  const toast = useToast();
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      await call(`/societies/${s.id}/contact`, { method: 'POST', body: { message: msg } });
      toast.success(`Message sent to ${s.coordinator_student_name} — continue the thread in the forum`);
      setMsg('');
      onDone();
      onNavigate?.('forum');
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!s} onClose={onClose} title={`Message ${s?.coordinator_student_name || 'coordinator'}`} subtitle={`${s?.name} · opens a forum thread`} icon={MessageSquare} size="sm"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" onClick={submit} disabled={busy || !msg.trim()}><Send size={14} /> {busy ? 'Sending…' : 'Send'}</button></>}>
      <Field label="Message"><textarea className="textarea" value={msg} onChange={(e) => setMsg(e.target.value)} autoFocus /></Field>
    </Modal>
  );
}

function DutyModal({ open, onClose, societies, onDone }) {
  const { studentProfile } = useAuth();
  const call = useApi();
  const toast = useToast();
  const subs = useLoader((api) => (open ? api(`/academics/subjects?semester=${studentProfile?.semester || 4}`) : Promise.resolve([])), [open]);
  const subjects = asList(subs.data).filter((s) => !studentProfile?.course_id || s.course_id === studentProfile.course_id);
  const member = societies.filter((s) => s.my_membership?.status === 'approved' || s.is_coordinator);
  const choices = member.length ? member : societies;
  const [f, setF] = useState({ societyId: '', classSubjectId: '', date: new Date().toISOString().slice(0, 10), sessionPeriod: '10:00 - 11:00', activityTitle: '', reason: '' });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setF((x) => ({ ...x, societyId: x.societyId || choices[0]?.id || '', classSubjectId: x.classSubjectId || subjects[0]?.id || '' }));
  }, [choices.length, subjects.length]); // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await call('/societies/attendance-requests', { method: 'POST', body: { ...f, societyId: Number(f.societyId), classSubjectId: Number(f.classSubjectId) } });
      toast.success(r?.message || 'Request sent to the subject faculty');
      setF((x) => ({ ...x, activityTitle: '', reason: '' }));
      onDone();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Request duty leave" subtitle="Routed automatically to the faculty who teaches the missed lecture." icon={CalendarDays} size="lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" type="submit" form="duty-form" disabled={busy}>{busy ? 'Submitting…' : 'Submit request'}</button></>}>
      {member.length === 0 && <Callout tone="warning" style={{ marginBottom: 14 }}>You aren’t an approved member of any society yet — the request may be rejected.</Callout>}
      <form id="duty-form" className="form-grid" onSubmit={submit}>
        <Field label="Society"><select className="select" value={f.societyId} onChange={set('societyId')}>{choices.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
        <Field label="Missed lecture"><select className="select" value={f.classSubjectId} onChange={set('classSubjectId')}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></Field>
        <Field label="Date"><input className="input" type="date" required value={f.date} onChange={set('date')} /></Field>
        <Field label="Period"><select className="select" value={f.sessionPeriod} onChange={set('sessionPeriod')}>{['09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00', '12:00 - 13:00', '14:00 - 15:00', '15:00 - 16:00', '16:00 - 17:00'].map((p) => <option key={p}>{p}</option>)}</select></Field>
        <Field label="Activity" className="full"><input className="input" required value={f.activityTitle} onChange={set('activityTitle')} placeholder="e.g. Smart India Hackathon internal round" /></Field>
        <Field label="Details" className="full"><textarea className="textarea" value={f.reason} onChange={set('reason')} placeholder="What you were doing and who can verify it" /></Field>
      </form>
    </Modal>
  );
}

function EditModal({ s, onClose, onDone }) {
  const call = useApi();
  const toast = useToast();
  const [f, setF] = useState(null);
  const [busy, setBusy] = useState(false);
  const people = useLoader((api) => (s ? Promise.all([settle(api('/students?semester=4'), []), settle(api('/faculty'), [])]) : Promise.resolve([[], []])), [!!s]);
  useEffect(() => { if (s) setF({ description: s.description || '', category: s.category || 'General', coordinatorStudentId: s.coordinator_student_id || '', coordinatorFacultyId: s.coordinator_faculty_id || '' }); }, [s]);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await call(`/societies/${s.id}`, { method: 'PUT', body: { ...f, coordinatorStudentId: f.coordinatorStudentId ? Number(f.coordinatorStudentId) : null, coordinatorFacultyId: f.coordinatorFacultyId ? Number(f.coordinatorFacultyId) : null } });
      toast.success(`${s.name} updated`);
      onDone();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  const [students, faculty] = people.data || [[], []];
  return (
    <Modal open={!!s} onClose={onClose} title={`Edit ${s?.name || ''}`} icon={Pencil} size="lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" type="submit" form="soc-form" disabled={busy}>{busy ? 'Saving…' : 'Save'}</button></>}>
      {f && (
        <form id="soc-form" className="form-grid" onSubmit={submit}>
          <Field label="Category"><select className="select" value={f.category} onChange={set('category')}>{Object.keys(CAT_HUE).map((c) => <option key={c}>{c}</option>)}</select></Field>
          <div />
          <Field label="Student coordinator"><select className="select" value={f.coordinatorStudentId} onChange={set('coordinatorStudentId')} disabled={people.loading}><option value="">Unassigned</option>{asList(students).map((x) => <option key={x.id} value={x.id}>{x.full_name} · {x.roll_no}</option>)}</select></Field>
          <Field label="Faculty mentor"><select className="select" value={f.coordinatorFacultyId} onChange={set('coordinatorFacultyId')} disabled={people.loading}><option value="">Unassigned</option>{asList(faculty).map((x) => <option key={x.id} value={x.id}>{x.full_name}</option>)}</select></Field>
          <Field label="Description" className="full"><textarea className="textarea" value={f.description} onChange={set('description')} /></Field>
        </form>
      )}
    </Modal>
  );
}
