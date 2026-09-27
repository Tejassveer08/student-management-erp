import React from 'react';
import { useAuth } from '../../context/AuthContext';
import {
  LayoutDashboard,
  QrCode,
  TrendingUp,
  GraduationCap,
  Users,
  Calendar,
  Award,
  FileText,
  CreditCard,
  Bell,
  BookOpen,
  Briefcase,
  Trophy,
  ShieldCheck,
  Sparkles,
  ChevronRight,
  Zap
} from 'lucide-react';

export default function Sidebar({ currentTab, setCurrentTab }) {
  const { user, hasPermission, roleMeta } = useAuth();

  const rawNavGroups = [
    {
      group: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, module: null }
      ]
    },
    {
      group: 'Flagship Innovations',
      items: [
        { id: 'attendance', label: 'Smart Attendance', icon: QrCode, module: 'attendance', highlight: true },
        { id: 'cgpa-simulator', label: 'CGPA Probability', icon: TrendingUp, module: 'cgpa_probability', highlight: true }
      ]
    },
    {
      group: 'Academic ERP',
      items: [
        { id: 'students', label: 'Student Dossiers', icon: GraduationCap, module: 'students' },
        { id: 'faculty', label: 'Faculty & Workload', icon: Users, module: 'faculty' },
        { id: 'academics', label: 'Academics & Timetable', icon: Calendar, module: 'academics' },
        { id: 'exams', label: 'Exams & Results', icon: Award, module: 'exams' },
        { id: 'assignments', label: 'Assignments & Notes', icon: FileText, module: 'assignments' }
      ]
    },
    {
      group: 'Administration',
      items: [
        { id: 'fees', label: 'Fees & Payments', icon: CreditCard, module: 'fees' },
        { id: 'notices', label: 'Notices & Bulletin', icon: Bell, module: 'notices' },
        { id: 'settings', label: 'Governance & Audit', icon: ShieldCheck, module: 'settings' }
      ]
    },
    {
      group: 'Campus',
      items: [
        { id: 'library-hostel', label: 'Library & Hostel', icon: BookOpen, module: 'library' },
        { id: 'placements', label: 'Placements & TnP', icon: Briefcase, module: 'placements' }
      ]
    },
    {
      group: 'Engagement',
      items: [
        { id: 'engagement', label: 'Merit & AI Guide', icon: Trophy, module: 'engagement' }
      ]
    }
  ];

  const navGroups = rawNavGroups.map(grp => ({
    ...grp,
    items: grp.items.filter(item => {
      if (!item.module) return true;
      return hasPermission(item.module, 'read');
    })
  })).filter(grp => grp.items.length > 0);

  return (
    <aside style={{
      width: '270px',
      flexShrink: 0,
      background: 'var(--bg-sidebar)',
      backdropFilter: 'blur(20px) saturate(1.5)',
      WebkitBackdropFilter: 'blur(20px) saturate(1.5)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1rem 0.75rem',
      height: '100%',
      overflowY: 'auto',
      position: 'relative',
      zIndex: 2
    }}>
      {/* Role-Themed User Identity Card */}
      <div 
        className="animate-slide-left"
        style={{
          padding: '1rem',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--role-badge-bg)',
          border: '1px solid var(--role-badge-border)',
          marginBottom: '1.25rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          boxShadow: '0 4px 16px var(--role-accent-glow)',
          position: 'relative',
          overflow: 'hidden'
        }}
      >
        {/* Decorative gradient blob */}
        <div style={{
          position: 'absolute',
          top: '-50%',
          right: '-20%',
          width: '80px',
          height: '80px',
          borderRadius: '50%',
          background: 'var(--role-accent)',
          opacity: 0.08,
          filter: 'blur(20px)',
          pointerEvents: 'none'
        }}></div>

        <div style={{ position: 'relative', flexShrink: 0 }}>
          <img 
            src={user?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'} 
            alt="User Avatar"
            style={{ 
              width: '42px', 
              height: '42px', 
              borderRadius: '12px', 
              objectFit: 'cover',
              border: '2px solid var(--role-accent)',
              boxShadow: '0 2px 8px var(--role-accent-glow)'
            }}
          />
          <span style={{
            position: 'absolute',
            bottom: '-2px',
            right: '-2px',
            width: '12px',
            height: '12px',
            borderRadius: '50%',
            backgroundColor: '#10b981',
            border: '2.5px solid var(--bg-surface)',
            boxShadow: '0 0 6px rgba(16, 185, 129, 0.5)'
          }}></span>
        </div>

        <div style={{ overflow: 'hidden', flex: 1 }}>
          <div style={{ 
            fontSize: '0.88rem', 
            fontWeight: 800, 
            whiteSpace: 'nowrap', 
            textOverflow: 'ellipsis', 
            overflow: 'hidden',
            color: 'var(--text-primary)',
            letterSpacing: '-0.01em'
          }}>
            {user?.fullName || 'User'}
          </div>
          <div style={{ 
            fontSize: '0.7rem', 
            fontWeight: 700, 
            color: 'var(--role-accent)',
            textTransform: 'uppercase',
            letterSpacing: '0.03em',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            <Zap size={10} />
            {roleMeta?.badge || `${user?.role} Portal`}
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', flex: 1 }}>
        {navGroups.map((grp, gIdx) => (
          <div key={gIdx} className="animate-slide-left" style={{ animationDelay: `${(gIdx + 1) * 0.06}s` }}>
            <div style={{
              fontSize: '0.65rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              color: 'var(--text-muted)',
              padding: '0 0.75rem 0.45rem 0.75rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem'
            }}>
              {grp.group === 'Flagship Innovations' && <Sparkles size={10} color="var(--role-accent)" />}
              {grp.group}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {grp.items.map(item => {
                const Icon = item.icon;
                const isActive = currentTab === item.id;

                return (
                  <button
                    key={item.id}
                    onClick={() => setCurrentTab(item.id)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.6rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: isActive 
                        ? 'var(--role-gradient)' 
                        : (item.highlight ? 'var(--role-badge-bg)' : 'transparent'),
                      color: isActive 
                        ? '#ffffff' 
                        : (item.highlight ? 'var(--role-accent)' : 'var(--text-secondary)'),
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '0.82rem',
                      fontWeight: isActive ? 700 : (item.highlight ? 600 : 500),
                      boxShadow: isActive ? '0 4px 14px var(--role-accent-glow)' : 'none',
                      transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                      position: 'relative',
                      overflow: 'hidden'
                    }}
                    onMouseEnter={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = item.highlight ? 'var(--role-badge-bg)' : 'var(--bg-surface-subtle)';
                        e.currentTarget.style.transform = 'translateX(4px)';
                        e.currentTarget.style.color = item.highlight ? 'var(--role-accent)' : 'var(--text-primary)';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isActive) {
                        e.currentTarget.style.background = item.highlight ? 'var(--role-badge-bg)' : 'transparent';
                        e.currentTarget.style.transform = 'translateX(0)';
                        e.currentTarget.style.color = item.highlight ? 'var(--role-accent)' : 'var(--text-secondary)';
                      }
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <div style={{
                        width: '28px',
                        height: '28px',
                        borderRadius: '8px',
                        background: isActive ? 'rgba(255, 255, 255, 0.2)' : (item.highlight ? 'var(--role-badge-bg)' : 'var(--bg-surface-subtle)'),
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        flexShrink: 0
                      }}>
                        <Icon size={15} color={isActive ? '#ffffff' : (item.highlight ? 'var(--role-accent)' : 'currentColor')} />
                      </div>
                      <span>{item.label}</span>
                    </div>

                    {isActive && (
                      <ChevronRight size={14} style={{ opacity: 0.8 }} />
                    )}

                    {item.highlight && !isActive && (
                      <span style={{
                        fontSize: '0.58rem',
                        fontWeight: 800,
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        background: 'var(--role-accent)',
                        color: '#ffffff',
                        letterSpacing: '0.04em'
                      }}>
                        CORE
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Footer System Info */}
      <div style={{
        marginTop: 'auto',
        paddingTop: '1rem',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: '0.68rem',
        color: 'var(--text-muted)',
        textAlign: 'center',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.2rem'
      }}>
        <div style={{ fontWeight: 700, color: 'var(--text-secondary)', fontSize: '0.72rem' }}>
          GTBIT ERP • CSE Dept
        </div>
        <div>
          Active: <span className="text-gradient" style={{ fontWeight: 800, textTransform: 'capitalize' }}>{user?.role}</span>
        </div>
        <div style={{ fontSize: '0.62rem', opacity: 0.7 }}>v2.0 • GGSIPU Affiliated</div>
      </div>
    </aside>
  );
}
