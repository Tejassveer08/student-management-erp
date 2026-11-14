import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  QrCode, Download, ShieldAlert, Play, RefreshCw, Copy, Users, AlertTriangle, Clock, BookOpen,
  ScanLine, UserCheck, UserX, Timer, Activity, Search, CheckCheck, Flag, Percent, Square,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi, asList } from '../lib/api';
import { useLoader, settle, useMySections } from '../lib/hooks';
import { pct, attTone, num } from '../lib/format';
import { SECTIONS, SEMESTERS } from '../config/campus';
import { AttendanceTrend, QR } from '../components/charts';
import {
  PageHeader, Card, Stat, Badge, Progress, Ring, Tabs, Segmented, Modal, Field, EmptyState, ErrorState, PageSkeleton,
  Callout, SearchInput, Avatar, Skeleton, useToast, cx,
} from '../components/ui';

const downloadCSV = (rows, filename) => {
  const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
  const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const a = Object.assign(document.createElement('a'), { href: url, download: filename });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
};

const subjectCSV = (summary) => [
  ['Subject code', 'Subject', 'Faculty', 'Held', 'Present', 'Society duty', 'Late', 'Absent', 'Attendance %', 'Classes needed for 75%', 'Safe leaves'],
  ...(summary?.subjects || []).map((s) => [
    s.subject_code, s.subject_name, s.faculty_name, s.total_classes, s.regular_present_count ?? s.present_count,
    s.society_present_count ?? 0, s.late_count, s.absent_count, s.attendance_percentage, s.classes_needed_for_75, s.safe_leaves_allowed,
  ]),
];

export default function AttendanceView() {
  const { user } = useAuth();
  const staff = user?.role === 'admin' || user?.role === 'faculty';
  return staff ? <StaffAttendance /> : <PersonalAttendance />;
}

/* ====================================================================== */
/* Student / parent                                                        */
/* ====================================================================== */
function PersonalAttendance() {
  const { user } = useAuth();
  const [deepCode] = useState(checkinCode);
  const [checkin, setCheckin] = useState(Boolean(deepCode) && user?.role === 'student');
  const closeCheckin = () => {
    setCheckin(false);
    if (checkinCode()) window.history.replaceState(null, '', '#/attendance');
  };
  const { data, loading, error, hardReload, reload } = useLoader((api) => Promise.all([
    api('/attendance/summary'),
    settle(api('/attendance/trends'), []),
  ]));

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;
  const [summary, trends] = data;
  const isStudent = user?.role === 'student';

  return (
    <>
      <PageHeader
        eyebrow="Flagship module · Smart attendance"
        title={<>Attendance <em>ledger</em></>}
        description={isStudent
          ? `Your live attendance across every subject, measured against the ${summary?.threshold ?? 75}% GGSIPU examination rule.`
          : `Live attendance for ${summary?.student_name || 'your ward'}, measured against the ${summary?.threshold ?? 75}% GGSIPU examination rule.`}
        actions={<>
          <button className="btn btn-ghost" onClick={() => downloadCSV(subjectCSV(summary), `attendance-${summary?.student_name || 'report'}.csv`)}><Download size={15} /> Export CSV</button>
          {isStudent && <button className="btn btn-accent" onClick={() => setCheckin(true)}><ScanLine size={15} /> QR check-in</button>}
        </>}
      />
      <StudentReport summary={summary} trends={trends} />
      {isStudent && <CheckinModal open={checkin} onClose={closeCheckin} onDone={reload} initialCode={deepCode} />}
    </>
  );
}

