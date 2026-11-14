import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, XCircle, Info, X } from 'lucide-react';

const ToastCtx = createContext(null);
const ICONS = { success: CheckCircle2, error: XCircle, info: Info };

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id) => setItems((xs) => xs.filter((t) => t.id !== id)), []);

  const push = useCallback((type, message, ms = 4200) => {
    const id = ++idRef.current;
    setItems((xs) => [...xs.slice(-3), { id, type, message }]);
    if (ms) setTimeout(() => dismiss(id), ms);
    return id;
  }, [dismiss]);

  const api = useMemo(() => ({
    success: (m, ms) => push('success', m, ms),
    error: (m, ms) => push('error', m, ms ?? 6000),
    info: (m, ms) => push('info', m, ms),
    dismiss,
  }), [push, dismiss]);

  return (
    <ToastCtx.Provider value={api}>
      {children}
      {createPortal(
        <div className="toasts" aria-live="polite">
          {items.map((t) => {
            const Icon = ICONS[t.type] || Info;
            return (
              <div key={t.id} className={`toast ${t.type}`} role="status">
                <Icon size={17} />
                <div>{t.message}</div>
                <button className="toast-close" onClick={() => dismiss(t.id)} aria-label="Dismiss"><X size={14} /></button>
              </div>
            );
          })}
        </div>,
        document.body
      )}
    </ToastCtx.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastCtx);
  if (!ctx) throw new Error('useToast must be used inside <ToastProvider>');
  return ctx;
}
