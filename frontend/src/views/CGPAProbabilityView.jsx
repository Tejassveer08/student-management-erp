import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  TrendingUp, RotateCcw, AlertTriangle, ShieldCheck, Sliders, Cpu, ArrowRight, Sigma, Target, Gauge, Users,
} from 'lucide-react';
import {
  ComposedChart, Bar, Line, ErrorBar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine,
  ScatterChart, Scatter, ZAxis, Cell,
} from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useApi, asList } from '../lib/api';
import { useLoader, settle, useChartColors, axisProps, useDebounced, useMySections } from '../lib/hooks';
import { SECTIONS } from '../config/campus';
import { gradeClass, pct } from '../lib/format';
import {
  PageHeader, Card, Badge, Ring, EmptyState, ErrorState, PageSkeleton, Callout, ChartTip, cx,
} from '../components/ui';

export default function CGPAProbabilityView() {
  const { user } = useAuth();
  const staff = user?.role === 'admin' || user?.role === 'faculty';
  const [section, setSection] = useState('CSE-2');
  const [studentId, setStudentId] = useState(staff ? null : 'me');
  const { sections } = useMySections(SECTIONS);
  useEffect(() => {
    if (staff && sections.length && !sections.includes(section)) { setSection(sections[0]); setStudentId(null); }
  }, [staff, sections, section]);

  const roster = useLoader((api) => (staff ? api(`/students?section=${encodeURIComponent(section)}`) : Promise.resolve([])), [staff, section]);
  const students = asList(roster.data);
  useEffect(() => {
    if (staff && students.length && !students.find((s) => String(s.id) === String(studentId))) setStudentId(students[0].id);
  }, [staff, students, studentId]);

  return (
    <>
      <PageHeader
        eyebrow="Flagship module · Predictive analytics"
        title={<>CGPA <em>probability</em></>}
        description="Forecasts this semester’s SGPA and CGPA before results are declared — weighing historical subject difficulty, continuous assessment and live attendance — and lets you test what-if scenarios."
        actions={staff && (
          <div className="row gap-8 wrap">
            <select className="select" style={{ width: 120 }} value={section} onChange={(e) => { setSection(e.target.value); setStudentId(null); }} aria-label="Section">
              {sections.map((s) => <option key={s}>{s}</option>)}
            </select>
            <select className="select" style={{ width: 280 }} value={studentId || ''} onChange={(e) => setStudentId(Number(e.target.value))} aria-label="Student" disabled={roster.loading}>
              {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.roll_no}</option>)}
            </select>
          </div>
        )}
      />
      {studentId ? <Analysis key={studentId} studentId={studentId} /> : roster.loading ? <PageSkeleton /> : (
        <div className="card"><EmptyState icon={Users} title="No students in this section" /></div>
      )}
    </>
  );
}

