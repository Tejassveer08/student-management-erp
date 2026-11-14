import React, { useMemo, useState } from 'react';
import {
  FileText, Plus, Upload, Clock, CheckCircle2, AlertTriangle, Paperclip, ExternalLink, Users, Trash2, Send,
  FolderOpen, FileType2, Presentation, File, MessageSquare, GraduationCap, X,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi, asList } from '../lib/api';
import { useLoader, settle } from '../lib/hooks';
import { fmtDateTime, fmtDate, daysUntil, timeAgo, statusTone } from '../lib/format';
import {
  PageHeader, Card, Badge, Tabs, Modal, Field, EmptyState, ErrorState, PageSkeleton, Chips, SearchInput, Callout, Skeleton, Stat, useToast,
} from '../components/ui';

const dueBadge = (d) => {
  const n = daysUntil(d);
  if (n == null) return null;
  if (n < 0) return <Badge tone="danger"><Clock size={11} /> Closed {-n}d ago</Badge>;
  if (n === 0) return <Badge tone="warning"><Clock size={11} /> Due today</Badge>;
  if (n <= 3) return <Badge tone="warning"><Clock size={11} /> {n}d left</Badge>;
  return <Badge><Clock size={11} /> {n}d left</Badge>;
};

const fileIcon = (t = '') => (/ppt/i.test(t) ? Presentation : /pdf/i.test(t) ? FileType2 : File);

