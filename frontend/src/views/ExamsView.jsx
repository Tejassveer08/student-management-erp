import React, { useEffect, useMemo, useState } from 'react';
import { Award, Printer, Plus, CalendarClock, ClipboardList, FileText, Send, CheckCircle2, Search, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi, asList } from '../lib/api';
import { useLoader, settle, useMySections } from '../lib/hooks';
import { fmtDate, gradeClass, titleCase, statusTone, daysUntil, num } from '../lib/format';
import { SECTIONS, SEMESTERS } from '../config/campus';
import BrandMark from '../components/layout/BrandMark';
import {
  PageHeader, Card, Badge, Tabs, Modal, Field, EmptyState, ErrorState, PageSkeleton, Segmented, SearchInput, Skeleton, Callout, useToast,
} from '../components/ui';

const MAX = { internal: 25, assignment: 15, external: 60 };
const gradeOf = (t) => (t >= 90 ? ['O', 10] : t >= 75 ? ['A+', 9] : t >= 65 ? ['A', 8] : t >= 55 ? ['B+', 7] : t >= 50 ? ['B', 6] : t >= 45 ? ['C', 5] : t >= 40 ? ['P', 4] : ['F', 0]);

export default function ExamsView() {
  const { user, hasPermission } = useAuth();
  const staff = user?.role === 'admin' || user?.role === 'faculty';
  const canEnter = hasPermission('exams', 'enter_marks');
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('marksheet');
  const [enter, setEnter] = useState(false);
  const [schedule, setSchedule] = useState(false);

  const exams = useLoader((api) => api('/exams'));

  return (
    <>
      <PageHeader
        eyebrow="Examinations"
        title={<>Exams & <em>results</em></>}
        description="Semester marksheets with SGPA and CGPA, the examination calendar, and the marks register for faculty."
        actions={<>
          {tab === 'marksheet' && <button className="btn btn-ghost" onClick={() => window.print()}><Printer size={15} /> Print marksheet</button>}
          {isAdmin && <button className="btn btn-ghost" onClick={() => setSchedule(true)}><CalendarClock size={15} /> Schedule exam</button>}
          {canEnter && <button className="btn btn-accent" onClick={() => setEnter(true)}><Plus size={15} /> Enter marks</button>}
        </>}
      />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'marksheet', label: 'Marksheet', icon: FileText },
        { id: 'schedule', label: 'Exam calendar', icon: CalendarClock, count: asList(exams.data).length || undefined },
        staff && { id: 'register', label: 'Marks register', icon: ClipboardList },
      ]} />
      {tab === 'marksheet' && <Marksheet staff={staff} />}
      {tab === 'schedule' && <Schedule q={exams} isAdmin={isAdmin} />}
      {tab === 'register' && staff && <Register />}
      {canEnter && <EnterMarks open={enter} onClose={() => setEnter(false)} exams={asList(exams.data)} />}
      {isAdmin && <ScheduleExam open={schedule} onClose={() => setSchedule(false)} onDone={() => { setSchedule(false); exams.reload(); }} />}
    </>
  );
}