/** Full attendance report for one student (shared by personal view and staff lookup) */
function StudentReport({ summary, trends }) {
  if (!summary) return <EmptyState title="No attendance summary available" />;
  const subjects = summary.subjects || [];
  const below = subjects.filter((s) => s.is_below_threshold);
  const needed = subjects.reduce((a, s) => a + (s.classes_needed_for_75 || 0), 0);
  const safe = subjects.reduce((a, s) => a + (s.safe_leaves_allowed || 0), 0);
  const risk = summary.is_at_risk;
  const o = summary.overall_percentage || 0;

  return (
    <div className="stack gap-16">
      {risk && (
        <Callout tone="danger" title="Detention risk — overall attendance is below 75%">
          Automatic alerts have been sent to the student and registered guardian. Attend the classes listed below to regain exam eligibility.
        </Callout>
      )}
      <div className="grid-4">
        <div className={cx('card stat span-2 rise d1', risk && 'tint-danger')} style={{ flexDirection: 'row', alignItems: 'center', gap: 22 }}>
          <Ring value={summary.total_conducted ? o : 0} size={128} stroke={11} color={risk ? 'var(--danger)' : o < 80 ? 'var(--warning)' : 'var(--success)'}>
            <div>
              <div className="serif num" style={{ fontSize: 34, lineHeight: 1 }}>{summary.total_conducted ? <>{o.toFixed(1)}<span style={{ fontSize: 16 }}>%</span></> : '—'}</div>
              <div className="xs muted">overall</div>
            </div>
          </Ring>
          <div className="grow">
            {summary.total_conducted
              ? <Badge tone={risk ? 'danger' : 'success'} dot>{risk ? `Below ${summary.threshold ?? 75}% — detention risk` : 'Exam eligible'}</Badge>
              : <Badge dot>No classes recorded yet</Badge>}
            <div className="serif" style={{ fontSize: 24, marginTop: 10, lineHeight: 1.15 }}>
              {summary.total_conducted
                ? <>{num(summary.total_attended, 1)} <span className="muted">of</span> {summary.total_conducted} sessions attended</>
                : 'Attendance appears here after the first roll call'}
            </div>
            <div className="small muted" style={{ marginTop: 6 }}>
              Includes {summary.total_society_credited || 0} society-duty credit{summary.total_society_credited === 1 ? '' : 's'} · late arrivals count as half
            </div>
          </div>
        </div>
        <Stat className="rise d2" label="Subjects below 75%" value={below.length} unit={`/ ${subjects.length}`} icon={AlertTriangle} tone={below.length ? 'danger' : 'success'}
          hint={below.length ? `${needed} consecutive classes needed to recover` : 'Every subject is compliant'} />
        <Stat className="rise d3" label="Safe leaves remaining" value={safe} icon={Timer} tone="info" hint="Across all subjects without dropping below 75%" />
      </div>

      <Card title="Attendance trajectory" subtitle="Cumulative percentage across the last 31 sessions" icon={Activity}>
        <AttendanceTrend data={trends} personal height={240} />
      </Card>

      <Card flush title="Subject-wise breakdown" subtitle="Recovery guidance is calculated per subject" icon={BookOpen}>
        {subjects.length === 0 ? <EmptyState compact title="No subjects tracked" /> : (
          <div className="table-wrap">
            <table className="tbl">
              <thead>
                <tr><th>Subject</th><th>Faculty</th><th className="right">Held</th><th className="right">Present</th><th className="right">Duty</th><th className="right">Late</th><th className="right">Absent</th><th style={{ width: 170 }}>Attendance</th><th>Guidance</th></tr>
              </thead>
              <tbody>
                {[...subjects].sort((a, b) => a.attendance_percentage - b.attendance_percentage).map((s) => (
                  <tr key={s.subject_id}>
                    <td><div className="strong">{s.subject_name}</div><div className="xs muted mono">{s.subject_code} · {s.credits} cr</div></td>
                    <td className="small ink-2">{s.faculty_name || '—'}</td>
                    <td className="right mono">{s.total_classes}</td>
                    <td className="right mono">{s.regular_present_count ?? s.present_count}</td>
                    <td className="right">{s.society_present_count ? <Badge tone="info"><Flag size={10} />+{s.society_present_count}</Badge> : <span className="faint mono">0</span>}</td>
                    <td className="right mono">{s.late_count}</td>
                    <td className="right mono">{s.absent_count}</td>
                    <td>
                      <div className="row gap-8">
                        <Progress value={s.attendance_percentage} tone={s.total_classes ? attTone(s.attendance_percentage) : undefined} className="grow" />
                        <span className="mono xs strong" style={{ width: 40, textAlign: 'right' }}>{s.total_classes ? pct(s.attendance_percentage, 0) : '—'}</span>
                      </div>
                    </td>
                    <td className="small">
                      {!s.total_classes ? <span className="faint">No classes yet</span>
                        : s.is_below_threshold ? <span className="t-danger">Attend next <b>{s.classes_needed_for_75}</b></span>
                          : <span className="muted">Can miss <b className="ink-2">{s.safe_leaves_allowed}</b></span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}

const checkinCode = () => {
  const m = window.location.hash.match(/[?&]checkin=([^&]+)/);
  return m ? decodeURIComponent(m[1]) : '';
};
const parseCode = (raw) => {
  const v = String(raw || '').trim();
  const m = v.match(/checkin=([^&\s]+)/);
  return (m ? decodeURIComponent(m[1]) : v).toUpperCase();
};

function CheckinModal({ open, onClose, onDone, initialCode }) {
  const call = useApi();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const videoRef = useRef(null);
  const canScan = typeof window !== 'undefined' && 'BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia;

  const submit = useCallback(async (value) => {
    const c = parseCode(value);
    if (!c) return;
    setBusy(true);
    setResult(null);
    try {
      const r = await call('/attendance/qr-checkin', { method: 'POST', body: { code: c } });
      setResult({ ok: true, msg: r?.message || 'Checked in' });
      toast.success(r?.message || 'You’re marked present');
      onDone?.();
    } catch (err) {
      setResult({ ok: false, msg: err.message });
    } finally {
      setBusy(false);
    }
  }, [call, toast, onDone]);

  useEffect(() => {
    if (!open) return;
    setResult(null);
    setScanning(false);
    setCode(initialCode || '');
    if (initialCode) submit(initialCode);
  }, [open, initialCode]); // eslint-disable-line react-hooks/exhaustive-deps

  // Camera scanning with the browser's BarcodeDetector
  useEffect(() => {
    if (!scanning) return;
    let stream;
    let timer;
    let stopped = false;
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
        if (stopped) return;
        const video = videoRef.current;
        video.srcObject = stream;
        await video.play();
        const detector = new window.BarcodeDetector({ formats: ['qr_code'] });
        const loop = async () => {
          if (stopped) return;
          try {
            const found = await detector.detect(video);
            if (found[0]?.rawValue) {
              setScanning(false);
              setCode(parseCode(found[0].rawValue));
              submit(found[0].rawValue);
              return;
            }
          } catch { /* frame not ready */ }
          timer = setTimeout(loop, 250);
        };
        loop();
      } catch (err) {
        setScanning(false);
        setResult({ ok: false, msg: `Camera unavailable: ${err.message}. Type the code instead.` });
      }
    })();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning, submit]);

  return (
    <Modal open={open} onClose={onClose} title="QR check-in" subtitle="Scan the code on the projector, or type the short code under it. Codes change every 30 seconds." icon={ScanLine} size="sm"
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Close</button>
        <button className="btn btn-accent" onClick={() => submit(code)} disabled={busy || !code.trim()}>{busy ? 'Checking in…' : 'Check in'}</button>
      </>}>
      <form onSubmit={(e) => { e.preventDefault(); submit(code); }} className="stack gap-12">
        <div className="tile" style={{ display: 'grid', placeItems: 'center', padding: 18 }}>
          {scanning ? (
            <video ref={videoRef} muted playsInline style={{ width: '100%', maxWidth: 300, borderRadius: 14, background: '#000' }} />
          ) : (
            <div className="stack gap-8" style={{ alignItems: 'center' }}>
              <QrCode size={46} className="faint" />
              {canScan
                ? <button type="button" className="btn btn-outline btn-sm" onClick={() => setScanning(true)}><ScanLine size={14} /> Scan with camera</button>
                : <span className="xs muted" style={{ textAlign: 'center' }}>Scan the QR with your phone camera — it opens this page and checks you in.</span>}
            </div>
          )}
        </div>
        <Field label="Code on screen" hint="Looks like 182-7F3K2A">
          <input className="input mono" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="182-7F3K2A" autoFocus={!initialCode} />
        </Field>
        {result && <Callout tone={result.ok ? 'success' : 'danger'}>{result.msg}</Callout>}
      </form>
    </Modal>
  );
}

/* ====================================================================== */
/* Faculty / admin                                                         */
/* ====================================================================== */
function StaffAttendance() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [tab, setTab] = useState('roll');
  const [override, setOverride] = useState(false);
  const [exportSection, setExportSection] = useState('CSE-2');
  const { sections: exportSections } = useMySections(SECTIONS);
  useEffect(() => {
    if (exportSections.length && !exportSections.includes(exportSection)) setExportSection(exportSections[0]);
  }, [exportSections, exportSection]);
  const [exportSem, setExportSem] = useState(4);
  const [exporting, setExporting] = useState(false);
  const call = useApi();
  const toast = useToast();

  const doExport = async () => {
    setExporting(true);
    try {
      const d = await call(`/attendance/export?section=${encodeURIComponent(exportSection)}&semester=${exportSem}`);
      const rows = asList(d, 'records');
      if (!rows.length) { toast.info('No records for that section and semester.'); return; }
      downloadCSV([
        ['Roll no', 'Enrollment no', 'Student', 'Subject code', 'Subject', 'Sessions', 'Present', 'Regular present', 'Society present', 'Late', 'Absent'],
        ...rows.map((r) => [r.roll_no, r.enrollment_no, r.student_name, r.subject_code, r.subject_name, r.total_sessions, r.present_count, r.regular_present_count, r.society_present_count, r.late_count, r.absent_count]),
      ], `attendance-${exportSection}-sem${exportSem}.csv`);
      toast.success(`Exported ${rows.length} rows for ${exportSection}`);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setExporting(false);
    }
  };

  return (
    <>
      <PageHeader
        eyebrow="Flagship module · Smart attendance"
        title={<>Smart <em>attendance</em></>}
        description="Run a timed QR session, take one-tap roll call, inspect any student against the 75% rule and export section registers."
        actions={isAdmin && <button className="btn btn-ghost" onClick={() => setOverride(true)}><ShieldAlert size={15} /> Audit override</button>}
      />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'roll', label: 'Session & roll call', icon: QrCode },
        { id: 'lookup', label: 'Student lookup', icon: Search },
        { id: 'campus', label: 'Trends & export', icon: Activity },
      ]} />
      {tab === 'roll' && <RollCall />}
      {tab === 'lookup' && <StudentLookup />}
      {tab === 'campus' && (
        <div className="grid-main">
          <Card title="Campus attendance trend" subtitle="Share of students present per session day" icon={Activity}>
            <TrendLoader />
          </Card>
          <Card title="Export section register" subtitle="Subject-wise attendance for every student in a section" icon={Download}>
            <div className="stack gap-12">
              <div className="grid-2" style={{ gap: 10 }}>
                <Field label="Section"><select className="select" value={exportSection} onChange={(e) => setExportSection(e.target.value)}>{exportSections.map((s) => <option key={s}>{s}</option>)}</select></Field>
                <Field label="Semester"><select className="select" value={exportSem} onChange={(e) => setExportSem(Number(e.target.value))}>{SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}</select></Field>
              </div>
              <button className="btn btn-primary" onClick={doExport} disabled={exporting}><Download size={15} /> {exporting ? 'Preparing…' : 'Download CSV'}</button>
            </div>
          </Card>
        </div>
      )}
      {isAdmin && <OverrideModal open={override} onClose={() => setOverride(false)} />}
    </>
  );
}