export default function AssignmentsView() {
  const { user, hasPermission } = useAuth();
  const staff = user?.role === 'admin' || user?.role === 'faculty';
  const isStudent = user?.role === 'student';
  const canCreate = hasPermission('assignments', 'create');
  const [tab, setTab] = useState('assignments');
  const [filter, setFilter] = useState('all');
  const [subject, setSubject] = useState('');
  const [q, setQ] = useState('');
  const [submitFor, setSubmitFor] = useState(null);
  const [gradeFor, setGradeFor] = useState(null);
  const [create, setCreate] = useState(false);
  const [upload, setUpload] = useState(false);
  const [del, setDel] = useState(null);
  const call = useApi();
  const toast = useToast();
  const { facultyProfile } = useAuth();

  const { data, loading, error, hardReload, reload } = useLoader((api) => Promise.all([
    api('/assignments?semester=4'),
    settle(api('/assignments/study-materials'), []),
  ]));
  const list = asList(data?.[0]);
  const materials = asList(data?.[1]);

  const statusOf = (a) => {
    if (a.my_submission) return a.my_submission.status === 'Graded' ? 'graded' : 'submitted';
    return daysUntil(a.due_date) < 0 ? 'overdue' : 'pending';
  };

  const filtered = useMemo(() => list.filter((a) => {
    if (subject && a.subject_code !== subject) return false;
    if (q && !`${a.title} ${a.subject_name}`.toLowerCase().includes(q.toLowerCase())) return false;
    if (filter === 'all') return true;
    if (isStudent) return statusOf(a) === filter;
    if (filter === 'mine') return a.faculty_id === facultyProfile?.id;
    if (filter === 'open') return daysUntil(a.due_date) >= 0;
    if (filter === 'closed') return daysUntil(a.due_date) < 0;
    return true;
  }).sort((a, b) => new Date(a.due_date) - new Date(b.due_date)), [list, subject, q, filter, isStudent, facultyProfile]); // eslint-disable-line react-hooks/exhaustive-deps

  const subjects = [...new Map(list.map((a) => [a.subject_code, a.subject_name])).entries()];
  const counts = list.reduce((m, a) => ({ ...m, [statusOf(a)]: (m[statusOf(a)] || 0) + 1 }), {});

  const doDelete = async () => {
    try {
      await call(`/assignments/${del.id}`, { method: 'DELETE' });
      toast.success('Assignment deleted');
      setDel(null);
      reload();
    } catch (e) { toast.error(e.message); }
  };

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;

  return (
    <>
      <PageHeader
        eyebrow="Coursework"
        title={<>Assignments & <em>notes</em></>}
        description={isStudent ? 'Everything due this semester, your submissions and grades, and lecture notes from your faculty.' : 'Publish assignments, grade submissions and share lecture material with your sections.'}
        actions={<>
          {canCreate && <button className="btn btn-ghost" onClick={() => setUpload(true)}><Upload size={15} /> Share notes</button>}
          {canCreate && <button className="btn btn-accent" onClick={() => setCreate(true)}><Plus size={15} /> New assignment</button>}
        </>}
      />

      {isStudent && (
        <div className="grid-4" style={{ marginBottom: 16 }}>
          <Stat label="To do" value={counts.pending || 0} icon={Clock} tone="accent" />
          <Stat label="Overdue" value={counts.overdue || 0} icon={AlertTriangle} tone={counts.overdue ? 'danger' : 'success'} />
          <Stat label="Awaiting grade" value={counts.submitted || 0} icon={Send} tone="info" />
          <Stat label="Graded" value={counts.graded || 0} icon={CheckCircle2} tone="success" />
        </div>
      )}

      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'assignments', label: 'Assignments', icon: FileText, count: list.length },
        { id: 'materials', label: 'Study material', icon: FolderOpen, count: materials.length },
      ]} />

      {tab === 'assignments' && (
        <>
          <div className="row-between wrap" style={{ gap: 10, marginBottom: 16 }}>
            <Chips value={filter} onChange={setFilter} options={isStudent
              ? [{ value: 'all', label: 'All', count: list.length }, { value: 'pending', label: 'To do', count: counts.pending || 0 }, { value: 'overdue', label: 'Overdue', count: counts.overdue || 0 }, { value: 'submitted', label: 'Submitted', count: counts.submitted || 0 }, { value: 'graded', label: 'Graded', count: counts.graded || 0 }]
              : [{ value: 'all', label: 'All' }, user?.role === 'faculty' && { value: 'mine', label: 'Created by me' }, { value: 'open', label: 'Open' }, { value: 'closed', label: 'Closed' }].filter(Boolean)} />
            <div className="row gap-8">
              <select className="select" style={{ width: 220 }} value={subject} onChange={(e) => setSubject(e.target.value)} aria-label="Subject">
                <option value="">All subjects</option>
                {subjects.map(([c, n]) => <option key={c} value={c}>{c} · {n}</option>)}
              </select>
              <SearchInput value={q} onChange={setQ} placeholder="Search" style={{ width: 200 }} />
            </div>
          </div>

          {filtered.length === 0 ? <div className="card"><EmptyState icon={FileText} title="No assignments here" description="Try another filter." /></div> : (
            <div className="grid-auto" style={{ '--min': '340px' }}>
              {filtered.map((a) => {
                const sub = a.my_submission;
                const st = statusOf(a);
                const own = staff && (user?.role === 'admin' || a.faculty_id === facultyProfile?.id);
                return (
                  <Card key={a.id} className="rise">
                    <div className="row-between" style={{ gap: 8 }}>
                      <Badge tone="accent">{a.subject_code}</Badge>
                      {dueBadge(a.due_date)}
                    </div>
                    <div className="strong" style={{ fontSize: 15.5, marginTop: 12, lineHeight: 1.35 }}>{a.title}</div>
                    <p className="small muted clamp-3" style={{ marginTop: 6 }}>{a.description}</p>
                    <div className="row gap-12 wrap xs muted" style={{ marginTop: 12 }}>
                      <span>{a.subject_name}</span>
                      <span>· {a.max_marks} marks</span>
                      <span>· {a.faculty_name}</span>
                    </div>
                    <div className="xs faint" style={{ marginTop: 2 }}>Due {fmtDateTime(a.due_date)}</div>

                    {isStudent && sub && (
                      <div className="tile-sm" style={{ marginTop: 14 }}>
                        <div className="row-between">
                          <Badge tone={statusTone(sub.status)} dot>{sub.status}</Badge>
                          {sub.marks_obtained != null && <span className="serif num" style={{ fontSize: 22 }}>{sub.marks_obtained}<span className="muted" style={{ fontSize: 13 }}> / {a.max_marks}</span></span>}
                        </div>
                        {sub.faculty_feedback && <div className="small ink-2 row gap-6" style={{ marginTop: 8, alignItems: 'flex-start' }}><MessageSquare size={13} style={{ marginTop: 3, flexShrink: 0 }} className="muted" />{sub.faculty_feedback}</div>}
                        <div className="xs faint" style={{ marginTop: 6 }}>Submitted {timeAgo(sub.submitted_at)}</div>
                      </div>
                    )}

                    <div className="row gap-6 wrap" style={{ marginTop: 14 }}>
                      {a.attachment_url && <a className="btn btn-ghost btn-sm" href={a.attachment_url} target="_blank" rel="noreferrer"><Paperclip size={13} /> Brief</a>}
                      {isStudent && st !== 'graded' && <button className={`btn btn-sm ${sub ? 'btn-ghost' : 'btn-accent'}`} onClick={() => setSubmitFor(a)}><Send size={13} /> {sub ? 'Resubmit' : st === 'overdue' ? 'Submit late' : 'Submit'}</button>}
                      {staff && <button className="btn btn-outline btn-sm" onClick={() => setGradeFor(a)} disabled={!own} title={!own ? 'Only the creating faculty can grade' : undefined}><Users size={13} /> {a.total_submissions || 0} submissions</button>}
                      {own && hasPermission('assignments', 'delete') && <button className="btn btn-quiet btn-sm" style={{ marginLeft: 'auto', color: 'var(--danger)' }} onClick={() => setDel(a)} aria-label="Delete"><Trash2 size={13} /></button>}
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </>
      )}

      {tab === 'materials' && <Materials materials={materials} onChanged={reload} />}

      <SubmitModal a={submitFor} onClose={() => setSubmitFor(null)} onDone={() => { setSubmitFor(null); reload(); }} />
      {staff && <GradeModal a={gradeFor} onClose={() => setGradeFor(null)} onChanged={reload} />}
      {canCreate && <CreateModal open={create} onClose={() => setCreate(false)} onDone={() => { setCreate(false); reload(); }} />}
      {canCreate && <UploadModal open={upload} onClose={() => setUpload(false)} onDone={() => { setUpload(false); reload(); setTab('materials'); }} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete assignment?" size="sm" icon={Trash2}
        footer={<><button className="btn btn-ghost" onClick={() => setDel(null)}>Cancel</button><button className="btn btn-danger" onClick={doDelete}>Delete</button></>}>
        <p className="ink-2"><b>{del?.title}</b> and its submissions will be removed for all students.</p>
      </Modal>
    </>
  );
}

const ACCEPT = '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.csv,.txt,.md,.zip,.png,.jpg,.jpeg,.ipynb,.py,.c,.cpp,.java,.js,.sql';
const prettySize = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);

function FilePicker({ file, onChange, label = 'Attach a file', hint = 'PDF, Office, ZIP, images or code · up to 15 MB' }) {
  const ref = React.useRef(null);
  return (
    <div className="tile row gap-12" style={{ borderStyle: 'dashed', cursor: 'pointer' }} onClick={() => ref.current?.click()}
      onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); if (e.dataTransfer.files[0]) onChange(e.dataTransfer.files[0]); }}>
      <span className="stat-icon" style={{ background: 'var(--accent-soft)', color: 'var(--accent)' }}><Upload size={16} /></span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="strong small truncate">{file ? file.name : label}</div>
        <div className="xs muted">{file ? prettySize(file.size) : hint}</div>
      </div>
      {file && <button type="button" className="icon-btn" aria-label="Remove file" onClick={(e) => { e.stopPropagation(); onChange(null); if (ref.current) ref.current.value = ''; }}><X size={15} /></button>}
      <input ref={ref} type="file" accept={ACCEPT} hidden onChange={(e) => onChange(e.target.files?.[0] || null)} />
    </div>
  );
}

function Materials({ materials, onChanged }) {
  const { user, hasPermission } = useAuth();
  const call = useApi();
  const toast = useToast();
  const remove = async (m) => {
    try {
      await call(`/assignments/study-materials/${m.id}`, { method: 'DELETE' });
      toast.success('Removed');
      onChanged?.();
    } catch (e) { toast.error(e.message); }
  };
  const canDelete = (m) => hasPermission('assignments', 'delete') && (user?.role === 'admin' || m.uploaded_by === user?.fullName);
  const [q, setQ] = useState('');
  const groups = useMemo(() => {
    const m = {};
    materials.filter((x) => !q || `${x.title} ${x.subject_name} ${x.unit_name}`.toLowerCase().includes(q.toLowerCase()))
      .forEach((x) => { (m[x.subject_code] = m[x.subject_code] || { name: x.subject_name, items: [] }).items.push(x); });
    return Object.entries(m).sort();
  }, [materials, q]);
  return (
    <div className="stack gap-16">
      <SearchInput value={q} onChange={setQ} placeholder="Search notes, units or subjects" style={{ maxWidth: 420 }} />
      {groups.length === 0 ? <div className="card"><EmptyState icon={FolderOpen} title="No material found" /></div> : groups.map(([code, g]) => (
        <Card key={code} flush title={g.name} subtitle={<span className="mono">{code}</span>} icon={FolderOpen} actions={<Badge>{g.items.length} file{g.items.length > 1 ? 's' : ''}</Badge>}>
          <div className="list">
            {g.items.map((m) => {
              const Icon = fileIcon(m.file_type);
              return (
                <div key={m.id} className="list-item">
                  <span className="stat-icon" style={{ background: /ppt/i.test(m.file_type) ? 'var(--warning-soft)' : 'var(--danger-soft)', color: /ppt/i.test(m.file_type) ? 'var(--warning)' : 'var(--danger)' }}><Icon size={15} /></span>
                  <div className="grow">
                    <div className="list-title">{m.title}</div>
                    <div className="list-meta">{m.unit_name} · {m.uploaded_by} · {fmtDate(m.uploaded_at)}</div>
                  </div>
                  <span className="mono xs muted desktop-only">{m.file_type} · {m.file_size}</span>
                  <a className="btn btn-ghost btn-sm" href={m.file_url} target="_blank" rel="noreferrer"><ExternalLink size={13} /> Open</a>
                  {canDelete(m) && <button className="btn btn-quiet btn-sm" style={{ color: 'var(--danger)' }} onClick={() => remove(m)} aria-label="Remove"><Trash2 size={13} /></button>}
                </div>
              );
            })}
          </div>
        </Card>
      ))}
    </div>
  );
}

function SubmitModal({ a, onClose, onDone }) {
  const call = useApi();
  const toast = useToast();
  const [text, setText] = useState('');
  const [url, setUrl] = useState('');
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const late = a && daysUntil(a.due_date) < 0;
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = new FormData();
      body.append('submissionText', text);
      body.append('fileUrl', url);
      if (file) body.append('file', file);
      const r = await call(`/assignments/${a.id}/submit`, { method: 'POST', body });
      toast.success(r?.message || 'Assignment submitted');
      setText(''); setUrl(''); setFile(null);
      onDone();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!a} onClose={onClose} title="Submit assignment" subtitle={a?.title} icon={Send}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" type="submit" form="sub-form" disabled={busy || (!text.trim() && !url.trim() && !file)}>{busy ? 'Uploading…' : 'Submit'}</button></>}>
      <form id="sub-form" onSubmit={submit} className="stack gap-12">
        {late && <Callout tone="warning">The deadline has passed — this submission will be recorded as late.</Callout>}
        {a?.my_submission?.file_url && <Callout tone="info">You already submitted. Uploading again replaces your earlier file.</Callout>}
        <FilePicker file={file} onChange={setFile} label="Upload your work" />
        <Field label="…or link to it" hint="Google Drive, GitHub or any shareable URL"><input className="input" type="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" /></Field>
        <Field label="Notes for your teacher"><textarea className="textarea" value={text} onChange={(e) => setText(e.target.value)} placeholder="Anything they should know" /></Field>
      </form>
    </Modal>
  );
}

