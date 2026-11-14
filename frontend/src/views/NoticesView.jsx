import React, { useState } from 'react';
import { Megaphone, Pin, Plus, Trash2, Building2, Users, CalendarDays } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi, asList } from '../lib/api';
import { useLoader, useDebounced } from '../lib/hooks';
import { fmtDate, timeAgo } from '../lib/format';
import { PageHeader, Badge, Modal, Field, EmptyState, ErrorState, Chips, SearchInput, Skeleton, useToast } from '../components/ui';

const CATS = ['Urgent', 'Academic', 'Exam', 'Placement', 'Event', 'General'];
const toneOf = (c) => ({ Urgent: 'danger', Academic: 'info', Exam: 'violet', Placement: 'accent', Event: 'warning', Financial: 'success' })[c] || 'neutral';
const barOf = (c) => ({ Urgent: 'var(--danger)', Academic: 'var(--info)', Exam: 'var(--violet)', Placement: 'var(--accent)', Event: 'var(--warning)', Financial: 'var(--success)' })[c] || 'var(--line-strong)';

export default function NoticesView() {
  const { user } = useAuth();
  const call = useApi();
  const toast = useToast();
  const canPost = user?.role === 'admin' || user?.role === 'faculty';
  const [cat, setCat] = useState('');
  const [aud, setAud] = useState('All');
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 300);
  const [open, setOpen] = useState(null);
  const [compose, setCompose] = useState(false);
  const [del, setDel] = useState(null);

  const { data, loading, error, hardReload, reload } = useLoader((api) => {
    const p = new URLSearchParams();
    if (cat) p.set('category', cat);
    if (aud && aud !== 'All') p.set('audience', aud);
    if (dq) p.set('search', dq);
    return api(`/notices?${p}`);
  }, [cat, aud, dq]);

  const list = [...asList(data)].sort((a, b) => (b.is_pinned || 0) - (a.is_pinned || 0) || new Date(b.created_at) - new Date(a.created_at));
  const pinned = list.filter((n) => n.is_pinned);
  const rest = list.filter((n) => !n.is_pinned);

  const remove = async () => {
    try {
      await call(`/notices/${del.id}`, { method: 'DELETE' });
      toast.success('Notice removed');
      setDel(null);
      setOpen(null);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  const noticeCard = (n) => (
    <article key={n.id} className="card interactive rise" onClick={() => setOpen(n)} style={{ overflow: 'hidden' }}>
      <div style={{ height: 3, background: barOf(n.category) }} />
      <div style={{ padding: 18 }}>
        <div className="row-between">
          <div className="row gap-6">
            <Badge tone={toneOf(n.category)}>{n.category}</Badge>
            {n.is_pinned ? <Badge tone="saffron"><Pin size={10} /> Pinned</Badge> : null}
          </div>
          <span className="xs faint">{timeAgo(n.created_at)}</span>
        </div>
        <h3 style={{ fontSize: 16, marginTop: 12, lineHeight: 1.35 }}>{n.title}</h3>
        <p className="small muted clamp-3" style={{ marginTop: 6 }}>{n.content}</p>
        <div className="row gap-12 wrap xs muted" style={{ marginTop: 14 }}>
          <span className="strong ink-2">{n.posted_by}</span>
          <span className="row gap-4"><Users size={11} />{n.target_audience}</span>
          {n.department_code && <span className="row gap-4"><Building2 size={11} />{n.department_code}</span>}
        </div>
      </div>
    </article>
  );

  return (
    <>
      <PageHeader
        eyebrow="Communication"
        title={<>Notice <em>board</em></>}
        description="Official circulars from the Dean’s office, departments, accounts and the placement cell."
        actions={canPost && <button className="btn btn-accent" onClick={() => setCompose(true)}><Plus size={15} /> Post notice</button>}
      />
      <div className="row-between wrap" style={{ gap: 10, marginBottom: 18 }}>
        <Chips value={cat} onChange={setCat} options={[{ value: '', label: 'All' }, ...CATS.map((c) => ({ value: c, label: c }))]} />
        <div className="row gap-8">
          <select className="select" style={{ width: 140 }} value={aud} onChange={(e) => setAud(e.target.value)} aria-label="Audience">
            {['All', 'Students', 'Faculty', 'Parents'].map((a) => <option key={a} value={a}>{a === 'All' ? 'All audiences' : a}</option>)}
          </select>
          <SearchInput value={q} onChange={setQ} placeholder="Search notices" style={{ width: 240 }} />
        </div>
      </div>

      {loading ? <div className="grid-auto" style={{ '--min': '320px' }}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={190} r={14} />)}</div>
        : error ? <ErrorState error={error} onRetry={hardReload} />
          : list.length === 0 ? <div className="card"><EmptyState icon={Megaphone} title="No notices found" description="Try another category or clear the search." /></div> : (
            <div className="stack gap-24">
              {pinned.length > 0 && (
                <section>
                  <div className="eyebrow row gap-6" style={{ marginBottom: 10 }}><Pin size={12} /> Pinned</div>
                  <div className="grid-auto" style={{ '--min': '320px' }}>{pinned.map(noticeCard)}</div>
                </section>
              )}
              {rest.length > 0 && (
                <section>
                  {pinned.length > 0 && <div className="eyebrow" style={{ marginBottom: 10 }}>Latest</div>}
                  <div className="grid-auto" style={{ '--min': '320px' }}>{rest.map(noticeCard)}</div>
                </section>
              )}
            </div>
          )}

      <Modal open={!!open} onClose={() => setOpen(null)} title={open?.title} size="lg"
        subtitle={open && <span className="row gap-6 wrap"><Badge tone={toneOf(open.category)}>{open.category}</Badge><span>{open.posted_by}</span><span>· {fmtDate(open.created_at)}</span></span>}
        footer={open?.can_delete && <button className="btn btn-danger-soft" onClick={() => setDel(open)}><Trash2 size={14} /> Delete notice</button>}>
        {open && (
          <div className="stack gap-16">
            <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.75, fontSize: 15 }} className="ink-2">{open.content}</p>
            <div className="row gap-16 wrap xs muted">
              <span className="row gap-4"><Users size={12} /> Audience: {open.target_audience}</span>
              {open.department_name && <span className="row gap-4"><Building2 size={12} /> {open.department_name}</span>}
              <span className="row gap-4"><CalendarDays size={12} /> {new Date(open.created_at).toLocaleString('en-IN')}</span>
            </div>
          </div>
        )}
      </Modal>

      {canPost && <Compose open={compose} onClose={() => setCompose(false)} onDone={() => { setCompose(false); reload(); }} />}

      <Modal open={!!del} onClose={() => setDel(null)} title="Delete this notice?" size="sm" icon={Trash2}
        footer={<><button className="btn btn-ghost" onClick={() => setDel(null)}>Cancel</button><button className="btn btn-danger" onClick={remove}>Delete</button></>}>
        <p className="ink-2">“{del?.title}” will be removed from every notice board.</p>
      </Modal>
    </>
  );
}

