import React, { Suspense, lazy, useCallback, useEffect, useState } from 'react';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, EmptyState, PageSkeleton } from './components/ui';
import Topbar from './components/layout/Topbar';
import Dock from './components/layout/Dock';
import MenuSheet from './components/layout/MenuSheet';
import CommandPalette from './components/layout/CommandPalette';
import { NAV_BY_ID } from './config/nav';

const DashboardView = lazy(() => import('./views/DashboardView'));
const AttendanceView = lazy(() => import('./views/AttendanceView'));
const CGPAProbabilityView = lazy(() => import('./views/CGPAProbabilityView'));
const StudentsView = lazy(() => import('./views/StudentsView'));
const FacultyView = lazy(() => import('./views/FacultyView'));
const AcademicsView = lazy(() => import('./views/AcademicsView'));
const ExamsView = lazy(() => import('./views/ExamsView'));
const AssignmentsView = lazy(() => import('./views/AssignmentsView'));
const FeesView = lazy(() => import('./views/FeesView'));
const NoticesView = lazy(() => import('./views/NoticesView'));
const LibraryHostelView = lazy(() => import('./views/LibraryHostelView'));
const PlacementsView = lazy(() => import('./views/PlacementsView'));
const EngagementView = lazy(() => import('./views/EngagementView'));
const SocietiesView = lazy(() => import('./views/SocietiesView'));
const ForumView = lazy(() => import('./views/ForumView'));
const SettingsView = lazy(() => import('./views/SettingsView'));
import LoginView from './views/LoginView';

const VIEWS = {
  dashboard: DashboardView,
  attendance: AttendanceView,
  'cgpa-simulator': CGPAProbabilityView,
  students: StudentsView,
  faculty: FacultyView,
  academics: AcademicsView,
  exams: ExamsView,
  assignments: AssignmentsView,
  fees: FeesView,
  notices: NoticesView,
  'library-hostel': LibraryHostelView,
  placements: PlacementsView,
  engagement: EngagementView,
  societies: SocietiesView,
  forum: ForumView,
  settings: SettingsView,
};

const readHash = () => {
  const id = window.location.hash.replace(/^#\/?/, '').split(/[?/]/)[0];
  return VIEWS[id] ? id : 'dashboard';
};

function Splash() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: 'radial-gradient(600px 400px at 50% 40%, rgba(79,70,229,0.35), transparent 70%), #070815', color: '#eef0ff' }}>
      <div className="stack gap-16" style={{ alignItems: 'center' }}>
        <div className="brand" style={{ color: '#eef0ff', fontSize: 30 }}><span className="brand-tile" style={{ width: 44, height: 44, fontSize: 24, borderRadius: 14 }}>G</span>GTBIT</div>
        <div className="row gap-8 xs" style={{ color: '#9599bd' }}><span className="spinner" style={{ width: 12, height: 12 }} /> Opening your portal…</div>
      </div>
    </div>
  );
}

function Shell() {
  const { user, loading, hasPermission } = useAuth();
  const [tab, setTab] = useState(readHash);
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => {
    const onHash = () => setTab(readHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const navigate = useCallback((id) => {
    if (!VIEWS[id]) return;
    if (window.location.hash !== `#/${id}`) window.location.hash = `/${id}`;
    setTab(id);
    setMenu(false);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPalette((p) => !p);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  useEffect(() => {
    const t = NAV_BY_ID[tab]?.title;
    document.title = t ? `${t} · GTBIT ERP` : 'GTBIT ERP';
  }, [tab]);

  if (loading) return <Splash />;
  if (!user) return <LoginView />;

  const meta = NAV_BY_ID[tab];
  const allowed = !meta?.module || hasPermission(meta.module, 'read');
  const View = VIEWS[tab];

  return (
    <div className="shell">
      <Topbar onNavigate={navigate} />
      <div className="main">
        <main className="content">
          <div key={tab} className="view-enter">
            {allowed ? (
              <Suspense fallback={<PageSkeleton />}><View onNavigate={navigate} /></Suspense>
            ) : (
              <div className="card" style={{ maxWidth: 520, margin: '8vh auto' }}>
                <EmptyState
                  icon={ShieldAlert}
                  title="You don’t have access to this module"
                  description={`Your ${user.role} account isn’t permitted to open ${meta?.title || tab}. Ask the administrator if you think this is a mistake.`}
                  action={<button className="btn btn-primary btn-sm" onClick={() => navigate('dashboard')}><ArrowLeft size={14} /> Back to dashboard</button>}
                />
              </div>
            )}
          </div>
        </main>
        <footer className="app-foot no-print">
          <span>GTBIT — Guru Tegh Bahadur Institute of Technology · GGSIPU, New Delhi</span>
          <span>Student Management ERP · B.Tech CSE 2023–27</span>
        </footer>
      </div>
      <Dock current={tab} onNavigate={navigate} onOpenMenu={() => setMenu(true)} onOpenPalette={() => setPalette(true)} />
      <MenuSheet open={menu} onClose={() => setMenu(false)} current={tab} onNavigate={navigate} />
      <CommandPalette open={palette} onClose={() => setPalette(false)} onNavigate={navigate} />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Shell />
      </ToastProvider>
    </AuthProvider>
  );
}