function Analysis({ studentId }) {
  const call = useApi();
  const c = useChartColors();
  const [adj, setAdj] = useState({});
  const [sim, setSim] = useState(null);
  const [simulating, setSimulating] = useState(false);
  const debouncedAdj = useDebounced(adj, 220);
  const reqId = useRef(0);

  const { data, loading, error, hardReload } = useLoader(async (api) => {
    const base = await api(`/cgpa/analysis/${studentId}`);
    // Build real semester history from declared report cards
    const sid = base?.student_id;
    const first = sid ? await settle(api(`/exams/report-card/${sid}?semester=1`), null) : null;
    const current = first?.student?.semester || 0;
    const sems = (first?.available_semesters || []).filter((s) => s < current);
    const rest = await Promise.all(sems.filter((s) => s !== 1).map((s) => settle(api(`/exams/report-card/${sid}?semester=${s}`), null)));
    const cards = [first, ...rest].filter((r) => r && sems.includes(r.selected_semester));
    const history = cards
      .map((r) => ({ sem: r.selected_semester, sgpa: r.academic_metrics?.semester_sgpa }))
      .filter((h) => h.sgpa != null)
      .sort((a, b) => a.sem - b.sem);
    return { base, history, currentSem: current, name: first?.student?.name, roll: first?.student?.roll_no };
  }, [studentId]);

  // live what-if
  useEffect(() => {
    if (!data) return;
    if (!Object.keys(debouncedAdj).some((k) => debouncedAdj[k])) { setSim(null); return; }
    const my = ++reqId.current;
    setSimulating(true);
    call('/cgpa/simulate', { method: 'POST', body: { studentId, whatIfAdjustments: debouncedAdj } })
      .then((r) => { if (my === reqId.current) setSim(r); })
      .catch(() => {})
      .finally(() => { if (my === reqId.current) setSimulating(false); });
  }, [debouncedAdj, data, studentId, call]);

  const base = data?.base;
  const view = sim || base;
  const active = Object.values(adj).filter(Boolean).length;

  const traj = useMemo(() => {
    if (!data) return [];
    const rows = data.history.map((h) => ({ label: `Sem ${h.sem}`, actual: h.sgpa }));
    if (view) {
      const [lo, hi] = view.sgpa_range || [];
      rows.push({
        label: `Sem ${data.currentSem || rows.length + 1}`,
        forecast: view.predicted_sgpa,
        err: lo != null && hi != null ? [view.predicted_sgpa - lo, hi - view.predicted_sgpa] : [0, 0],
      });
    }
    return rows;
  }, [data, view]);

  const scatter = useMemo(() => (view?.subjects || []).map((s) => ({
    x: Math.round(s.difficulty_index * 100), y: s.predicted_score, z: s.credits, name: s.subject_code, full: s.subject_name, risk: s.is_at_risk,
  })), [view]);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;
  if (!base) return <div className="card"><EmptyState title="No prediction available" /></div>;

  const delta = sim ? +(sim.predicted_sgpa - base.predicted_sgpa).toFixed(2) : 0;
  const deltaC = sim ? +(sim.predicted_cgpa - base.predicted_cgpa).toFixed(2) : 0;
  const [slo, shi] = view.sgpa_range || [];
  const [clo, chi] = view.cgpa_range || [];
  const confTone = view.confidence_level === 'High' ? 'var(--success)' : view.confidence_level === 'Moderate' ? 'var(--warning)' : 'var(--danger)';
  const subjects = view.subjects || [];
  const baseBy = Object.fromEntries((base.subjects || []).map((s) => [s.subject_id, s]));

  return (
    <div className="stack gap-16">
      {/* Forecast hero */}
      <section className="hero rise">
        <div className="row-between wrap" style={{ gap: 24, alignItems: 'stretch' }}>
          <div style={{ flex: '1 1 380px' }}>
            <div className="eyebrow">{data.name ? `${data.name} · ${data.roll}` : 'Forecast'} · Semester {data.currentSem || '—'}</div>
            <div className="row gap-12" style={{ alignItems: 'baseline', marginTop: 14 }}>
              <span className="serif num" style={{ fontSize: 88, lineHeight: 0.9, color: '#fff' }}>{view.predicted_sgpa?.toFixed(2)}</span>
              <div>
                <div style={{ color: 'var(--panel-muted)', fontSize: 13 }}>Projected SGPA</div>
                {sim && delta !== 0 && <Badge tone={delta > 0 ? 'success' : 'danger'} style={{ marginTop: 4 }}>{delta > 0 ? '+' : ''}{delta} vs. baseline</Badge>}
              </div>
            </div>
            <BandBar lo={slo} hi={shi} value={view.predicted_sgpa} />
            <div className="row gap-16 wrap small" style={{ color: 'var(--panel-muted)', marginTop: 10 }}>
              <span>Likely range <b style={{ color: '#fff' }}>{slo?.toFixed?.(2)} – {shi?.toFixed?.(2)}</b></span>
              <span>{view.total_semester_credits} credits this semester</span>
            </div>
          </div>
          <div className="vr desktop-only" style={{ background: 'rgba(255,255,255,0.1)' }} />
          <div className="row gap-24 wrap" style={{ flex: '1 1 380px', justifyContent: 'space-around' }}>
            <div>
              <div className="eyebrow">Projected CGPA</div>
              <div className="serif num" style={{ fontSize: 48, lineHeight: 1.05, color: '#fff', marginTop: 8 }}>{view.predicted_cgpa?.toFixed(2)}</div>
              <div className="small" style={{ color: 'var(--panel-muted)' }}>from {view.current_cgpa} · band {clo?.toFixed?.(2)}–{chi?.toFixed?.(2)}</div>
              {sim && deltaC !== 0 && <div className="xs" style={{ color: deltaC > 0 ? '#4ade80' : '#f87171', marginTop: 4 }}>{deltaC > 0 ? '+' : ''}{deltaC} with your tweaks</div>}
            </div>
            <div className="row gap-12">
              <Ring value={view.confidence_score} size={104} stroke={9} color={confTone} track="rgba(255,255,255,0.1)">
                <div><div className="serif num" style={{ fontSize: 26, color: '#fff' }}>{view.confidence_score}<span style={{ fontSize: 13 }}>%</span></div></div>
              </Ring>
              <div>
                <div className="eyebrow">Confidence</div>
                <div style={{ color: '#fff', marginTop: 4 }}>{view.confidence_level} reliability</div>
                <div className="xs" style={{ color: 'var(--panel-muted)', maxWidth: 190, lineHeight: 1.5 }}>
                  {view.confidence_basis ? (
                    <>
                      Internals recorded for {Math.round(view.confidence_basis.internal_coverage * 100)}% of credits
                      {view.confidence_basis.internal_coverage < 1 && view.confidence_basis.uses_cgpa_history ? ' (the rest use your CGPA record)' : ''}
                      {' · '}attendance evidence {Math.round(view.confidence_basis.attendance_coverage * 100)}%
                      {' · '}SGPA band ±{(view.confidence_basis.sgpa_band / 2).toFixed(2)}
                    </>
                  ) : 'Rises as more internal marks are recorded'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {view.at_risk_subjects?.length > 0 && (
        <Callout tone="danger" title={`${view.at_risk_subjects.length} subject${view.at_risk_subjects.length > 1 ? 's' : ''} flagged by the early-warning model`}>
          <div className="stack gap-6" style={{ marginTop: 6 }}>
            {view.at_risk_subjects.map((r) => (
              <div key={r.subject_code} className="row gap-8 wrap small">
                <b className="mono">{r.subject_code}</b><span>{r.subject_name}</span>
                <span className="muted">— {r.reason}</span>
                <Badge tone="danger">Projected {r.predicted_grade} · {r.predicted_score}</Badge>
              </div>
            ))}
          </div>
        </Callout>
      )}

      <div className="grid-2">
        <Card title="SGPA trajectory" subtitle="Declared semesters, then this semester’s forecast with its confidence band" icon={TrendingUp}>
          <ResponsiveContainer width="100%" height={260}>
            <ComposedChart data={traj} margin={{ top: 16, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke={c.line} />
              <XAxis dataKey="label" {...axisProps(c)} />
              <YAxis domain={[5, 10]} {...axisProps(c)} />
              <ReferenceLine y={8} stroke={c.saffron} strokeDasharray="4 4" label={{ value: 'Distinction', position: 'insideTopLeft', fill: c.saffron, fontSize: 11 }} />
              <Tooltip content={<ChartTip format={(v) => (Array.isArray(v) ? '' : Number(v).toFixed(2))} />} cursor={{ fill: c.sunken }} />
              <Bar dataKey="actual" name="Declared SGPA" fill={c.lineStrong} radius={[4, 4, 0, 0]} barSize={28} />
              <Bar dataKey="forecast" name="Forecast SGPA" fill={c.accent} radius={[4, 4, 0, 0]} barSize={28}>
                <ErrorBar dataKey="err" width={10} strokeWidth={2} stroke={c.ink} direction="y" />
              </Bar>
              <Line dataKey="actual" stroke={c.muted} strokeDasharray="3 3" dot={false} legendType="none" name=" " connectNulls />
            </ComposedChart>
          </ResponsiveContainer>
        </Card>
        <Card title="Difficulty vs. projected marks" subtitle="Each dot is a subject · size = credits · red = at risk" icon={Target}>
          <ResponsiveContainer width="100%" height={260}>
            <ScatterChart margin={{ top: 16, right: 12, left: -20, bottom: 0 }}>
              <CartesianGrid stroke={c.line} />
              <XAxis type="number" dataKey="x" name="Difficulty" unit="%" domain={[0, 100]} {...axisProps(c)} />
              <YAxis type="number" dataKey="y" name="Projected" domain={[0, 100]} {...axisProps(c)} />
              <ZAxis type="number" dataKey="z" range={[50, 220]} />
              <ReferenceLine y={40} stroke={c.danger} strokeDasharray="4 4" />
              <Tooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => active && payload?.[0] ? (
                <div className="chart-tip">
                  <div className="strong">{payload[0].payload.full}</div>
                  <div className="xs muted mono">{payload[0].payload.name} · {payload[0].payload.z} credits</div>
                  <div className="small" style={{ marginTop: 4 }}>Difficulty {payload[0].payload.x}% · Projected <b>{payload[0].payload.y}</b></div>
                </div>
              ) : null} />
              <Scatter data={scatter}>
                {scatter.map((d, i) => <Cell key={i} fill={d.risk ? c.danger : c.accent} fillOpacity={0.75} />)}
              </Scatter>
            </ScatterChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <Card
        title="What-if simulator"
        subtitle="Drag a subject to imagine scoring higher or lower in the remaining exams. Nothing is saved."
        icon={Sliders}
        actions={<>
          {simulating && <span className="row gap-6 xs muted"><span className="spinner" style={{ width: 12, height: 12 }} /> Recomputing</span>}
          {active > 0 && <Badge tone="warning">{active} tweak{active > 1 ? 's' : ''}</Badge>}
          <button className="btn btn-ghost btn-sm" onClick={() => setAdj({})} disabled={!active}><RotateCcw size={14} /> Reset</button>
        </>}
        flush
      >
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>Subject</th>
                <th className="right">Difficulty</th>
                <th className="right">Attendance</th>
                <th className="right">Coursework</th>
                <th style={{ width: 260 }}>Adjust remaining exams</th>
                <th className="right">Projected</th>
                <th className="center">Grade</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => {
                const a = adj[s.subject_id] || 0;
                const b = baseBy[s.subject_id];
                const moved = b && b.predicted_score !== s.predicted_score;
                return (
                  <tr key={s.subject_id} className={cx(a !== 0 && 'selected')}>
                    <td>
                      <div className="row gap-6"><span className="strong">{s.subject_name}</span>{s.is_at_risk && <AlertTriangle size={13} className="t-danger" />}</div>
                      <div className="xs muted mono">{s.subject_code} · {s.credits} cr</div>
                    </td>
                    <td className="right"><DiffPill v={s.difficulty_index} /></td>
                    <td className={`right mono small t-${s.attendance_pct < 75 ? 'danger' : 'muted'}`}>{pct(s.attendance_pct, 0)}</td>
                    <td className="right mono small">{s.coursework_score}</td>
                    <td>
                      <div className="row gap-10">
                        <input type="range" min={-15} max={15} step={1} value={a}
                          onChange={(e) => setAdj((x) => ({ ...x, [s.subject_id]: Number(e.target.value) }))}
                          aria-label={`Adjust ${s.subject_name}`} />
                        <span className={`mono xs strong ${a > 0 ? 't-success' : a < 0 ? 't-danger' : 'faint'}`} style={{ width: 34, textAlign: 'right' }}>{a > 0 ? `+${a}` : a}</span>
                      </div>
                    </td>
                    <td className="right">
                      <span className="mono strong">{s.predicted_score}</span>
                      {moved && <div className={`xs mono ${s.predicted_score > b.predicted_score ? 't-success' : 't-danger'}`}>{s.predicted_score > b.predicted_score ? '▲' : '▼'} {Math.abs(s.predicted_score - b.predicted_score).toFixed(1)}</div>}
                    </td>
                    <td className="center">
                      <span className={`grade grade-${gradeClass(s.predicted_grade)}`}>{s.predicted_grade}</span>
                      <div className="xs faint mono" style={{ marginTop: 2 }}>{s.grade_range?.[0]}–{s.grade_range?.[1]}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <div className="grid-3">
        <ModelCard icon={Sigma} title="End-term projection" body={<>The 60-mark external is projected as a weighted blend of coursework ({Math.round((view.model?.weights?.internal_weight ?? 0.45) * 100)}%), attendance ({Math.round((view.model?.weights?.attendance_weight ?? 0.2) * 100)}%) and subject ease, 1 − difficulty ({Math.round((view.model?.weights?.difficulty_weight ?? 0.35) * 100)}%). Admins tune these weights in Governance.</>} />
        <ModelCard icon={Gauge} title="Continuous assessment" body={<>Your recorded internal (out of 25) and assignment (out of 15) marks count as they are. Subjects without internals yet use the subject’s historical average and get a wider band.</>} />
        <ModelCard icon={ShieldCheck} title="Attendance rule" body={<>Below the {view.model?.attendance_threshold ?? 75}% eligibility rule the projected external is cut progressively, and the subject is flagged as at risk.</>} />
      </div>
      <div className="row gap-8 xs faint"><Cpu size={13} /> Engine: {view.engine || 'Weighted model'} <ArrowRight size={12} /> results are probabilistic estimates, not official grades.</div>
    </div>
  );
}

function BandBar({ lo, hi, value, min = 5, max = 10 }) {
  if (lo == null || hi == null) return null;
  const p = (v) => `${((Math.max(min, Math.min(max, v)) - min) / (max - min)) * 100}%`;
  return (
    <div style={{ position: 'relative', height: 26, marginTop: 18 }}>
      <div style={{ position: 'absolute', top: 11, left: 0, right: 0, height: 4, background: 'rgba(255,255,255,0.1)' }} />
      <div style={{ position: 'absolute', top: 8, height: 10, left: p(lo), width: `calc(${p(hi)} - ${p(lo)})`, background: 'color-mix(in srgb, var(--accent-2) 55%, transparent)', transition: 'all .5s var(--ease)' }} />
      <div style={{ position: 'absolute', top: 3, width: 3, height: 20, left: p(value), background: '#fff', transform: 'translateX(-1px)', transition: 'left .5s var(--ease)' }} />
      {[5, 6, 7, 8, 9, 10].map((t) => (
        <span key={t} className="mono" style={{ position: 'absolute', top: 24, left: p(t), transform: 'translateX(-50%)', fontSize: 10, color: '#71717a' }}>{t}</span>
      ))}
    </div>
  );
}

function DiffPill({ v }) {
  const n = Math.round((v || 0) * 100);
  const tone = n >= 70 ? 'danger' : n >= 55 ? 'warning' : 'success';
  return <Badge tone={tone}>{n}%</Badge>;
}

function ModelCard({ icon: Icon, title, body }) {
  return (
    <div className="card" style={{ padding: 18 }}>
      <div className="row gap-10" style={{ marginBottom: 8 }}>
        <span className="stat-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon size={15} /></span>
        <span className="strong">{title}</span>
      </div>
      <p className="small muted" style={{ lineHeight: 1.6 }}>{body}</p>
    </div>
  );
}

