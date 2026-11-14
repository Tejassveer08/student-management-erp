import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, CornerDownLeft, Moon, Sun, LogOut, ArrowUp, ArrowDown } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NAV_ITEMS } from '../../config/nav';

export default function CommandPalette({ open, onClose, onNavigate }) {
  const { hasPermission, theme, toggleTheme, logout } = useAuth();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const inputRef = useRef(null);
  const listRef = useRef(null);

  useEffect(() => {
    if (open) {
      setQ('');
      setIdx(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  const results = useMemo(() => {
    const pages = NAV_ITEMS.filter((i) => !i.module || hasPermission(i.module, 'read')).map((i) => ({
      kind: 'Pages', id: i.id, label: i.title, hint: i.group, icon: i.icon, hay: `${i.title} ${i.label} ${i.group} ${i.keywords}`.toLowerCase(),
      run: () => onNavigate(i.id),
    }));
    const actions = [
      { kind: 'Actions', id: 'theme', label: `Switch to ${theme === 'dark' ? 'light' : 'dark'} appearance`, icon: theme === 'dark' ? Sun : Moon, hay: 'theme dark light mode appearance', run: toggleTheme },
      { kind: 'Actions', id: 'logout', label: 'Sign out', icon: LogOut, hay: 'logout sign out exit', run: logout },
    ];
    const all = [...pages, ...actions];
    const terms = q.toLowerCase().trim().split(/\s+/).filter(Boolean);
    if (!terms.length) return all;
    return all.filter((r) => terms.every((t) => r.hay.includes(t)));
  }, [q, hasPermission, onNavigate, theme, toggleTheme, logout]);

  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-i="${idx}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [idx]);

  if (!open) return null;

  const choose = (r) => { r.run(); onClose(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(results.length - 1, i + 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)); }
    else if (e.key === 'Enter' && results[idx]) { e.preventDefault(); choose(results[idx]); }
    else if (e.key === 'Escape') onClose();
  };

  let lastKind = null;
  return createPortal(
    <div className="cmdk-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="cmdk" role="dialog" aria-label="Command palette">
        <div className="cmdk-input">
          <Search size={18} color="var(--muted)" />
          <input ref={inputRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search modules and actions…" aria-label="Search" />
          <span className="kbd">Esc</span>
        </div>
        <div className="cmdk-list" ref={listRef}>
          {results.length === 0 && <div className="empty" style={{ padding: 28 }}><div className="empty-desc">No matches for “{q}”.</div></div>}
          {results.map((r, i) => {
            const head = r.kind !== lastKind ? (lastKind = r.kind) : null;
            const Icon = r.icon;
            return (
              <React.Fragment key={r.kind + r.id}>
                {head && <div className="cmdk-group">{head}</div>}
                <button data-i={i} className={`cmdk-item${i === idx ? ' active' : ''}`} onMouseMove={() => setIdx(i)} onClick={() => choose(r)}>
                  <span className="ico"><Icon size={15} /></span>
                  <span className="grow">{r.label}</span>
                  {r.hint && <span className="xs faint">{r.hint}</span>}
                  {i === idx && <CornerDownLeft size={14} color="var(--muted)" />}
                </button>
              </React.Fragment>
            );
          })}
        </div>
        <div className="cmdk-foot">
          <span className="row gap-4"><ArrowUp size={12} /><ArrowDown size={12} /> navigate</span>
          <span className="row gap-4"><CornerDownLeft size={12} /> open</span>
          <span className="row gap-4"><span className="kbd" style={{ height: 16, fontSize: 10 }}>esc</span> close</span>
        </div>
      </div>
    </div>,
    document.body
  );
}
