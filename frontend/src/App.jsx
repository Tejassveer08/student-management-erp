import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import Navbar from './components/layout/Navbar';
import Sidebar from './components/layout/Sidebar';

import DashboardView from './views/DashboardView';
import AttendanceView from './views/AttendanceView';
import CGPAProbabilityView from './views/CGPAProbabilityView';
import StudentsView from './views/StudentsView';
import FacultyView from './views/FacultyView';
import AcademicsView from './views/AcademicsView';
import ExamsView from './views/ExamsView';
import AssignmentsView from './views/AssignmentsView';
import FeesView from './views/FeesView';
import NoticesView from './views/NoticesView';
import LibraryHostelView from './views/LibraryHostelView';
import PlacementsView from './views/PlacementsView';
import EngagementView from './views/EngagementView';
import SettingsView from './views/SettingsView';
import LoginView from './views/LoginView';
import { ShieldAlert, ArrowLeft, Home, ChevronRight, Sparkles } from 'lucide-react';

const TAB_PERMISSIONS = {
  'dashboard': null,
  'attendance': 'attendance',
  'cgpa-simulator': 'cgpa_probability',
  'students': 'students',
  'faculty': 'faculty',
  'academics': 'academics',
  'exams': 'exams',
  'assignments': 'assignments',
  'fees': 'fees',
  'notices': 'notices',
  'library-hostel': 'library',
  'placements': 'placements',
  'engagement': 'engagement',
  'settings': 'settings'
};

const TAB_LABELS = {
  'dashboard': 'Dashboard Overview',
  'attendance': 'Smart Attendance Tracker',
  'cgpa-simulator': 'CGPA Probability Module',
  'students': 'Student Academic Dossiers',
  'faculty': 'Faculty Directory & Workload',
  'academics': 'Academic Curriculum & Timetable',
  'exams': 'Examinations & University Results',
  'assignments': 'Assignments & Courseware Notes',
  'fees': 'Fees & Digital Receipt Portal',
  'notices': 'Institutional Bulletins & Circulars',
  'library-hostel': 'Library & Hostel Administration',
  'placements': 'Placements & Internship Cell',
  'engagement': 'Merit Leaderboard & AI Guide',
  'settings': 'Institutional Governance & Audit Logs'
};

function MainApp() {
  const { user, loading, hasPermission } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [viewKey, setViewKey] = useState(0);

  // Trigger view animation on tab change
  const handleTabChange = (tab) => {
    setCurrentTab(tab);
    setViewKey(prev => prev + 1);
  };

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1.5rem',
        color: 'var(--text-muted)'
      }}>
        {/* Premium loading spinner */}
        <div style={{ position: 'relative' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: '3px solid var(--border-subtle)',
            borderTopColor: 'var(--primary)',
            animation: 'spin 0.8s linear infinite'
          }}></div>
          <div style={{
            position: 'absolute',
            inset: '6px',
            borderRadius: '50%',
            border: '3px solid transparent',
            borderBottomColor: 'var(--secondary)',
            animation: 'spin 1.2s linear infinite reverse'
          }}></div>
        </div>
        <div>
          <div style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', textAlign: 'center' }}>
            Initializing GTBIT ERP
          </div>
          <div style={{ fontSize: '0.78rem', textAlign: 'center', marginTop: '0.25rem' }}>
            Loading your personalized portal...
          </div>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  // Permission Guard
  const requiredModule = TAB_PERMISSIONS[currentTab];
  const isAuthorized = !requiredModule || hasPermission(requiredModule, 'read');

  const renderActiveView = () => {
    if (!isAuthorized) {
      return (
        <div className="glass-panel animate-scale-in" style={{
          padding: '3rem 2.5rem',
          textAlign: 'center',
          maxWidth: '550px',
          margin: '3rem auto',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1rem',
          border: '1px solid var(--danger-border)',
          background: 'var(--bg-surface)'
        }}>
          <div style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            background: 'var(--danger-bg)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--danger)',
            border: '2px solid var(--danger-border)',
            boxShadow: '0 4px 16px rgba(239, 68, 68, 0.15)'
          }}>
            <ShieldAlert size={36} />
          </div>
          <h2 style={{ fontSize: '1.35rem', color: 'var(--danger)', fontWeight: 800 }}>Access Prohibited</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem', lineHeight: 1.7 }}>
            Your current role (<strong style={{ textTransform: 'capitalize', color: 'var(--text-primary)' }}>{user.role}</strong>) does not have authorization to view <strong>{TAB_LABELS[currentTab] || currentTab}</strong>.
          </p>
          <button 
            onClick={() => handleTabChange('dashboard')} 
            className="btn btn-primary"
            style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
          >
            <ArrowLeft size={16} /> Return to Dashboard
          </button>
        </div>
      );
    }

    switch (currentTab) {
      case 'dashboard': return <DashboardView onNavigate={handleTabChange} />;
      case 'attendance': return <AttendanceView />;
      case 'cgpa-simulator': return <CGPAProbabilityView />;
      case 'students': return <StudentsView />;
      case 'faculty': return <FacultyView />;
      case 'academics': return <AcademicsView />;
      case 'exams': return <ExamsView />;
      case 'assignments': return <AssignmentsView />;
      case 'fees': return <FeesView />;
      case 'notices': return <NoticesView />;
      case 'library-hostel': return <LibraryHostelView />;
      case 'placements': return <PlacementsView />;
      case 'engagement': return <EngagementView />;
      case 'settings': return <SettingsView />;
      default: return <DashboardView onNavigate={handleTabChange} />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', position: 'relative' }}>
      {/* Sticky Top Navbar */}
      <Navbar onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />

      {/* Main Content Area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar currentTab={currentTab} setCurrentTab={handleTabChange} />

        <main style={{
          flex: 1,
          padding: '1.25rem 1.5rem',
          overflowY: 'auto',
          maxWidth: '1600px',
          margin: '0 auto',
          width: '100%',
          position: 'relative',
          zIndex: 1
        }}>
          {/* Breadcrumbs */}
          <div className="animate-slide-up" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.76rem',
            color: 'var(--text-muted)',
            marginBottom: '1rem',
            fontWeight: 500,
            padding: '0.4rem 0.75rem',
            background: 'var(--bg-surface-subtle)',
            borderRadius: 'var(--radius-full)',
            width: 'fit-content',
            border: '1px solid var(--border-subtle)'
          }}>
            <button 
              onClick={() => handleTabChange('dashboard')}
              style={{
                background: 'none',
                border: 'none',
                padding: 0,
                color: 'var(--text-muted)',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                fontSize: 'inherit',
                fontFamily: 'inherit',
                transition: 'color 0.15s ease'
              }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--role-accent)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
            >
              <Home size={12} />
              <span>Portal</span>
            </button>
            <ChevronRight size={11} style={{ opacity: 0.5 }} />
            <span style={{ color: 'var(--role-accent)', fontWeight: 700 }}>
              {TAB_LABELS[currentTab] || currentTab}
            </span>
          </div>

          {/* View Content with transition key */}
          <div key={viewKey} className="animate-view-in">
            {renderActiveView()}
          </div>
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <MainApp />
    </AuthProvider>
  );
}
