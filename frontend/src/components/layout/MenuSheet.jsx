import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { LogOut, Moon, Sun, ArrowUpRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NAV } from '../../config/nav';
import { Avatar } from '../ui';

/** Full-screen module launcher: every module the role may open, as tiles grouped by area */
export default function MenuSheet({ open, onClose, current, onNavigate }) {
  const { user, hasPermission, roleMeta, theme, toggleTheme, logout } = useAuth();

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = prev; };
  }, [open, onClose]);

  if (!open) return null;

  const groups = NAV
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.module || hasPermission(i.module, 'read')) }))
    .filter((g) => g.items.length);
  const total = groups.reduce((a, g) => a + g.items.length, 0);
  const first = (user?.fullName || '').replace(/^(Dr|Prof|Mr|Mrs|Ms)\.?\s+/i, '').split(' ')[0];

  return createPortal(
    <div className="sheet" role="dialog" aria-modal="true" aria-label="All modules">
      <div className="sheet-inner">
        <div className="row-between">
          <div className="row gap-12">
            <span className="brand"><span className="brand-tile">G</span>GTBIT</span>
            <span className="badge desktop-only" style={{ background: 'rgba(255,255,255,0.08)', color: 'var(--panel-muted)' }}>{total} modules · {roleMeta.label}</span>
          </div>
          <button className="sheet-close" onClick={onClose}>Close <span className="kbd">Esc</span></button>
        </div>

        <h2 className="sheet-headline rise">Where to next,<br /><span>{first}?</span></h2>

        {groups.map((g, gi) => (
          <section key={g.group} className={`rise d${Math.min(gi + 1, 6)}`}>
            <div className="sheet-group-label">{g.group}</div>
            <div className="sheet-tiles">
              {g.items.map((item) => {
                const Icon = item.icon;
                return (
                  <button key={item.id} className={`sheet-tile${current === item.id ? ' active' : ''}`} onClick={() => { onNavigate(item.id); onClose(); }}>
                    <span className="ic" style={{ background: item.swatch }}><Icon size={19} strokeWidth={2.1} /></span>
                    {item.tag && <span className="tag">{item.tag}</span>}
                    <span>
                      <span className="t" style={{ display: 'block' }}>{item.title}</span>
                      <span className="k">{current === item.id ? 'You are here' : item.keywords.split(' ').slice(0, 3).join(' · ')}</span>
                    </span>
                    <ArrowUpRight size={16} className="arrow" />
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        <div className="sheet-foot">
          <Avatar src={user?.avatarUrl} name={user?.fullName} size={42} />
          <div className="grow">
            <div style={{ fontWeight: 700 }}>{user?.fullName}</div>
            <div className="xs" style={{ color: 'var(--panel-muted)' }}>{user?.email}</div>
          </div>
          <button className="sheet-btn" onClick={toggleTheme}>{theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />} {theme === 'dark' ? 'Light' : 'Dark'} mode</button>
          <button className="sheet-btn danger" onClick={logout}><LogOut size={15} /> Sign out</button>
        </div>
      </div>
    </div>,
    document.body
  );
}
