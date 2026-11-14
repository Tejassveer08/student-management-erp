import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Search, Inbox, AlertTriangle, Info, CheckCircle2, XCircle } from 'lucide-react';
import { initials } from '../../lib/format';

export { ToastProvider, useToast } from './Toast';

const cx = (...c) => c.filter(Boolean).join(' ');
export { cx };

/* ------------------------------------------------------------------ */
/* Page structure                                                      */
/* ------------------------------------------------------------------ */
export function PageHeader({ eyebrow, title, description, actions, children }) {
  return (
    <header className="page-head">
      <div style={{ minWidth: 0 }}>
        {eyebrow && <div className="eyebrow" style={{ marginBottom: 10 }}>{eyebrow}</div>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="page-desc">{description}</p>}
        {children}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </header>
  );
}

export function Card({ title, subtitle, icon: Icon, actions, children, className, bodyClassName, flush, bordered, style, onClick, footer }) {
  const hasHead = title || actions;
  return (
    <section className={cx('card', flush && 'flush', onClick && 'interactive', className)} style={style} onClick={onClick}>
      {hasHead && (
        <div className={cx('card-hd', (bordered || flush) && 'bordered')}>
          <div style={{ minWidth: 0 }}>
            {title && <h3 className="card-title">{Icon && <Icon size={16} />}{title}</h3>}
            {subtitle && <div className="card-sub">{subtitle}</div>}
          </div>
          {actions && <div className="row gap-6" style={{ flexShrink: 0 }}>{actions}</div>}
        </div>
      )}
      {flush ? children : <div className={cx('card-bd', bodyClassName)}>{children}</div>}
      {footer && <div className="card-ft">{footer}</div>}
    </section>
  );
}

/** Figure-first stat tile (any `icon` prop is ignored by design) */
export function Stat({ label, value, unit, hint, tone = 'neutral', children, className, style }) {
  return (
    <div className={cx('card stat', `tone-${tone}`, className)} style={style}>
      <div className="stat-value">{value}{unit && <small>{unit}</small>}</div>
      <div className="stat-label">{label}</div>
      {hint && <div className="stat-hint">{hint}</div>}
      {children}
    </div>
  );
}

/** Big-figure headline: a huge number with a sentence beside it */
export function Headline({ eyebrow, figure, unit, children, aside }) {
  return (
    <section className="rise">
      {eyebrow && <div className="eyebrow" style={{ marginBottom: 22 }}>{eyebrow}</div>}
      <div className="headline">
        <div className="headline-fig">{figure}{unit && <small>{unit}</small>}</div>
        <div className="headline-text grow">{children}</div>
        {aside}
      </div>
    </section>
  );
}

