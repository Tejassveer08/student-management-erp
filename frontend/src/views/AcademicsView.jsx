import React, { useMemo, useState } from 'react';
import { CalendarDays, BookOpen, MapPin, User, ChevronDown, FlaskConical, GraduationCap, Layers, Clock } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { asList } from '../lib/api';
import { useLoader, useNow } from '../lib/hooks';
import { SECTIONS, SEMESTERS } from '../config/campus';
import { PageHeader, Card, Badge, Progress, Tabs, EmptyState, ErrorState, PageSkeleton, Segmented, Stat, cx } from '../components/ui';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
const diffTone = (d) => (d >= 0.65 ? 'danger' : d >= 0.45 ? 'warning' : 'success');
const diffLabel = (d) => (d >= 0.65 ? 'Hard' : d >= 0.45 ? 'Moderate' : 'Easy');

export default function AcademicsView() {
  const { studentProfile } = useAuth();
  const [sem, setSem] = useState(studentProfile?.semester || 4);
  const [section, setSection] = useState(studentProfile?.section || 'CSE-2');
  const [tab, setTab] = useState('timetable');
  const [layout, setLayout] = useState('grid');
  const [openSub, setOpenSub] = useState(null);
  const now = useNow(60000);

  const { data, loading, error, hardReload } = useLoader((api) => Promise.all([
    api(`/academics/subjects?semester=${sem}`),
    api(`/academics/timetable?semester=${sem}&section=${encodeURIComponent(section)}`),
    api('/academics/courses').catch(() => []),
  ]), [sem, section]);

  const subjects = asList(data?.[0]);
  const slots = asList(data?.[1]);
  const courses = asList(data?.[2]);
  const course = courses.find((c) => c.code === `BTECH-${section.split('-')[0]}`);
  const deptSubjects = course ? subjects.filter((s) => s.course_id === course.id) : [];
  const catalog = deptSubjects.length ? deptSubjects : subjects;

  const times = useMemo(() => [...new Set(slots.map((s) => `${s.start_time}|${s.end_time}`))].sort(), [slots]);
  const cell = (day, t) => slots.find((s) => s.day_of_week === day && `${s.start_time}|${s.end_time}` === t);
  const today = now.toLocaleDateString('en-US', { weekday: 'long' });
  const hm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const credits = catalog.reduce((a, s) => a + (s.credits || 0), 0);
  const labs = catalog.filter((s) => s.type && s.type !== 'Theory').length;

  return (
    <>
      <PageHeader
        eyebrow="Curriculum"
        title={<>Courses & <em>timetable</em></>}
        description="The weekly schedule for any section and the semester’s subject catalogue, with historical pass rates and difficulty."
        actions={<div className="row gap-8">
          <select className="select" style={{ width: 130 }} value={sem} onChange={(e) => setSem(Number(e.target.value))} aria-label="Semester">{SEMESTERS.map((s) => <option key={s} value={s}>Semester {s}</option>)}</select>
          <select className="select" style={{ width: 120 }} value={section} onChange={(e) => setSection(e.target.value)} aria-label="Section">{SECTIONS.map((s) => <option key={s}>{s}</option>)}</select>
        </div>}
      />

      {loading ? <PageSkeleton /> : error ? <ErrorState error={error} onRetry={hardReload} /> : (
        <>
          <div className="grid-4" style={{ marginBottom: 16 }}>
            <Stat label="Weekly lectures" value={slots.length} icon={CalendarDays} tone="accent" hint={`${section} · semester ${sem}`} />
            <Stat label="Subjects" value={catalog.length} icon={BookOpen} tone="info" hint={`${labs} practical / lab`} />
            <Stat label="Credits" value={credits} icon={Layers} tone="violet" />
            <Stat label="Programmes" value={courses.length || 5} icon={GraduationCap} tone="success" hint="CSE · IT · ECE · AI-ML · AI-DS" />
          </div>

          <Tabs value={tab} onChange={setTab} tabs={[
            { id: 'timetable', label: 'Weekly timetable', icon: CalendarDays, count: slots.length },
            { id: 'catalog', label: 'Subject catalogue', icon: BookOpen, count: catalog.length },
            { id: 'programmes', label: 'Programmes', icon: GraduationCap, count: courses.length },
          ]} />

          {tab === 'timetable' && (
            <Card flush title={`${section} · Semester ${sem}`} subtitle="Monday to Friday" icon={CalendarDays}
              actions={<Segmented value={layout} onChange={setLayout} options={[{ value: 'grid', label: 'Grid' }, { value: 'list', label: 'By day' }]} />}>
              {slots.length === 0 ? <EmptyState icon={CalendarDays} title="No timetable published" description="This section has no scheduled lectures for the selected semester." /> : layout === 'grid' ? (
                <div className="table-wrap">
                  <table className="tbl" style={{ tableLayout: 'fixed', minWidth: 820 }}>
                    <thead>
                      <tr>
                        <th style={{ width: 96 }}>Time</th>
                        {DAYS.map((d) => <th key={d} style={d === today ? { color: 'var(--accent)' } : undefined}>{d}{d === today && ' · today'}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {times.map((t) => {
                        const [st, en] = t.split('|');
                        return (
                          <tr key={t}>
                            <td className="mono xs muted" style={{ verticalAlign: 'top' }}>{st}<br />{en}</td>
                            {DAYS.map((d) => {
                              const s = cell(d, t);
                              const live = s && d === today && hm >= st && hm < en;
                              return (
                                <td key={d} style={{ verticalAlign: 'top', padding: 6 }}>
                                  {s ? (
                                    <div className={cx('tt-slot', s.subject_type && s.subject_type !== 'Theory' && 'lab')} style={live ? { background: 'var(--accent-soft)', borderColor: 'var(--accent-line)' } : undefined}>
                                      <div className="row-between"><span className="mono xs strong">{s.subject_code}</span>{live && <span className="dot live" />}</div>
                                      <div className="small strong clamp-2" style={{ marginTop: 2 }}>{s.subject_name}</div>
                                      <div className="xs muted truncate" style={{ marginTop: 4 }}>{s.faculty_name}</div>
                                      <div className="xs faint">{s.room_no}</div>
                                    </div>
                                  ) : <div style={{ height: '100%', minHeight: 60, background: 'repeating-linear-gradient(-45deg, transparent 0 6px, var(--sunken) 6px 7px)' }} />}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="card-bd">
                  <div className="grid-auto" style={{ '--min': '220px' }}>
                    {DAYS.map((d) => {
                      const xs = slots.filter((s) => s.day_of_week === d).sort((a, b) => a.start_time.localeCompare(b.start_time));
                      return (
                        <div key={d} className="tile" style={d === today ? { borderColor: 'var(--accent-line)' } : undefined}>
                          <div className="row-between" style={{ marginBottom: 10 }}><span className="strong">{d}</span><Badge tone={d === today ? 'accent' : 'neutral'}>{xs.length}</Badge></div>
                          <div className="timeline">
                            {xs.length === 0 ? <span className="xs faint">No lectures</span> : xs.map((s) => (
                              <div key={s.id} className="tl-item">
                                <div className="mono xs muted">{s.start_time} – {s.end_time}</div>
                                <div className="small strong">{s.subject_name}</div>
                                <div className="xs muted row gap-4"><User size={11} />{s.faculty_name} · <MapPin size={11} />{s.room_no}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </Card>
          )}

          {tab === 'catalog' && (
            <Card flush>
              {catalog.length === 0 ? <EmptyState title="No subjects for this semester" /> : (
                <div className="list">
                  {catalog.map((s) => {
                    const open = openSub === s.id;
                    return (
                      <div key={s.id} style={{ borderTop: '1px solid var(--line)' }}>
                        <button className="list-item clickable" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left', borderTop: 0 }} onClick={() => setOpenSub(open ? null : s.id)} aria-expanded={open}>
                          <span className="stat-icon" style={{ background: s.type === 'Theory' ? 'var(--accent-soft)' : 'var(--saffron-soft)', color: s.type === 'Theory' ? 'var(--accent)' : '#b7791f' }}>
                            {s.type === 'Theory' ? <BookOpen size={15} /> : <FlaskConical size={15} />}
                          </span>
                          <div className="grow">
                            <div className="list-title">{s.name}</div>
                            <div className="list-meta"><span className="mono">{s.code}</span> · {s.credits} credits · {s.faculty_name || 'Unassigned'}</div>
                          </div>
                          <div className="desktop-only" style={{ width: 160 }}>
                            <div className="row-between xs"><span className="muted">Pass rate</span><span className="mono">{s.historical_pass_pct}%</span></div>
                            <Progress value={s.historical_pass_pct} tone={s.historical_pass_pct < 70 ? 'warning' : 'success'} style={{ marginTop: 4 }} />
                          </div>
                          <Badge tone={diffTone(s.difficulty_index)}>{diffLabel(s.difficulty_index)} · {Math.round((s.difficulty_index || 0) * 100)}</Badge>
                          <ChevronDown size={16} className="muted" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
                        </button>
                        {open && (
                          <div style={{ padding: '0 18px 18px 60px' }} className="rise">
                            <div className="grid-3" style={{ gap: 10, marginBottom: 12 }}>
                              <div className="tile-sm"><div className="xs muted">Historical average</div><div className="strong mono">{s.historical_avg_marks} / 100</div></div>
                              <div className="tile-sm"><div className="xs muted">Pass rate</div><div className="strong mono">{s.historical_pass_pct}%</div></div>
                              <div className="tile-sm"><div className="xs muted">Type</div><div className="strong">{s.type}</div></div>
                            </div>
                            <div className="eyebrow" style={{ marginBottom: 6 }}>Syllabus outline</div>
                            {s.syllabus_outline ? (
                              <ol className="small ink-2" style={{ paddingLeft: 18, lineHeight: 1.7 }}>
                                {s.syllabus_outline.split(/,\s*(?=Unit)/).map((u, i) => <li key={i}>{u.replace(/^Unit \d+:\s*/, '')}</li>)}
                              </ol>
                            ) : <div className="small faint">Not published yet.</div>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {tab === 'programmes' && (
            <div className="grid-auto" style={{ '--min': '280px' }}>
              {courses.sort((a, b) => a.id - b.id).map((c) => (
                <Card key={c.id}>
                  <Badge tone="accent">{c.department_code}</Badge>
                  <div className="serif" style={{ fontSize: 22, lineHeight: 1.2, marginTop: 10 }}>{c.name}</div>
                  <div className="small muted" style={{ marginTop: 6 }}>{c.department_name}</div>
                  <div className="divider" style={{ margin: '14px 0 10px' }} />
                  <div className="row-between xs muted"><span className="mono">{c.code}</span><span className="row gap-4"><Clock size={12} /> {c.duration_semesters} semesters</span></div>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
