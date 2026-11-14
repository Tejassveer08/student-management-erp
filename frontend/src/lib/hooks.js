import { useCallback, useEffect, useRef, useState } from 'react';
import { useApi } from './api';
import { useAuth } from '../context/AuthContext';

const read = () => {
  const s = getComputedStyle(document.documentElement);
  const v = (k) => s.getPropertyValue(k).trim();
  return {
    accent: v('--accent'),
    accent2: v('--accent-2'),
    ink: v('--ink'),
    ink2: v('--ink-2'),
    muted: v('--muted'),
    faint: v('--faint'),
    line: v('--line'),
    lineStrong: v('--line-strong'),
    surface: v('--surface'),
    sunken: v('--sunken'),
    success: v('--success'),
    warning: v('--warning'),
    danger: v('--danger'),
    info: v('--info'),
    violet: v('--violet'),
    saffron: v('--saffron'),
  };
};

/** Resolved theme colours for SVG charts; re-reads when theme or role changes. */
export function useChartColors() {
  const [c, setC] = useState(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setC(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'data-role'] });
    return () => obs.disconnect();
  }, []);
  return c;
}

/** Axis props shared by every cartesian chart */
export const axisProps = (c) => ({
  tick: { fill: c.muted, fontSize: 11 },
  axisLine: false,
  tickLine: false,
});

/**
 * Load one or more endpoints in parallel.
 * `load` receives the bound api() and returns a promise of anything.
 * Returns { data, loading, error, reload, setData }.
 */
export function useLoader(load, deps = []) {
  const call = useApi();
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const seq = useRef(0);

  const run = useCallback(async (silent = false) => {
    const my = ++seq.current;
    if (!silent) setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const data = await load(call);
      if (my === seq.current) setState({ data, loading: false, error: null });
      return data;
    } catch (error) {
      if (my === seq.current) setState((s) => ({ ...s, loading: false, error }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [call, ...deps]);

  useEffect(() => { run(); }, [run]);

  return {
    ...state,
    reload: () => run(true),
    hardReload: () => run(false),
    setData: (fn) => setState((s) => ({ ...s, data: typeof fn === 'function' ? fn(s.data) : fn })),
  };
}

/** Resolve settled promise → value or fallback (so one failing endpoint doesn't sink a page) */
export const settle = (p, fallback = null) => p.then((v) => v, () => fallback);

export function useDebounced(value, ms = 300) {
  const [v, setV] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setV(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return v;
}

export function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), ms);
    return () => clearInterval(t);
  }, [ms]);
  return now;
}

/**
 * Sections the signed-in staff member may work with: every section for admins,
 * only the sections they're mapped to teach for faculty (the API enforces the same rule).
 */
export function useMySections(all) {
  const { user } = useAuth();
  const isFaculty = user?.role === 'faculty';
  const q = useLoader(async (api) => {
    if (!isFaculty) return all;
    const d = await api('/dashboard/summary');
    return [...new Set((d?.assigned_classes || []).map((c) => c.section))].sort();
  }, [isFaculty]);
  return { sections: q.data || (isFaculty ? [] : all), loading: q.loading };
}
