import React, { useEffect, useState } from 'react';
import { Moon, Sun, CheckCheck, LogOut, Bell, KeyRound } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useApi } from '../../lib/api';
import { useNow } from '../../lib/hooks';
import { timeAgo } from '../../lib/format';
import { NAV_BY_ID } from '../../config/nav';
import { Popover, EmptyState, Avatar, Modal, Field, Callout, useToast } from '../ui';

const typeSwatch = (t = '') => {
  if (t.includes('cgpa')) return 'var(--cobalt)';
  if (t.includes('attend')) return 'var(--teal)';
  if (t.includes('fee')) return 'var(--ochre)';
  if (t.includes('notice')) return 'var(--stone)';
  if (t.includes('exam')) return 'var(--plum)';
  if (t.includes('assignment')) return 'var(--sky)';
  if (t.includes('placement')) return 'var(--teal)';
  if (t.includes('society') || t.includes('forum')) return 'var(--cobalt)';
  return 'var(--signal)';
};

export default function Topbar({ onNavigate }) {
  const { token, user, theme, toggleTheme, logout, roleMeta, studentProfile, facultyProfile } = useAuth();
  const call = useApi();
  const now = useNow(30000);
  const [items, setItems] = useState([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const [me, setMe] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);

  useEffect(() => {
    if (!token) return;
    let alive = true;
    let inFlight = false; // never stack polls while the API is busy
    const load = () => {
      if (inFlight) return;
      inFlight = true;
      call('/dashboard/notifications')
        .then((d) => { if (alive) { setItems(d?.notifications || []); setUnread(d?.unread_count || 0); } })
        .catch(() => {})
        .finally(() => { inFlight = false; });
    };
    load();
    const t = setInterval(load, 20000);
    return () => { alive = false; clearInterval(t); };
  }, [token, call]);

  const markAll = async () => {
    try {
      await call('/dashboard/notifications/mark-read', { method: 'PUT', body: {} });
      setUnread(0);
      setItems((xs) => xs.map((n) => ({ ...n, is_read: 1 })));
    } catch { /* non-critical */ }
  };

  const openLink = (n) => {
    const id = String(n.link_url || '').replace(/^\/+/, '').split(/[?#/]/)[0];
    if (NAV_BY_ID[id]) onNavigate(id);
    setOpen(false);
  };

  const ident = studentProfile
    ? `${studentProfile.section || ''} · Sem ${studentProfile.semester || '—'}`
    : facultyProfile?.employee_id || roleMeta.title;

  return (
    <header className="topbar no-print">
      <button className="brand" onClick={() => onNavigate('dashboard')} aria-label="GTBIT ERP home">
        <span className="brand-tile">G</span>GTBIT
      </button>

      <div className="topbar-meta" style={{ marginLeft: 18 }}>
        <i className="dot live" style={{ marginRight: 4 }} />
        <span><b>{roleMeta.label?.toLowerCase()}</b></span>
        <span>{ident}</span>
        <span>{now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} · {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false })}</span>
      </div>

      <div className="topbar-actions">
        <div style={{ position: 'relative' }}>
          <button className="icon-btn boxed" onClick={() => setOpen((o) => !o)} aria-label={`Alerts (${unread} unread)`}>
            <Bell size={17} />
            {unread > 0 && <span style={{ position: 'absolute', top: -4, right: -4, minWidth: 18, height: 18, padding: '0 5px', borderRadius: 99, background: 'var(--signal)', color: '#fff', fontSize: 10.5, fontWeight: 700, display: 'grid', placeItems: 'center', boxShadow: '0 0 0 2px var(--bg)' }}>{unread}</span>}
          </button>
          <Popover open={open} onClose={() => setOpen(false)} style={{ width: 400, maxWidth: 'calc(100vw - 28px)', right: -50 }}>
            <div className="row-between" style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)' }}>
              <div>
                <div className="serif" style={{ fontSize: 20 }}>Alerts</div>
                <div className="xs muted" style={{ marginTop: 2 }}>{unread ? `${unread} unread` : 'You’re all caught up'}</div>
              </div>
              {unread > 0 && <button className="btn btn-quiet btn-sm" onClick={markAll}><CheckCheck size={14} /> Mark all read</button>}
            </div>
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {items.length === 0 ? (
                <EmptyState icon={Bell} title="No alerts" description="Attendance, CGPA and fee alerts will appear here." compact />
              ) : items.map((n) => (
                <button key={n.id ?? n._id} className="menu-item" style={{ alignItems: 'flex-start', padding: '14px 18px', borderTop: '1px solid var(--line)', gap: 12 }} onClick={() => openLink(n)}>
                  <span className="sq" style={{ background: n.is_read ? 'var(--line-strong)' : typeSwatch(n.type), marginTop: 6, boxShadow: n.is_read ? 'none' : `0 0 0 4px color-mix(in srgb, ${typeSwatch(n.type)} 22%, transparent)` }} />
                  <span className="grow" style={{ minWidth: 0 }}>
                    <span className="row-between" style={{ gap: 8, alignItems: 'baseline' }}>
                      <span className="strong small" style={{ color: 'var(--ink)' }}>{n.title}</span>
                      <span className="faint" style={{ fontSize: 11.5, flexShrink: 0 }}>{timeAgo(n.created_at)}</span>
                    </span>
                    <span className="small muted clamp-2" style={{ display: '-webkit-box', marginTop: 3 }}>{n.message}</span>
                  </span>
                </button>
              ))}
            </div>
          </Popover>
        </div>

        <button className="icon-btn boxed" onClick={toggleTheme} aria-label="Toggle theme">
          {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
        </button>

        <div style={{ position: 'relative' }}>
          <button onClick={() => setMe((m) => !m)} aria-haspopup="menu" aria-expanded={me} aria-label="Account"
            style={{ border: 0, background: 'none', padding: 0, cursor: 'pointer', display: 'grid' }}>
            <Avatar src={user?.avatarUrl} name={user?.fullName} size={38} />
          </button>
          <Popover open={me} onClose={() => setMe(false)} style={{ width: 280 }}>
            <div style={{ padding: '16px 18px', borderBottom: '1px solid var(--line)', background: 'linear-gradient(135deg, var(--accent-soft), transparent)' }}>
              <div className="serif truncate" style={{ fontSize: 18 }}>{user?.fullName}</div>
              <div className="xs muted truncate" style={{ marginTop: 3 }}>{user?.email}</div>
              <span className="badge badge-accent" style={{ marginTop: 8 }}>{roleMeta.label} · {ident}</span>
            </div>
            <button className="menu-item" onClick={() => { toggleTheme(); setMe(false); }}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />} {theme === 'dark' ? 'Light' : 'Dark'} appearance
            </button>
            <button className="menu-item" onClick={() => { setPwOpen(true); setMe(false); }}>
              <KeyRound size={15} /> Change password
            </button>
            <button className="menu-item danger" onClick={logout}>
              <LogOut size={15} /> Sign out
            </button>
          </Popover>
        </div>
      </div>
    <ChangePassword open={pwOpen} onClose={() => setPwOpen(false)} />
    </header>
  );
}

