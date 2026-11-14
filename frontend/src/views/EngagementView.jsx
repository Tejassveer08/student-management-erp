import React, { useMemo, useState } from 'react';
import { Trophy, BookOpenCheck, Compass, Crown, Medal, Plus, Sparkles, Target, Award, TrendingUp, ChevronLeft, ChevronRight, Cpu } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi, asList } from '../lib/api';
import { useLoader, settle } from '../lib/hooks';
import { num } from '../lib/format';
import {
  PageHeader, Card, Badge, Progress, Avatar, Ring, Tabs, EmptyState, ErrorState, PageSkeleton, SearchInput, Stat, Skeleton, useToast, cx,
} from '../components/ui';

export default function EngagementView() {
  const { user } = useAuth();
  const personal = user?.role === 'student' || user?.role === 'parent';
  const [tab, setTab] = useState('leaderboard');
  return (
    <>
      <PageHeader eyebrow="Engagement" title={<>Merit & <em>guide</em></>}
        description="A campus-wide merit leaderboard built from academics, attendance and coursework — plus a personal study planner and career guidance." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'leaderboard', label: 'Leaderboard', icon: Trophy },
        personal && { id: 'planner', label: 'Study planner', icon: BookOpenCheck },
        personal && { id: 'career', label: 'Career guide', icon: Compass },
      ]} />
      {tab === 'leaderboard' && <Leaderboard />}
      {tab === 'planner' && personal && <Planner />}
      {tab === 'career' && personal && <Career />}
    </>
  );
}

