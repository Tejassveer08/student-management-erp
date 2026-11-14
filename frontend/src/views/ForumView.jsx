import React, { useEffect, useMemo, useState } from 'react';
import {
  MessagesSquare, Plus, Heart, CheckCircle2, CornerDownRight, Reply, Trash2, Send, BookOpen, Flag, Globe, X, ShieldCheck, ArrowLeft,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi, asList } from '../lib/api';
import { useLoader, useDebounced } from '../lib/hooks';
import { timeAgo } from '../lib/format';
import {
  PageHeader, Card, Badge, Avatar, Modal, Field, EmptyState, ErrorState, Segmented, SearchInput, Skeleton, useToast, cx,
} from '../components/ui';

const SCOPE = { general: ['General', Globe, 'neutral'], subject: ['Subject', BookOpen, 'info'], society: ['Society', Flag, 'violet'] };
const roleTone = (r) => (r === 'faculty' ? 'success' : r === 'admin' ? 'accent' : 'neutral');

export default function ForumView() {
  const { user } = useAuth();
  const call = useApi();
  const toast = useToast();
  const [scope, setScope] = useState('all');
  const [subject, setSubject] = useState('');
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 300);
  const [sel, setSel] = useState(null);
  const [ask, setAsk] = useState(false);
  const [del, setDel] = useState(null);

  const subjects = useLoader((api) => api('/forum/my-subjects').catch(() => []));
  const threads = useLoader((api) => {
    const p = new URLSearchParams();
    if (scope !== 'all') p.set('scope', scope);
    if (subject) p.set('subjectId', subject);
    if (dq.trim()) p.set('search', dq.trim());
    return api(`/forum/threads?${p}`);
  }, [scope, subject, dq]);
  const detail = useLoader((api) => (sel ? api(`/forum/threads/${sel}`) : Promise.resolve(null)), [sel]);

  // live refresh
  useEffect(() => {
    const t = setInterval(() => { threads.reload(); if (sel) detail.reload(); }, 10000);
    return () => clearInterval(t);
  }, [sel, threads.reload, detail.reload]); // eslint-disable-line react-hooks/exhaustive-deps

  const list = asList(threads.data);

  const removeThread = async () => {
    try {
      await call(`/forum/threads/${del}`, { method: 'DELETE' });
      toast.success('Thread deleted');
      setDel(null);
      setSel(null);
      threads.reload();
    } catch (e) { toast.error(e.message); }
  };

  return (
    <>
      <PageHeader
        eyebrow="Community"
        title={<>Campus <em>forum</em></>}
        description="Ask subject doubts, talk to society coordinators and get answers verified by faculty."
        actions={<button className="btn btn-accent" onClick={() => setAsk(true)}><Plus size={15} /> Ask a question</button>}
      />

      <div className="grid-side" style={{ gridTemplateColumns: 'minmax(300px, 400px) minmax(0, 1fr)' }}>
        <Card flush className={cx(sel && 'forum-list-hidden')}>
          <div className="stack gap-8" style={{ padding: 14, borderBottom: '1px solid var(--line)' }}>
            <SearchInput value={q} onChange={setQ} placeholder="Search threads" size="sm" />
            <div className="row gap-8 wrap">
              <Segmented value={scope} onChange={(v) => { setScope(v); if (v !== 'subject') setSubject(''); }} options={[{ value: 'all', label: 'All' }, { value: 'general', label: 'General' }, { value: 'subject', label: 'Subject' }, { value: 'society', label: 'Society' }]} />
              {scope === 'subject' && (
                <select className="select select-sm" style={{ flex: 1, minWidth: 120 }} value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
                  <option value="">All subjects</option>
                  {asList(subjects.data).map((s) => <option key={s.id} value={s.id}>{s.code}</option>)}
                </select>
              )}
            </div>
          </div>
          <div className="list" style={{ maxHeight: 'calc(100vh - 300px)', minHeight: 300, overflowY: 'auto' }}>
            {threads.loading ? <div className="stack gap-8" style={{ padding: 14 }}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={64} />)}</div>
              : threads.error ? <div style={{ padding: 14 }}><ErrorState error={threads.error} onRetry={threads.hardReload} /></div>
                : list.length === 0 ? <EmptyState icon={MessagesSquare} title="No threads" description="Be the first to ask." />
                  : list.map((t) => {
                    const [label, Icon, tone] = SCOPE[t.scope] || SCOPE.general;
                    return (
                      <div key={t.id} className={cx('list-item clickable', sel === t.id && 'active')} onClick={() => setSel(t.id)} style={{ alignItems: 'flex-start', padding: '12px 14px' }}>
                        <Avatar src={t.author_avatar} name={t.author_name} size={32} />
                        <div className="grow">
                          <div className="list-title clamp-2">{t.title}</div>
                          <div className="row gap-6 wrap" style={{ marginTop: 6 }}>
                            <Badge tone={tone}><Icon size={10} /> {t.subject_code || t.society_name || label}</Badge>
                            {t.is_resolved ? <Badge tone="success"><CheckCircle2 size={10} /> Resolved</Badge> : null}
                          </div>
                          <div className="xs muted" style={{ marginTop: 6 }}>{t.author_name} · {timeAgo(t.last_activity_at || t.created_at)} · {t.post_count} {t.post_count === 1 ? 'reply' : 'replies'}</div>
                        </div>
                      </div>
                    );
                  })}
          </div>
        </Card>

        <div className={cx(!sel && 'forum-detail-hidden')}>
          {!sel ? (
            <div className="card"><EmptyState icon={MessagesSquare} title="Pick a thread" description="Select a discussion on the left, or start a new one." /></div>
          ) : detail.loading && !detail.data ? <Skeleton h={420} r={14} /> : detail.error ? <ErrorState error={detail.error} onRetry={detail.hardReload} /> : detail.data && (
            <Thread data={detail.data} user={user} onBack={() => setSel(null)} onDelete={() => setDel(sel)} reload={() => { detail.reload(); threads.reload(); }} />
          )}
        </div>
      </div>

      <AskModal open={ask} onClose={() => setAsk(false)} subjects={asList(subjects.data)} onDone={(id) => { setAsk(false); threads.reload(); if (id) setSel(id); }} />
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete thread?" size="sm" icon={Trash2}
        footer={<><button className="btn btn-ghost" onClick={() => setDel(null)}>Cancel</button><button className="btn btn-danger" onClick={removeThread}>Delete</button></>}>
        <p className="ink-2">The thread and all of its replies will be permanently removed.</p>
      </Modal>
    </>
  );
}

