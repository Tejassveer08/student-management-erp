import React, { useEffect, useMemo, useState } from 'react';
import { BookOpen, BedDouble, Library, BookMarked, Undo2, Plus, AlertTriangle, Users, Building, Clock, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useApi, asList } from '../lib/api';
import { useLoader, useDebounced } from '../lib/hooks';
import { fmtDate, daysUntil, inr, statusTone } from '../lib/format';
import { SECTIONS } from '../config/campus';
import {
  PageHeader, Card, Badge, Progress, Tabs, Modal, Field, EmptyState, ErrorState, Chips, SearchInput, Skeleton, Stat, Callout, Segmented, useToast,
} from '../components/ui';

export default function LibraryHostelView() {
  const [tab, setTab] = useState('library');
  return (
    <>
      <PageHeader eyebrow="Campus services" title={<>Library & <em>hostel</em></>}
        description="Search the central library, track borrowed books and fines, and see hostel blocks and room allocations." />
      <Tabs value={tab} onChange={setTab} tabs={[
        { id: 'library', label: 'Library', icon: Library },
        { id: 'hostel', label: 'Hostel', icon: BedDouble },
      ]} />
      {tab === 'library' ? <LibraryTab /> : <HostelTab />}
    </>
  );
}

/* ====================================================================== */
function LibraryTab() {
  const { user } = useAuth();
  const staff = user?.role === 'admin' || user?.role === 'faculty';
  const [q, setQ] = useState('');
  const dq = useDebounced(q, 250);
  const [cat, setCat] = useState('');
  const [issueBook, setIssueBook] = useState(null);

  const books = useLoader((api) => api(`/library/books${dq ? `?search=${encodeURIComponent(dq)}` : ''}`), [dq]);
  const list = asList(books.data);
  const cats = useMemo(() => [...new Set(list.map((b) => b.category))].sort(), [list]);
  const shown = list.filter((b) => !cat || b.category === cat);
  const totalCopies = list.reduce((a, b) => a + (b.total_copies || 0), 0);
  const avail = list.reduce((a, b) => a + (b.available_copies || 0), 0);

  return (
    <div className="stack gap-16">
      {!staff ? <MyLoans /> : <CirculationDesk onIssue={() => setIssueBook({})} reloadBooks={books.reload} />}

      <div className="grid-4">
        <Stat label="Titles" value={list.length} icon={BookOpen} tone="accent" />
        <Stat label="Copies on shelf" value={avail} unit={`/ ${totalCopies}`} icon={Library} tone="success" />
        <Stat label="On loan" value={totalCopies - avail} icon={BookMarked} tone="info" />
        <Stat label="Categories" value={cats.length} icon={Building} tone="violet" />
      </div>

      <Card flush title="Catalogue" icon={Library}
        actions={<SearchInput value={q} onChange={setQ} placeholder="Title, author or ISBN" size="sm" style={{ width: 260 }} />}>
        <div style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)' }}>
          <Chips value={cat} onChange={setCat} options={[{ value: '', label: 'All' }, ...cats.map((c) => ({ value: c, label: c }))]} />
        </div>
        {books.loading ? <div className="stack gap-8" style={{ padding: 16 }}>{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} h={48} />)}</div>
          : books.error ? <div style={{ padding: 16 }}><ErrorState error={books.error} onRetry={books.hardReload} /></div>
            : shown.length === 0 ? <EmptyState icon={BookOpen} title="No books match" /> : (
              <div className="table-wrap">
                <table className="tbl">
                  <thead><tr><th>Title</th><th>Category</th><th>Shelf</th><th style={{ width: 200 }}>Availability</th>{staff && <th />}</tr></thead>
                  <tbody>
                    {shown.map((b) => (
                      <tr key={b.id}>
                        <td>
                          <div className="row gap-12">
                            <div style={{ width: 34, height: 46, flexShrink: 0, background: `linear-gradient(135deg, hsl(${(b.id * 47) % 360} 45% 42%), hsl(${(b.id * 47 + 40) % 360} 50% 30%))`, boxShadow: 'inset -3px 0 0 rgba(0,0,0,.25)' }} />
                            <div style={{ minWidth: 0 }}>
                              <div className="strong">{b.title}</div>
                              <div className="xs muted">{b.author} · {b.edition}</div>
                              <div className="xs faint mono">ISBN {b.isbn}</div>
                            </div>
                          </div>
                        </td>
                        <td><Badge>{b.category}</Badge></td>
                        <td className="mono small">{b.shelf_location}</td>
                        <td>
                          <div className="row-between xs" style={{ marginBottom: 4 }}>
                            <span className={b.available_copies ? 't-success' : 't-danger'}>{b.available_copies ? `${b.available_copies} available` : 'All on loan'}</span>
                            <span className="mono muted">{b.available_copies}/{b.total_copies}</span>
                          </div>
                          <Progress value={(b.available_copies / (b.total_copies || 1)) * 100} tone={b.available_copies ? 'success' : 'danger'} />
                        </td>
                        {staff && <td className="right"><button className="btn btn-ghost btn-sm" disabled={!b.available_copies} onClick={() => setIssueBook(b)}>Issue</button></td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
      </Card>
      {staff && <IssueModal book={issueBook} books={list} onClose={() => setIssueBook(null)} onDone={() => { setIssueBook(null); books.reload(); }} />}
    </div>
  );
}

function LoanList({ issues, onReturn, busy, showBorrower }) {
  if (!issues.length) return <EmptyState compact icon={CheckCircle2} title={showBorrower ? 'No books are out right now' : 'No books borrowed'} />;
  return (
    <div className="list">
      {issues.map((i) => {
        const d = daysUntil(i.due_date);
        const active = !i.return_date;
        return (
          <div key={i.id} className="list-item">
            <span className="stat-icon" style={{ background: active ? (d < 0 ? 'var(--danger-soft)' : 'var(--accent-soft)') : 'var(--sunken)', color: active ? (d < 0 ? 'var(--danger)' : 'var(--accent)') : 'var(--muted)' }}><BookMarked size={15} /></span>
            <div className="grow">
              <div className="list-title">{i.title}</div>
              <div className="list-meta">{showBorrower ? <><b>{i.student_name}</b> · {i.roll_no} · </> : null}{i.author}{i.shelf_location ? ` · ${i.shelf_location}` : ''} · issued {fmtDate(i.issue_date)}</div>
            </div>
            {i.fine_amount > 0 && <Badge tone="danger">Fine {inr(i.fine_amount)}</Badge>}
            {active ? (
              <Badge tone={d < 0 ? 'danger' : d <= 3 ? 'warning' : 'neutral'}><Clock size={11} /> {d < 0 ? `${-d}d overdue` : `Due ${fmtDate(i.due_date)}`}</Badge>
            ) : <Badge tone={statusTone(i.status)}>Returned {fmtDate(i.return_date)}</Badge>}
            {onReturn && active && <button className="btn btn-ghost btn-sm" onClick={() => onReturn(i)} disabled={busy === i.id}><Undo2 size={13} /> {busy === i.id ? '…' : 'Return'}</button>}
          </div>
        );
      })}
    </div>
  );
}

function MyLoans() {
  const { user } = useAuth();
  const { data, loading, error, hardReload } = useLoader((api) => api('/library/my-issues'));
  const issues = asList(data);
  const overdue = issues.filter((i) => !i.return_date && daysUntil(i.due_date) < 0);
  const fines = issues.reduce((a, i) => a + (i.fine_amount || 0), 0);
  return (
    <Card flush title={user?.role === 'parent' ? 'Ward’s borrowed books' : 'My borrowed books'} icon={BookMarked}
      actions={<>{overdue.length > 0 && <Badge tone="danger"><AlertTriangle size={11} /> {overdue.length} overdue</Badge>}{fines > 0 && <Badge tone="warning">Fines {inr(fines)}</Badge>}</>}>
      {loading ? <div style={{ padding: 16 }}><Skeleton h={60} /></div> : error ? <div style={{ padding: 16 }}><ErrorState error={error} onRetry={hardReload} /></div> : <LoanList issues={issues} />}
    </Card>
  );
}

function CirculationDesk({ onIssue, reloadBooks }) {
  const call = useApi();
  const toast = useToast();
  const [section, setSection] = useState('CSE-2');
  const [sid, setSid] = useState(null);
  const [busy, setBusy] = useState(null);
  const [mode, setMode] = useState('open');
  const open = useLoader((api) => (mode === 'open' ? api('/library/loans') : Promise.resolve([])), [mode]);
  const roster = useLoader((api) => (mode === 'student' ? api(`/students?section=${encodeURIComponent(section)}`) : Promise.resolve([])), [section, mode]);
  const students = asList(roster.data);
  useEffect(() => { if (students.length && !students.find((s) => s.id === sid)) setSid(students[0].id); }, [students, sid]);
  const loans = useLoader((api) => (mode === 'student' && sid ? api(`/library/my-issues?studentId=${sid}`) : Promise.resolve([])), [sid, mode]);

  const ret = async (i) => {
    setBusy(i.id);
    try {
      const r = await call('/library/return', { method: 'POST', body: { issueId: i.id } });
      toast.success(r?.message || `“${i.title}” returned`);
      loans.reload();
      open.reload();
      reloadBooks();
    } catch (e) { toast.error(e.message); } finally { setBusy(null); }
  };

  return (
    <Card flush title="Circulation desk" subtitle="Look up a student’s loans, process returns or issue a new book" icon={BookMarked}
      actions={<button className="btn btn-accent btn-sm" onClick={onIssue}><Plus size={13} /> Issue book</button>}>
      <div className="row gap-8 wrap" style={{ padding: '12px 18px', borderBottom: '1px solid var(--line)' }}>
        <Segmented value={mode} onChange={setMode} options={[{ value: 'open', label: 'All open loans' }, { value: 'student', label: 'By student' }]} />
        {mode === 'student' && <>
        <select className="select select-sm" style={{ width: 110 }} value={section} onChange={(e) => { setSection(e.target.value); setSid(null); }} aria-label="Section">{SECTIONS.map((s) => <option key={s}>{s}</option>)}</select>
        <select className="select select-sm" style={{ width: 280 }} value={sid || ''} onChange={(e) => setSid(Number(e.target.value))} aria-label="Student">
          {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.roll_no}</option>)}
        </select>
        </>}
      </div>
      {mode === 'open'
        ? (open.loading ? <div style={{ padding: 16 }}><Skeleton h={50} /></div> : <LoanList issues={asList(open.data)} onReturn={ret} busy={busy} showBorrower />)
        : (loans.loading ? <div style={{ padding: 16 }}><Skeleton h={50} /></div> : <LoanList issues={asList(loans.data)} onReturn={ret} busy={busy} />)}
    </Card>
  );
}

function IssueModal({ book, books, onClose, onDone }) {
  const call = useApi();
  const toast = useToast();
  const [bookId, setBookId] = useState('');
  const [section, setSection] = useState('CSE-2');
  const [sid, setSid] = useState('');
  const [days, setDays] = useState(14);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (book) setBookId(book.id ? String(book.id) : ''); }, [book]);
  const roster = useLoader((api) => (book ? api(`/students?section=${encodeURIComponent(section)}`) : Promise.resolve([])), [!!book, section]);
  const students = asList(roster.data);
  const avail = books.filter((b) => b.available_copies > 0);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await call('/library/issue', { method: 'POST', body: { bookId: Number(bookId || avail[0]?.id), studentId: Number(sid || students[0]?.id), days: Number(days) } });
      toast.success(r?.message || 'Book issued');
      onDone();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };

  return (
    <Modal open={!!book} onClose={onClose} title="Issue a book" icon={BookMarked}
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" onClick={submit} disabled={busy || !students.length || !avail.length}>{busy ? 'Issuing…' : 'Issue'}</button></>}>
      <div className="form-grid">
        <Field label="Book" className="full">
          <select className="select" value={bookId} onChange={(e) => setBookId(e.target.value)}>
            {avail.map((b) => <option key={b.id} value={b.id}>{b.title} ({b.available_copies} left)</option>)}
          </select>
        </Field>
        <Field label="Section"><select className="select" value={section} onChange={(e) => { setSection(e.target.value); setSid(''); }}>{SECTIONS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Loan period"><select className="select" value={days} onChange={(e) => setDays(e.target.value)}>{[7, 14, 21, 30].map((d) => <option key={d} value={d}>{d} days</option>)}</select></Field>
        <Field label="Student" className="full">
          <select className="select" value={sid} onChange={(e) => setSid(e.target.value)} disabled={roster.loading}>
            {students.map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.roll_no}</option>)}
          </select>
        </Field>
      </div>
    </Modal>
  );
}

