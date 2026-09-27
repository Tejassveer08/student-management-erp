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
  Compass,
  CheckCircle2
} from 'lucide-react';

export default function Sidebar({ currentTab, setCurrentTab }) {
  const { user } = useAuth();

  const navGroups = [
    {
      group: 'Overview',
      items: [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, badge: user?.role }
      ]
    },
    {
      group: 'Flagship Innovations',
      items: [
        { id: 'attendance', label: 'Smart Attendance Tracker', icon: QrCode, highlight: true },
        { id: 'cgpa-simulator', label: 'CGPA Probability Module', icon: TrendingUp, highlight: true }
      ]
    },
    {
      group: 'Academic ERP',
      items: [
        { id: 'students', label: 'Student Management', icon: GraduationCap },
        { id: 'faculty', label: 'Faculty & Workload', icon: Users },
        { id: 'academics', label: 'Academics & Timetable', icon: Calendar },
        { id: 'exams', label: 'Examinations & Results', icon: Award },
        { id: 'assignments', label: 'Assignments & Notes', icon: FileText }
      ]
    },
    {
      group: 'Administration & Finance',
      items: [
        { id: 'fees', label: 'Fees & Payment Portal', icon: CreditCard },
        { id: 'notices', label: 'Notices & Bulletin', icon: Bell }
      ]
    },
    {
      group: 'Campus & Institutional',
      items: [
        { id: 'library-hostel', label: 'Library & Hostel', icon: BookOpen },
        { id: 'placements', label: 'Placements & TnP', icon: Briefcase }
      ]
    },
    {
      group: 'Student Engagement',
      items: [
        { id: 'engagement', label: 'Merit Leaderboard & AI Guide', icon: Trophy }
      ]
    }
  ];

  return (
    <aside style={{
      width: '260px',
      flexShrink: 0,
      background: 'var(--bg-sidebar)',
      borderRight: '1px solid var(--border-subtle)',
      display: 'flex',
      flexDirection: 'column',
      padding: '1.25rem 0.85rem',
      height: '100%',
      overflowY: 'auto'
    }}>
      {/* User Welcome Card */}
      <div style={{
        padding: '0.85rem',
        borderRadius: 'var(--radius-md)',
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.08) 0%, rgba(6, 182, 212, 0.08) 100%)',
        border: '1px solid var(--border-subtle)',
        marginBottom: '1.25rem',
        display: 'flex',
        alignItems: 'center',
        gap: '0.65rem'
      }}>
        <img 
          src={user?.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'} 
          alt="User Avatar"
          style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
        />
        <div style={{ overflow: 'hidden' }}>
          <div style={{ 
            fontSize: '0.85rem', 
            fontWeight: 700, 
            whiteSpace: 'nowrap', 
            textOverflow: 'ellipsis', 
            overflow: 'hidden',
            color: 'var(--text-primary)'
          }}>
            {user?.fullName || 'User'}
          </div>
          <div style={{ 
            fontSize: '0.72rem', 
            fontWeight: 600, 
            color: 'var(--primary)',
            textTransform: 'capitalize',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--success)' }}></span>
            {user?.role} Portal
          </div>
        </div>
      </div>

      {/* Navigation Groups */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        {navGroups.map((grp, gIdx) => (
          <div key={gIdx}>
            <div style={{
              fontSize: '0.68rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              color: 'var(--text-muted)',
              padding: '0 0.65rem 0.4rem 0.65rem'
            }}>
              {grp.group}
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem' }}>
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
                      padding: '0.55rem 0.75rem',
                      borderRadius: 'var(--radius-md)',
                      border: 'none',
                      background: isActive 
                        ? 'linear-gradient(135deg, var(--primary) 0%, #6366f1 100%)' 
                        : (item.highlight ? 'rgba(79, 70, 229, 0.05)' : 'transparent'),
                      color: isActive 
                        ? '#ffffff' 
                        : (item.highlight ? 'var(--primary)' : 'var(--text-secondary)'),
                      cursor: 'pointer',
                      fontFamily: 'inherit',
                      fontSize: '0.825rem',
                      fontWeight: isActive ? 700 : (item.highlight ? 600 : 500),
                      boxShadow: isActive ? '0 4px 12px var(--primary-glow)' : 'none',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                      <Icon size={17} color={isActive ? '#ffffff' : (item.highlight ? 'var(--primary)' : 'currentColor')} />
                      <span>{item.label}</span>
                    </div>

                    {item.badge && (
                      <span style={{
                        fontSize: '0.65rem',
                        fontWeight: 700,
                        textTransform: 'uppercase',
                        padding: '0.1rem 0.4rem',
                        borderRadius: '9999px',
                        background: isActive ? 'rgba(255,255,255,0.25)' : 'var(--bg-surface-subtle)',
                        color: isActive ? '#ffffff' : 'var(--text-muted)'
                      }}>
                        {item.badge}
                      </span>
                    )}

                    {item.highlight && !isActive && (
                      <span style={{
                        fontSize: '0.6rem',
                        fontWeight: 800,
                        padding: '0.1rem 0.35rem',
                        borderRadius: '4px',
                        background: 'var(--primary-glow)',
                        color: 'var(--primary)'
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

      {/* Footer Info */}
      <div style={{
        marginTop: 'auto',
        paddingTop: '1rem',
        borderTop: '1px solid var(--border-subtle)',
        fontSize: '0.7rem',
        color: 'var(--text-muted)',
        textAlign: 'center'
      }}>
        <div>GTBIT ERP • B.Tech CSE</div>
        <div>Batch 2023 - 2027</div>
      </div>
    </aside>
  );
}
