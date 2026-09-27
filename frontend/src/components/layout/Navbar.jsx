import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { 
  Bell, Sun, Moon, Shield, GraduationCap, Users, HeartHandshake, 
  LogOut, X, Clock, Sparkles
} from 'lucide-react';

export default function Navbar({ onMenuToggle }) {
  const { user, token, theme, toggleTheme, logout } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showNotifications, setShowNotifications] = useState(false);
  const [currentTime, setCurrentTime] = useState(new Date());

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

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
      } catch (err) { /* silent */ }
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
    } catch (err) { /* silent */ }
  };

  const roleIcon = {
    admin: Shield,
    faculty: Users,
    student: GraduationCap,
    parent: HeartHandshake
  }[user?.role?.toLowerCase()] || GraduationCap;
  const RoleIcon = roleIcon;

  const greeting = (() => {
    const h = currentTime.getHours();
    if (h < 12) return 'Good Morning';
    if (h < 17) return 'Good Afternoon';
    return 'Good Evening';
  })();

  return (
    <header className="glass-panel animate-slide-up" style={{
      position: 'sticky',
      top: 0,
      zIndex: 100,
      margin: '0.6rem 0.75rem 0 0.75rem',
      borderRadius: 'var(--radius-lg)',
      padding: '0.6rem 1.25rem',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: '1rem',
      borderLeft: '4px solid var(--role-accent)',
      boxShadow: '0 4px 24px var(--role-accent-glow), var(--shadow-md)',
      background: 'var(--bg-glass)'
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
          background: 'var(--role-gradient)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#ffffff',
          fontWeight: '900',
          fontSize: '1.2rem',
          boxShadow: '0 4px 14px var(--role-accent-glow)',
          letterSpacing: '-0.02em',
          position: 'relative',
          overflow: 'hidden'
        }}>
          G
          {/* Shimmer on logo */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: '-100%',
            width: '200%',
            height: '100%',
            background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.2) 50%, transparent 100%)',
            animation: 'shimmerProgress 3s infinite',
            pointerEvents: 'none'
          }}></div>
        </div>
        
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 800, fontSize: '1.1rem', letterSpacing: '-0.025em', color: 'var(--text-primary)' }}>
              GTBIT ERP
            </span>
            <span className="badge" style={{ 
              fontSize: '0.62rem', 
              padding: '0.12rem 0.45rem',
              background: 'var(--role-badge-bg)',
              color: 'var(--role-accent)',
              border: '1px solid var(--role-badge-border)',
              fontWeight: 800,
              letterSpacing: '0.04em'
            }}>
              GGSIPU
            </span>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <Clock size={10} />
            {greeting}, <span style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{user?.fullName?.split(' ')[0] || 'User'}</span>
            <span style={{ opacity: 0.5 }}>•</span>
            {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </div>
        </div>
      </div>

      {/* Right Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        {/* Static Role Badge */}
        <div style={{ 
          borderRadius: 'var(--radius-full)', 
          padding: '0.35rem 0.8rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.4rem',
          fontSize: '0.76rem',
          fontWeight: 700,
          background: 'var(--role-badge-bg)',
          border: '1px solid var(--role-badge-border)',
          color: 'var(--role-accent)',
          boxShadow: '0 2px 10px var(--role-accent-glow)'
        }}>
          <RoleIcon size={13} />
          <span style={{ textTransform: 'capitalize', fontWeight: 800 }}>
            {user?.role || 'Guest'}
          </span>
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
            <Bell size={16} color="var(--text-secondary)" />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: '-3px',
                right: '-3px',
                background: 'linear-gradient(135deg, #ef4444 0%, #f87171 100%)',
                color: '#ffffff',
                fontSize: '0.6rem',
                fontWeight: 800,
                borderRadius: '9999px',
                padding: '0.1rem 0.35rem',
                minWidth: '16px',
                textAlign: 'center',
                boxShadow: '0 2px 8px rgba(239, 68, 68, 0.5)',
                animation: 'pulseGlow 2s infinite'
              }}>
                {unreadCount}
              </span>
            )}
          </button>

          {showNotifications && (
            <>
              {/* Backdrop to close */}
              <div 
                onClick={() => setShowNotifications(false)}
                style={{ position: 'fixed', inset: 0, zIndex: 199 }}
              ></div>
              <div className="glass-panel animate-scale-in" style={{
                position: 'absolute',
                top: 'calc(100% + 10px)',
                right: 0,
                width: '360px',
                maxHeight: '420px',
                overflowY: 'auto',
                padding: '0',
                borderRadius: 'var(--radius-lg)',
                boxShadow: 'var(--shadow-float)',
                background: 'var(--bg-surface)',
                zIndex: 200,
                border: '1px solid var(--border-subtle)'
              }}>
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'space-between',
                  padding: '0.85rem 1rem',
                  borderBottom: '1px solid var(--border-subtle)',
                  background: 'var(--bg-surface-subtle)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                    <Bell size={15} color="var(--role-accent)" />
                    <span style={{ fontWeight: 800, fontSize: '0.88rem' }}>Notifications</span>
                    {unreadCount > 0 && (
                      <span className="badge badge-danger" style={{ fontSize: '0.6rem', padding: '0.1rem 0.35rem' }}>
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    {unreadCount > 0 && (
                      <button 
                        onClick={markAllRead} 
                        style={{ 
                          background: 'none', 
                          border: 'none', 
                          color: 'var(--role-accent)', 
                          fontSize: '0.72rem', 
                          cursor: 'pointer',
                          fontWeight: 700,
                          fontFamily: 'inherit'
                        }}
                      >
                        Mark all read
                      </button>
                    )}
                    <button
                      onClick={() => setShowNotifications(false)}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '2px', color: 'var(--text-muted)' }}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                <div style={{ padding: '0.5rem' }}>
                  {notifications.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '2rem 1rem', color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                      <Bell size={28} style={{ opacity: 0.3, marginBottom: '0.5rem' }} />
                      <div>No new notifications</div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                      {notifications.map((n, idx) => (
                        <div 
                          key={n.id}
                          className="animate-card-in"
                          style={{
                            padding: '0.65rem 0.75rem',
                            borderRadius: 'var(--radius-sm)',
                            background: n.is_read ? 'transparent' : 'var(--bg-surface-subtle)',
                            borderLeft: `3px solid ${
                              n.type === 'attendance_alert' ? 'var(--danger)' :
                              n.type === 'cgpa_warning' ? 'var(--warning)' : 'var(--role-accent)'
                            }`,
                            transition: 'background 0.2s ease',
                            animationDelay: `${idx * 0.04}s`
                          }}
                        >
                          <div style={{ fontWeight: 700, fontSize: '0.8rem', color: 'var(--text-primary)' }}>
                            {n.title}
                          </div>
                          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '0.2rem', lineHeight: 1.4 }}>
                            {n.message}
                          </div>
                          <div style={{ fontSize: '0.64rem', color: 'var(--text-muted)', marginTop: '0.3rem', fontWeight: 500 }}>
                            {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Theme Toggle */}
        <button 
          onClick={toggleTheme}
          className="btn btn-secondary btn-sm"
          style={{ 
            borderRadius: 'var(--radius-full)', 
            width: '36px', 
            height: '36px', 
            padding: 0,
            transition: 'all 0.3s ease'
          }}
          title={theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
        >
          {theme === 'light' ? (
            <Moon size={16} color="var(--text-secondary)" />
          ) : (
            <Sun size={16} color="#fbbf24" />
          )}
        </button>

        {/* User Avatar & Logout */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: '0.15rem' }}>
          <div style={{ position: 'relative' }}>
            <img 
              src={user?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'} 
              alt={user?.fullName || 'User'}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                objectFit: 'cover',
                border: '2px solid var(--role-accent)',
                boxShadow: '0 2px 8px var(--role-accent-glow)'
              }}
            />
          </div>

          <button 
            onClick={logout}
            className="btn btn-sm"
            style={{ 
              padding: '0.4rem 0.7rem', 
              borderRadius: 'var(--radius-full)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.3rem',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              color: 'var(--danger)',
              fontWeight: 700,
              fontSize: '0.74rem',
              cursor: 'pointer',
              transition: 'all 0.25s ease'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.4)';
              e.currentTarget.style.transform = 'scale(1.03)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(239, 68, 68, 0.2)';
              e.currentTarget.style.transform = 'scale(1)';
            }}
            title="Log Out & Return to Login Screen"
            id="logoutBtn"
          >
            <LogOut size={13} />
            <span>Log Out</span>
          </button>
        </div>
      </div>
    </header>
  );
}