/** Proportional flat colour blocks — each segment sized by its value */
export function Splits({ items, style }) {
  const list = items.filter((i) => i && (i.value > 0 || i.always));
  if (!list.length) return null;
  return (
    <div className="splits" style={style}>
      {list.map((it, i) => {
        const Tag = it.onClick ? 'button' : 'div';
        return (
          <Tag key={it.label} className="split" onClick={it.onClick}
            style={{ flex: `${Math.max(it.value, 0.0001)} 1 0`, background: it.color, color: it.ink || '#0f1222', animationDelay: `${i * 0.08}s` }}>
            <span className="n">{it.display ?? it.value}</span>
            <span className="l">{it.label}</span>
          </Tag>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Atoms                                                               */
/* ------------------------------------------------------------------ */
export function Badge({ tone = 'neutral', dot, children, className, style, title }) {
  return (
    <span className={cx('badge', tone !== 'neutral' && `badge-${tone}`, className)} style={style} title={title}>
      {dot && <span className="bdot" />}
      {children}
    </span>
  );
}

const AVATAR_HUES = ['#4f46e5', '#7c3aed', '#c026d3', '#db2777', '#0891b2', '#059669', '#ea580c', '#475569'];
const hueFor = (name = '') => AVATAR_HUES[[...String(name)].reduce((a, ch) => (a * 31 + ch.charCodeAt(0)) >>> 0, 7) % AVATAR_HUES.length];

export function Avatar({ src, name, size = 32, square, className }) {
  const [broken, setBroken] = useState(false);
  const showImg = src && !broken;
  const isLogo = className?.includes('logo');
  return (
    <span className={cx('avatar', square && 'sq', className)} style={{ '--s': `${size}px`, background: showImg || isLogo ? undefined : hueFor(name) }} title={name}>
      {showImg ? <img src={src} alt="" onError={() => setBroken(true)} loading="lazy" /> : initials(name)}
    </span>
  );
}

export function Progress({ value = 0, tone, size, className, style }) {
  const v = Math.max(0, Math.min(100, Number(value) || 0));
  return (
    <div className={cx('progress', tone, size, className)} style={style} role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <span style={{ width: `${v}%` }} />
    </div>
  );
}

/** Circular meter. `value` 0..max */
export function Ring({ value = 0, max = 100, size = 120, stroke = 10, color = 'var(--accent)', track = 'var(--sunken)', children }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.max(0, Math.min(1, (Number(value) || 0) / max));
  const [off, setOff] = useState(c);
  useEffect(() => {
    const id = requestAnimationFrame(() => setOff(c * (1 - p)));
    return () => cancelAnimationFrame(id);
  }, [c, p]);
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={off} style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.2,.8,.2,1)' }}
        />
      </svg>
      <div className="ring-label">{children}</div>
    </div>
  );
}

export function Spinner({ size = 18, style }) {
  return <span className="spinner" style={{ width: size, height: size, ...style }} />;
}

export function Skeleton({ h = 16, w = '100%', r, style }) {
  return <div className="skeleton" style={{ height: h, width: w, borderRadius: r, ...style }} />;
}

/** Generic page-loading placeholder that mirrors a typical layout */
export function PageSkeleton({ stats = 4, rows = 2 }) {
  return (
    <div className="stack gap-20">
      <div className="stack gap-8">
        <Skeleton h={12} w={160} />
        <Skeleton h={72} w={420} />
        <Skeleton h={14} w={480} />
      </div>
      {stats > 0 && (
        <div className="grid-4">
          {Array.from({ length: stats }).map((_, i) => <Skeleton key={i} h={140} />)}
        </div>
      )}
      <div className="grid-main">
        {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} h={300} />)}
      </div>
    </div>
  );
}

export function EmptyState({ icon: Icon = Inbox, title = 'Nothing here yet', description, action, compact }) {
  return (
    <div className="empty" style={compact ? { padding: '24px 16px' } : undefined}>
      <div className="empty-icon"><Icon size={20} /></div>
      <div className="empty-title">{title}</div>
      {description && <div className="empty-desc">{description}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  return (
    <div className="card">
      <EmptyState
        icon={AlertTriangle}
        title="Couldn’t load this page"
        description={error?.message || String(error || 'Unknown error')}
        action={onRetry && <button className="btn btn-ghost btn-sm" onClick={onRetry}>Try again</button>}
      />
    </div>
  );
}

const CALLOUT_ICONS = { info: Info, warning: AlertTriangle, danger: XCircle, success: CheckCircle2, accent: Info };
export function Callout({ tone = 'info', icon, title, children, style, action }) {
  const Icon = icon || CALLOUT_ICONS[tone];
  return (
    <div className={`callout callout-${tone}`} style={style}>
      <Icon size={16} />
      <div className="grow">
        {title && <div className="strong" style={{ color: 'var(--ink)', marginBottom: children ? 2 : 0 }}>{title}</div>}
        {children}
      </div>
      {action}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Navigation controls                                                 */
/* ------------------------------------------------------------------ */
export function Tabs({ tabs, value, onChange, style }) {
  return (
    <div className="tabs" role="tablist" style={style}>
      {tabs.filter(Boolean).map((t) => {
        const Icon = t.icon;
        return (
          <button key={t.id} role="tab" aria-selected={value === t.id} className={cx('tab', value === t.id && 'active')} onClick={() => onChange(t.id)}>
            {Icon && <Icon size={15} />}
            {t.label}
            {t.count != null && <span className="count">{t.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Segmented({ options, value, onChange, style }) {
  return (
    <div className="seg" style={style}>
      {options.map((o) => {
        const opt = typeof o === 'object' ? o : { value: o, label: o };
        const Icon = opt.icon;
        return (
          <button key={opt.value} type="button" className={value === opt.value ? 'active' : ''} onClick={() => onChange(opt.value)}>
            {Icon && <Icon size={13} />}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

export function Chips({ options, value, onChange }) {
  return (
    <div className="row wrap gap-6">
      {options.map((o) => {
        const opt = typeof o === 'object' ? o : { value: o, label: o };
        return (
          <button key={opt.value} type="button" className={cx('chip', value === opt.value && 'active')} onClick={() => onChange(opt.value)}>
            {opt.label}
            {opt.count != null && <span className="count">{opt.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Form controls                                                       */
/* ------------------------------------------------------------------ */
export function Field({ label, hint, children, className, style, htmlFor }) {
  return (
    <div className={cx('field', className)} style={style}>
      {label && <label className="label" htmlFor={htmlFor}>{label}</label>}
      {children}
      {hint && <span className="hint">{hint}</span>}
    </div>
  );
}

export function SearchInput({ value, onChange, placeholder = 'Search…', style, autoFocus, size }) {
  return (
    <div className="input-wrap" style={style}>
      <Search size={15} />
      <input
        className={cx('input', size === 'sm' && 'input-sm')}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoFocus={autoFocus}
        type="search"
      />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overlays                                                            */
/* ------------------------------------------------------------------ */
export function Modal({ open, onClose, title, subtitle, children, footer, size, icon: Icon }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => e.key === 'Escape' && onClose?.();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
  if (!open) return null;
  return createPortal(
    <div className="modal-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={cx('modal', size)} role="dialog" aria-modal="true" ref={ref}>
        {(title || onClose) && (
          <div className="modal-hd">
            <div className="row gap-12" style={{ alignItems: 'flex-start', minWidth: 0 }}>
              {Icon && <span className="stat-icon" style={{ background: 'var(--brand-grad)', color: '#fff', marginTop: 2 }}><Icon size={16} /></span>}
              <div style={{ minWidth: 0 }}>
                {title && <div className="modal-title">{title}</div>}
                {subtitle && <div className="modal-sub">{subtitle}</div>}
              </div>
            </div>
            {onClose && <button className="modal-close" onClick={onClose} aria-label="Close">Close <span className="kbd">Esc</span></button>}
          </div>
        )}
        <div className="modal-bd">{children}</div>
        {footer && <div className="modal-ft">{footer}</div>}
      </div>
    </div>,
    document.body
  );
}

/** Popover anchored to its wrapper; closes on outside click / Escape */
export function Popover({ open, onClose, children, style, className }) {
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => {
      if (ref.current && !ref.current.parentElement.contains(e.target)) onClose();
    };
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);
  if (!open) return null;
  return <div ref={ref} className={cx('popover', className)} style={style}>{children}</div>;
}

/** Key/value list */
export function KV({ items, style }) {
  return (
    <dl className="kv" style={style}>
      {items.filter(Boolean).map(([k, v], i) => (
        <React.Fragment key={i}>
          <dt>{k}</dt>
          <dd>{v ?? '—'}</dd>
        </React.Fragment>
      ))}
    </dl>
  );
}

/** Shared recharts tooltip */
export function ChartTip({ active, payload, label, format = (v) => v, labelFormat }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="chart-tip">
      {label != null && <div className="t">{labelFormat ? labelFormat(label) : label}</div>}
      {payload.map((p, i) => (
        <div key={i} className="row gap-8" style={{ justifyContent: 'space-between' }}>
          <span className="row gap-6"><span className="dot" style={{ background: p.color || p.payload?.fill || p.payload?.color }} />{p.name}</span>
          <b className="num">{format(p.value, p)}</b>
        </div>
      ))}
    </div>
  );
}
