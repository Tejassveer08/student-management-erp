import { useCallback } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * Thin fetch wrapper for the ERP REST API.
 * - Adds the JWT bearer header
 * - JSON-encodes plain-object bodies (FormData passes through untouched)
 * - Throws an Error carrying the server's `error` message on non-2xx responses
 */
export async function api(path, { token, method = 'GET', body, signal, raw = false } = {}) {
  const url = path.startsWith('/api') ? path : `/api${path.startsWith('/') ? '' : '/'}${path}`;
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  let payload;
  if (body instanceof FormData) payload = body;
  else if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(url, { method, headers, body: payload, signal });
  } catch (err) {
    if (err.name === 'AbortError') throw err;
    throw new Error('Cannot reach the ERP server. Check your connection and try again.');
  }
  if (raw) return res;

  let data = null;
  const text = await res.text();
  if (text) {
    try { data = JSON.parse(text); } catch { data = text; }
  }
  if (!res.ok) {
    const msg = (data && typeof data === 'object' && (data.error || data.message)) ||
      (res.status === 502 || res.status === 504 ? 'The ERP server is not reachable right now.' : `Request failed (${res.status})`);
    const e = new Error(msg);
    e.status = res.status;
    e.data = data;
    throw e;
  }
  return data;
}

/** Hook returning an api() bound to the current session token. */
export function useApi() {
  const { token } = useAuth();
  return useCallback((path, opts = {}) => api(path, { ...opts, token }), [token]);
}

/** Pick the first array found on a response, tolerating `{ items: [] }` style payloads. */
export function asList(data, ...keys) {
  if (Array.isArray(data)) return data;
  if (!data || typeof data !== 'object') return [];
  for (const k of keys) if (Array.isArray(data[k])) return data[k];
  const firstArr = Object.values(data).find(Array.isArray);
  return firstArr || [];
}