/* ---------------------------------------------------------------------- */
const PER = 20;
function Leaderboard() {
  const { studentProfile } = useAuth();
  const [q, setQ] = useState('');
  const [page, setPage] = useState(0);
  const { data, loading, error, hardReload } = useLoader((api) => api('/engagement/leaderboard'));
  const rows = asList(data);
  const me = rows.find((r) => r.student_id === studentProfile?.id);
  const filtered = useMemo(() => rows.filter((r) => !q || `${r.student_name} ${r.roll_no}`.toLowerCase().includes(q.toLowerCase())), [rows, q]);
  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;
  const top = rows.slice(0, 3);
  const pages = Math.max(1, Math.ceil(filtered.length / PER));
  const cur = Math.min(page, pages - 1);
  const maxPts = rows[0]?.total_merit_points || 1;

  return (
    <div className="stack gap-16">
      {top.length === 3 && (
        <section className="hero rise" style={{ paddingBottom: 0 }}>
          <div className="eyebrow" style={{ textAlign: 'center' }}>This semester’s top scholars</div>
          <div className="row" style={{ justifyContent: 'center', alignItems: 'flex-end', gap: 'clamp(12px, 4vw, 40px)', marginTop: 22 }}>
            {[top[1], top[0], top[2]].map((r, i) => {
              const place = [2, 1, 3][i];
              const h = [120, 160, 96][i];
              const col = place === 1 ? 'var(--saffron)' : place === 2 ? '#d4d4d8' : '#d6a07a';
              return (
                <div key={r.student_id} className="stack gap-8" style={{ alignItems: 'center', width: 'clamp(96px, 22vw, 180px)' }}>
                  {place === 1 && <Crown size={22} color="var(--saffron)" />}
                  <div style={{ borderRadius: 99, padding: 3, background: col }}><Avatar src={r.avatar_url} name={r.student_name} size={place === 1 ? 72 : 58} /></div>
                  <div style={{ textAlign: 'center' }}>
                    <div className="strong" style={{ color: '#fff', fontSize: 14 }}>{r.student_name}</div>
                    <div className="xs mono" style={{ color: 'var(--panel-muted)' }}>{r.roll_no}</div>
                  </div>
                  <div style={{ width: '100%', height: h, background: `linear-gradient(180deg, ${col}33, ${col}0d)`, borderTop: `2px solid ${col}`, display: 'grid', placeItems: 'center' }}>
                    <div style={{ textAlign: 'center' }}>
                      <div className="serif num" style={{ fontSize: 34, color: '#fff', lineHeight: 1 }}>{place}</div>
                      <div className="xs mono" style={{ color: '#d4d4d8' }}>{r.total_merit_points} XP</div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {me && (
        <div className="grid-4">
          <Stat label="Your rank" value={`#${me.rank}`} unit={`of ${num(rows.length)}`} icon={Medal} tone="accent" hint={`Top ${Math.max(1, Math.round((me.rank / rows.length) * 100))}% of campus`} />
          <Stat label="Merit points" value={me.total_merit_points} unit="XP" icon={Sparkles} tone="warning" hint={`${maxPts - me.total_merit_points} XP behind #1`} />
          <Stat label="Academic score" value={me.academic_score} icon={Award} tone="violet" />
          <Stat label="Attendance + coursework" value={me.attendance_score + me.assignment_score} icon={Target} tone="success" />
        </div>
      )}

      <Card flush title="Campus leaderboard" subtitle="Academic + attendance + assignment points" icon={Trophy}
        actions={<SearchInput value={q} onChange={(v) => { setQ(v); setPage(0); }} placeholder="Find a student" size="sm" style={{ width: 240 }} />}>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th style={{ width: 70 }}>Rank</th><th>Student</th><th className="right">CGPA</th><th style={{ width: 260 }}>Point mix</th><th className="right">XP</th><th>Badges</th></tr></thead>
            <tbody>
              {filtered.slice(cur * PER, cur * PER + PER).map((r) => {
                const isMe = r.student_id === studentProfile?.id;
                const t = r.total_merit_points || 1;
                return (
                  <tr key={r.student_id} className={cx(isMe && 'selected')}>
                    <td><span className={cx('mono strong', r.rank <= 3 && 'accent')}>#{r.rank}</span></td>
                    <td>
                      <div className="row gap-10">
                        <Avatar src={r.avatar_url} name={r.student_name} size={30} />
                        <div><div className="strong">{r.student_name} {isMe && <Badge tone="accent">You</Badge>}</div><div className="xs muted mono">{r.roll_no}</div></div>
                      </div>
                    </td>
                    <td className="right mono">{r.current_cgpa}</td>
                    <td>
                      <div style={{ display: 'flex', height: 8, overflow: 'hidden', gap: 2, width: `${(t / maxPts) * 100}%`, minWidth: 40 }} title={`Academic ${r.academic_score} · Attendance ${r.attendance_score} · Assignments ${r.assignment_score}`}>
                        <span style={{ flex: r.academic_score, background: 'var(--violet)' }} />
                        <span style={{ flex: r.attendance_score, background: 'var(--success)' }} />
                        <span style={{ flex: r.assignment_score, background: 'var(--saffron)' }} />
                      </div>
                    </td>
                    <td className="right mono strong">{r.total_merit_points}</td>
                    <td><div className="row wrap gap-4">{(r.badges || []).slice(0, 2).map((b) => <Badge key={b} tone="saffron">{b}</Badge>)}</div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="row-between wrap" style={{ padding: '10px 16px', borderTop: '1px solid var(--line)', gap: 10 }}>
          <div className="row gap-12 xs muted">
            <span className="row gap-4"><span className="dot" style={{ background: 'var(--violet)' }} />Academic</span>
            <span className="row gap-4"><span className="dot" style={{ background: 'var(--success)' }} />Attendance</span>
            <span className="row gap-4"><span className="dot" style={{ background: 'var(--saffron)' }} />Assignments</span>
          </div>
          <div className="row gap-6">
            {me && <button className="btn btn-quiet btn-sm" onClick={() => { setQ(''); setPage(Math.floor((me.rank - 1) / PER)); }}>Jump to me</button>}
            <button className="btn btn-ghost btn-sm btn-icon" disabled={cur === 0} onClick={() => setPage(cur - 1)} aria-label="Previous"><ChevronLeft size={15} /></button>
            <span className="mono xs muted">{cur + 1} / {pages}</span>
            <button className="btn btn-ghost btn-sm btn-icon" disabled={cur >= pages - 1} onClick={() => setPage(cur + 1)} aria-label="Next"><ChevronRight size={15} /></button>
          </div>
        </div>
      </Card>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
function Planner() {
  const { user } = useAuth();
  const call = useApi();
  const toast = useToast();
  const isStudent = user?.role === 'student';
  const [busy, setBusy] = useState(null);
  const { data, loading, error, hardReload, setData } = useLoader((api) => api('/engagement/study-plan/me'));
  if (loading) return <PageSkeleton stats={3} />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;
  const items = [...(data?.planner_items || [])].sort((a, b) => ({ High: 0, Medium: 1, Low: 2 }[a.priority] ?? 3) - ({ High: 0, Medium: 1, Low: 2 }[b.priority] ?? 3));
  const done = items.reduce((a, i) => a + (i.completed_hours_this_week || 0), 0);
  const target = data?.weekly_target_total_hours || items.reduce((a, i) => a + i.recommended_weekly_hours, 0);

  const log = async (it, h) => {
    setBusy(it.subject_id);
    try {
      await call('/engagement/study-plan/progress', { method: 'POST', body: { subjectId: it.subject_id, addHours: h } });
      setData((d) => ({
        ...d,
        planner_items: d.planner_items.map((x) => {
          if (x.subject_id !== it.subject_id) return x;
          const c = +(x.completed_hours_this_week + h).toFixed(1);
          return { ...x, completed_hours_this_week: c, progress_pct: Math.min(100, Math.round((c / x.recommended_weekly_hours) * 100)) };
        }),
      }));
      toast.success(`Logged ${h}h for ${it.subject_code}`);
    } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <div className="stack gap-16">
      <div className="card" style={{ padding: 20 }}>
        <div className="row gap-24 wrap">
          <Ring value={done} max={target || 1} size={120} stroke={11}>
            <div><div className="serif num" style={{ fontSize: 28, lineHeight: 1 }}>{Math.round((done / (target || 1)) * 100)}%</div><div className="xs muted">this week</div></div>
          </Ring>
          <div className="grow">
            <div className="serif" style={{ fontSize: 26, lineHeight: 1.2 }}>{done.toFixed(1)} of {target} study hours logged</div>
            <p className="small muted" style={{ marginTop: 6, maxWidth: 560 }}>Weekly hours are weighted by each subject’s difficulty and your live attendance — harder subjects and those where you’ve missed class get more time.</p>
            <div className="row gap-8 wrap" style={{ marginTop: 12 }}>
              {['High', 'Medium', 'Low'].map((p) => <Badge key={p} tone={p === 'High' ? 'danger' : p === 'Medium' ? 'warning' : 'success'}>{items.filter((i) => i.priority === p).length} {p.toLowerCase()} priority</Badge>)}
            </div>
          </div>
        </div>
      </div>
      <div className="grid-auto" style={{ '--min': '300px' }}>
        {items.map((it) => (
          <Card key={it.subject_id}>
            <div className="row-between">
              <span className="mono xs muted">{it.subject_code}</span>
              <Badge tone={it.priority === 'Critical' ? 'danger' : it.priority === 'High' ? 'warning' : it.priority === 'Moderate' ? 'info' : 'success'}>{it.priority}</Badge>
            </div>
            <div className="strong" style={{ marginTop: 6 }}>{it.subject_name}</div>
            <div className="row-between small" style={{ marginTop: 12, marginBottom: 6 }}>
              <span className="muted">{it.completed_hours_this_week}h of {it.recommended_weekly_hours}h</span>
              <span className="mono strong">{it.progress_pct}%</span>
            </div>
            <Progress value={it.progress_pct} tone={it.progress_pct >= 100 ? 'success' : undefined} />
            {it.weak_topics && (
              <div className="row wrap gap-4" style={{ marginTop: 12 }}>
                {it.weak_topics.split(/\s*·\s*|,\s*/).filter(Boolean).slice(0, 3).map((t) => <Badge key={t} tone="outline">{t}</Badge>)}
              </div>
            )}
            {it.reasons?.length > 0 && <div className="xs ink-2" style={{ marginTop: 10 }}>Why: {it.reasons.join(' · ')}</div>}
            <div className="row-between xs muted" style={{ marginTop: 12 }}>
              <span>Difficulty {Math.round(it.difficulty_index * 100)}{it.live_attendance_pct != null ? ` · attendance ${Math.round(it.live_attendance_pct)}%` : ''}{it.internal_score != null ? ` · internal ${it.internal_score}/25` : ''}</span>
              {isStudent && (
                <div className="row gap-4">
                  {[0.5, 1].map((h) => <button key={h} className="btn btn-ghost btn-sm" disabled={busy === it.subject_id} onClick={() => log(it, h)}><Plus size={12} />{h}h</button>)}
                </div>
              )}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------------- */
function Career() {
  const { data, loading, error, hardReload } = useLoader((api) => settle(api('/engagement/career-recommendations/me'), null).then((d) => d || Promise.reject(new Error('Career guidance is unavailable right now.'))));
  if (loading) return <div className="grid-3">{[0, 1, 2].map((i) => <Skeleton key={i} h={380} r={14} />)}</div>;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;
  const recs = data?.recommendations || [];
  return (
    <div className="stack gap-16">
      <div className="row gap-8 small muted"><Cpu size={14} /> Generated by the {data?.ai_provider === 'rule-based' ? 'rule-based engine' : data?.ai_provider} from {data?.analysis_basis?.toLowerCase()}</div>
      {recs.length === 0 ? <div className="card"><EmptyState icon={Compass} title="No recommendations yet" /></div> : (
        <div className="grid-auto" style={{ '--min': '320px' }}>
          {recs.map((r, i) => (
            <Card key={r.role} className={cx('rise', i === 0 && 'tint-accent')}>
              <div className="row gap-16" style={{ alignItems: 'flex-start' }}>
                <Ring value={r.fit_score} size={74} stroke={7}><span className="serif num" style={{ fontSize: 20 }}>{r.fit_score}</span></Ring>
                <div className="grow">
                  {i === 0 && <Badge tone="accent" style={{ marginBottom: 6 }}><Sparkles size={11} /> Best fit</Badge>}
                  <div className="serif" style={{ fontSize: 22, lineHeight: 1.15 }}>{r.role}</div>
                  <div className="xs muted row gap-4" style={{ marginTop: 6 }}><TrendingUp size={12} /> {r.market_demand}</div>
                </div>
              </div>
              {[['Strengths you bring', r.matching_strengths, 'success'], ['Areas to grow', r.growth_areas, 'warning'], ['Recommended certifications', r.recommended_certifications, 'info']].map(([t, xs, tone]) => (
                <div key={t} style={{ marginTop: 16 }}>
                  <div className="eyebrow" style={{ marginBottom: 8 }}>{t}</div>
                  <div className="row wrap gap-6">{(xs || []).map((x) => <Badge key={x} tone={tone}>{x}</Badge>)}</div>
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
