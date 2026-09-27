import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Bell, Sun, Moon, Shield, GraduationCap, Users, HeartHandshake, 
  CheckCircle, AlertTriangle, ChevronDown, LogOut, Check, Sparkles 
} from 'lucide-react';

export default function Navbar({ onMenuToggle }) {
  const { user, token, quickSwitchRole, theme, toggleTheme, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [showRoleMenu, setShowRoleMenu] = useState(false);

  useEffect(() => {
    if (!token) return;

    async function fetchNotifications() {
      try {
        const res = await fetch('/api/dashboard/notifications', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setNotifications(data.notifications || []);
          setUnreadCount(data.unread_count || 0);
        }
      } catch (err) {
        // silent
      }
    }

    fetchNotifications();
    const interval = setInterval(fetchNotifications, 15000);
    return () => clearInterval(interval);
  }, [token]);

  const markAllRead = async () => {
    try {
      await fetch('/api/dashboard/notifications/mark-read', {
        method: 'POST',
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      });
      setUnreadCount(0);
      setNotifications(prev => prev.map(n => ({ ...n, is_read: 1 })));
    } catch (err) {
      // silent
    }
  };

  const roles = [
    { id: 'admin', label: 'Admin (HOD)', icon: Shield, email: 'admin@gtbit.ac.in', desc: 'Prof. Basanti Pal Nandi (Dean & HOD)' },
    { id: 'faculty', label: 'Faculty', icon: Users, email: 'faculty.nandi@gtbit.ac.in', desc: 'Ms. Basanti Pal Nandi (Project Guide)' },
    { id: 'student', label: 'Student (Tejassveer)', icon: GraduationCap, email: 'tejassveer@gtbit.ac.in', desc: 'Roll: 071/CSE2/2023 | 8.78 CGPA' },
    { id: 'student-dev', label: 'Student (Dev)', icon: GraduationCap, email: 'dev.sharma@gtbit.ac.in', desc: 'Roll: 605/CSE2/2023 | 8.45 CGPA' },
    { id: 'student-aman', label: 'Student (Aman - Risk)', icon: AlertTriangle, email: 'aman.gupta@gtbit.ac.in', desc: 'Low Attendance 67.5% (<75% Alert Demo)' },
    { id: 'parent', label: 'Parent', icon: HeartHandshake, email: 'parent.tejassveer@gmail.com', desc: 'Mr. Kuldeep Singh Vasant' }
  ];

  return (
    <header className="glass-panel" style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      margin: '0.75rem 1rem 0 1rem',
      borderRadius: 'var(--radius-lg)',
      padding: '0.65rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem'
    }}>
      {/* Brand & College Crest */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
        <button 
          onClick={onMenuToggle}
          className="btn btn-secondary btn-sm"
          style={{ display: 'none', padding: '0.4rem', border: 'none' }}
          id="mobileMenuBtn"
        >
          ☰
        </button>

        <div style={{
          width: '42px',
          height: '42px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: '800',
          fontSize: '1.25rem',
          boxShadow: '0 4px 12px rgba(79, 70, 229, 0.35)'
        }}>
          G
        </div>
        
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.02em', color: 'var(--text-primary)' }}>
              GTBIT ERP
            </span>
            <span className="badge badge-primary" style={{ fontSize: '0.68rem', padding: '0.15rem 0.5rem' }}>
              GGSIPU
            </span>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
            Guru Tegh Bahadur Institute of Technology • CSE Dept
          </div>
        </div>
      </div>

      {/* Role Switcher Toolbar (Persona Switcher for effortless demo) */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowRoleMenu(!showRoleMenu)}
            className="btn btn-secondary btn-sm"
            style={{ 
              borderRadius: 'var(--radius-full)', 
              padding: '0.4rem 0.85rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.45rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: 'var(--bg-surface)',
              borderColor: 'var(--primary-glow)'
            }}
          >
            <Sparkles size={14} color="#6366f1" />
            <span>Persona:</span>
            <span style={{ 
              color: 'var(--primary)', 
              textTransform: 'capitalize',
              fontWeight: 700 
            }}>
              {user?.role || 'Guest'}
            </span>
            <ChevronDown size={14} />
          </button>

          {showRoleMenu && (
            <div className="glass-panel" style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '310px',
              padding: '0.6rem',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-xl)',
              background: 'var(--bg-surface)',
              zIndex: 200
            }}>
              <div style={{ 
                padding: '0.4rem 0.6rem 0.5rem 0.6rem', 
                fontSize: '0.75rem', 
                fontWeight: 700, 
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                borderBottom: '1px solid var(--border-subtle)'
              }}>
                Switch Active Persona
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', marginTop: '0.4rem' }}>
                {roles.map(r => {
                  const Icon = r.icon;
                  const isActive = user?.email === r.email;
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        quickSwitchRole(r.id.startsWith('student') ? 'student' : r.id, r.email);
                        setShowRoleMenu(false);
                      }}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '0.55rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        border: 'none',
                        background: isActive ? 'var(--primary-glow)' : 'transparent',
                        color: isActive ? 'var(--primary)' : 'var(--text-primary)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                        transition: 'all 0.15s ease'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <div style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '8px',
                          background: isActive ? 'var(--primary)' : 'var(--bg-surface-subtle)',
                          color: isActive ? '#fff' : 'var(--text-secondary)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center'
                        }}>
                          <Icon size={14} />
                        </div>
                        <div>
                          <div style={{ fontSize: '0.825rem', fontWeight: 600 }}>{r.label}</div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{r.desc}</div>
                        </div>
                      </div>
                      {isActive && <Check size={16} color="var(--primary)" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Notifications Bell */}
        <div style={{ position: 'relative' }}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className="btn btn-secondary btn-sm"
            style={{ 
              borderRadius: 'var(--radius-full)', 
              width: '36px', 
              height: '36px', 
              padding: 0,
              position: 'relative'
            }}
            title="Notifications"
          >
            <Bell size={17} color="var(--text-secondary)" />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                background: 'var(--danger)',
                color: '#ffffff',
                fontSize: '0.65rem',
                fontWeight: 800,
                borderRadius: '9999px',
                padding: '0.1rem 0.35rem',
                minWidth: '16px',
                textAlign: 'center',
                boxShadow: '0 2px 5px rgba(239, 68, 68, 0.4)',
                animation: 'pulseGlow 2s infinite'
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <div className="glass-panel" style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              right: 0,
              width: '340px',
              maxHeight: '400px',
              overflowY: 'auto',
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-xl)',
              background: 'var(--bg-surface)',
              zIndex: 200
            }}>
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                paddingBottom: '0.5rem',
                borderBottom: '1px solid var(--border-subtle)',
                marginBottom: '0.5rem'
              }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>Notifications</span>
                {unreadCount > 0 && (
                  <button 
                    onClick={markAllRead} 
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--primary)', 
                      fontSize: '0.75rem', 
                      cursor: 'pointer',
                      fontWeight: 600
                    }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              {notifications.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                  No new notifications
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                  {notifications.map(n => (
                    <div 
                      key={n.id}
                      style={{
                        padding: '0.6rem',
                        borderRadius: 'var(--radius-sm)',
                        background: n.is_read ? 'transparent' : 'var(--bg-surface-subtle)',
                        borderLeft: `3px solid ${
                          n.type === 'attendance_alert' ? 'var(--danger)' :
                          n.type === 'cgpa_warning' ? 'var(--warning)' : 'var(--primary)'
                        }`
                      }}
                    >
                      <div style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                        {n.message}
                      </div>
                      <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                        {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Theme Toggle Button */}
        <button 
          onClick={toggleTheme}
          className="btn btn-secondary btn-sm"
          style={{ 
            borderRadius: 'var(--radius-full)', 
            width: '36px', 
            height: '36px', 
            padding: 0 
          }}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? (
            <Moon size={17} color="var(--text-secondary)" />
          ) : (
            <Sun size={17} color="#fbbf24" />
          )}
        </button>

        {/* User Avatar & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginLeft: '0.25rem' }}>
          <img 
            src={user?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'} 
            alt={user?.fullName || 'User'}
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '9999px',
              objectFit: 'cover',
              border: '2px solid var(--primary-glow)'
            }}
          />

          <button 
            onClick={logout}
            className="btn btn-secondary btn-sm"
            style={{ padding: '0.4rem', borderRadius: 'var(--radius-full)' }}
            title="Log Out"
          >
            <LogOut size={15} color="var(--danger)" />
          </button>
        </div>
      </div>
    </header>
  );
}