function GradeModal({ a, onClose, onChanged }) {
  const call = useApi();
  const toast = useToast();
  const [draft, setDraft] = useState({});
  const [busy, setBusy] = useState(null);
  const { data, loading, error, hardReload, reload } = useLoader((api) => (a ? api(`/assignments/${a.id}/submissions`) : Promise.resolve([])), [a?.id]);
  const subs = asList(data);

  const save = async (s) => {
    const d = draft[s.id] || {};
    setBusy(s.id);
    try {
      await call('/assignments/grade', { method: 'POST', body: { submissionId: s.id, marksObtained: Number(d.marks ?? s.marks_obtained), feedback: d.feedback ?? s.faculty_feedback ?? '' } });
      toast.success(`Graded ${s.student_name}`);
      reload();
      onChanged?.();
    } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <Modal open={!!a} onClose={onClose} title="Submissions" subtitle={a && `${a.title} · out of ${a.max_marks}`} icon={GraduationCap} size="xl">
      {loading ? <Skeleton h={240} /> : error ? <ErrorState error={error} onRetry={hardReload} /> : subs.length === 0 ? <EmptyState icon={Users} title="No submissions yet" /> : (
        <div className="stack gap-10">
          {subs.map((s) => {
            const d = draft[s.id] || {};
            return (
              <div key={s.id} className="tile">
                <div className="row-between wrap" style={{ gap: 10 }}>
                  <div>
                    <div className="strong">{s.student_name} <span className="mono xs muted">{s.roll_no}</span></div>
                    <div className="xs muted">Submitted {fmtDateTime(s.submitted_at)}</div>
                  </div>
                  <Badge tone={statusTone(s.status)} dot>{s.status}</Badge>
                </div>
                {s.submission_text && <p className="small ink-2" style={{ marginTop: 8 }}>{s.submission_text}</p>}
                {s.file_url && <a className="btn btn-ghost btn-sm" href={s.file_url} target="_blank" rel="noreferrer" style={{ marginTop: 8 }}><Paperclip size={12} /> {s.file_name || (s.file_url.startsWith('/api/uploads') ? 'Open submitted file' : 'Open link')}</a>}
                <div className="row gap-8 wrap" style={{ marginTop: 12 }}>
                  <input className="input input-sm mono" style={{ width: 90 }} type="number" min="0" max={a.max_marks} step="0.5" placeholder="Marks"
                    value={d.marks ?? s.marks_obtained ?? ''} onChange={(e) => setDraft((x) => ({ ...x, [s.id]: { ...d, marks: e.target.value } }))} aria-label="Marks" />
                  <input className="input input-sm grow" style={{ minWidth: 200 }} placeholder="Feedback"
                    value={d.feedback ?? s.faculty_feedback ?? ''} onChange={(e) => setDraft((x) => ({ ...x, [s.id]: { ...d, feedback: e.target.value } }))} aria-label="Feedback" />
                  <button className="btn btn-primary btn-sm" onClick={() => save(s)} disabled={busy === s.id || (d.marks ?? s.marks_obtained) == null || (d.marks ?? s.marks_obtained) === ''}>
                    {busy === s.id ? 'Saving…' : s.status === 'Graded' ? 'Update' : 'Grade'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Modal>
  );
}

function useSubjectOptions(open) {
  const { user } = useAuth();
  const isFaculty = user?.role === 'faculty';
  const q = useLoader(async (api) => {
    if (!open) return [];
    if (isFaculty) {
      const cl = (await api('/dashboard/summary'))?.assigned_classes || [];
      return [...new Map(cl.map((c) => [c.subject_id, { id: c.subject_id, label: `${c.subject_code} · ${c.subject_name}` }])).values()];
    }
    return asList(await api('/academics/subjects')).map((s) => ({ id: s.id, label: `Sem ${s.semester} · ${s.code} · ${s.name}` }));
  }, [open, isFaculty]);
  return asList(q.data);
}

function CreateModal({ open, onClose, onDone }) {
  const call = useApi();
  const toast = useToast();
  const subjects = useSubjectOptions(open);
  const [f, setF] = useState(() => {
    const week = new Date(Date.now() + 7 * 86400000);
    week.setMinutes(week.getMinutes() - week.getTimezoneOffset());
    return { subjectId: '', title: '', description: '', maxMarks: 20, dueDate: week.toISOString().slice(0, 10), attachmentUrl: '' };
  });
  const [busy, setBusy] = useState(false);
  const [file, setFile] = useState(null);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries({ ...f, subjectId: f.subjectId || subjects[0]?.id }).forEach(([k, v]) => body.append(k, v ?? ''));
      if (file) body.append('file', file);
      const r = await call('/assignments', { method: 'POST', body });
      toast.success(r?.message || 'Assignment published');
      setF((x) => ({ ...x, title: '', description: '', attachmentUrl: '' }));
      setFile(null);
      onDone();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="New assignment" icon={Plus} size="lg"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" type="submit" form="asg-form" disabled={busy || !subjects.length}>{busy ? 'Publishing…' : 'Publish'}</button></>}>
      <form id="asg-form" onSubmit={submit} className="form-grid">
        <Field label="Subject" className="full"><select className="select" value={f.subjectId} onChange={set('subjectId')}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
        <Field label="Title" className="full"><input className="input" required value={f.title} onChange={set('title')} placeholder="e.g. Implement Dijkstra with a binary heap" /></Field>
        <Field label="Instructions" className="full"><textarea className="textarea" value={f.description} onChange={set('description')} /></Field>
        <Field label="Maximum marks"><input className="input" type="number" min="1" max="100" value={f.maxMarks} onChange={set('maxMarks')} /></Field>
        <Field label="Due date" hint="Accepted until 11:59 pm"><input className="input" type="date" required value={f.dueDate} onChange={set('dueDate')} /></Field>
        <div className="full"><FilePicker file={file} onChange={setFile} label="Attach a brief or dataset (optional)" /></div>
      </form>
    </Modal>
  );
}

function UploadModal({ open, onClose, onDone }) {
  const call = useApi();
  const toast = useToast();
  const subjects = useSubjectOptions(open);
  const [f, setF] = useState({ subjectId: '', title: '', unitName: '', fileUrl: '' });
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      const body = new FormData();
      Object.entries({ ...f, subjectId: f.subjectId || subjects[0]?.id }).forEach(([k, v]) => body.append(k, v ?? ''));
      if (file) body.append('file', file);
      const r = await call('/assignments/study-materials', { method: 'POST', body });
      toast.success(r?.message || 'Notes shared');
      setF((x) => ({ ...x, title: '', unitName: '', fileUrl: '' }));
      setFile(null);
      onDone();
    } catch (err) { toast.error(err.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Share study material" icon={Upload}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" type="submit" form="mat-form" disabled={busy || !subjects.length || !f.title || (!file && !f.fileUrl)}>{busy ? 'Uploading…' : 'Share'}</button></>}>
      <form id="mat-form" onSubmit={submit} className="form-grid">
        <Field label="Subject" className="full"><select className="select" value={f.subjectId} onChange={set('subjectId')}>{subjects.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}</select></Field>
        <Field label="Title" className="full"><input className="input" required value={f.title} onChange={set('title')} /></Field>
        <Field label="Unit" className="full"><input className="input" value={f.unitName} onChange={set('unitName')} placeholder="Unit 2: Greedy algorithms" /></Field>
        <div className="full"><FilePicker file={file} onChange={setFile} label="Upload notes or slides" /></div>
        <Field label="…or share a link" className="full"><input className="input" type="url" value={f.fileUrl} onChange={set('fileUrl')} placeholder="https://" disabled={Boolean(file)} /></Field>
      </form>
    </Modal>
  );
}
