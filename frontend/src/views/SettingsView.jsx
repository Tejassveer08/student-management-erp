import React, { useEffect, useMemo, useState } from 'react';
import { ShieldCheck, SlidersHorizontal, History, Save, RotateCcw, ChevronDown, Percent, Scale, Calendar, IndianRupee, Brain, User, Globe } from 'lucide-react';
import { useApi, asList } from '../lib/api';
import { useLoader } from '../lib/hooks';
import { fmtDateTime, timeAgo, titleCase } from '../lib/format';
import {
  PageHeader, Card, Badge, Tabs, Modal, Field, EmptyState, ErrorState, PageSkeleton, Chips, SearchInput, Callout, useToast, cx,
} from '../components/ui';

const ICONS = { attendance_threshold: Percent, grading_scale: Scale, cgpa_probability_weights: Brain, late_fee_per_day: IndianRupee, academic_session: Calendar };
const parse = (s) => {
  if (s.data_type === 'json') { try { return JSON.parse(s.setting_value); } catch { return s.setting_value; } }
  if (s.data_type === 'number') return Number(s.setting_value);
  if (s.data_type === 'boolean') return s.setting_value === 'true' || s.setting_value === '1';
  return s.setting_value;
};

export default function SettingsView() {
  const [tab, setTab] = useState('policies');
  const { data, loading, error, hardReload, reload } = useLoader((api) => Promise.all([api('/settings'), api('/settings/audit-logs?limit=200')]));
  if (loading) return <PageSkeleton stats={0} rows={2} />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;
  const settings = asList(data[0]);
  const logs = asList(data[1]);
  return (
    <>
      <PageHeader eyebrow="Administration" title={<>Governance & <em>audit</em></>}
        description="Institution-wide policies that drive attendance, grading, fines and the CGPA engine — every change is justified and permanently logged." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'policies', label: 'Policies', icon: SlidersHorizontal, count: settings.length },
        { id: 'audit', label: 'Audit trail', icon: History, count: logs.length },
      ]} />
      {tab === 'policies' ? (
        <div className="stack gap-16">
          {settings.map((s) => <SettingCard key={s.setting_key} s={s} onSaved={reload} />)}
        </div>
      ) : <AuditTrail logs={logs} />}
    </>
  );
}

function SettingCard({ s, onSaved }) {
  const call = useApi();
  const toast = useToast();
  const initial = useMemo(() => parse(s), [s]);
  const [val, setVal] = useState(initial);
  const [confirm, setConfirm] = useState(false);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { setVal(initial); }, [initial]);
  const dirty = JSON.stringify(val) !== JSON.stringify(initial);
  const Icon = ICONS[s.setting_key] || SlidersHorizontal;

  const save = async () => {
    setBusy(true);
    try {
      await call(`/settings/${s.setting_key}`, { method: 'PUT', body: { value: val, reason } });
      toast.success(`${titleCase(s.setting_key)} updated`);
      setConfirm(false);
      setReason('');
      onSaved();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Card>
      <div className="row gap-16 wrap" style={{ alignItems: 'flex-start' }}>
        <span className="stat-icon" style={{ width: 40, height: 40, background: 'var(--accent-soft)', color: 'var(--accent)' }}><Icon size={18} /></span>
        <div className="grow" style={{ minWidth: 260 }}>
          <div className="row gap-8 wrap">
            <span className="strong" style={{ fontSize: 15 }}>{titleCase(s.setting_key)}</span>
            <Badge>{s.category}</Badge>
            <span className="mono xs faint">{s.setting_key}</span>
          </div>
          <p className="small muted" style={{ marginTop: 4, maxWidth: 720 }}>{s.description}</p>
          <div style={{ marginTop: 14 }}><Editor s={s} val={val} setVal={setVal} /></div>
          <div className="xs faint row gap-6" style={{ marginTop: 12 }}><User size={11} /> Last changed by {s.updated_by || '—'} · {timeAgo(s.updated_at)}</div>
        </div>
        <div className="row gap-6" style={{ alignSelf: 'flex-start' }}>
          {dirty && <button className="btn btn-quiet btn-sm" onClick={() => setVal(initial)}><RotateCcw size={13} /> Reset</button>}
          <button className="btn btn-primary btn-sm" disabled={!dirty} onClick={() => setConfirm(true)}><Save size={13} /> Save</button>
        </div>
      </div>
      <Modal open={confirm} onClose={() => setConfirm(false)} title="Confirm policy change" subtitle={titleCase(s.setting_key)} icon={ShieldCheck}
        footer={<><button className="btn btn-ghost" onClick={() => setConfirm(false)}>Cancel</button><button className="btn btn-accent" onClick={save} disabled={busy || reason.trim().length < 5}>{busy ? 'Saving…' : 'Apply change'}</button></>}>
        <div className="stack gap-12">
          <Callout tone="warning">This affects every student immediately and is recorded in the audit trail.</Callout>
          <div className="grid-2" style={{ gap: 10 }}>
            <div><div className="eyebrow" style={{ marginBottom: 6 }}>Current</div><pre className="code-box">{fmtVal(initial)}</pre></div>
            <div><div className="eyebrow" style={{ marginBottom: 6 }}>New</div><pre className="code-box" style={{ borderColor: 'var(--accent-line)' }}>{fmtVal(val)}</pre></div>
          </div>
          <Field label="Reason for change" hint="Required — at least 5 characters"><textarea className="textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Academic council resolution dated …" autoFocus /></Field>
        </div>
      </Modal>
    </Card>
  );
}