function TrendLoader() {
  const { data, loading } = useLoader((api) => settle(api('/attendance/trends'), []));
  return loading ? <Skeleton h={260} /> : <AttendanceTrend data={data} height={260} />;
}

/* ----- Session + roll call ------------------------------------------- */
function RollCall() {
  const { user } = useAuth();
  const call = useApi();
  const toast = useToast();
  const isFaculty = user?.role === 'faculty';

  // class options: faculty → their mapped classes; admin → any subject × section
  const opts = useLoader(async (api) => {
    if (isFaculty) {
      const d = await api('/dashboard/summary');
      return { classes: d?.assigned_classes || [] };
    }
    return { subjects: asList(await api('/academics/subjects')) };
  }, [isFaculty]);

  const [classKey, setClassKey] = useState('');
  const [adminSem, setAdminSem] = useState(4);
  const [adminSubject, setAdminSubject] = useState('');
  const [adminSection, setAdminSection] = useState('CSE-2');
  const [topic, setTopic] = useState('');
  const [session, setSession] = useState(null);
  const [remaining, setRemaining] = useState(0);
  const [starting, setStarting] = useState(false);
  const [live, setLive] = useState(null);

  const classes = opts.data?.classes || [];
  const subjects = (opts.data?.subjects || []).filter((s) => Number(s.semester) === Number(adminSem));

  useEffect(() => {
    if (isFaculty && classes.length && !classKey) setClassKey(`${classes[0].subject_id}|${classes[0].section}|${classes[0].semester}`);
  }, [isFaculty, classes, classKey]);
  useEffect(() => {
    if (!isFaculty && subjects.length && !subjects.find((s) => String(s.id) === String(adminSubject))) setAdminSubject(String(subjects[0].id));
  }, [isFaculty, subjects, adminSubject]);

  const sel = isFaculty
    ? (() => { const [sid, sec, sem] = classKey.split('|'); return { subjectId: Number(sid), section: sec, semester: Number(sem) }; })()
    : { subjectId: Number(adminSubject), section: adminSection, semester: Number(adminSem) };
  const selSubject = isFaculty
    ? classes.find((c) => `${c.subject_id}|${c.section}|${c.semester}` === classKey)
    : subjects.find((s) => String(s.id) === String(adminSubject));

  // live code + check-ins, refreshed every 3 seconds while the session is open
  useEffect(() => {
    if (!session?.sessionId) return;
    let alive = true;
    const pull = () => call(`/attendance/sessions/${session.sessionId}/live`).then((d) => { if (alive) setLive(d); }).catch(() => {});
    pull();
    const t = setInterval(pull, 3000);
    return () => { alive = false; clearInterval(t); };
  }, [session?.sessionId, call]);

  const closeSession = async () => {
    try {
      await call(`/attendance/sessions/${session.sessionId}/close`, { method: 'POST' });
      setSession((s) => ({ ...s, expiresAt: new Date().toISOString() }));
      toast.info('QR check-in closed — review the roster and submit');
    } catch (e) {
      toast.error(e.message);
    }
  };

  // countdown
  useEffect(() => {
    if (!session?.expiresAt) return;
    const tick = () => setRemaining(Math.max(0, Math.round((new Date(session.expiresAt).getTime() - Date.now()) / 1000)));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [session]);

  const start = async () => {
    if (!sel.subjectId || !sel.section) return;
    setStarting(true);
    try {
      const d = await call('/attendance/create-session', {
        method: 'POST',
        body: { ...sel, topicCovered: topic || 'Lecture', durationMinutes: 15 },
      });
      setLive(null);
      setSession({ ...d, ...sel, durationSeconds: 900, subjectName: selSubject?.subject_name || selSubject?.name, subjectCode: selSubject?.subject_code || selSubject?.code });
      toast.success('Roll call open — students can scan the QR now');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setStarting(false);
    }
  };

  if (opts.loading) return <div className="grid-side"><Skeleton h={420} r={14} /><Skeleton h={420} r={14} /></div>;
  if (opts.error) return <ErrorState error={opts.error} onRetry={opts.hardReload} />;

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0');
  const ss = String(remaining % 60).padStart(2, '0');
  const expired = session && remaining === 0;

  return (
    <div className="grid-side">
      <div className="stack">
        <Card title="1 · Choose class" icon={BookOpen}>
          <div className="stack gap-12">
            {isFaculty ? (
              classes.length === 0 ? <Callout tone="warning">No classes are mapped to your profile yet.</Callout> : (
                <Field label="Mapped class">
                  <select className="select" value={classKey} onChange={(e) => { setClassKey(e.target.value); setSession(null); }}>
                    {classes.map((c) => <option key={`${c.subject_id}|${c.section}|${c.semester}`} value={`${c.subject_id}|${c.section}|${c.semester}`}>{c.subject_code} · {c.section} · Sem {c.semester}</option>)}
                  </select>
                </Field>
              )
            ) : (
              <>
                <div className="grid-2" style={{ gap: 10 }}>
                  <Field label="Semester"><select className="select" value={adminSem} onChange={(e) => { setAdminSem(Number(e.target.value)); setSession(null); }}>{SEMESTERS.map((s) => <option key={s} value={s}>Sem {s}</option>)}</select></Field>
                  <Field label="Section"><select className="select" value={adminSection} onChange={(e) => { setAdminSection(e.target.value); setSession(null); }}>{SECTIONS.map((s) => <option key={s}>{s}</option>)}</select></Field>
                </div>
                <Field label="Subject">
                  <select className="select" value={adminSubject} onChange={(e) => { setAdminSubject(e.target.value); setSession(null); }}>
                    {subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}
                  </select>
                </Field>
              </>
            )}
            <Field label="Topic covered" hint="Optional — saved with the session">
              <input className="input" value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Dijkstra’s algorithm" />
            </Field>
            <button className="btn btn-accent" onClick={start} disabled={starting || !sel.subjectId}>
              {session ? <><RefreshCw size={15} /> Start a new roll call</> : <><Play size={15} /> Open 15-min QR roll call</>}
            </button>
          </div>
        </Card>

        {session && (() => {
          const code = live?.code || session.code;
          const link = `${window.location.origin}/#/attendance?checkin=${code}`;
          const scanned = (live?.records || []).filter((r) => r.method === 'QR_Scan').length;
          return (
            <Card title="2 · Live QR" icon={QrCode} actions={expired ? <Badge tone="danger">Closed</Badge> : <Badge tone="success" dot>Live · rotates every 30s</Badge>}>
              <div className="stack gap-12" style={{ alignItems: 'center', textAlign: 'center' }}>
                <div style={{ opacity: expired ? 0.25 : 1, transition: 'opacity .3s' }}><QR value={link} size={200} /></div>
                <div className="row gap-6">
                  <code className="code-box" style={{ padding: '6px 12px', fontSize: 18, letterSpacing: '0.08em' }}>{expired ? '— closed —' : code}</code>
                  {!expired && <button className="icon-btn" aria-label="Copy check-in link" onClick={() => { navigator.clipboard?.writeText(link); toast.info('Check-in link copied'); }}><Copy size={15} /></button>}
                </div>
                <div>
                  <div className="serif num" style={{ fontSize: 44, lineHeight: 1, color: remaining < 60 ? 'var(--danger)' : 'var(--ink)' }}>{mm}:{ss}</div>
                  <div className="xs muted">{expired ? 'Check-in closed' : 'left to check in'} · {session.subjectCode} · {session.section}</div>
                </div>
                <Progress value={(remaining / (session.durationSeconds || 900)) * 100} tone={remaining < 60 ? 'danger' : undefined} style={{ width: '100%' }} />
                <div className="row gap-8 wrap" style={{ justifyContent: 'center' }}>
                  <Badge tone="accent"><ScanLine size={11} /> {scanned} scanned in</Badge>
                  {!expired && <button className="btn btn-ghost btn-sm" onClick={closeSession}><Square size={12} /> Close check-in</button>}
                </div>
              </div>
            </Card>
          );
        })()}
      </div>

      <Roster section={sel.section} semester={sel.semester} session={session} liveRecords={live?.records} />
    </div>
  );
}

function Roster({ section, semester, session, liveRecords }) {
  const call = useApi();
  const toast = useToast();
  const [q, setQ] = useState('');
  const [marks, setMarks] = useState({});
  const [saving, setSaving] = useState(false);
  const { data, loading, error, hardReload } = useLoader(
    (api) => (section ? api(`/students?section=${encodeURIComponent(section)}&semester=${semester || ''}`) : Promise.resolve([])),
    [section, semester]
  );
  const students = asList(data);

  const seen = useRef(new Set());
  useEffect(() => {
    const m = {};
    students.forEach((s) => { m[s.id] = session ? 'Absent' : 'Present'; });
    seen.current = new Set();
    setMarks(m);
  }, [data, session?.sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Apply server-side marks (QR scans) as they arrive, once each
  useEffect(() => {
    const fresh = (liveRecords || []).filter((r) => !seen.current.has(`${r.student_id}|${r.status}`));
    if (!fresh.length) return;
    fresh.forEach((r) => seen.current.add(`${r.student_id}|${r.status}`));
    setMarks((m) => ({ ...m, ...Object.fromEntries(fresh.map((r) => [r.student_id, r.status])) }));
  }, [liveRecords]);
  const viaQR = new Set((liveRecords || []).filter((r) => r.method === 'QR_Scan').map((r) => r.student_id));

  const filtered = useMemo(() => {
    const t = q.toLowerCase();
    return students.filter((s) => !t || s.full_name?.toLowerCase().includes(t) || s.roll_no?.toLowerCase().includes(t));
  }, [students, q]);

  const counts = Object.values(marks).reduce((a, v) => ({ ...a, [v]: (a[v] || 0) + 1 }), {});
  const setAll = (v) => setMarks(Object.fromEntries(students.map((s) => [s.id, v])));

  const submit = async () => {
    if (!session) return;
    setSaving(true);
    try {
      const r = await call('/attendance/bulk-mark', {
        method: 'POST',
        body: { sessionId: session.sessionId, records: Object.entries(marks).map(([studentId, status]) => ({ studentId: Number(studentId), status })) },
      });
      toast.success(r?.message || 'Attendance saved');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card flush title={<>3 · Roll call <span className="muted" style={{ fontWeight: 400 }}>· {section || '—'}</span></>} icon={Users}
      subtitle={session ? `${students.length} students · unscanned students start as absent — tap P / L / A to adjust` : `${students.length} students · tap P / L / A to change a mark`}
      actions={<>
        <button className="btn btn-ghost btn-sm" onClick={() => setAll('Present')} disabled={!students.length}><CheckCheck size={14} /> All present</button>
        <button className="btn btn-primary btn-sm" onClick={submit} disabled={!session || saving || !students.length} title={!session ? 'Start a session first' : undefined}>
          {saving ? 'Saving…' : 'Submit attendance'}
        </button>
      </>}>
      <div className="row-between wrap" style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)', gap: 10 }}>
        <SearchInput value={q} onChange={setQ} placeholder="Filter by name or roll no" size="sm" style={{ flex: '1 1 220px', maxWidth: 320 }} />
        <div className="row gap-6">
          <Badge tone="success"><UserCheck size={11} /> {counts.Present || 0}</Badge>
          <Badge tone="warning"><Clock size={11} /> {counts.Late || 0}</Badge>
          <Badge tone="danger"><UserX size={11} /> {counts.Absent || 0}</Badge>
        </div>
      </div>
      {!session && students.length > 0 && (
        <div style={{ padding: '12px 18px 0' }}><Callout tone="accent">Start a session to enable submission. Marks are saved against that session.</Callout></div>
      )}
      {loading ? (
        <div className="stack gap-8" style={{ padding: 18 }}>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={44} />)}</div>
      ) : error ? (
        <div style={{ padding: 18 }}><ErrorState error={error} onRetry={hardReload} /></div>
      ) : filtered.length === 0 ? (
        <EmptyState icon={Users} title="No students" description="No students found for this section and semester." />
      ) : (
        <div className="list" style={{ maxHeight: 640, overflowY: 'auto', paddingTop: 6 }}>
          {filtered.map((s, i) => {
            const m = marks[s.id] || 'Present';
            return (
              <div key={s.id} className="list-item" style={{ padding: '9px 18px' }}>
                <span className="mono xs faint" style={{ width: 22 }}>{String(i + 1).padStart(2, '0')}</span>
                <Avatar src={s.avatar_url} name={s.full_name} size={30} />
                <div className="grow">
                  <div className="list-title">{s.full_name} {viaQR.has(s.id) && <Badge tone="accent" style={{ marginLeft: 6 }}><ScanLine size={10} /> QR</Badge>}</div>
                  <div className="list-meta mono">{s.roll_no}</div>
                </div>
                <span className={`mono xs t-${attTone(s.live_attendance_pct)}`} style={{ width: 48, textAlign: 'right' }} title="Overall attendance">{pct(s.live_attendance_pct, 0)}</span>
                <div className="seg" role="radiogroup" aria-label={`Mark ${s.full_name}`}>
                  {[['Present', 'P', 'var(--success)'], ['Late', 'L', 'var(--warning)'], ['Absent', 'A', 'var(--danger)']].map(([v, l, col]) => (
                    <button key={v} type="button" className={m === v ? 'active' : ''} style={m === v ? { color: col, minWidth: 30 } : { minWidth: 30 }}
                      onClick={() => setMarks((x) => ({ ...x, [s.id]: v }))} aria-pressed={m === v}>{l}</button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

/* ----- Student lookup ------------------------------------------------- */
function StudentLookup() {
  const [section, setSection] = useState('CSE-2');
  const { sections: lookupSections } = useMySections(SECTIONS);
  useEffect(() => {
    if (lookupSections.length && !lookupSections.includes(section)) setSection(lookupSections[0]);
  }, [lookupSections, section]);
  const [q, setQ] = useState('');
  const [picked, setPicked] = useState(null);
  const roster = useLoader((api) => api(`/students?section=${encodeURIComponent(section)}`), [section]);
  const report = useLoader(
    (api) => (picked ? Promise.all([api(`/attendance/summary?studentId=${picked}`), settle(api(`/attendance/trends?studentId=${picked}`), [])]) : Promise.resolve(null)),
    [picked]
  );
  const list = asList(roster.data).filter((s) => !q || `${s.full_name} ${s.roll_no}`.toLowerCase().includes(q.toLowerCase()));
  const sorted = [...list].sort((a, b) => (a.live_attendance_pct ?? 100) - (b.live_attendance_pct ?? 100));

  return (
    <div className="grid-side">
      <Card flush title="Roster" icon={Users} subtitle="Sorted by attendance, lowest first"
        actions={<select className="select select-sm" style={{ width: 110 }} value={section} onChange={(e) => { setSection(e.target.value); setPicked(null); }}>{lookupSections.map((s) => <option key={s}>{s}</option>)}</select>}>
        <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--line)' }}><SearchInput value={q} onChange={setQ} size="sm" placeholder="Search students" /></div>
        <div className="list" style={{ maxHeight: 620, overflowY: 'auto' }}>
          {roster.loading ? <div className="stack gap-8" style={{ padding: 14 }}>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} h={40} />)}</div>
            : sorted.length === 0 ? <EmptyState compact title="No students" />
              : sorted.map((s) => (
                <div key={s.id} className={cx('list-item clickable', picked === s.id && 'active')} onClick={() => setPicked(s.id)} style={{ padding: '10px 14px' }}>
                  <Avatar src={s.avatar_url} name={s.full_name} size={30} />
                  <div className="grow"><div className="list-title truncate">{s.full_name}</div><div className="list-meta mono">{s.roll_no} · Sem {s.semester}</div></div>
                  <Badge tone={attTone(s.live_attendance_pct)}>{pct(s.live_attendance_pct, 0)}</Badge>
                </div>
              ))}
        </div>
      </Card>
      <div>
        {!picked ? (
          <div className="card"><EmptyState icon={Percent} title="Pick a student" description="Select anyone from the roster to see their full subject-wise report, trend and recovery guidance." /></div>
        ) : report.loading ? <PageSkeleton stats={3} rows={1} /> : report.error ? <ErrorState error={report.error} onRetry={report.hardReload} /> : (
          <div className="stack gap-16">
            <div className="row-between">
              <div>
                <div className="serif" style={{ fontSize: 28, lineHeight: 1.1 }}>{report.data?.[0]?.student_name}</div>
                <div className="small muted">Detailed attendance report</div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={() => downloadCSV(subjectCSV(report.data[0]), `attendance-${report.data[0]?.student_name}.csv`)}><Download size={14} /> CSV</button>
            </div>
            <StudentReport summary={report.data?.[0]} trends={report.data?.[1]} />
          </div>
        )}
      </div>
    </div>
  );
}

/* ----- Admin override -------------------------------------------------- */
function OverrideModal({ open, onClose }) {
  const call = useApi();
  const toast = useToast();
  const [form, setForm] = useState({ recordId: '', status: 'Present', reason: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async () => {
    setBusy(true);
    try {
      await call('/attendance/override', { method: 'PUT', body: { recordId: Number(form.recordId), status: form.status, reason: form.reason } });
      toast.success(`Record #${form.recordId} updated and written to the audit log`);
      setForm({ recordId: '', status: 'Present', reason: '' });
      onClose();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open={open} onClose={onClose} title="Attendance audit override" subtitle="Correct a locked record. Every override is permanently logged with your justification." icon={ShieldAlert}
      footer={<>
        <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
        <button className="btn btn-danger" onClick={submit} disabled={busy || !form.recordId || form.reason.trim().length < 5}>{busy ? 'Applying…' : 'Apply override'}</button>
      </>}>
      <div className="form-grid">
        <Field label="Attendance record ID"><input className="input mono" type="number" value={form.recordId} onChange={set('recordId')} placeholder="e.g. 142" /></Field>
        <Field label="Corrected status">
          <Segmented value={form.status} onChange={(v) => setForm((f) => ({ ...f, status: v }))} options={['Present', 'Late', 'Absent']} />
        </Field>
        <Field label="Justification" hint="Minimum 5 characters — stored in the audit trail" className="full">
          <textarea className="textarea" value={form.reason} onChange={set('reason')} placeholder="e.g. Sanctioned duty leave for inter-college hackathon" />
        </Field>
      </div>
    </Modal>
  );
}