/* ---------------------------------------------------------------------- */
function Marksheet({ staff }) {
  const { user, studentProfile } = useAuth();
  const [section, setSection] = useState('CSE-2');
  const [sid, setSid] = useState(studentProfile?.id || null);
  const [sem, setSem] = useState(null);
  const [examId, setExamId] = useState(null);
  const { sections } = useMySections(SECTIONS);
  useEffect(() => {
    if (staff && sections.length && !sections.includes(section)) setSection(sections[0]);
  }, [staff, sections, section]);

  const roster = useLoader((api) => (staff ? api(`/students?section=${encodeURIComponent(section)}`) : user?.role === 'parent' ? api('/students') : Promise.resolve([])), [staff, section]);
  const students = asList(roster.data);
  useEffect(() => {
    if (!sid && students.length) setSid(students[0].id);
  }, [students, sid]);

  const card = useLoader((api) => {
    if (!sid) return Promise.resolve(null);
    const q = new URLSearchParams();
    if (sem) q.set('semester', sem);
    if (examId) q.set('examId', examId);
    return api(`/exams/report-card/${sid}${q.toString() ? `?${q}` : ''}`);
  }, [sid, sem, examId]);
  const rc = card.data;
  const avail = rc?.available_semesters || [];

  return (
    <div className="stack gap-16">
      <div className="row-between wrap no-print" style={{ gap: 10 }}>
        <div className="row gap-8 wrap">
          {staff && <select className="select" style={{ width: 120 }} value={section} onChange={(e) => { setSection(e.target.value); setSid(null); }} aria-label="Section">{sections.map((s) => <option key={s}>{s}</option>)}</select>}
          {(staff || students.length > 1) && (
            <select className="select" style={{ width: 280 }} value={sid || ''} onChange={(e) => setSid(Number(e.target.value))} aria-label="Student">
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.roll_no}</option>)}
            </select>
          )}
        </div>
        <div className="row gap-8 wrap">
          {(rc?.exams || []).length > 1 && (
            <select className="select select-sm" style={{ width: 'auto' }} value={rc.selected_exam?.id || ''} onChange={(e) => setExamId(Number(e.target.value))} aria-label="Examination">
              {rc.exams.map((e) => <option key={e.id} value={e.id}>{e.name}{e.status !== 'Results_Declared' ? ' (provisional)' : ''}</option>)}
            </select>
          )}
          {avail.length > 0 && <Segmented value={rc?.selected_semester} onChange={(v) => { setSem(v); setExamId(null); }} options={avail.map((s) => ({ value: s, label: `Sem ${s}` }))} />}
        </div>
      </div>

      {card.loading || (!sid && roster.loading) ? <Skeleton h={520} r={14} /> : card.error ? <ErrorState error={card.error} onRetry={card.hardReload} /> : !rc ? (
        <div className="card"><EmptyState icon={Users} title="Select a student" /></div>
      ) : (
        <article className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <header style={{ padding: '26px 28px', borderBottom: '1px solid var(--line)', background: 'var(--surface-2)' }}>
            <div className="row-between wrap" style={{ gap: 16 }}>
              <div className="row gap-14" style={{ gap: 14 }}>
                <div className="brand-mark" style={{ width: 52, height: 52, background: "var(--brand-grad)", borderRadius: 14 }}><BrandMark size={28} /></div>
                <div>
                  <div className="serif" style={{ fontSize: 24, lineHeight: 1.1 }}>{rc.institution?.name}</div>
                  <div className="xs muted">{rc.institution?.affiliate} · {rc.institution?.accreditation}</div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="eyebrow">Statement of grades</div>
                <div className="serif" style={{ fontSize: 22 }}>Semester {rc.selected_semester}</div>
                {rc.selected_exam && <div className="xs muted">{rc.selected_exam.name} · {rc.selected_exam.academic_year}</div>}
              </div>
            </div>
          </header>
          <div style={{ padding: '20px 28px' }} className="grid-4">
            {[['Student', rc.student?.name], ['Roll number', <span className="mono">{rc.student?.roll_no}</span>], ['Enrollment', <span className="mono">{rc.student?.enrollment_no}</span>], ['Section', `${rc.student?.section} · current sem ${rc.student?.semester}`]].map(([k, v]) => (
              <div key={k}><div className="xs muted">{k}</div><div className="strong">{v}</div></div>
            ))}
          </div>
          <div className="table-wrap" style={{ borderTop: '1px solid var(--line)' }}>
            <table className="tbl">
              <thead>
                <tr><th>Code</th><th>Subject</th><th className="right">Credits</th><th className="right">Internal /25</th><th className="right">Assign. /15</th><th className="right">External /60</th><th className="right">Total</th><th className="center">Grade</th><th className="right">GP</th></tr>
              </thead>
              <tbody>
                {(rc.subjects || []).length === 0 ? (
                  <tr><td colSpan={9}><EmptyState compact title="No results declared for this semester" /></td></tr>
                ) : rc.subjects.map((m) => (
                  <tr key={m.id}>
                    <td className="mono small">{m.subject_code}</td>
                    <td><div className="strong">{m.subject_name}</div>{m.remarks && <div className="xs muted">{m.remarks}</div>}</td>
                    <td className="right mono">{m.credits}</td>
                    <td className="right mono">{m.internal_assessment}</td>
                    <td className="right mono">{m.assignment_score}</td>
                    <td className="right mono">{m.external_exam}</td>
                    <td className="right mono strong">{m.total_score}</td>
                    <td className="center"><span className={`grade grade-${gradeClass(m.letter_grade)}`}>{m.letter_grade}</span></td>
                    <td className="right mono">{m.grade_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <footer className="grid-4" style={{ padding: '20px 28px', borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
            <div><div className="xs muted">Semester credits</div><div className="serif num" style={{ fontSize: 30 }}>{rc.academic_metrics?.semester_credits}</div></div>
            <div><div className="xs muted">SGPA</div><div className="serif num" style={{ fontSize: 30 }}>{rc.academic_metrics?.semester_sgpa ?? '—'}</div></div>
            <div><div className="xs muted">Cumulative CGPA</div><div className="serif num accent" style={{ fontSize: 30 }}>{rc.academic_metrics?.cumulative_cgpa}</div></div>
            <div><div className="xs muted">Result</div><div style={{ marginTop: 8 }}><Badge tone={/REAPPEAR/.test(rc.academic_metrics?.status) ? 'danger' : /PROVISIONAL|NO RESULT/.test(rc.academic_metrics?.status) ? 'warning' : 'success'} dot>{rc.academic_metrics?.status}</Badge></div></div>
          </footer>
          <div className="xs faint" style={{ padding: '10px 28px 18px' }}>Computer-generated statement from the GTBIT ERP. Grades follow the institution’s current GGSIPU grading policy.</div>
        </article>
      )}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
function Schedule({ q, isAdmin }) {
  const call = useApi();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  if (q.loading) return <PageSkeleton stats={0} rows={1} />;
  if (q.error) return <ErrorState error={q.error} onRetry={q.hardReload} />;
  const list = [...asList(q.data)].sort((a, b) => String(b.start_date).localeCompare(String(a.start_date)));
  if (!list.length) return <div className="card"><EmptyState icon={CalendarClock} title="No examinations scheduled" /></div>;

  const publish = async (e) => {
    setBusy(e.id);
    try {
      const r = await call(`/exams/${e.id}/publish`, { method: 'POST' });
      toast.success(r?.message || 'Results published');
      q.reload();
    } catch (err) { toast.error(err.message); } finally { setBusy(null); }
  };

  return (
    <div className="grid-auto" style={{ '--min': '320px' }}>
      {list.map((e) => {
        const d = daysUntil(e.start_date);
        const declared = e.status === 'Results_Declared';
        return (
          <Card key={e.id}>
            <div className="row-between">
              <Badge tone={e.exam_type === 'Major' ? 'violet' : 'info'}>{e.exam_type}</Badge>
              <Badge tone={declared ? 'success' : statusTone(e.status)} dot>{titleCase(e.status)}</Badge>
            </div>
            <div className="serif" style={{ fontSize: 22, lineHeight: 1.2, marginTop: 12 }}>{e.name}</div>
            <div className="small muted" style={{ marginTop: 4 }}>Semester {e.semester} · {e.academic_year}</div>
            <div className="tile-sm row-between" style={{ marginTop: 14 }}>
              <div><div className="xs muted">From</div><div className="small strong">{fmtDate(e.start_date)}</div></div>
              <div style={{ textAlign: 'right' }}><div className="xs muted">To</div><div className="small strong">{fmtDate(e.end_date)}</div></div>
            </div>
            <div className="row-between" style={{ marginTop: 12 }}>
              <span className="xs muted">{d > 0 ? `Starts in ${d} days` : declared ? 'Results available' : d > -30 ? 'In progress or awaiting results' : 'Concluded'}</span>
              {isAdmin && !declared && <button className="btn btn-outline btn-sm" onClick={() => publish(e)} disabled={busy === e.id}><Send size={13} /> {busy === e.id ? 'Publishing…' : 'Publish results'}</button>}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

/* ---------------------------------------------------------------------- */
const RPP = 30;
function Register() {
  const [sem, setSem] = useState(4);
  const [q, setQ] = useState('');
  const [subject, setSubject] = useState('');
  const [exam, setExam] = useState('');
  const [page, setPage] = useState(0);
  const { data, loading, error, hardReload } = useLoader((api) => api(`/exams/marks?semester=${sem}`), [sem]);
  const rows = asList(data);
  const subjects = useMemo(() => [...new Map(rows.map((r) => [r.subject_code, r.subject_name])).entries()].sort(), [rows]);
  const examsList = useMemo(() => [...new Set(rows.map((r) => r.exam_name))], [rows]);
  const filtered = rows.filter((r) => (!subject || r.subject_code === subject) && (!exam || r.exam_name === exam) &&
    (!q || `${r.student_name} ${r.roll_no}`.toLowerCase().includes(q.toLowerCase())));
  const pages = Math.max(1, Math.ceil(filtered.length / RPP));
  const cur = Math.min(page, pages - 1);
  const avg = filtered.length ? filtered.reduce((a, r) => a + r.total_score, 0) / filtered.length : 0;
  const fails = filtered.filter((r) => r.letter_grade === 'F').length;

  return (
    <Card flush>
      <div className="row wrap" style={{ padding: 14, gap: 10, borderBottom: '1px solid var(--line)' }}>
        <select className="select" style={{ width: 130 }} value={sem} onChange={(e) => { setSem(Number(e.target.value)); setSubject(''); setExam(''); setPage(0); }}>{SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}</select>
        <select className="select" style={{ width: 240 }} value={subject} onChange={(e) => { setSubject(e.target.value); setPage(0); }}><option value="">All subjects</option>{subjects.map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}</select>
        <select className="select" style={{ width: 260 }} value={exam} onChange={(e) => { setExam(e.target.value); setPage(0); }}><option value="">All examinations</option>{examsList.map((x) => <option key={x}>{x}</option>)}</select>
        <SearchInput value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder="Student or roll no" style={{ flex: '1 1 200px' }} />
      </div>
      {loading ? <div className="stack gap-8" style={{ padding: 16 }}>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={40} />)}</div>
        : error ? <div style={{ padding: 16 }}><ErrorState error={error} onRetry={hardReload} /></div>
          : filtered.length === 0 ? <EmptyState icon={Search} title="No marks match" /> : (
            <>
              <div className="row gap-16 wrap small" style={{ padding: '10px 16px', borderBottom: '1px solid var(--line)' }}>
                <span><span className="muted">Entries</span> <b className="mono">{num(filtered.length)}</b></span>
                <span><span className="muted">Average total</span> <b className="mono">{avg.toFixed(1)}</b></span>
                <span><span className="muted">Fails</span> <b className={`mono ${fails ? 't-danger' : ''}`}>{fails}</b></span>
              </div>
              <div className="table-wrap">
                <table className="tbl compact">
                  <thead><tr><th>Student</th><th>Subject</th><th>Examination</th><th className="right">Int.</th><th className="right">Asg.</th><th className="right">Ext.</th><th className="right">Total</th><th className="center">Grade</th></tr></thead>
                  <tbody>
                    {filtered.slice(cur * RPP, cur * RPP + RPP).map((r) => (
                      <tr key={r.id}>
                        <td><div className="strong small">{r.student_name}</div><div className="xs muted mono">{r.roll_no}</div></td>
                        <td className="small"><span className="mono">{r.subject_code}</span></td>
                        <td className="xs muted">{r.exam_name}</td>
                        <td className="right mono">{r.internal_assessment}</td><td className="right mono">{r.assignment_score}</td><td className="right mono">{r.external_exam}</td>
                        <td className="right mono strong">{r.total_score}</td>
                        <td className="center"><span className={`grade grade-${gradeClass(r.letter_grade)}`}>{r.letter_grade}</span></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="row-between" style={{ padding: '10px 16px', borderTop: '1px solid var(--line)' }}>
                <span className="small muted">Page {cur + 1} of {pages}</span>
                <div className="row gap-6">
                  <button className="btn btn-ghost btn-sm btn-icon" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Previous"><ChevronLeft size={15} /></button>
                  <button className="btn btn-ghost btn-sm btn-icon" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Next"><ChevronRight size={15} /></button>
                </div>
              </div>
            </>
          )}
    </Card>
  );
}

/* ---------------------------------------------------------------------- */
function EnterMarks({ open, onClose, exams }) {
  const { user } = useAuth();
  const call = useApi();
  const toast = useToast();
  const isFaculty = user?.role === 'faculty';
  const [classKey, setClassKey] = useState('');
  const [sem, setSem] = useState(4);
  const [section, setSection] = useState('CSE-2');
  const [subjectId, setSubjectId] = useState('');
  const [f, setF] = useState({ examId: '', studentId: '', internalAssessment: '', assignmentScore: '', externalExam: '', remarks: '' });
  const [busy, setBusy] = useState(false);

  const opts = useLoader(async (api) => {
    if (!open) return null;
    if (isFaculty) return { classes: (await api('/dashboard/summary'))?.assigned_classes || [] };
    return { subjects: asList(await settle(api(`/academics/subjects?semester=${sem}`), [])) };
  }, [open, isFaculty, sem]);
  const classes = opts.data?.classes || [];
  const subjects = opts.data?.subjects || [];

  useEffect(() => { if (isFaculty && classes.length && !classKey) setClassKey(`${classes[0].subject_id}|${classes[0].section}|${classes[0].semester}`); }, [isFaculty, classes, classKey]);
  const [cSub, cSec, cSem] = classKey.split('|');
  const effSection = isFaculty ? cSec : section;
  const effSem = isFaculty ? Number(cSem) : sem;
  const effSubject = isFaculty ? Number(cSub) : Number(subjectId || subjects[0]?.id);

  const roster = useLoader((api) => (open && effSection ? api(`/students?section=${encodeURIComponent(effSection)}&semester=${effSem || ''}`) : Promise.resolve([])), [open, effSection, effSem]);
  const students = asList(roster.data);
  const semExams = exams.filter((e) => Number(e.semester) === Number(effSem));

  const n = (v) => Number(v || 0);
  const total = n(f.internalAssessment) + n(f.assignmentScore) + n(f.externalExam);
  const [g, gp] = gradeOf(total);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const over = n(f.internalAssessment) > MAX.internal || n(f.assignmentScore) > MAX.assignment || n(f.externalExam) > MAX.external;

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await call('/exams/marks', {
        method: 'POST',
        body: {
          examId: Number(f.examId || semExams[0]?.id), subjectId: effSubject, studentId: Number(f.studentId || students[0]?.id),
          internalAssessment: n(f.internalAssessment), assignmentScore: n(f.assignmentScore), externalExam: n(f.externalExam), remarks: f.remarks,
        },
      });
      toast.success(`Saved — total ${r?.total_score}/100, grade ${r?.letter_grade}`);
      setF((x) => ({ ...x, internalAssessment: '', assignmentScore: '', externalExam: '', remarks: '' }));
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Enter marks" subtitle="Records or updates a student’s marks for one subject and examination." icon={Award} size="lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Close</button><button className="btn btn-accent" type="submit" form="marks-form" disabled={busy || over || !students.length || !semExams.length}>{busy ? 'Saving…' : 'Save marks'}</button></>}>
      {opts.loading ? <Skeleton h={300} /> : (
        <form id="marks-form" onSubmit={submit} className="form-grid">
          {isFaculty ? (
            <Field label="Class" className="full">
              <select className="select" value={classKey} onChange={(e) => setClassKey(e.target.value)}>
                {classes.map((c) => <option key={`${c.subject_id}|${c.section}|${c.semester}`} value={`${c.subject_id}|${c.section}|${c.semester}`}>{c.subject_code} · {c.subject_name} · {c.section}</option>)}
              </select>
            </Field>
          ) : (
            <>
              <Field label="Semester"><select className="select" value={sem} onChange={(e) => { setSem(Number(e.target.value)); setSubjectId(''); }}>{SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}</select></Field>
              <Field label="Section"><select className="select" value={section} onChange={(e) => setSection(e.target.value)}>{SECTIONS.map((s) => <option key={s}>{s}</option>)}</select></Field>
              <Field label="Subject" className="full"><select className="select" value={subjectId} onChange={(e) => setSubjectId(e.target.value)}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></Field>
            </>
          )}
          <Field label="Examination">
            <select className="select" value={f.examId} onChange={set('examId')}>
              {semExams.length === 0 && <option value="">No exams for semester {effSem}</option>}
              {semExams.map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
            </select>
          </Field>
          <Field label="Student">
            <select className="select" value={f.studentId} onChange={set('studentId')} disabled={roster.loading}>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.roll_no}</option>)}
            </select>
          </Field>
          <div className="full grid-3" style={{ gap: 12 }}>
            <Field label={`Internal / ${MAX.internal}`}><input className="input mono" type="number" min="0" max={MAX.internal} value={f.internalAssessment} onChange={set('internalAssessment')} required /></Field>
            <Field label={`Assignment / ${MAX.assignment}`}><input className="input mono" type="number" min="0" max={MAX.assignment} value={f.assignmentScore} onChange={set('assignmentScore')} required /></Field>
            <Field label={`External / ${MAX.external}`}><input className="input mono" type="number" min="0" max={MAX.external} value={f.externalExam} onChange={set('externalExam')} required /></Field>
          </div>
          <div className="full tile row-between">
            <div><div className="xs muted">Total</div><div className="serif num" style={{ fontSize: 34, lineHeight: 1 }}>{total}<span className="muted" style={{ fontSize: 16 }}> / 100</span></div></div>
            <div className="row gap-12"><span className={`grade grade-${gradeClass(g)}`} style={{ fontSize: 16, height: 34, minWidth: 44 }}>{g}</span><span className="small muted">{gp} grade points</span></div>
          </div>
          {over && <div className="full"><Callout tone="danger">A component exceeds its maximum marks.</Callout></div>}
          <Field label="Remarks" className="full"><input className="input" value={f.remarks} onChange={set('remarks')} placeholder="Optional feedback for the student" /></Field>
        </form>
      )}
    </Modal>
  );
}

function ScheduleExam({ open, onClose, onDone }) {
  const call = useApi();
  const toast = useToast();
  const [f, setF] = useState({ name: '', semester: 4, academicYear: '2025-2026', examType: 'Minor', startDate: '', endDate: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await call('/exams', { method: 'POST', body: { ...f, semester: Number(f.semester) } });
      toast.success('Examination scheduled');
      onDone();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Schedule examination" icon={CalendarClock}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" type="submit" form="exam-form" disabled={busy}><CheckCircle2 size={14} /> {busy ? 'Saving…' : 'Schedule'}</button></>}>
      <form id="exam-form" onSubmit={submit} className="form-grid">
        <Field label="Name" className="full"><input className="input" required value={f.name} onChange={set('name')} placeholder="Mid-Term Minor-2 Examination (Semester 4)" /></Field>
        <Field label="Type"><select className="select" value={f.examType} onChange={set('examType')}><option>Minor</option><option>Major</option><option>Practical</option></select></Field>
        <Field label="Semester"><select className="select" value={f.semester} onChange={set('semester')}>{SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}</select></Field>
        <Field label="Start date"><input className="input" type="date" required value={f.startDate} onChange={set('startDate')} /></Field>
        <Field label="End date"><input className="input" type="date" required value={f.endDate} onChange={set('endDate')} /></Field>
        <Field label="Academic year" className="full"><input className="input" value={f.academicYear} onChange={set('academicYear')} /></Field>
      </form>
    </Modal>
  );
}