const fmtVal = (v) => (typeof v === 'object' ? JSON.stringify(v, null, 2) : String(v));

function Editor({ s, val, setVal }) {
  if (s.setting_key === 'attendance_threshold') {
    return (
      <div className="row gap-16 wrap" style={{ maxWidth: 520 }}>
        <input type="range" min={50} max={95} step={0.5} value={val} onChange={(e) => setVal(Number(e.target.value))} style={{ flex: 1, minWidth: 200 }} aria-label="Threshold" />
        <div className="serif num" style={{ fontSize: 34, lineHeight: 1, width: 110 }}>{Number(val).toFixed(1)}<span className="muted" style={{ fontSize: 16 }}>%</span></div>
      </div>
    );
  }
  if (s.setting_key === 'cgpa_probability_weights' && val && typeof val === 'object') {
    const sum = Object.values(val).reduce((a, x) => a + Number(x || 0), 0);
    return (
      <div className="stack gap-10" style={{ maxWidth: 560 }}>
        {Object.entries(val).map(([k, v]) => (
          <div key={k} className="row gap-12">
            <span className="small" style={{ width: 150 }}>{titleCase(k.replace('_weight', ''))}</span>
            <input type="range" min={0} max={1} step={0.05} value={v} onChange={(e) => setVal({ ...val, [k]: Number(e.target.value) })} style={{ flex: 1 }} aria-label={k} />
            <span className="mono small" style={{ width: 40, textAlign: 'right' }}>{Number(v).toFixed(2)}</span>
          </div>
        ))}
        <div className={cx('xs', Math.abs(sum - 1) > 0.001 ? 't-warning' : 'muted')}>Weights sum to {sum.toFixed(2)}{Math.abs(sum - 1) > 0.001 && ' — they should add up to 1.00'}</div>
      </div>
    );
  }
  if (s.setting_key === 'grading_scale' && val && typeof val === 'object') {
    return (
      <div className="table-wrap" style={{ maxWidth: 560, border: '1px solid var(--line)' }}>
        <table className="tbl compact">
          <thead><tr><th>Grade</th><th>Label</th><th className="right">Min marks</th><th className="right">Points</th></tr></thead>
          <tbody>
            {Object.entries(val).map(([g, r]) => (
              <tr key={g}>
                <td className="mono strong">{g}</td>
                <td className="small">{r.label}</td>
                <td className="right"><input className="input input-sm mono" style={{ width: 80, textAlign: 'right' }} type="number" min={0} max={100} value={r.min} onChange={(e) => setVal({ ...val, [g]: { ...r, min: Number(e.target.value) } })} /></td>
                <td className="right"><input className="input input-sm mono" style={{ width: 70, textAlign: 'right' }} type="number" min={0} max={10} value={r.points} onChange={(e) => setVal({ ...val, [g]: { ...r, points: Number(e.target.value) } })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  if (s.data_type === 'boolean') {
    return <label className="check"><input type="checkbox" checked={!!val} onChange={(e) => setVal(e.target.checked)} /> Enabled</label>;
  }
  if (s.data_type === 'number') {
    return <input className="input mono" style={{ width: 180 }} type="number" value={val} onChange={(e) => setVal(Number(e.target.value))} />;
  }
  if (s.data_type === 'json') {
    return <textarea className="textarea mono" style={{ maxWidth: 560 }} value={typeof val === 'string' ? val : JSON.stringify(val, null, 2)} onChange={(e) => { try { setVal(JSON.parse(e.target.value)); } catch { setVal(e.target.value); } }} />;
  }
  return <input className="input" style={{ maxWidth: 320 }} value={val} onChange={(e) => setVal(e.target.value)} />;
}

function AuditTrail({ logs }) {
  const [action, setAction] = useState('');
  const [q, setQ] = useState('');
  const [open, setOpen] = useState(null);
  const actions = [...new Set(logs.map((l) => l.action))].sort();
  const list = logs.filter((l) => (!action || l.action === action) && (!q || `${l.user_email} ${l.reason} ${l.entity_type} ${l.entity_id}`.toLowerCase().includes(q.toLowerCase())));
  return (
    <Card flush>
      <div className="row-between wrap" style={{ padding: 14, gap: 10, borderBottom: '1px solid var(--line)' }}>
        <Chips value={action} onChange={setAction} options={[{ value: '', label: 'All actions', count: logs.length }, ...actions.map((a) => ({ value: a, label: titleCase(a), count: logs.filter((l) => l.action === a).length }))]} />
        <SearchInput value={q} onChange={setQ} placeholder="Search actor, reason, entity" size="sm" style={{ width: 260 }} />
      </div>
      {list.length === 0 ? <EmptyState icon={History} title="No audit entries" /> : (
        <div className="list">
          {list.map((l) => (
            <div key={l.id} style={{ borderTop: '1px solid var(--line)' }}>
              <button className="list-item clickable" style={{ width: '100%', border: 0, background: 'none', textAlign: 'left' }} onClick={() => setOpen(open === l.id ? null : l.id)} aria-expanded={open === l.id}>
                <span className="stat-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><ShieldCheck size={15} /></span>
                <div className="grow">
                  <div className="row gap-8 wrap"><span className="mono small strong">{l.action}</span><Badge tone="outline">{l.entity_type} #{l.entity_id}</Badge></div>
                  <div className="small ink-2 clamp-2" style={{ marginTop: 2 }}>{l.reason}</div>
                  <div className="xs muted" style={{ marginTop: 2 }}>{l.user_email} · {l.user_role} · {fmtDateTime(l.created_at)}</div>
                </div>
                <ChevronDown size={16} className="muted" style={{ transform: open === l.id ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
              </button>
              {open === l.id && (
                <div className="grid-2 rise" style={{ padding: '0 18px 16px 60px', gap: 10 }}>
                  <div><div className="eyebrow" style={{ marginBottom: 6 }}>Before</div><pre className="code-box">{l.old_value ? fmtVal(l.old_value) : '—'}</pre></div>
                  <div><div className="eyebrow" style={{ marginBottom: 6 }}>After</div><pre className="code-box" style={{ borderColor: 'var(--accent-line)' }}>{l.new_value ? fmtVal(l.new_value) : '—'}</pre></div>
                  <div className="xs faint span-2 row gap-4"><Globe size={11} /> {l.ip_address || 'unknown IP'}</div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
