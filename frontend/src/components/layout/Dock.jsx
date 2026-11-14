import React from 'react';
import { LayoutGrid, Search } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { NAV_BY_ID, NAV_ITEMS, DOCK } from '../../config/nav';

/** Floating ink dock: the role's five most-used modules, the module index and search */
export default function Dock({ current, onNavigate, onOpenMenu, onOpenPalette }) {
  const { user, hasPermission } = useAuth();
  const allowed = (i) => i && (!i.module || hasPermission(i.module, 'read'));
  const ids = (DOCK[user?.role] || DOCK.student).filter((id) => allowed(NAV_BY_ID[id]));
  const total = NAV_ITEMS.filter(allowed).length;
  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const offDock = !ids.includes(current) && NAV_BY_ID[current];

  return (
    <nav className="dock no-print" aria-label="Primary">
      {ids.map((id) => {
        const item = NAV_BY_ID[id];
        const Icon = item.icon;
        return (
          <button key={id} className={`dock-item${current === id ? ' active' : ''}`} onClick={() => onNavigate(id)} aria-current={current === id ? 'page' : undefined} title={item.title}>
            <span className="sq" style={{ background: item.swatch }} />
            <Icon size={18} className="ico" />
            <span className="lbl">{item.label === 'Smart Attendance' ? 'Attendance' : item.label === 'CGPA Probability' ? 'CGPA' : item.label}</span>
          </button>
        );
      })}
      <span className="dock-sep" />
      <button className={`dock-item menu-btn${offDock ? ' active' : ''}`} onClick={onOpenMenu} aria-label="All modules">
        <LayoutGrid size={16} />
        <span className="lbl">{offDock ? offDock.label : 'Menu'}</span>
        <span className="count">{total}</span>
      </button>
      <button className="dock-item" onClick={onOpenPalette} aria-label="Search">
        <Search size={16} className="ico" />
        <span className="lbl">Search</span>
        <span className="kbd">{isMac ? '⌘K' : 'Ctrl K'}</span>
      </button>
    </nav>
  );
}
