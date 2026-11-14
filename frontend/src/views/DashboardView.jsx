import React, { useMemo, useState } from 'react';
import {
  QrCode, TrendingUp, ShieldCheck, AlertTriangle, Wallet, Activity, Megaphone,
  CalendarClock, Layers, FileCheck, Flag, ArrowRight, CreditCard, Sparkles, Award, Clock, BookOpenCheck,
  CheckCircle2, ArrowUpRight, Smartphone, Landmark, Pin,
} from 'lucide-react';
import { XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar } from 'recharts';
import confetti from 'canvas-confetti';
import { useAuth } from '../context/AuthContext';
import { AttendanceTrend } from '../components/charts';
import { useLoader, settle, useChartColors, axisProps } from '../lib/hooks';
import { useApi, asList } from '../lib/api';
import { inr, inrShort, num, pct, fmtDate, timeAgo, daysUntil, attTone, titleCase, statusTone } from '../lib/format';
import {
  Card, Stat, Badge, Progress, Avatar, EmptyState, ErrorState, PageSkeleton, Modal, ChartTip, Callout, useToast,
  Headline, Splits,
} from '../components/ui';

const greet = () => {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
};
const firstName = (n = '') => n.replace(/^(Mr|Mrs|Ms|Dr|Prof)\.?\s+/i, '').split(' ')[0];

// The CGPA cohort runs the prediction engine for every student and holds the API for a while,
// so share one in-flight request and reuse a good result for ten minutes across dashboard visits.
let cohortCache = null;
const loadCohort = (api) => {
  if (cohortCache && Date.now() - cohortCache.at < 10 * 60 * 1000) return cohortCache.promise;
  const promise = api('/cgpa/at-risk-cohort').catch(() => {
    cohortCache = null;
    return [];
  });
  cohortCache = { at: Date.now(), promise };
  return promise;
};
const today = () => new Date().toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });

export default function DashboardView({ onNavigate }) {
  const { user } = useAuth();
  const role = user?.role;
  if (role === 'admin') return <AdminDashboard go={onNavigate} />;
  if (role === 'faculty') return <FacultyDashboard go={onNavigate} />;
  if (role === 'parent') return <ParentDashboard go={onNavigate} />;
  return <StudentDashboard go={onNavigate} />;
}

/* ====================================================================== */
/* Shared pieces                                                           */
/* ====================================================================== */
/** Big figure + sentence, then proportional blocks, then the role's next actions */
function Lead({ eyebrow, figure, unit, children, splits, actions, aside }) {
  return (
    <>
      <Headline eyebrow={eyebrow} figure={figure} unit={unit} aside={aside}>{children}</Headline>
      {splits && <Splits items={splits} />}
      {actions && <div className="row wrap gap-8 rise d2" style={{ margin: splits ? '-16px 0 40px' : '0 0 40px' }}>{actions}</div>}
    </>
  );
}

function HeroBtn({ icon: Icon, children, onClick, primary }) {
  return (
    <button className={`btn ${primary ? 'btn-accent' : 'btn-ghost'}`} onClick={onClick}>
      <Icon size={15} /> {children}
    </button>
  );
}

function NoticeList({ notices, go, limit = 4 }) {
  const list = (notices || []).slice(0, limit);
  if (!list.length) return <EmptyState icon={Megaphone} title="No notices" compact />;
  return (
    <div className="list">
      {list.map((n) => (
        <div key={n.id ?? n._id} className="list-item clickable" onClick={() => go('notices')} style={{ alignItems: 'flex-start' }}>
          <span className={`dot ${n.category === 'Urgent' ? 'danger' : 'accent'}`} style={{ marginTop: 7 }} />
          <div className="grow">
            <div className="list-title clamp-2">{n.is_pinned ? <Pin size={12} style={{ marginRight: 4, verticalAlign: -1, color: 'var(--saffron)' }} /> : null}{n.title}</div>
            <div className="list-meta">{n.posted_by} · {timeAgo(n.created_at)}</div>
          </div>
          <Badge tone={n.category === 'Urgent' ? 'danger' : n.category === 'Placement' ? 'violet' : n.category === 'Event' ? 'warning' : 'info'}>{n.category}</Badge>
        </div>
      ))}
    </div>
  );
}

