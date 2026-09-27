import React, { useState } from 'react';
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
import LoginView from './views/LoginView';

function MainApp() {
  const { user, loading } = useAuth();
  const [currentTab, setCurrentTab] = useState('dashboard');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '1rem',
        color: 'var(--text-muted)'
      }}>
        <div style={{
          width: '48px',
          height: '48px',
          borderRadius: '50%',
          border: '3px solid var(--border-subtle)',
          borderTopColor: 'var(--primary)',
          animation: 'spin 0.8s linear infinite'
        }}></div>
        <div style={{ fontSize: '1rem', fontWeight: 600 }}>Initializing GTBIT ERP Platform...</div>
      </div>
    );
  }

  if (!user) {
    return <LoginView />;
  }

  const renderActiveView = () => {
    switch (currentTab) {
      case 'dashboard':
        return <DashboardView onNavigate={(tab) => setCurrentTab(tab)} />;
      case 'attendance':
        return <AttendanceView />;
      case 'cgpa-simulator':
        return <CGPAProbabilityView />;
      case 'students':
        return <StudentsView />;
      case 'faculty':
        return <FacultyView />;
      case 'academics':
        return <AcademicsView />;
      case 'exams':
        return <ExamsView />;
      case 'assignments':
        return <AssignmentsView />;
      case 'fees':
        return <FeesView />;
      case 'notices':
        return <NoticesView />;
      case 'library-hostel':
        return <LibraryHostelView />;
      case 'placements':
        return <PlacementsView />;
      case 'engagement':
        return <EngagementView />;
      default:
        return <DashboardView onNavigate={(tab) => setCurrentTab(tab)} />;
    }
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Sticky Top Navbar */}
      <Navbar onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />

      {/* Main Content Area: Sidebar + Active View */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        <Sidebar currentTab={currentTab} setCurrentTab={setCurrentTab} />

        <main style={{
          flex: 1,
          padding: '1.5rem',
          overflowY: 'auto',
          maxWidth: '1600px',
          margin: '0 auto',
          width: '100%'
        }}>
          {renderActiveView()}
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
