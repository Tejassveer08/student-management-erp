import React, { useMemo, useState } from 'react';
import { Users, UserPlus, Mail, Phone, DoorOpen, Clock, BookOpen, Link2, GraduationCap, CalendarDays, Building2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi, asList } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { SECTIONS, SEMESTERS } from '../config/campus';
import {
  PageHeader, Card, Badge, Progress, Avatar, Modal, Field, EmptyState, ErrorState, PageSkeleton, SearchInput, Chips, KV, Stat, Skeleton, useToast,
} from '../components/ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const MAX_LOAD = 24;

export default function FacultyView() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [q, setQ] = useState('');
  const [dept, setDept] = useState('all');
  const [open, setOpen] = useState(null);
  const [add, setAdd] = useState(false);

  const { data, loading, error, hardReload, reload } = useLoader((api) => Promise.all([api('/faculty'), api('/academics/departments').catch(() => [])]));
  const faculty = asList(data?.[0]);
  const depts = asList(data?.[1]);

  const counts = useMemo(() => faculty.reduce((m, f) => ({ ...m, [f.department_code]: (m[f.department_code] || 0) + 1 }), {}), [faculty]);
  const list = faculty.filter((f) => (dept === 'all' || f.department_code === dept) &&
    (!q || `${f.full_name} ${f.employee_id} ${f.designation} ${(f.assigned_subjects || []).map((s) => s.name).join(' ')}`.toLowerCase().includes(q.toLowerCase())));

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;

  const avgLoad = faculty.length ? faculty.reduce((a, f) => a + (f.weekly_workload_hours || 0), 0) / faculty.length : 0;
  const totalSlots = faculty.reduce((a, f) => a + (f.scheduled_slots_count || 0), 0);
  const heavy = faculty.filter((f) => f.weekly_workload_hours >= 18).length;

  return (
    <>
      <PageHeader
        eyebrow="Academic staff"
        title={<>Faculty <em>directory</em></>}
        description="Profiles, qualifications, office rooms and teaching load for every department, with the subject–section map behind each timetable."
        actions={isAdmin && <button className="btn btn-accent" onClick={() => setAdd(true)}><UserPlus size={15} /> Onboard faculty</button>}
      />

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Stat label="Faculty members" value={faculty.length} icon={Users} tone="accent" hint={`${depts.length || Object.keys(counts).length} departments`} />
        <Stat label="Average workload" value={avgLoad.toFixed(1)} unit="h / week" icon={Clock} tone="info" />
        <Stat label="Weekly lecture slots" value={totalSlots} icon={CalendarDays} tone="violet" />
        <Stat label="Heavy load (≥ 18h)" value={heavy} icon={GraduationCap} tone={heavy ? 'warning' : 'success'} />
      </div>

      <div className="row-between wrap" style={{ marginBottom: 16, gap: 12 }}>
        <Chips value={dept} onChange={setDept} options={[{ value: 'all', label: 'All', count: faculty.length }, ...Object.keys(counts).sort().map((k) => ({ value: k, label: k, count: counts[k] }))]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search name, ID or subject" style={{ width: 300, maxWidth: '100%' }} />
      </div>

      {list.length === 0 ? <div className="card"><EmptyState icon={Users} title="No faculty match" /></div> : (
        <div className="grid-auto" style={{ '--min': '300px' }}>
          {list.map((f, i) => (
            <Card key={f.id} onClick={() => setOpen(f.id)} className={`rise d${(i % 6) + 1}`}>
              <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
                <Avatar src={f.avatar_url} name={f.full_name} size={52} square />
                <div className="grow">
                  <div className="strong" style={{ fontSize: 15 }}>{f.full_name}</div>
                  <div className="small muted clamp-2">{f.designation}</div>
                  <div className="row gap-6 wrap" style={{ marginTop: 6 }}>
                    <Badge tone="accent">{f.department_code}</Badge>
                    <span className="mono xs faint">{f.employee_id}</span>
                  </div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <div className="row-between xs" style={{ marginBottom: 6 }}>
                  <span className="muted">Weekly load</span>
                  <span className="mono strong">{f.weekly_workload_hours}h</span>
                </div>
                <Progress value={(f.weekly_workload_hours / MAX_LOAD) * 100} tone={f.weekly_workload_hours >= 20 ? 'danger' : f.weekly_workload_hours >= 18 ? 'warning' : undefined} />
              </div>
              <div className="row wrap gap-4" style={{ marginTop: 12, minHeight: 24 }}>
                {(f.assigned_subjects || []).slice(0, 3).map((s) => <Badge key={`${s.id}-${s.section}`} tone="outline" title={s.name}>{s.code} · {s.section}</Badge>)}
                {(f.assigned_subjects || []).length > 3 && <Badge>+{f.assigned_subjects.length - 3}</Badge>}
              </div>
              <div className="divider" style={{ margin: '14px 0 10px' }} />
              <div className="row-between xs muted">
                <span className="row gap-4"><DoorOpen size={12} /> {f.office_room}</span>
                <span className="row gap-4"><CalendarDays size={12} /> {f.scheduled_slots_count || 0} slots</span>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Profile id={open} onClose={() => setOpen(null)} isAdmin={isAdmin} />
      {isAdmin && <AddFaculty open={add} onClose={() => setAdd(false)} depts={depts} onDone={() => { setAdd(false); reload(); }} />}
    </>
  );
}

function Profile({ id, onClose, isAdmin }) {
  const [assign, setAssign] = useState(false);
  const { data: f, loading, error, hardReload, reload } = useLoader((api) => (id ? api(`/faculty/${id}`) : Promise.resolve(null)), [id]);
  const byDay = useMemo(() => {
    const m = Object.fromEntries(DAYS.map((d) => [d, []]));
    (f?.timetable || []).forEach((t) => { (m[t.day_of_week] = m[t.day_of_week] || []).push(t); });
    Object.values(m).forEach((xs) => xs.sort((a, b) => a.start_time.localeCompare(b.start_time)));
    return m;
  }, [f]);

  return (
    <Modal open={!!id} onClose={onClose} size="xl" title={f?.full_name || 'Faculty profile'} subtitle={f && `${f.designation} · ${f.department_name}`} icon={Users}
      footer={isAdmin && f && <button className="btn btn-ghost" onClick={() => setAssign(true)}><Link2 size={14} /> Assign class</button>}>
      {loading ? <div className="stack gap-12"><Skeleton h={100} /><Skeleton h={240} /></div> : error ? <ErrorState error={error} onRetry={hardReload} /> : f && (
        <div className="stack gap-16">
          <div className="grid-2">
            <div className="tile row gap-16" style={{ alignItems: 'flex-start' }}>
              <Avatar src={f.avatar_url} name={f.full_name} size={64} square />
              <KV style={{ flex: 1 }} items={[
                ['Employee ID', <span className="mono">{f.employee_id}</span>],
                ['Qualification', f.qualification],
                [<span className="row gap-6"><DoorOpen size={13} />Office</span>, f.office_room],
                ['Status', <Badge tone="success" dot>{f.status}</Badge>],
              ]} />
            </div>
            <div className="tile">
              <KV items={[
                [<span className="row gap-6"><Mail size={13} />Email</span>, <a href={`mailto:${f.email}`}>{f.email}</a>],
                [<span className="row gap-6"><Phone size={13} />Phone</span>, f.phone],
                [<span className="row gap-6"><Clock size={13} />Workload</span>, `${f.weekly_workload_hours} hours / week`],
                [<span className="row gap-6"><Building2 size={13} />Department</span>, f.department_code],
              ]} />
              <Progress value={(f.weekly_workload_hours / MAX_LOAD) * 100} style={{ marginTop: 12 }} />
            </div>
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Mapped classes</div>
            {(f.assigned_classes || []).length === 0 ? <EmptyState compact title="No classes mapped" /> : (
              <div className="grid-auto" style={{ '--min': '220px', gap: 10 }}>
                {f.assigned_classes.map((c) => (
                  <div key={c.id} className="tile-sm row gap-10">
                    <span className="stat-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><BookOpen size={14} /></span>
                    <div><div className="small strong">{c.subject_name}</div><div className="xs muted mono">{c.subject_code} · {c.section} · Sem {c.semester}</div></div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div>
            <div className="eyebrow" style={{ marginBottom: 10 }}>Weekly timetable</div>
            <div className="grid-auto" style={{ '--min': '150px', gap: 10 }}>
              {DAYS.map((d) => (
                <div key={d} className="tile-sm" style={{ minHeight: 110 }}>
                  <div className="xs strong" style={{ marginBottom: 8 }}>{d}</div>
                  <div className="stack gap-6">
                    {byDay[d].length === 0 ? <span className="xs faint">Free</span> : byDay[d].map((t) => (
                      <div key={t.id} className="tt-slot" style={{ padding: '6px 8px' }}>
                        <div className="mono xs muted">{t.start_time}–{t.end_time}</div>
                        <div className="xs strong">{t.subject_code}</div>
                        <div className="xs muted">{t.section} · {t.room_no}</div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      {isAdmin && f && <AssignClass open={assign} faculty={f} onClose={() => setAssign(false)} onDone={() => { setAssign(false); reload(); }} />}
    </Modal>
  );
}

function AssignClass({ open, faculty, onClose, onDone }) {
  const call = useApi();
  const toast = useToast();
  const [sem, setSem] = useState(4);
  const [subjectId, setSubjectId] = useState('');
  const [section, setSection] = useState('CSE-1');
  const [busy, setBusy] = useState(false);
  const subs = useLoader((api) => (open ? api(`/academics/subjects?semester=${sem}`) : Promise.resolve([])), [open, sem]);
  const subjects = asList(subs.data);

  const submit = async () => {
    const sub = subjects.find((s) => String(s.id) === String(subjectId)) || subjects[0];
    if (!sub) return;
    setBusy(true);
    try {
      await call('/faculty/assign-class', { method: 'POST', body: { facultyId: faculty.id, subjectId: sub.id, courseId: sub.course_id, departmentId: faculty.department_id, semester: sem, section } });
      toast.success(`${sub.code} · ${section} assigned to ${faculty.full_name}`);
      onDone();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Assign class" subtitle={faculty.full_name} icon={Link2} size="sm"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" onClick={submit} disabled={busy || !subjects.length}>{busy ? 'Assigning…' : 'Assign'}</button></>}>
      <div className="stack gap-12">
        <div className="grid-2" style={{ gap: 10 }}>
          <Field label="Semester"><select className="select" value={sem} onChange={(e) => { setSem(Number(e.target.value)); setSubjectId(''); }}>{SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}</select></Field>
          <Field label="Section"><select className="select" value={section} onChange={(e) => setSection(e.target.value)}>{SECTIONS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        </div>
        <Field label="Subject">
          <select className="select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={subs.loading}>
            {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

const blank = { fullName: '', email: '', phone: '', employeeId: '', departmentId: 1, designation: 'Assistant Professor', qualification: '', weeklyWorkloadHours: 16, officeRoom: '' };

function AddFaculty({ open, onClose, onDone, depts }) {
  const call = useApi();
  const toast = useToast();
  const [f, setF] = useState(blank);
  const [busy, setBusy] = useState(false);
  const set = (k, n) => (e) => setF((x) => ({ ...x, [k]: n ? Number(e.target.value) : e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await call('/faculty', { method: 'POST', body: f });
      toast.success(`${f.fullName} onboarded — they can sign in with their employee ID`);
      setF(blank);
      onDone();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Onboard faculty" subtitle="Creates the staff profile and a portal login." icon={UserPlus} size="lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" type="submit" form="fac-form" disabled={busy}>{busy ? 'Saving…' : 'Onboard'}</button></>}>
      <form id="fac-form" className="form-grid" onSubmit={submit}>
        <Field label="Full name"><input className="input" required value={f.fullName} onChange={set('fullName')} placeholder="Dr. Anjali Mehra" /></Field>
        <Field label="Employee ID"><input className="input mono" required value={f.employeeId} onChange={set('employeeId')} placeholder="FAC-CSE-005" /></Field>
        <Field label="Email"><input className="input" type="email" required value={f.email} onChange={set('email')} placeholder="name@gtbit.ac.in" /></Field>
        <Field label="Phone"><input className="input" value={f.phone} onChange={set('phone')} /></Field>
        <Field label="Department">
          <select className="select" value={f.departmentId} onChange={set('departmentId', true)}>
            {(depts.length ? depts : [{ id: 1, name: 'Computer Science and Engineering' }]).sort((a, b) => a.id - b.id).map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </select>
        </Field>
        <Field label="Designation">
          <select className="select" value={f.designation} onChange={set('designation')}>
            {['Assistant Professor', 'Associate Professor', 'Professor', 'Professor & Head', 'Lab Instructor'].map((d) => <option key={d}>{d}</option>)}
          </select>
        </Field>
        <Field label="Qualification" className="full"><input className="input" value={f.qualification} onChange={set('qualification')} placeholder="M.Tech (CSE), Ph.D" /></Field>
        <Field label="Weekly workload (hours)"><input className="input" type="number" min="0" max="40" value={f.weeklyWorkloadHours} onChange={set('weeklyWorkloadHours', true)} /></Field>
        <Field label="Office room"><input className="input" value={f.officeRoom} onChange={set('officeRoom')} placeholder="Room 302-B" /></Field>
      </form>
    </Modal>
  );
}