function Thread({ data, user, onBack, onDelete, reload }) {
  const call = useApi();
  const toast = useToast();
  const { hasPermission } = useAuth();
  const [body, setBody] = useState('');
  const [replyTo, setReplyTo] = useState(null);
  const [busy, setBusy] = useState(false);
  const t = data.thread;
  const posts = data.posts || [];
  const canVerify = hasPermission('forum', 'verify');
  const canReply = hasPermission('forum', 'reply');
  const canLike = hasPermission('forum', 'like');
  const canDelete = user?.role === 'admin' || t.author_id === user?.id;
  const [label, Icon, tone] = SCOPE[t.scope] || SCOPE.general;

  const tree = useMemo(() => {
    const kids = {};
    const roots = [];
    posts.forEach((p) => (p.parent_post_id ? (kids[p.parent_post_id] = kids[p.parent_post_id] || []).push(p) : roots.push(p)));
    return { roots, kids };
  }, [posts]);
  const opening = tree.roots[0];

  const act = async (fn, okMsg) => {
    try { await fn(); if (okMsg) toast.success(okMsg); reload(); } catch (e) { toast.error(e.message); }
  };

  const send = async (e) => {
    e.preventDefault();
    if (!body.trim()) return;
    setBusy(true);
    try {
      await call(`/forum/threads/${t.id}/posts`, { method: 'POST', body: { body, parentPostId: replyTo?.id || null } });
      setBody('');
      setReplyTo(null);
      reload();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };

  const renderPost = (p, depth) => (
    <div key={p.id} style={{ marginLeft: depth ? Math.min(depth, 3) * 22 : 0, marginTop: 12 }}>
      <div className="tile" style={p.is_faculty_answer === 1 ? { borderColor: 'color-mix(in srgb, var(--success) 40%, transparent)', background: 'var(--success-soft)' } : undefined}>
        <div className="row gap-8 wrap">
          {depth > 0 && <CornerDownRight size={13} className="faint" />}
          <Avatar src={p.author_avatar} name={p.author_name} size={24} />
          <span className="strong small">{p.author_name}</span>
          <Badge tone={roleTone(p.author_role)}>{p.author_role}</Badge>
          {p.is_faculty_answer === 1 && <Badge tone="success"><ShieldCheck size={11} /> Verified answer</Badge>}
          <span className="xs faint" style={{ marginLeft: 'auto' }}>{timeAgo(p.created_at)}</span>
        </div>
        <p style={{ marginTop: 8, whiteSpace: 'pre-wrap', lineHeight: 1.65 }} className="ink-2">{p.body}</p>
        <div className="row gap-4" style={{ marginTop: 8 }}>
          <button className={cx('btn btn-sm', p.user_has_liked ? 'btn-outline' : 'btn-quiet')} disabled={!canLike} onClick={() => act(() => call(`/forum/posts/${p.id}/like`, { method: 'POST' }))}>
            <Heart size={13} fill={p.user_has_liked ? 'currentColor' : 'none'} /> {p.like_count || 0}
          </button>
          {canReply && <button className="btn btn-quiet btn-sm" onClick={() => { setReplyTo(p); document.getElementById('forum-reply')?.focus(); }}><Reply size={13} /> Reply</button>}
          {canVerify && p !== opening && (
            <button className={cx('btn btn-sm', p.is_faculty_answer === 1 ? 'btn-success-soft' : 'btn-quiet')} onClick={() => act(() => call(`/forum/posts/${p.id}/verify`, { method: 'PUT' }), p.is_faculty_answer ? 'Verification removed' : 'Marked as verified answer')}>
              <CheckCircle2 size={13} /> {p.is_faculty_answer === 1 ? 'Verified' : 'Verify'}
            </button>
          )}
        </div>
      </div>
      {(tree.kids[p.id] || []).map((k) => renderPost(k, depth + 1))}
    </div>
  );

  return (
    <Card flush>
      <div style={{ padding: '18px 20px', borderBottom: '1px solid var(--line)' }}>
        <div className="row-between" style={{ gap: 10 }}>
          <div className="row gap-6 wrap">
            <button className="btn btn-quiet btn-sm forum-back" onClick={onBack}><ArrowLeft size={14} /> Threads</button>
            <Badge tone={tone}><Icon size={11} /> {t.subject_code ? `${t.subject_code} · ${t.subject_name}` : t.society_name || label}</Badge>
            {t.is_resolved ? <Badge tone="success"><CheckCircle2 size={11} /> Resolved</Badge> : <Badge tone="warning">Open</Badge>}
          </div>
          {canDelete && <button className="icon-btn" onClick={onDelete} aria-label="Delete thread" style={{ color: 'var(--danger)' }}><Trash2 size={16} /></button>}
        </div>
        <h2 className="serif" style={{ fontSize: 28, fontWeight: 400, lineHeight: 1.15, marginTop: 12 }}>{t.title}</h2>
        <div className="row gap-8 small muted" style={{ marginTop: 8 }}>
          <Avatar src={t.author_avatar} name={t.author_name} size={22} /> {t.author_name} · {timeAgo(t.created_at)}
        </div>
      </div>
      <div style={{ padding: '6px 20px 20px', maxHeight: 'calc(100vh - 420px)', minHeight: 200, overflowY: 'auto' }}>
        {tree.roots.length === 0 ? <EmptyState compact title="No messages yet" /> : tree.roots.map((p) => renderPost(p, 0))}
      </div>
      {canReply && (
        <form onSubmit={send} style={{ padding: 14, borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
          {replyTo && (
            <div className="row gap-6 xs muted" style={{ marginBottom: 8 }}>
              <CornerDownRight size={12} /> Replying to <b className="ink-2">{replyTo.author_name}</b>
              <button type="button" className="icon-btn" style={{ width: 22, height: 22 }} onClick={() => setReplyTo(null)} aria-label="Cancel reply"><X size={12} /></button>
            </div>
          )}
          <div className="row gap-8" style={{ alignItems: 'flex-end' }}>
            <textarea id="forum-reply" className="textarea" style={{ minHeight: 44, height: 44 }} value={body} onChange={(e) => setBody(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) send(e); }} placeholder="Write a reply… (Ctrl + Enter to send)" />
            <button className="btn btn-accent" type="submit" disabled={busy || !body.trim()}><Send size={15} /></button>
          </div>
        </form>
      )}
    </Card>
  );
}

function AskModal({ open, onClose, subjects, onDone }) {
  const call = useApi();
  const toast = useToast();
  const [f, setF] = useState({ scope: 'subject', subjectId: '', title: '', body: '' });
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await call('/forum/threads', { method: 'POST', body: { title: f.title, body: f.body, scope: f.scope, subjectId: f.scope === 'subject' ? Number(f.subjectId || subjects[0]?.id) : null } });
      toast.success('Question posted');
      setF((x) => ({ ...x, title: '', body: '' }));
      onDone(r?.threadId);
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Ask a question" subtitle="Subject questions are visible to that subject’s faculty and classmates." icon={MessagesSquare} size="lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" type="submit" form="ask-form" disabled={busy}>{busy ? 'Posting…' : 'Post question'}</button></>}>
      <form id="ask-form" className="form-grid" onSubmit={submit}>
        <Field label="Where"><Segmented value={f.scope} onChange={(v) => setF((x) => ({ ...x, scope: v }))} options={[{ value: 'subject', label: 'Subject doubt' }, { value: 'general', label: 'General' }]} /></Field>
        {f.scope === 'subject' ? (
          <Field label="Subject"><select className="select" value={f.subjectId} onChange={set('subjectId')}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.code} · {s.name}</option>)}</select></Field>
        ) : <div />}
        <Field label="Title" className="full"><input className="input" required value={f.title} onChange={set('title')} placeholder="Summarise your question in one line" /></Field>
        <Field label="Details" className="full"><textarea className="textarea" style={{ minHeight: 160 }} required value={f.body} onChange={set('body')} placeholder="What have you tried? Where are you stuck?" /></Field>
      </form>
    </Modal>
  );
}
