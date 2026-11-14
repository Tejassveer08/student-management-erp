import React, { useState } from 'react';
import { Briefcase, MapPin, IndianRupee, Trophy, Building2, CalendarClock, CheckCircle2, Lock, Plus, Send, TrendingUp, Award, Users } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { useAuth } from '../context/AuthContext';
import { useApi, asList } from '../lib/api';
import { useLoader, useChartColors, axisProps } from '../lib/hooks';
import { fmtDate, daysUntil, statusTone } from '../lib/format';
import {
  PageHeader, Card, Badge, Avatar, Modal, Field, EmptyState, ErrorState, PageSkeleton, Chips, Stat, ChartTip, Callout, Skeleton, useToast,
} from '../components/ui';

export default function PlacementsView() {
  const { user, studentProfile } = useAuth();
  const c = useChartColors();
  const isStudent = user?.role === 'student';
  const isAdmin = user?.role === 'admin';
  const [filter, setFilter] = useState('all');
  const [apply, setApply] = useState(null);
  const [pipeline, setPipeline] = useState(null);
  const [create, setCreate] = useState(false);

  const { data, loading, error, hardReload, reload } = useLoader((api) => Promise.all([api('/placements/drives'), api('/placements/stats')]));
  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;
  const drives = asList(data[0]);
  const st = data[1] || {};

  const shown = drives.filter((d) => {
    if (filter === 'eligible') return d.is_eligible;
    if (filter === 'applied') return d.has_applied;
    if (filter === 'open') return d.status !== 'Closed';
    return true;
  }).sort((a, b) => new Date(b.drive_date) - new Date(a.drive_date));
  const ctcData = [...drives].sort((a, b) => b.ctc_lpa - a.ctc_lpa).slice(0, 8).map((d) => ({ name: d.company_name.replace(/ (India|Platforms.*|Analytics|Instruments)$/, ''), ctc: d.ctc_lpa }));
  const applied = drives.filter((d) => d.has_applied);

  return (
    <>
      <PageHeader
        eyebrow="Training & placement cell"
        title={<>Placement <em>drives</em></>}
        description="Department-targeted opportunities with eligibility checked against your CGPA, one-click applications and live status."
        actions={isAdmin && <button className="btn btn-accent" onClick={() => setCreate(true)}><Plus size={15} /> New drive</button>}
      />

      <div className="grid-4" style={{ marginBottom: 16 }}>
        <Stat label="Highest package" value={st.highest_package_lpa || '—'} unit="LPA" icon={Trophy} tone="warning" hint={st.basis} />
        <Stat label="Average package" value={st.average_package_lpa || '—'} unit="LPA" icon={TrendingUp} tone="accent" hint={st.basis} />
        <Stat label="Drives this season" value={st.total_drives ?? drives.length} icon={Briefcase} tone="info" hint={`${st.open_drives ?? 0} open now`} />
        <Stat label="Offers made" value={st.total_offers ?? 0} icon={Award} tone="success" hint={`${st.total_applications ?? 0} applications`} />
      </div>

      <div className="grid-main" style={{ marginBottom: 16 }}>
        <Card title="Packages on offer" subtitle="Top CTC by company (LPA)" icon={IndianRupee}>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={ctcData} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
              <XAxis dataKey="name" {...axisProps(c)} interval={0} tick={{ fill: c.muted, fontSize: 10.5 }} />
              <YAxis {...axisProps(c)} />
              <Tooltip content={<ChartTip format={(v) => `${v} LPA`} />} cursor={{ fill: c.sunken }} />
              <Bar dataKey="ctc" name="CTC" radius={[4, 4, 0, 0]} barSize={26}>
                {ctcData.map((d, i) => <Cell key={i} fill={i === 0 ? c.saffron : c.accent} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </Card>
        <Card flush title={isStudent ? 'My applications' : 'Top recruiters'} icon={isStudent ? Send : Building2}>
          {isStudent ? (
            applied.length === 0 ? <EmptyState compact icon={Send} title="No applications yet" description="Apply to an eligible drive below." /> : (
              <div className="list">
                {applied.map((d) => (
                  <div key={d.id} className="list-item">
                    <Avatar src={d.company_logo} name={d.company_name} size={32} square className="logo" />
                    <div className="grow"><div className="list-title">{d.company_name}</div><div className="list-meta">{d.role_title}</div></div>
                    <Badge tone={statusTone(d.application_status) === 'neutral' ? 'info' : statusTone(d.application_status)} dot>{d.application_status}</Badge>
                  </div>
                ))}
              </div>
            )
          ) : (
            <div className="list">
              {(st.top_recruiters || []).map((r, i) => (
                <div key={r.name} className="list-item">
                  <span className="mono xs faint" style={{ width: 18 }}>{i + 1}</span>
                  <div className="grow"><div className="list-title">{r.name}</div><div className="list-meta">{r.hires} hires</div></div>
                  <span className="mono strong small">{r.ctc}</span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <div className="row-between wrap" style={{ marginBottom: 14, gap: 10 }}>
        <Chips value={filter} onChange={setFilter} options={[
          { value: 'all', label: 'All drives', count: drives.length },
          { value: 'open', label: 'Open' },
          isStudent && { value: 'eligible', label: 'Eligible for me', count: drives.filter((d) => d.is_eligible).length },
          isStudent && { value: 'applied', label: 'Applied', count: applied.length },
        ].filter(Boolean)} />
        {isStudent && <span className="small muted">Your CGPA: <b className="mono ink-2">{studentProfile?.current_cgpa}</b></span>}
      </div>

      {shown.length === 0 ? <div className="card"><EmptyState icon={Briefcase} title="No drives here" /></div> : (
        <div className="grid-auto" style={{ '--min': '340px' }}>
          {shown.map((d) => {
            const left = daysUntil(d.deadline);
            const closed = left < 0 || d.status === 'Closed';
            return (
              <Card key={d.id} className="rise">
                <div className="row gap-12" style={{ alignItems: 'flex-start' }}>
                  <div style={{ width: 48, height: 48, background: '#fff', border: '1px solid var(--line)', display: 'grid', placeItems: 'center', padding: 8, flexShrink: 0 }}>
                    <Avatar src={d.company_logo} name={d.company_name} size={32} square className="logo" />
                  </div>
                  <div className="grow">
                    <div className="strong" style={{ fontSize: 15.5 }}>{d.company_name}</div>
                    <div className="small muted">{d.role_title}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div className="serif num" style={{ fontSize: 26, lineHeight: 1 }}>{d.ctc_lpa}</div>
                    <div className="xs muted">LPA</div>
                  </div>
                </div>
                <p className="small ink-2 clamp-3" style={{ marginTop: 12 }}>{d.description}</p>
                <div className="row wrap gap-6" style={{ marginTop: 12 }}>
                  <Badge><MapPin size={11} /> {d.job_location}</Badge>
                  <Badge>Min CGPA {d.eligibility_min_cgpa}</Badge>
                  <Badge tone={d.status === 'Active' ? 'success' : d.status === 'Upcoming' ? 'info' : 'neutral'} dot>{d.status}</Badge>
                  {isAdmin && <Badge tone="accent">{d.applicants ?? 0} applicants</Badge>}
                </div>
                <div className="tile-sm row-between" style={{ marginTop: 14 }}>
                  <div className="xs"><div className="muted">Apply by</div><div className="strong">{fmtDate(d.deadline)}</div></div>
                  <div className="xs" style={{ textAlign: 'right' }}><div className="muted">Drive date</div><div className="strong">{fmtDate(d.drive_date)}</div></div>
                </div>
                {isAdmin && (
                  <div className="row gap-8" style={{ marginTop: 14 }}>
                    <button className="btn btn-outline btn-sm" onClick={() => setPipeline(d)}><Users size={13} /> Manage applicants</button>
                  </div>
                )}
                {isStudent && d.application_feedback && <Callout tone="info" style={{ marginTop: 12 }}>{d.application_feedback}</Callout>}
                {isStudent && (
                  <div className="row-between" style={{ marginTop: 14 }}>
                    {d.has_applied ? <Badge tone="success"><CheckCircle2 size={11} /> Applied · {d.application_status}</Badge>
                      : !d.is_eligible ? <span className="xs muted row gap-4"><Lock size={12} /> Requires CGPA {d.eligibility_min_cgpa}</span>
                        : closed ? <span className="xs muted row gap-4"><CalendarClock size={12} /> Applications closed</span>
                          : <span className="xs t-success">{left === 0 ? 'Closes today' : `${left} days left`}</span>}
                    {!d.has_applied && <button className="btn btn-accent btn-sm" disabled={!d.is_eligible || closed} onClick={() => setApply(d)}><Send size={13} /> Apply</button>}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {isStudent && <ApplyModal drive={apply} onClose={() => setApply(null)} onDone={() => { setApply(null); reload(); }} />}
      {isAdmin && <CreateDrive open={create} onClose={() => setCreate(false)} onDone={() => { setCreate(false); reload(); }} />}
      {isAdmin && <Pipeline drive={pipeline} onClose={() => setPipeline(null)} onChanged={reload} />}
    </>
  );
}

function ApplyModal({ drive, onClose, onDone }) {
  const call = useApi();
  const toast = useToast();
  const [resume, setResume] = useState('');
  const [busy, setBusy] = useState(false);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await call('/placements/apply', { method: 'POST', body: { driveId: drive.id, resumeLink: resume } });
      toast.success(r?.message || `Applied to ${drive.company_name}`);
      setResume('');
      onDone();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!drive} onClose={onClose} title={`Apply to ${drive?.company_name || ''}`} subtitle={drive?.role_title} icon={Briefcase} size="sm"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" onClick={submit} disabled={busy || !resume.trim()}>{busy ? 'Submitting…' : 'Submit application'}</button></>}>
      <div className="stack gap-12">
        <Callout tone="success">You meet the minimum CGPA of {drive?.eligibility_min_cgpa} for this drive.</Callout>
        <Field label="Résumé link" hint="Google Drive or any public URL to your latest résumé PDF"><input className="input" type="url" value={resume} onChange={(e) => setResume(e.target.value)} placeholder="https://" autoFocus /></Field>
      </div>
    </Modal>
  );
}

function CreateDrive({ open, onClose, onDone }) {
  const call = useApi();
  const toast = useToast();
  const [f, setF] = useState({ companyName: '', companyLogo: '', roleTitle: '', jobLocation: '', ctcLpa: '', eligibilityMinCgpa: 7, driveDate: '', deadline: '', description: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await call('/placements/drives', { method: 'POST', body: { ...f, ctcLpa: Number(f.ctcLpa), eligibilityMinCgpa: Number(f.eligibilityMinCgpa) } });
      toast.success('Placement drive published');
      onDone();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="New placement drive" icon={Briefcase} size="lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" type="submit" form="drive-form" disabled={busy}>{busy ? 'Publishing…' : 'Publish drive'}</button></>}>
      <form id="drive-form" className="form-grid" onSubmit={submit}>
        <Field label="Company"><input className="input" required value={f.companyName} onChange={set('companyName')} /></Field>
        <Field label="Role"><input className="input" required value={f.roleTitle} onChange={set('roleTitle')} placeholder="SDE Intern" /></Field>
        <Field label="Location"><input className="input" value={f.jobLocation} onChange={set('jobLocation')} /></Field>
        <Field label="CTC (LPA)"><input className="input" type="number" step="0.1" required value={f.ctcLpa} onChange={set('ctcLpa')} /></Field>
        <Field label="Minimum CGPA"><input className="input" type="number" step="0.1" min="0" max="10" value={f.eligibilityMinCgpa} onChange={set('eligibilityMinCgpa')} /></Field>
        <Field label="Logo URL"><input className="input" type="url" value={f.companyLogo} onChange={set('companyLogo')} placeholder="https://" /></Field>
        <Field label="Application deadline"><input className="input" type="date" required value={f.deadline} onChange={set('deadline')} /></Field>
        <Field label="Drive date"><input className="input" type="date" required value={f.driveDate} onChange={set('driveDate')} /></Field>
        <Field label="Description" className="full"><textarea className="textarea" value={f.description} onChange={set('description')} /></Field>
      </form>
    </Modal>
  );
}

const STAGES = [['Applied', 'info'], ['Shortlisted', 'accent'], ['Interviewing', 'warning'], ['Selected', 'success'], ['Not_Selected', 'danger']];

/** Admin recruitment pipeline for one drive: move each applicant through the stages (students are notified) */
function Pipeline({ drive, onClose, onChanged }) {
  const call = useApi();
  const toast = useToast();
  const [busy, setBusy] = useState(null);
  const [notes, setNotes] = useState({});
  const { data, loading, error, hardReload, reload } = useLoader((api) => (drive ? api(`/placements/drives/${drive.id}/applications`) : Promise.resolve([])), [drive?.id]);
  const apps = asList(data);
  const move = async (a, status) => {
    setBusy(a.id);
    try {
      await call(`/placements/applications/${a.id}`, { method: 'PUT', body: { status, feedback: notes[a.id] || undefined } });
      toast.success(`${a.student_name} → ${status.replace('_', ' ')}`);
      reload();
      onChanged?.();
    } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };
  const closeDrive = async () => {
    try { await call(`/placements/drives/${drive.id}/close`, { method: 'PUT' }); toast.info('Applications closed'); onChanged?.(); onClose(); } catch (e) { toast.error(e.message); }
  };
  return (
    <Modal open={!!drive} onClose={onClose} title={drive ? `${drive.company_name} · applicants` : ''} subtitle={drive && `${drive.role_title} · ${drive.ctc_lpa} LPA · min CGPA ${drive.eligibility_min_cgpa}`} icon={Users} size="xl"
      footer={drive?.status !== 'Closed' ? <button className="btn btn-ghost" onClick={closeDrive}>Close applications</button> : null}>
      {loading ? <Skeleton h={240} /> : error ? <ErrorState error={error} onRetry={hardReload} /> : apps.length === 0 ? <EmptyState icon={Users} title="No applicants yet" /> : (
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Student</th><th className="right">CGPA</th><th>Resume</th><th>Stage</th><th>Note to student</th></tr></thead>
            <tbody>
              {apps.map((a) => (
                <tr key={a.id}>
                  <td><div className="strong">{a.student_name}</div><div className="xs muted mono">{a.roll_no} · {a.section}</div></td>
                  <td className="right mono">{a.current_cgpa}</td>
                  <td>{a.resume_link ? <a href={a.resume_link} target="_blank" rel="noreferrer" className="small">Open</a> : '—'}</td>
                  <td>
                    <select className="select select-sm" style={{ width: 150 }} value={a.status} disabled={busy === a.id} onChange={(e) => move(a, e.target.value)} aria-label={`Stage for ${a.student_name}`}>
                      {STAGES.map(([v]) => <option key={v} value={v}>{v.replace('_', ' ')}</option>)}
                    </select>
                  </td>
                  <td><input className="input input-sm" placeholder={a.feedback || 'Optional — sent with the next change'} value={notes[a.id] || ''} onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value }))} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  );
}
