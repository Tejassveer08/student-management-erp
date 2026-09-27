import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { 
  ShieldCheck, 
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
  Sliders
} from 'lucide-react';

export default function SettingsView() {
  const { token, user, hasPermission } = useAuth();
  const [settings, setSettings] = useState([]);
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeSubTab, setActiveSubTab] = useState('settings'); // 'settings' | 'audit_logs'
  const [savingKey, setSavingKey] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);
  const [auditSearch, setAuditSearch] = useState('');
  const [auditFilterAction, setAuditFilterAction] = useState('ALL');

  useEffect(() => {
    fetchData();
  }, [token]);

  async function fetchData() {
    setLoading(true);
    try {
      const [settRes, logsRes] = await Promise.all([
        fetch('/api/settings', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/settings/audit-logs', { headers: { Authorization: `Bearer ${token}` } })
      ]);

      if (settRes.ok) {
        const settData = await settRes.json();
        setSettings(settData);
      }
      if (logsRes.ok) {
        const logsData = await logsRes.json();
        setAuditLogs(logsData);
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
          description: setting.description
        })
      });

      if (res.ok) {
        setToastMessage(`Updated ${setting.setting_key} successfully!`);
        setTimeout(() => setToastMessage(null), 3000);
        // Refresh audit logs since settings update produces an audit entry
        const logsRes = await fetch('/api/settings/audit-logs', { headers: { Authorization: `Bearer ${token}` } });
        if (logsRes.ok) setAuditLogs(await logsRes.json());
      } else {
        const err = await res.json();
        alert(`Failed to save: ${err.error || 'Server error'}`);
      }
    } catch (err) {
      alert(`Network error saving setting: ${err.message}`);
    } finally {
      setSavingKey(null);
    }
  };

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
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚡ Loading Governance Console...</div>
        <div>Retrieving institutional policy configurations and audit logs...</div>
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
          >
            <Settings size={15} /> Policy Parameters
          </button>
          <button 
            onClick={() => setActiveSubTab('audit_logs')}
            className={`btn btn-sm ${activeSubTab === 'audit_logs' ? 'btn-primary' : 'btn-secondary'}`}
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
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h2 style={{ fontSize: '1.15rem', fontWeight: 700 }}>Institutional Policy Knobs</h2>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Configurable parameters impacting academic regulations, automated detention alerts, and fee structures.
              </p>
            </div>
            <button onClick={fetchData} className="btn btn-secondary btn-sm">
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1rem' }}>
            {settings.map(s => (
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
                    Type: {s.data_type || 'string'}
                  </span>
                </div>

                <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  {s.description || 'Configurable institutional governance rule.'}
                </p>

                <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                  <input 
                    type={s.data_type === 'number' ? 'number' : 'text'}
                    value={s.setting_value}
                    onChange={(e) => handleSettingChange(s.setting_key, e.target.value)}
                    style={{
                      flex: 1,
                      padding: '0.5rem 0.75rem',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border-strong)',
                      background: 'var(--bg-surface)',
                      color: 'var(--text-primary)',
                      fontSize: '0.85rem'
                    }}
                  />
                  <button 
                    onClick={() => saveSetting(s)}
                    disabled={savingKey === s.setting_key}
                    className="btn btn-primary btn-sm"
                  >
                    <Save size={14} />
                    {savingKey === s.setting_key ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            ))}
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

            <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
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