/* ====================================================================== */
/* Admin                                                                   */
/* ====================================================================== */
function AdminDashboard({ go }) {
  const { user } = useAuth();
  const c = useChartColors();
  const { data, loading, error, hardReload } = useLoader((api) => Promise.all([
    api('/dashboard/summary'),
    settle(api('/attendance/trends'), []),
  ]));
  // The CGPA cohort runs the prediction engine for every student — load it separately so the page isn't blocked
  const cohortQ = useLoader(loadCohort);
  const cohort = asList(cohortQ.data);

  const cohortBySection = useMemo(() => {
    const m = {};
    cohort.forEach((s) => { m[s.section] = (m[s.section] || 0) + 1; });
    return Object.entries(m).map(([section, count]) => ({ section, count })).sort((a, b) => b.count - a.count);
  }, [cohort]);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;

  const [summary, trends] = data;
  const s = summary?.stats || {};
  const threshold = s.regulatory_threshold || 75;
  const collected = s.total_fees_collected || 0;
  const demand = s.total_fees_demand || 0;
  const outstanding = Math.max(0, demand - collected);
  const feeData = [
    { name: 'Collected', value: collected, color: c.success },
    { name: 'Outstanding', value: outstanding, color: c.warning },
  ];
  const atRisk = summary?.at_risk_students || [];

  return (
    <>
      <Lead
        eyebrow={`${today()} · ${greet()}, ${firstName(user?.fullName)} · ${num(s.total_faculty)} faculty · ${num(s.total_courses)} programmes · ${num(s.total_subjects)} subjects`}
        figure={num(s.total_students)}
        splits={[
          { value: Math.max(0, (s.total_students || 0) - (s.at_risk_students_count || 0)), label: `at or above the ${threshold}% line`, color: 'var(--teal)', onClick: () => go('students') },
          { value: s.at_risk_students_count || 0, label: 'below it — detention risk', color: 'var(--signal)', onClick: () => go('attendance') },
        ]}
        actions={<>
          <HeroBtn primary icon={ShieldCheck} onClick={() => go('settings')}>Governance & audit</HeroBtn>
          <HeroBtn icon={QrCode} onClick={() => go('attendance')}>Attendance control</HeroBtn>
          <HeroBtn icon={TrendingUp} onClick={() => go('cgpa-simulator')}>CGPA analytics</HeroBtn>
        </>}
      >
        students enrolled. <span>{num(s.at_risk_students_count)} sit under the {threshold}% attendance rule.</span>
      </Lead>

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Stat className="rise d1" label="Average attendance" value={pct(s.average_attendance)} icon={Activity} tone={attTone(s.average_attendance)}
          hint={<>Policy minimum <b>{threshold}%</b></>}>
          <Progress value={s.average_attendance} tone={attTone(s.average_attendance)} style={{ marginTop: 6 }} />
        </Stat>
        <Stat className="rise d2" label="Fee recovery" value={pct(s.fee_collection_rate)} icon={Wallet} tone="success"
          hint={<>{inrShort(collected)} of {inrShort(demand)}</>}>
          <Progress value={s.fee_collection_rate} tone="success" style={{ marginTop: 6 }} />
        </Stat>
        <Stat className="rise d3" label="Below attendance threshold" value={num(s.at_risk_students_count)} icon={AlertTriangle} tone="danger"
          hint={<>{pct((s.at_risk_students_count / (s.total_students || 1)) * 100)} of the student body</>} />
        <Stat className="rise d4" label="Flagged by CGPA engine" value={cohortQ.loading ? '…' : num(cohort.length)} icon={TrendingUp} tone="violet"
          hint={<button className="btn btn-quiet btn-sm" style={{ marginLeft: -10 }} onClick={() => go('cgpa-simulator')}>Inspect cohort <ArrowRight size={13} /></button>} />
      </div>

      <div className="grid-main" style={{ marginBottom: 16 }}>
        <Card title="Campus attendance, last 31 sessions" subtitle="Daily share of students marked present across all sections" icon={Activity}
          actions={<Badge tone="accent" dot>Live</Badge>}>
          <AttendanceTrend data={trends} height={250} />
        </Card>
        <Card title="Fee recovery" subtitle="Current semester demand vs. collection" icon={Wallet}
          actions={<button className="btn btn-ghost btn-sm" onClick={() => go('fees')}>Ledger</button>}>
          <div style={{ position: 'relative', height: 190 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={feeData} dataKey="value" nameKey="name" innerRadius={62} outerRadius={84} paddingAngle={2} stroke="none" startAngle={90} endAngle={-270}>
                  {feeData.map((d) => <Cell key={d.name} fill={d.color} />)}
                </Pie>
                <Tooltip content={<ChartTip format={(v) => inr(v)} />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="ring-label" style={{ pointerEvents: 'none' }}>
              <div>
                <div className="serif num" style={{ fontSize: 30, lineHeight: 1 }}>{pct(s.fee_collection_rate, 0)}</div>
                <div className="xs muted">recovered</div>
              </div>
            </div>
          </div>
          <div className="grid-2" style={{ gap: 10, marginTop: 8 }}>
            <div className="tile-sm"><div className="xs muted row gap-6"><span className="dot success" />Collected</div><div className="strong num">{inrShort(collected)}</div></div>
            <div className="tile-sm"><div className="xs muted row gap-6"><span className="dot warning" />Outstanding</div><div className="strong num">{inrShort(outstanding)}</div></div>
          </div>
        </Card>
      </div>

      <div className="grid-main" style={{ marginBottom: 16 }}>
        <Card flush title="Early-warning risk cohort" subtitle={`Lowest attendance first · ${num(s.at_risk_students_count)} students under ${threshold}%`} icon={AlertTriangle}
          actions={<button className="btn btn-ghost btn-sm" onClick={() => go('attendance')}>Open tracker</button>}>
          {atRisk.length === 0 ? <EmptyState icon={CheckCircle2} title="Everyone is compliant" description={`No student is below ${threshold}%.`} /> : (
            <div className="table-wrap" style={{ maxHeight: 380 }}>
              <table className="tbl">
                <thead><tr><th>Student</th><th>Section</th><th style={{ width: 180 }}>Attendance</th><th className="right">CGPA</th></tr></thead>
                <tbody>
                  {atRisk.slice(0, 12).map((st) => (
                    <tr key={st.id} className="clickable" onClick={() => go('students')}>
                      <td><div className="strong">{st.full_name}</div><div className="xs muted mono">{st.roll_no}</div></td>
                      <td><Badge>{st.section}</Badge> <span className="xs muted">Sem {st.semester}</span></td>
                      <td>
                        <div className="row gap-8"><Progress value={st.attendance_pct} tone={attTone(st.attendance_pct)} className="grow" /><span className="mono xs" style={{ width: 40, textAlign: 'right' }}>{pct(st.attendance_pct, 0)}</span></div>
                      </td>
                      <td className="right mono">{st.current_cgpa?.toFixed?.(2) ?? st.current_cgpa}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card title="Predicted risk by section" subtitle="Students with at least one at-risk subject" icon={Layers}>
          {cohortQ.loading ? <div className="stack gap-8">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton" style={{ height: 14, width: `${90 - i * 9}%` }} />)}<div className="xs muted" style={{ marginTop: 6 }}>Running prediction engine across the cohort…</div></div> : cohortBySection.length === 0 ? <EmptyState compact title="No predicted risk" /> : (
            <ResponsiveContainer width="100%" height={Math.max(220, cohortBySection.length * 24)}>
              <BarChart data={cohortBySection} layout="vertical" margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="section" {...axisProps(c)} width={62} />
                <Tooltip content={<ChartTip />} cursor={{ fill: c.sunken }} />
                <Bar dataKey="count" name="Students" fill={c.violet} radius={[0, 4, 4, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div className="grid-3">
        <Card title="Audit trail" subtitle="Recent privileged actions" icon={ShieldCheck}
          actions={<button className="btn btn-ghost btn-sm" onClick={() => go('settings')}>Full log</button>}>
          {(summary?.recent_audit_logs || []).length === 0 ? <EmptyState compact title="No overrides recorded" /> : (
            <div className="timeline">
              {summary.recent_audit_logs.slice(0, 5).map((l) => (
                <div key={l.id ?? l._id} className="tl-item">
                  <div className="row-between"><span className="mono xs strong">{l.action}</span><span className="xs faint">{timeAgo(l.created_at)}</span></div>
                  <div className="small muted clamp-2">{l.reason || l.entity_type}</div>
                  <div className="xs faint">{l.user_email}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card flush title="Notice board" icon={Megaphone} actions={<button className="btn btn-ghost btn-sm" onClick={() => go('notices')}>All</button>}>
          <NoticeList notices={summary?.recent_notices} go={go} />
        </Card>
        <Card flush title="Examinations" icon={CalendarClock} actions={<button className="btn btn-ghost btn-sm" onClick={() => go('exams')}>Manage</button>}>
          {(summary?.examinations || []).length === 0 ? <EmptyState compact title="No examinations" /> : (
            <div className="list">
              {summary.examinations.map((e) => (
                <div key={e.id ?? e._id} className="list-item">
                  <div className="grow">
                    <div className="list-title">{e.name}</div>
                    <div className="list-meta">{fmtDate(e.start_date)} – {fmtDate(e.end_date)} · {e.academic_year}</div>
                  </div>
                  <Badge tone={statusTone(e.status)}>{titleCase(e.status)}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </>
  );
}

/* ====================================================================== */
/* Faculty                                                                 */
/* ====================================================================== */
function FacultyDashboard({ go }) {
  const { user, facultyProfile } = useAuth();
  const { data, loading, error, hardReload } = useLoader((api) => Promise.all([
    api('/dashboard/summary'),
    settle(api('/attendance/trends'), []),
  ]));
  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;
  const [d, trends] = data;
  const s = d?.stats || {};
  const schedule = d?.today_schedule || [];
  const classes = d?.assigned_classes || [];
  const risk = [...(d?.at_risk_students || [])].sort((a, b) => a.attendance_pct - b.attendance_pct);
  const now = new Date();
  const nowHM = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const isToday = d?.schedule_is_today !== false;
  const doneN = isToday ? schedule.filter((sl) => nowHM >= sl.end_time).length : 0;
  const liveN = isToday ? schedule.filter((sl) => nowHM >= sl.start_time && nowHM < sl.end_time).length : 0;
  const nextN = schedule.length - doneN - liveN;

  return (
    <>
      <Lead
        eyebrow={`${today()} · ${greet()}, ${user?.fullName?.replace(/^(Dr|Prof|Mr|Ms|Mrs)\.?\s+/, '')} · ${facultyProfile?.designation || 'Faculty'}, ${facultyProfile?.department_name || 'Department'}`}
        figure={schedule.length}
        splits={schedule.length ? [
          { value: doneN, label: 'taught', color: 'var(--stone)' },
          { value: liveN, label: 'in session now', color: 'var(--signal)', onClick: () => go('attendance') },
          { value: nextN, label: 'still to come', color: 'var(--teal)' },
        ] : null}
        actions={<>
          <HeroBtn primary icon={QrCode} onClick={() => go('attendance')}>Start attendance</HeroBtn>
          <HeroBtn icon={FileCheck} onClick={() => go('assignments')}>Grade work {s.pending_grading ? `(${s.pending_grading})` : ''}</HeroBtn>
          <HeroBtn icon={Flag} onClick={() => go('societies')}>Duty-leave queue {s.pending_society_attendance ? `(${s.pending_society_attendance})` : ''}</HeroBtn>
        </>}
      >
        {schedule.length === 1 ? 'lecture' : 'lectures'} on your timetable {isToday ? 'today' : `on ${d?.schedule_day}`}. <span>{num(risk.length)} students in your sections are under 75%.</span>
      </Lead>

      <div className="grid-4" style={{ marginBottom: 18 }}>
        <Stat className="rise d1" label="Mapped subjects" value={s.assigned_subjects_count ?? 0} hint={`${classes.length} class allocations`} />
        <Stat className="rise d2" label="Weekly workload" value={s.weekly_workload ?? 0} unit="hours" hint="from the published timetable" />
        <Stat className="rise d3" label="Submissions to grade" value={s.pending_grading ?? 0} tone={s.pending_grading ? 'warning' : 'neutral'}
          hint={<button className="text-btn" onClick={() => go('assignments')}>open grading →</button>} />
        <Stat className="rise d4" label="Duty-leave requests" value={s.pending_society_attendance ?? 0} tone={s.pending_society_attendance ? 'warning' : 'neutral'}
          hint={<button className="text-btn" onClick={() => go('societies')}>review queue →</button>} />
      </div>

      <div className="grid-main" style={{ marginBottom: 16 }}>
        <Card title={d?.schedule_is_today === false ? `Next teaching day · ${d.schedule_day}` : 'Today’s teaching'} subtitle={d?.schedule_is_today === false ? 'No lectures on weekends — here’s Monday' : now.toLocaleDateString('en-IN', { weekday: 'long' })} icon={CalendarClock}
          actions={<button className="btn btn-ghost btn-sm" onClick={() => go('academics')}>Timetable</button>}>
          {schedule.length === 0 ? <EmptyState icon={CalendarClock} title="No lectures today" description="Enjoy the free day, or catch up on grading." compact /> : (
            <div className="stack gap-8">
              {schedule.map((sl) => {
                const isToday = d?.schedule_is_today !== false;
                const live = isToday && nowHM >= sl.start_time && nowHM < sl.end_time;
                const done = isToday && nowHM >= sl.end_time;
                return (
                  <div key={sl.id ?? sl._id} className="row gap-12 tile" style={{ opacity: done ? 0.6 : 1, borderColor: live ? 'var(--accent-line)' : undefined, background: live ? 'var(--accent-soft)' : undefined }}>
                    <div className="mono small" style={{ width: 92, flexShrink: 0 }}>
                      <div className="strong">{sl.start_time}</div>
                      <div className="muted xs">{sl.end_time}</div>
                    </div>
                    <div className="vr" />
                    <div className="grow">
                      <div className="strong">{sl.subject_name}</div>
                      <div className="xs muted">{sl.subject_code} · Section {sl.section} · {sl.room_no}</div>
                    </div>
                    {live ? <Badge tone="success" dot>In session</Badge> : done ? <Badge>Done</Badge> : <Badge tone="accent">Upcoming</Badge>}
                    {!done && <button className="btn btn-outline btn-sm" onClick={() => go('attendance')}><QrCode size={13} /> Mark</button>}
                  </div>
                );
              })}
            </div>
          )}
        </Card>
        <Card flush title="Mapped classes" subtitle="From the faculty–class allocation map" icon={Layers}>
          {classes.length === 0 ? <EmptyState compact title="No classes allocated" /> : (
            <div className="list">
              {classes.map((ac, i) => (
                <div key={i} className="list-item">
                  <span className="stat-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><BookOpenCheck size={15} /></span>
                  <div className="grow">
                    <div className="list-title">{ac.subject_name}</div>
                    <div className="list-meta">{ac.subject_code} · Sem {ac.semester} · {ac.section} · {ac.credits} credits</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="grid-main">
        <Card flush title="Students under the 75% rule" subtitle={`${risk.length} students across your sections, lowest first`} icon={AlertTriangle}
          actions={<button className="btn btn-ghost btn-sm" onClick={() => go('attendance')}>Roll call</button>}>
          {risk.length === 0 ? <EmptyState icon={CheckCircle2} title="All compliant" description="Every student in your sections is above 75%." /> : (
            <div className="table-wrap" style={{ maxHeight: 420 }}>
              <table className="tbl">
                <thead><tr><th>Student</th><th>Section</th><th className="right">Sessions</th><th style={{ width: 170 }}>Attendance</th></tr></thead>
                <tbody>
                  {risk.slice(0, 40).map((st) => (
                    <tr key={st.id ?? st.roll_no}>
                      <td><div className="strong">{st.student_name}</div><div className="xs muted mono">{st.roll_no}</div></td>
                      <td><Badge>{st.section}</Badge></td>
                      <td className="right mono small">{st.present_count}/{st.total_sessions}</td>
                      <td><div className="row gap-8"><Progress value={st.attendance_pct} tone={attTone(st.attendance_pct)} className="grow" /><span className="mono xs" style={{ width: 42, textAlign: 'right' }}>{pct(st.attendance_pct)}</span></div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <div className="stack">
          <Card title="Campus attendance trend" icon={Activity}><AttendanceTrend data={trends} height={170} /></Card>
          <Card flush title="Notices" icon={Megaphone} actions={<button className="btn btn-ghost btn-sm" onClick={() => go('notices')}>All</button>}>
            <NoticeList notices={d?.recent_notices} go={go} limit={3} />
          </Card>
        </div>
      </div>
    </>
  );
}

/* ====================================================================== */
/* Student                                                                 */
/* ====================================================================== */
function StudentDashboard({ go }) {
  const { user, studentProfile } = useAuth();
  const { data, loading, error, hardReload } = useLoader((api) => Promise.all([
    api('/dashboard/summary'),
    settle(api('/attendance/trends'), []),
    settle(api('/attendance/summary'), null),
  ]));
  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;
  const [d, trends, att] = data;
  const s = d?.stats || {};
  const p = d?.student_profile || studentProfile || {};
  const live = s.live_attendance ?? att?.overall_percentage ?? 0;
  const critical = s.is_attendance_critical;
  const range = (s.predicted_sgpa_range || []).filter((x) => x != null);
  const subjects = [...(att?.subjects || [])].filter((x) => x.total_classes > 0).sort((a, b) => a.attendance_percentage - b.attendance_percentage);
  const lowSubjects = subjects.filter((x) => x.is_below_threshold);
  const cgpa = studentProfile?.current_cgpa;

  return (
    <>
      <Lead
        eyebrow={`${today()} · ${greet()}, ${firstName(user?.fullName)} · ${p.roll_no || ''} · ${p.section || '—'} · Sem ${p.semester || '—'}`}
        figure={Math.round(live)} unit="%"
        splits={att ? [
          { value: att.total_attended || 0, label: 'sessions attended', color: 'var(--teal)' },
          { value: Math.max(0, (att.total_conducted || 0) - (att.total_attended || 0)), label: 'missed', color: 'var(--signal)', onClick: () => go('attendance') },
        ] : null}
        actions={<>
          <HeroBtn primary icon={QrCode} onClick={() => go('attendance')}>QR check-in</HeroBtn>
          <HeroBtn icon={TrendingUp} onClick={() => go('cgpa-simulator')}>What-if simulator</HeroBtn>
          <HeroBtn icon={Award} onClick={() => go('exams')}>Marksheets</HeroBtn>
        </>}
      >
        of your classes attended. <span>{critical ? 'You’re under the 75% rule and could be detained.' : lowSubjects.length ? `Exam-eligible, but ${lowSubjects.length} subject${lowSubjects.length > 1 ? 's are' : ' is'} under 75%.` : 'You’re exam-eligible in every subject.'}</span>
      </Lead>

      {critical && (
        <Callout tone="danger" title="Your attendance is below the 75% GGSIPU requirement" style={{ marginBottom: 16 }}
          action={<button className="btn btn-danger btn-sm" onClick={() => go('attendance')}>Recovery plan</button>}>
          You may be detained from end-term examinations. Check how many classes you need to attend in each subject.
        </Callout>
      )}

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Stat className="rise d1" label="Cumulative CGPA" value={cgpa ?? '—'} unit="/ 10" hint={<>campus merit rank <b>#{s.merit_rank ?? '—'}</b></>} />
        <Stat className="rise d2" label="Predicted SGPA" value={s.predicted_sgpa ?? '—'} unit="/ 10" icon={TrendingUp} tone={s.at_risk_subject_count ? 'warning' : 'violet'}
          hint={s.predicted_sgpa == null ? 'Forecast unavailable' : <>{range.length === 2 ? <>Band {range[0]}–{range[1]} · </> : null}{s.confidence_score}% confidence{s.at_risk_subject_count ? <> · <b>{s.at_risk_subject_count} at risk</b></> : null}</>} />
        <Stat className="rise d3" label="Merit points" value={num(s.merit_points)} unit="XP" icon={Sparkles} tone="warning"
          hint={<div className="row wrap gap-4">{(s.badges || []).map((b) => <Badge key={b} tone="saffron">{b}</Badge>)}</div>} />
        <Stat className="rise d4" label="Semester fees" value={s.fee_status || '—'} icon={CreditCard} tone={s.fee_status === 'Paid' ? 'success' : 'warning'}
          hint={<button className="btn btn-quiet btn-sm" style={{ marginLeft: -10 }} onClick={() => go('fees')}>View receipts <ArrowRight size={13} /></button>} />
      </div>

      <div className="grid-main" style={{ marginBottom: 16 }}>
        <Card title="Attendance trajectory" subtitle="Your cumulative attendance over the last 31 sessions" icon={Activity}>
          <AttendanceTrend data={trends} personal height={240} />
        </Card>
        <Card flush title="Due soon" subtitle="Upcoming assignments" icon={FileCheck} actions={<button className="btn btn-ghost btn-sm" onClick={() => go('assignments')}>All</button>}>
          {(d?.upcoming_assignments || []).length === 0 ? <EmptyState icon={CheckCircle2} title="Nothing due" description="You're on top of your coursework." compact /> : (
            <div className="list">
              {d.upcoming_assignments.map((a) => {
                const days = daysUntil(a.due_date);
                return (
                  <div key={a.id ?? a._id} className="list-item clickable" onClick={() => go('assignments')}>
                    <div className="grow">
                      <div className="list-title clamp-2">{a.title}</div>
                      <div className="list-meta">{a.subject_code} · {a.max_marks} marks</div>
                    </div>
                    <Badge tone={days < 0 ? 'danger' : days <= 2 ? 'warning' : 'neutral'}>
                      <Clock size={11} /> {days < 0 ? `${-days}d overdue` : days === 0 ? 'Today' : `${days}d left`}
                    </Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      </div>

      <div className="grid-main">
        <Card title="Subject-wise attendance" subtitle={lowSubjects.length ? `${lowSubjects.length} subject${lowSubjects.length > 1 ? 's' : ''} below 75%` : 'All subjects above 75%'} icon={BookOpenCheck}
          actions={<button className="btn btn-ghost btn-sm" onClick={() => go('attendance')}>Details</button>}>
          {subjects.length === 0 ? <EmptyState compact title="No subject records" /> : (
            <div className="stack gap-12">
              {subjects.slice(0, 7).map((x) => (
                <div key={x.subject_id}>
                  <div className="row-between small" style={{ marginBottom: 6 }}>
                    <span className="truncate"><span className="strong">{x.subject_name}</span> <span className="muted mono xs">{x.subject_code}</span></span>
                    <span className="row gap-8" style={{ flexShrink: 0 }}>
                      {x.classes_needed_for_75 > 0 && <span className="xs t-danger">+{x.classes_needed_for_75} classes needed</span>}
                      <span className="mono xs strong">{pct(x.attendance_percentage, 0)}</span>
                    </span>
                  </div>
                  <Progress value={x.attendance_percentage} tone={attTone(x.attendance_percentage)} />
                </div>
              ))}
            </div>
          )}
        </Card>
        <Card flush title="Notices" icon={Megaphone} actions={<button className="btn btn-ghost btn-sm" onClick={() => go('notices')}>All</button>}>
          <NoticeList notices={d?.recent_notices} go={go} />
        </Card>
      </div>
    </>
  );
}

/* ====================================================================== */
/* Parent                                                                  */
/* ====================================================================== */
function ParentDashboard({ go }) {
  const { user } = useAuth();
  const call = useApi();
  const toast = useToast();
  const [wardId, setWardId] = useState(null);
  const [payOpen, setPayOpen] = useState(false);
  const [method, setMethod] = useState('upi');
  const [paying, setPaying] = useState(false);

  const { data: d, loading, error, hardReload, reload } = useLoader(
    (api) => api(wardId ? `/dashboard/summary?wardId=${wardId}` : '/dashboard/summary'),
    [wardId]
  );

  if (loading && !d) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;

  if (d && !d.active_ward) {
    return <div className="card" style={{ maxWidth: 560, margin: '8vh auto' }}><EmptyState icon={Award} title="No ward is linked to this account" description="Ask the college office to link your child’s record to your guardian login. Once linked, attendance, results and fees appear here." /></div>;
  }
  const ward = d?.active_ward || {};
  const wards = d?.linked_wards || [];
  const s = d?.stats || {};
  const marks = d?.recent_marks || [];
  const risk = s.is_attendance_risk;
  const due = s.fee_due_amount || 0;

  const pay = async () => {
    setPaying(true);
    try {
      await call('/fees/pay', {
        method: 'POST',
        body: { paymentId: s.fee_payment_id, paymentMethod: { upi: 'UPI', card: 'Credit/Debit Card', netbanking: 'Net Banking' }[method], transactionRef: `GTB-${Date.now()}` },
      });
      confetti({ particleCount: 90, spread: 70, origin: { y: 0.65 } });
      toast.success(`Payment of ${inr(due)} received. A receipt has been generated.`);
      setPayOpen(false);
      reload();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setPaying(false);
    }
  };

  return (
    <>
      <Lead
        eyebrow={`Guardian portal · ${today()} · ${greet()}, ${user?.fullName?.replace(/^(Mr|Mrs|Ms|Dr)\.?\s+/, '').split(' ')[0]}`}
        figure={Math.round(s.live_attendance || 0)} unit="%"
        splits={[
          { value: s.classes_attended || 0, label: 'classes attended', color: 'var(--teal)' },
          { value: s.classes_absent || 0, label: 'absences', color: 'var(--signal)' },
        ]}
        aside={
          <div className="row gap-12" style={{ border: '1px solid var(--card-border)', borderRadius: 20, boxShadow: 'var(--shadow-md)', padding: 14, minWidth: 290, alignSelf: 'flex-end', background: 'var(--surface)' }}>
            <Avatar src={ward.avatar_url} name={ward.student_name} size={46} />
            <div className="grow">
              <div className="mono xs muted">viewing ward</div>
              {wards.length > 1 ? (
                <select className="select select-sm" style={{ marginTop: 4 }} value={ward.student_id || ''} onChange={(e) => setWardId(Number(e.target.value))}>
                  {wards.map((w) => <option key={w.student_id} value={w.student_id}>{w.student_name}</option>)}
                </select>
              ) : <div className="strong">{ward.student_name}</div>}
              <div className="xs mono muted" style={{ marginTop: 4 }}>{ward.roll_no} · {ward.section} · Sem {ward.semester}</div>
            </div>
          </div>
        }
      >
        attendance for {firstName(ward.student_name)}. <span>{risk ? 'Below the 75% GGSIPU requirement.' : 'Meets university criteria.'}</span>
      </Lead>

      <div className="grid-3" style={{ marginBottom: 16 }}>
        <Stat className="rise d1" label="Duty-leave credits" value={s.society_credited_classes ?? 0} unit="classes" hint={`${s.classes_attended ?? 0} of ${s.total_classes ?? 0} classes attended`} />
        <Stat className="rise d2" label="Cumulative CGPA" value={ward.current_cgpa ?? '—'} unit="/ 10" icon={Award} tone="violet"
          hint={ward.course_name} />
        <Stat className="rise d3" label="Semester fees" value={s.fee_status || '—'} icon={CreditCard} tone={s.fee_status === 'Paid' ? 'success' : 'warning'}
          hint={s.fee_status === 'Paid' ? <>All dues cleared for semester {ward.semester}</> : <>{inr(due)} due by {fmtDate(s.fee_due_date)}</>}>
          {s.fee_status !== 'Paid' && <button className="btn btn-accent btn-sm" style={{ alignSelf: 'flex-start', marginTop: 4 }} onClick={() => setPayOpen(true)}><CreditCard size={13} /> Pay online</button>}
        </Stat>
      </div>

      <div className="grid-main" style={{ marginBottom: 16 }}>
        <Card flush title="Latest examination marks" subtitle={`${ward.student_name || 'Ward'} · ${marks[0]?.exam_name || 'most recent declared results'}`} icon={Award}
          actions={<button className="btn btn-ghost btn-sm" onClick={() => go('exams')}>Full transcript</button>}>
          {marks.length === 0 ? <EmptyState compact title="No marks declared yet" /> : (
            <div className="table-wrap">
              <table className="tbl">
                <thead><tr><th>Subject</th><th className="right">Internal</th><th className="right">Assign.</th><th className="right">External</th><th className="right">Total</th><th className="center">Grade</th></tr></thead>
                <tbody>
                  {marks.map((m) => (
                    <tr key={m.id ?? m._id}>
                      <td><div className="strong">{m.subject_name}</div><div className="xs muted mono">{m.subject_code}</div></td>
                      <td className="right mono">{m.internal_assessment}</td>
                      <td className="right mono">{m.assignment_score}</td>
                      <td className="right mono">{m.external_exam}</td>
                      <td className="right mono strong">{m.total_score}</td>
                      <td className="center"><span className={`grade grade-${String(m.letter_grade).toLowerCase().replace('+', 'p')}`}>{m.letter_grade}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
        <Card flush title="Society duty attendance" subtitle="Classes credited for approved society work" icon={Flag}>
          {(d?.ward_society_attendance || []).length === 0 ? <EmptyState compact title="No duty-leave requests" /> : (
            <div className="list">
              {d.ward_society_attendance.map((it) => (
                <div key={it.id ?? it._id} className="list-item" style={{ alignItems: 'flex-start' }}>
                  <div className="grow">
                    <div className="list-title">{it.activity_title}</div>
                    <div className="list-meta">{it.society_name} · {it.subject_code} · {fmtDate(it.date)}</div>
                    {it.reviewer_remarks && <div className="xs muted" style={{ marginTop: 4, fontStyle: 'italic' }}>“{it.reviewer_remarks}”</div>}
                  </div>
                  <Badge tone={statusTone(it.status)}>{titleCase(it.status)}</Badge>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card flush title="Notices for guardians" icon={Megaphone} actions={<button className="btn btn-ghost btn-sm" onClick={() => go('notices')}>All</button>}>
        <NoticeList notices={d?.recent_notices} go={go} />
      </Card>

      <Modal open={payOpen} onClose={() => !paying && setPayOpen(false)} title="Pay semester fees" subtitle={`${ward.student_name} · ${ward.roll_no}`} icon={CreditCard} size="sm"
        footer={<>
          <button className="btn btn-ghost" onClick={() => setPayOpen(false)} disabled={paying}>Cancel</button>
          <button className="btn btn-accent" onClick={pay} disabled={paying}>{paying ? <><span className="spinner" style={{ width: 14, height: 14 }} /> Processing…</> : <>Pay {inr(due)}</>}</button>
        </>}>
        <div className="tile" style={{ textAlign: 'center', marginBottom: 18 }}>
          <div className="xs muted">Amount payable</div>
          <div className="serif num" style={{ fontSize: 42, lineHeight: 1.1 }}>{inr(due)}</div>
          <div className="xs muted">Semester {ward.semester} · due {fmtDate(s.fee_due_date)}</div>
        </div>
        <div className="label" style={{ marginBottom: 8 }}>Payment method</div>
        <div className="stack gap-8">
          {[['upi', 'UPI', 'GPay, PhonePe, Paytm', Smartphone], ['card', 'Card', 'Debit or credit card', CreditCard], ['netbanking', 'Net banking', 'All major Indian banks', Landmark]].map(([k, l, dsc, Icon]) => (
            <label key={k} className="tile-sm row gap-12" style={{ cursor: 'pointer', borderColor: method === k ? 'var(--accent)' : undefined, background: method === k ? 'var(--accent-soft)' : undefined }}>
              <input type="radio" name="pm" checked={method === k} onChange={() => setMethod(k)} style={{ accentColor: 'var(--accent)' }} />
              <Icon size={16} />
              <div className="grow"><div className="strong small">{l}</div><div className="xs muted">{dsc}</div></div>
              {method === k && <ArrowUpRight size={14} className="accent" />}
            </label>
          ))}
        </div>
        <p className="xs faint" style={{ marginTop: 14 }}>No payment gateway is connected yet — this records the payment and issues a receipt; the accounts office reconciles it.</p>
      </Modal>
    </>
  );
}
