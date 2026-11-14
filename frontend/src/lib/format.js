export const inr = (n, opts = {}) => {
  const v = Number(n || 0);
  return '₹' + v.toLocaleString('en-IN', { maximumFractionDigits: 0, ...opts });
};

/** Compact rupee figure: ₹6.37 Cr, ₹4.2 L, ₹85,000 */
export const inrShort = (n) => {
  const v = Number(n || 0);
  if (Math.abs(v) >= 1e7) return `₹${(v / 1e7).toFixed(2)} Cr`;
  if (Math.abs(v) >= 1e5) return `₹${(v / 1e5).toFixed(1)} L`;
  return inr(v);
};

export const num = (n, d = 0) => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: d, minimumFractionDigits: d });

export const pct = (n, d = 1) => `${Number(n || 0).toFixed(d).replace(/\.0+$/, '')}%`;

const toDate = (d) => (d instanceof Date ? d : new Date(d));
const valid = (d) => d && !Number.isNaN(toDate(d).getTime());

export const fmtDate = (d, o = { day: 'numeric', month: 'short', year: 'numeric' }) =>
  valid(d) ? toDate(d).toLocaleDateString('en-IN', o) : '—';

export const fmtShortDate = (d) => fmtDate(d, { day: 'numeric', month: 'short' });

export const fmtTime = (d) => (valid(d) ? toDate(d).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—');

export const fmtDateTime = (d) => (valid(d) ? `${fmtDate(d)}, ${fmtTime(d)}` : '—');

export function timeAgo(d) {
  if (!valid(d)) return '';
  const s = Math.round((Date.now() - toDate(d).getTime()) / 1000);
  const fut = s < 0;
  const a = Math.abs(s);
  const units = [[60, 'second'], [60, 'minute'], [24, 'hour'], [7, 'day'], [4.35, 'week'], [12, 'month'], [Infinity, 'year']];
  let v = a;
  let unit = 'second';
  for (const [step, name] of units) {
    unit = name;
    if (v < step) break;
    v /= step;
  }
  v = Math.floor(v);
  if (unit === 'second' && v < 45) return fut ? 'in a moment' : 'just now';
  const label = `${v} ${unit}${v === 1 ? '' : 's'}`;
  return fut ? `in ${label}` : `${label} ago`;
}

/** Days until a date (negative = overdue) */
export const daysUntil = (d) => (valid(d) ? Math.ceil((toDate(d).getTime() - Date.now()) / 86400000) : null);

export const initials = (name = '') =>
  name.replace(/^(Mr|Mrs|Ms|Dr|Prof)\.?\s+/i, '').split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export const titleCase = (s = '') => String(s).replace(/[_-]+/g, ' ').toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

/** tone for an attendance percentage against the 75% rule */
export const attTone = (p) => (p == null ? 'neutral' : p < 65 ? 'danger' : p < 75 ? 'warning' : 'success');

/** grade → css class suffix */
export const gradeClass = (g = '') => {
  const k = String(g).toUpperCase().replace('+', 'P');
  return ({ O: 'o', AP: 'ap', A: 'a', BP: 'bp', B: 'b', C: 'c', P: 'c', F: 'f' })[k] || 'b';
};

export const statusTone = (s = '') => {
  const v = String(s).toLowerCase();
  if (/(paid|approved|accepted|active|present|selected|declared|verified|returned|open|success|completed|resolved|graded|submitted|ongoing|available)/.test(v)) return 'success';
  if (/(pending|partial|upcoming|review|applied|shortlist|scheduled|issued|in.?progress)/.test(v)) return 'warning';
  if (/(overdue|rejected|absent|failed|closed|expired|detained|inactive|cancel|urgent|lost)/.test(v)) return 'danger';
  return 'neutral';
};