function ChangePassword({ open, onClose }) {
  const { changePassword } = useAuth();
  const toast = useToast();
  const [f, setF] = useState({ current: '', next: '', confirm: '' });
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const weak = f.next && (f.next.length < 8 || !/[A-Za-z]/.test(f.next) || !/d/.test(f.next));
  const mismatch = f.confirm && f.next !== f.confirm;
  const submit = async (e) => {
    e?.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await changePassword(f.current, f.next);
      toast.success('Password updated');
      setF({ current: '', next: '', confirm: '' });
      onClose();
    } catch (x) {
      setErr(x.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} onClose={onClose} title="Change password" subtitle="At least 8 characters, with letters and numbers." icon={KeyRound} size="sm"
      footer={<><button className="btn btn-ghost" onClick={onClose}>Cancel</button><button className="btn btn-accent" onClick={submit} disabled={busy || !f.current || !f.next || weak || mismatch || !f.confirm}>{busy ? 'Saving…' : 'Update password'}</button></>}>
      <form onSubmit={submit} className="stack gap-12">
        {err && <Callout tone="danger">{err}</Callout>}
        <Field label="Current password"><input className="input" type="password" autoComplete="current-password" value={f.current} onChange={(e) => setF({ ...f, current: e.target.value })} autoFocus /></Field>
        <Field label="New password" hint={weak ? 'Use 8+ characters with letters and numbers' : undefined}><input className="input" type="password" autoComplete="new-password" value={f.next} onChange={(e) => setF({ ...f, next: e.target.value })} /></Field>
        <Field label="Confirm new password" hint={mismatch ? 'Passwords don’t match' : undefined}><input className="input" type="password" autoComplete="new-password" value={f.confirm} onChange={(e) => setF({ ...f, confirm: e.target.value })} /></Field>
      </form>
    </Modal>
  );
}