function Compose({ open, onClose, onDone }) {
  const call = useApi();
  const toast = useToast();
  const { facultyProfile } = useAuth();
  const [f, setF] = useState({ title: '', content: '', category: 'Academic', targetAudience: 'All', isPinned: false });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await call('/notices', { method: 'POST', body: { ...f, isPinned: f.isPinned ? 1 : 0, departmentId: facultyProfile?.department_id || 1 } });
      toast.success('Notice published');
      setF({ title: '', content: '', category: 'Academic', targetAudience: 'All', isPinned: false });
      onDone();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Post a notice" icon={Megaphone} size="lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" type="submit" form="notice-form" disabled={busy}>{busy ? 'Publishing…' : 'Publish'}</button></>}>
      <form id="notice-form" className="form-grid" onSubmit={submit}>
        <Field label="Title" className="full"><input className="input" required value={f.title} onChange={set('title')} /></Field>
        <Field label="Category"><select className="select" value={f.category} onChange={set('category')}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
        <Field label="Audience"><select className="select" value={f.targetAudience} onChange={set('targetAudience')}>{['All', 'Students', 'Faculty', 'Parents'].map((a) => <option key={a}>{a}</option>)}</select></Field>
        <Field label="Message" className="full"><textarea className="textarea" style={{ minHeight: 160 }} required value={f.content} onChange={set('content')} /></Field>
        <label className="check full"><input type="checkbox" checked={f.isPinned} onChange={set('isPinned')} /> Pin to the top of every board</label>
      </form>
    </Modal>
  );
}