/* ====================================================================== */
function HostelTab() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [alloc, setAlloc] = useState(null);
  const call = useApi();
  const toast = useToast();
  const { data, loading, error, hardReload, reload } = useLoader((api) => api('/library/rooms'));
  const vacate = async (o) => {
    try {
      await call('/library/vacate', { method: 'POST', body: { studentId: o.student_id } });
      toast.success(`${o.name} moved out`);
      reload();
    } catch (e) { toast.error(e.message); }
  };
  const rooms = asList(data);
  const blocks = useMemo(() => rooms.reduce((m, r) => ({ ...m, [r.block_name]: [...(m[r.block_name] || []), r] }), {}), [rooms]);
  if (loading) return <Skeleton h={300} r={14} />;
  if (error) return <ErrorState error={error} onRetry={hardReload} />;

  const cap = rooms.reduce((a, r) => a + r.capacity, 0);
  const occ = rooms.reduce((a, r) => a + r.occupied_count, 0);
  const mine = rooms.find((r) => r.is_mine);

  return (
    <div className="stack gap-16">
      {mine && (
        <Callout tone="accent" icon={BedDouble} title={`${user?.role === 'parent' ? 'Your ward is' : 'You’re'} allocated to ${mine.room_no}, ${mine.block_name}`}>
          Floor {mine.floor} · {mine.occupied_count} of {mine.capacity} beds taken · {inr(mine.fee_per_semester)} per semester
        </Callout>
      )}
      <div className="grid-4">
        <Stat label="Rooms" value={rooms.length} icon={BedDouble} tone="accent" hint={`${Object.keys(blocks).length} blocks`} />
        <Stat label="Beds occupied" value={occ} unit={`/ ${cap}`} icon={Users} tone="info" />
        <Stat label="Occupancy" value={`${Math.round((occ / (cap || 1)) * 100)}%`} icon={Building} tone="violet" />
        <Stat label="Vacant beds" value={cap - occ} icon={CheckCircle2} tone="success" />
      </div>
      {Object.entries(blocks).map(([block, rs]) => (
        <Card key={block} title={block} icon={Building} subtitle={`${rs.length} rooms`}>
          <div className="grid-auto" style={{ '--min': '220px', gap: 12 }}>
            {rs.map((r) => {
              const full = r.occupied_count >= r.capacity;
              const isMine = r === mine;
              return (
                <div key={r.id} className="tile" style={isMine ? { borderColor: 'var(--accent)', background: 'var(--accent-soft)' } : undefined}>
                  <div className="row-between">
                    <span className="serif" style={{ fontSize: 24 }}>{r.room_no}</span>
                    <Badge tone={full ? 'danger' : 'success'} dot>{full ? 'Full' : `${r.capacity - r.occupied_count} free`}</Badge>
                  </div>
                  <div className="row gap-4" style={{ margin: '10px 0' }}>
                    {Array.from({ length: r.capacity }).map((_, i) => (
                      <span key={i} className="stat-icon" style={{ width: 28, height: 28, background: i < r.occupied_count ? 'var(--accent)' : 'var(--sunken)', color: i < r.occupied_count ? '#fff' : 'var(--faint)' }}><BedDouble size={14} /></span>
                    ))}
                  </div>
                  {isAdmin ? (
                    <div className="stack gap-4" style={{ minHeight: 32 }}>
                      {(r.occupants || []).length === 0 ? <span className="xs muted">Vacant</span> : r.occupants.map((o) => (
                        <div key={o.student_id} className="row-between xs"><span className="truncate">{o.name}</span><button className="btn btn-quiet btn-sm" style={{ height: 22, padding: '0 6px', color: 'var(--danger)' }} onClick={() => vacate(o)}>Vacate</button></div>
                      ))}
                    </div>
                  ) : <div className="xs muted" style={{ minHeight: 32 }}>{isMine ? 'Your room' : r.occupied_count ? `${r.occupied_count} occupied` : 'Vacant'}</div>}
                  <div className="row-between xs" style={{ marginTop: 8 }}>
                    <span className="muted">Floor {r.floor} · {inr(r.fee_per_semester)}/sem</span>
                    {isAdmin && !full && <button className="btn btn-outline btn-sm" onClick={() => setAlloc(r)}>Allocate</button>}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
      ))}
      {isAdmin && <AllocateModal room={alloc} onClose={() => setAlloc(null)} onDone={() => { setAlloc(null); reload(); }} />}
    </div>
  );
}

function AllocateModal({ room, onClose, onDone }) {
  const call = useApi();
  const toast = useToast();
  const [section, setSection] = useState('CSE-2');
  const [sid, setSid] = useState('');
  const [busy, setBusy] = useState(false);
  const roster = useLoader((api) => (room ? api(`/students?section=${encodeURIComponent(section)}`) : Promise.resolve([])), [!!room, section]);
  const students = asList(roster.data);
  const submit = async () => {
    setBusy(true);
    try {
      const r = await call('/library/allocate', { method: 'POST', body: { roomId: room.id, studentId: Number(sid || students[0]?.id) } });
      toast.success(r?.message || 'Room allocated');
      onDone();
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <Modal open={!!room} onClose={onClose} title={`Allocate ${room?.room_no || ''}`} subtitle={room?.block_name} icon={BedDouble} size="sm"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" onClick={submit} disabled={busy || !students.length}>{busy ? 'Allocating…' : 'Allocate'}</button></>}>
      <div className="stack gap-12">
        <Field label="Section"><select className="select" value={section} onChange={(e) => { setSection(e.target.value); setSid(''); }}>{SECTIONS.map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Student"><select className="select" value={sid} onChange={(e) => setSid(e.target.value)} disabled={roster.loading}>{students.map((s) => <option key={s.id} value={s.id}>{s.full_name} · {s.roll_no}</option>)}</select></Field>
      </div>
    </Modal>
  );
}
