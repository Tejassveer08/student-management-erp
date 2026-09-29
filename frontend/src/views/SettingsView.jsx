import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
  ShieldAlert,
  Settings, 
  FileText, 
  Save, 
  AlertTriangle, 
  CheckCircle2, 
  RefreshCw, 
  Search, 
  Filter, 
  Clock, 
  User, 
  Activity,
  Sliders,
  Download,
  Database
} from 'lucide-react';

export default function SettingsView() {
  const { token, user, hasPermission, quickSwitchRole } = useAuth();
  const [settings, setSettings] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('settings'); // 'settings' | 'audit_logs'
  const [savingKey, setSavingKey] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState('ALL');

  useEffect(() => {
    if (token && user?.role === 'admin') {
      fetchData();
    } else {
      setLoading(false);
    }
  }, [token, user?.role]);

  async function fetchData() {
    setLoading(true);
    try {
      const [settRes, logsRes] = await Promise.all([
        fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/settings/audit-logs', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (settRes.ok) {
        const settData = await settRes.json();
        const settArray = Array.isArray(settData)
          ? settData
          : Object.keys(settData).map(k => ({
              setting_key: k,
              setting_value: settData[k].rawValue || (typeof settData[k].value === 'object' ? JSON.stringify(settData[k].value, null, 2) : String(settData[k].value ?? '')),
              description: settData[k].description,
              category: settData[k].category || 'General',
              data_type: typeof settData[k].value === 'number' ? 'number' : (typeof settData[k].value === 'object' ? 'json' : 'string'),
              updated_at: settData[k].updated_at,
              updated_by: settData[k].updated_by_name || 'System'
            }));
        setSettings(settArray);
      }

      if (logsRes.ok) {
        const logsData = await logsRes.json();
        const logsArray = Array.isArray(logsData) ? logsData : (logsData.logs || []);
        setAuditLogs(logsArray);
      }
    } catch (err) {
      console.error('Failed to load settings or audit logs:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleSettingChange = (key, value) => {
    setSettings(prev => prev.map(s => s.setting_key === key ? { ...s, setting_value: value } : s));
  };

  const saveSetting = async (setting) => {
    setSavingKey(setting.setting_key);
    try {
      const res = await fetch(`/api/settings/${setting.setting_key}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          value: setting.setting_value,
          description: setting.description,
          reason: `Admin updated ${setting.setting_key} via Governance Console`
        })
      });

      if (res.ok) {
        setToastMessage(`Policy parameter "${setting.setting_key}" updated & logged!`);
        setTimeout(() => setToastMessage(null), 3500);

        // Refresh audit logs since settings update produces a real-time audit entry
        const logsRes = await fetch('/api/settings/audit-logs', { headers: { Authorization: `Bearer ${token}` } });
        if (logsRes.ok) {
          const lData = await logsRes.json();
          setAuditLogs(Array.isArray(lData) ? lData : (lData.logs || []));
        }
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Failed to save: ${err.error || 'Server error'}`);
      }
    } catch (err) {
      alert(`Network error saving setting: ${err.message}`);
    } finally {
      setSavingKey(null);
    }
  };

  // Export audit trail to CSV
  const exportAuditCSV = () => {
    if (!filteredAuditLogs.length) return;
    const headers = ['ID', 'Timestamp', 'Actor Email', 'Role', 'Action', 'Entity Type', 'Entity ID', 'Prior Value', 'New Value', 'Reason', 'IP Address'];
    const rows = filteredAuditLogs.map(l => [
      l.id,
      `"${new Date(l.created_at).toISOString()}"`,
      `"${l.user_email || ''}"`,
      `"${l.user_role || ''}"`,
      `"${l.action || ''}"`,
      `"${l.entity_type || ''}"`,
      `"${l.entity_id || ''}"`,
      `"${(typeof l.old_value === 'object' ? JSON.stringify(l.old_value) : (l.old_value || '')).replace(/"/g, '""')}"`,
      `"${(typeof l.new_value === 'object' ? JSON.stringify(l.new_value) : (l.new_value || '')).replace(/"/g, '""')}"`,
      `"${(l.reason || '').replace(/"/g, '""')}"`,
      `"${l.ip_address || ''}"`
    ]);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `gtbit_audit_trail_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Guard against non-admin roles
  if (user && user.role !== 'admin') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
        <div className="glass-panel" style={{
          padding: '3rem 2.5rem',
          maxWidth: '560px',
          textAlign: 'center',
          borderRadius: 'var(--radius-xl)',
          border: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-float)'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '20px',
            background: 'rgba(239, 68, 68, 0.12)',
            color: 'var(--danger)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 1.5rem',
            border: '1px solid rgba(239, 68, 68, 0.25)'
          }}>
            <ShieldAlert size={32} />
          </div>

          <span className="badge badge-danger" style={{ marginBottom: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Administrative Authority Required
          </span>

          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: '0.75rem' }}>
            Institutional Governance & Audit Logs
          </h2>

          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.6, marginBottom: '1.75rem' }}>
            This console governs campus-wide regulatory policies, grading scales, CGPA prediction weights, and tamper-evident audit trails. It is restricted to the <strong>Administrator / Dean</strong> role.
          </p>

          <button
            onClick={() => quickSwitchRole('admin')}
            className="btn btn-primary"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.75rem 1.5rem', fontWeight: 700 }}
          >
            <ShieldCheck size={16} /> Switch to Admin Persona (Dean Academics)
          </button>
        </div>
      </div>
    );
  }

  // Filter audit logs
  const filteredAuditLogs = auditLogs.filter(log => {
    const matchesSearch = 
      (log.user_email || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.action || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.reason || '').toLowerCase().includes(auditSearch.toLowerCase()) ||
      (log.entity_type || '').toLowerCase().includes(auditSearch.toLowerCase());

    const matchesAction = auditFilterAction === 'ALL' || log.action === auditFilterAction;
    return matchesSearch && matchesAction;
  });

  const distinctActions = ['ALL', ...new Set(auditLogs.map(l => l.action).filter(Boolean))];

  if (loading) {
    return (
      <div style={{ padding: '4rem 2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{
          width: '48px',
          height: '48px',
          border: '3px solid var(--border-subtle)',
          borderTopColor: 'var(--role-accent)',
          borderRadius: '50%',
          animation: 'spin 0.8s linear infinite',
          margin: '0 auto 1.5rem'
        }}></div>
        <div style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.35rem' }}>
          Loading Governance & Regulatory Console...
        </div>
        <div style={{ fontSize: '0.84rem' }}>
          Retrieving institutional policy configurations and audit trails...
        </div>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem 2rem',
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(13, 148, 136, 0.08) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        borderLeft: '4px solid var(--role-accent)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
            <span className="badge" style={{ background: 'var(--role-badge-bg)', color: 'var(--role-accent)', fontWeight: 700 }}>
              Institutional Governance
            </span>
            <span className="badge badge-success">Admin Authority Active</span>
          </div>
          <h1 style={{ fontSize: '1.65rem' }}>Institution Settings & Regulatory Audit Logs</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginTop: '0.2rem' }}>
            Configure institutional compliance policies, grading standards, and inspect cryptographic audit trails.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button 
            onClick={() => setActiveSubTab('settings')}
            className={`btn btn-sm ${activeSubTab === 'settings' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Settings size={15} /> Policy Parameters ({settings.length})
          </button>
          <button 
            onClick={() => setActiveSubTab('audit_logs')}
            className={`btn btn-sm ${activeSubTab === 'audit_logs' ? 'btn-primary' : 'btn-secondary'}`}
            style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
          >
            <Activity size={15} /> System Audit Trail ({auditLogs.length})
          </button>
        </div>
      </div>

      {toastMessage && (
        <div style={{
          padding: '0.75rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          background: 'var(--success-bg)',
          border: '1px solid var(--success-border)',
          color: 'var(--success)',
          fontWeight: 600,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle2 size={18} />
          {toastMessage}
        </div>
      )}

      {/* Subtab 1: Institutional Settings */}
      {activeSubTab === 'settings' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Institutional Policy Knobs</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Configurable parameters impacting academic regulations, automated detention alerts, and fee structures.
              </p>
            </div>
            <button onClick={fetchData} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
            {settings.map(s => {
              const isJson = s.data_type === 'json' || s.setting_value?.trim().startsWith('{') || s.setting_value?.trim().startsWith('[');
              return (
                <div key={s.setting_key} style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--role-accent)' }}>
                      {s.setting_key.replace(/_/g, ' ').toUpperCase()}
                    </span>
                    <span className="badge badge-info" style={{ fontSize: '0.65rem' }}>
                      Category: {s.category || 'Academic'}
                    </span>
                  </div>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                    {s.description || 'Configurable institutional governance rule.'}
                  </p>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: 'auto' }}>
                    {isJson ? (
                      <textarea
                        rows={4}
                        value={s.setting_value}
                        onChange={(e) => handleSettingChange(s.setting_key, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-strong)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.78rem',
                          resize: 'vertical'
                        }}
                      />
                    ) : (
                      <input 
                        type={s.data_type === 'number' ? 'number' : 'text'}
                        step="any"
                        value={s.setting_value}
                        onChange={(e) => handleSettingChange(s.setting_key, e.target.value)}
                        style={{
                          width: '100%',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          border: '1px solid var(--border-strong)',
                          background: 'var(--bg-surface)',
                          color: 'var(--text-primary)',
                          fontSize: '0.85rem'
                        }}
                      />
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>
                        Updated by: {s.updated_by || 'System'}
                      </span>
                      <button 
                        onClick={() => saveSetting(s)}
                        disabled={savingKey === s.setting_key}
                        className="btn btn-primary btn-sm"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.35rem' }}
                      >
                        <Save size={14} />
                        {savingKey === s.setting_key ? 'Saving...' : 'Save Rule'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Subtab 2: System Audit Logs */}
      {activeSubTab === 'audit_logs' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Immutable Administrative Audit Trail</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Regulatory log tracking all administrative overrides, mark moderations, fee waivers, and setting changes.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <button
                onClick={exportAuditCSV}
                className="btn btn-secondary btn-sm"
                title="Download CSV for regulatory compliance & accreditation"
                style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
              >
                <Download size={14} /> Export CSV
              </button>

              <div style={{ position: 'relative' }}>
                <Search size={14} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
                <input 
                  type="text"
                  placeholder="Search user, action, reason..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  style={{
                    padding: '0.45rem 0.75rem 0.45rem 2.25rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface)',
                    color: 'var(--text-primary)',
                    fontSize: '0.8rem',
                    width: '220px'
                  }}
                />
              </div>

              <select 
                value={auditFilterAction}
                onChange={(e) => setAuditFilterAction(e.target.value)}
                style={{
                  padding: '0.45rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface)',
                  color: 'var(--text-primary)',
                  fontSize: '0.8rem'
                }}
              >
                {distinctActions.map(act => (
                  <option key={act} value={act}>{act}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.8rem' }}>
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Actor / Role</th>
                  <th>Action</th>
                  <th>Entity</th>
                  <th>Prior Value</th>
                  <th>New Value</th>
                  <th>Reason / Justification</th>
                </tr>
              </thead>
              <tbody>
                {filteredAuditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                      No audit records found matching filters.
                    </td>
                  </tr>
                ) : (
                  filteredAuditLogs.map(log => (
                    <tr key={log.id}>
                      <td style={{ whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                          <Clock size={12} />
                          {new Date(log.created_at).toLocaleString()}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{log.user_email || 'System'}</div>
                        <span className="badge badge-primary" style={{ fontSize: '0.62rem', textTransform: 'uppercase' }}>
                          {log.user_role}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${log.action.includes('OVERRIDE') ? 'badge-danger' : (log.action.includes('PUBLISH') ? 'badge-success' : 'badge-warning')}`} style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>
                          {log.action}
                        </span>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.72rem' }}>
                          {log.entity_type} #{log.entity_id}
                        </span>
                      </td>
                      <td style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                        {log.old_value ? (typeof log.old_value === 'string' ? log.old_value : JSON.stringify(log.old_value)) : '—'}
                      </td>
                      <td style={{ maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 600 }}>
                        {log.new_value ? (typeof log.new_value === 'string' ? log.new_value : JSON.stringify(log.new_value)) : '—'}
                      </td>
                      <td style={{ maxWidth: '220px', color: 'var(--text-secondary)' }}>
                        {log.reason || 'Administrative action'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
