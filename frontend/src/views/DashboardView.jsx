import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  GraduationCap,
  BookOpen,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Clock,
  ArrowRight,
  Shield,
  FileCheck,
  CreditCard,
  Mail,
  Phone,
  Sparkles,
  QrCode
} from 'lucide-react';

export default function DashboardView({ onNavigate }) {
  const { user, token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;

    async function fetchDashboard() {
      setLoading(true);
      try {
        const res = await fetch('/api/dashboard/summary', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const resData = await res.json();
          setData(resData);
        }
      } catch (err) {
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchDashboard();
  }, [token, user?.role]);

  if (loading) {
    return (
      <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>⚡ Loading Dashboard...</div>
        <div>Aggregating real-time academic, attendance and predictive data...</div>
      </div>
    );
  }

  // 1. ADMIN DASHBOARD
  if (user?.role === 'admin') {
    const stats = data?.stats || {};
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Banner */}
        <div className="glass-panel" style={{
          padding: '1.5rem 2rem',
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>
              Institutional Command Center
            </div>
            <h1 style={{ fontSize: '1.65rem' }}>Welcome, Dean & Administration</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
              Guru Tegh Bahadur Institute of Technology • Academic Management Overview
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => onNavigate('attendance')} className="btn btn-primary btn-sm">
              <QrCode size={16} /> Attendance Control
            </button>
            <button onClick={() => onNavigate('cgpa-simulator')} className="btn btn-secondary btn-sm">
              <TrendingUp size={16} /> CGPA Analytics
            </button>
          </div>
        </div>

        {/* Key Metrics Grid */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
          gap: '1rem'
        }}>
          <div className="stat-card info">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>TOTAL ENROLLMENT</span>
              <GraduationCap size={20} color="var(--info)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.total_students || 5} Students</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Active in B.Tech CSE (Sem 4)</div>
          </div>

          <div className="stat-card purple">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>FACULTY MEMBERS</span>
              <Users size={20} color="var(--accent-purple)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.total_faculty || 3} Faculty</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Average workload: 16 hrs/week</div>
          </div>

          <div className="stat-card success">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>AVG ATTENDANCE RATE</span>
              <CheckCircle2 size={20} color="var(--success)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.average_attendance || 88.5}%</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Well above 75% GGSIPU standard</div>
          </div>

          <div className="stat-card warning">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>FEE COLLECTIONS</span>
              <DollarSign size={20} color="var(--warning)" />
            </div>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.fee_collection_rate || 80}%</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Rs. {(stats.total_fees_collected || 0).toLocaleString()} Collected
            </div>
          </div>
        </div>

        {/* Split Section: At Risk Alert Cohort + Recent Notices */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {/* Proactive At-Risk Warning Box */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} color="var(--danger)" />
                <h3 style={{ fontSize: '1rem' }}>Proactive Early-Warning Cohort</h3>
              </div>
              <span className="badge badge-danger">1 Student At Risk</span>
            </div>

            <p style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginBottom: '1rem' }}>
              Students flagged automatically by the CGPA Probability Engine & Smart Attendance Tracker (&lt;75% attendance or high difficulty risk):
            </p>

            <div style={{
              padding: '0.85rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--danger)' }}>
                  Aman Gupta (Roll: 012/CSE2/2023)
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                  Live Attendance: <strong>67.5%</strong> (&lt; 75% threshold) • Weak in Algorithms (Diff: 0.72)
                </div>
              </div>
              <button onClick={() => onNavigate('cgpa-simulator')} className="btn btn-outline btn-sm">
                View Risk Model
              </button>
            </div>
          </div>

          {/* Institutional Notices */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem' }}>Recent Institutional Bulletins</h3>
              <button onClick={() => onNavigate('notices')} className="btn btn-secondary btn-sm">
                View All
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {(data?.recent_notices || []).slice(0, 3).map(n => (
                <div key={n.id} style={{
                  padding: '0.65rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.825rem' }}>{n.title}</div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      By {n.posted_by} • {new Date(n.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <span className={`badge badge-${n.category === 'Urgent' ? 'danger' : (n.category === 'Placement' ? 'info' : 'primary')}`}>
                    {n.category}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 2. FACULTY DASHBOARD
  if (user?.role === 'faculty') {
    const stats = data?.stats || {};
    const schedule = data?.today_schedule || [];
    const subjects = data?.assigned_subjects || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Banner */}
        <div className="glass-panel" style={{
          padding: '1.5rem 2rem',
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>
              Faculty Academic Console
            </div>
            <h1 style={{ fontSize: '1.65rem' }}>Welcome, {user?.fullName}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
              Assistant Professor & Project Guide • CSE Department (CSE-2)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => onNavigate('attendance')} className="btn btn-primary btn-sm">
              <QrCode size={16} /> Mark One-Tap Attendance
            </button>
            <button onClick={() => onNavigate('assignments')} className="btn btn-secondary btn-sm">
              <FileCheck size={16} /> Grade Submissions
            </button>
          </div>
        </div>

        {/* Stats Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem' }}>
          <div className="stat-card info">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>ASSIGNED SUBJECTS</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.assigned_subjects_count || 2} Courses</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Algorithms & Software Engg</div>
          </div>

          <div className="stat-card success">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>TODAY'S LECTURES</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.today_classes_count || 2} Sessions</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>Room 302 & Lab 4</div>
          </div>

          <div className="stat-card warning">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>PENDING GRADING</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.pending_grading || 0} Submissions</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Minor Assignment 1</div>
          </div>

          <div className="stat-card purple">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>WEEKLY WORKLOAD</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.weekly_workload || 16} Hours</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Theory + Practical Labs</div>
          </div>
        </div>

        {/* Schedule & Assigned Classes */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {/* Today's Schedule */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Today's Teaching Schedule</h3>
            {schedule.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No lectures scheduled for today.</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {schedule.map(s => (
                  <div key={s.id} style={{
                    padding: '0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{s.subject_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        {s.subject_code} • Section: {s.section} • {s.room_no}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge badge-primary">{s.start_time} - {s.end_time}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Subjects Managed */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Assigned Subjects & Difficulty Weights</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {subjects.map(sub => (
                <div key={sub.id} style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>{sub.name}</span>
                    <span className="badge badge-info">{sub.code}</span>
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>
                    Difficulty Index: <strong>{sub.difficulty_index}</strong> • Credits: {sub.credits} • Historical Pass: {sub.historical_pass_pct}%
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 3. STUDENT DASHBOARD
  if (user?.role === 'student') {
    const stats = data?.stats || {};
    const assignments = data?.upcoming_assignments || [];
    const notices = data?.recent_notices || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Banner with CGPA Probability & Live Attendance Alert */}
        <div className="glass-panel" style={{
          padding: '1.75rem 2rem',
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span className="badge badge-primary">B.Tech CSE • Sem 4</span>
              <span className="badge badge-success">Rank #{stats.merit_rank || 2} on Campus</span>
            </div>
            <h1 style={{ fontSize: '1.75rem' }}>Welcome back, {user?.fullName}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
              Roll No: {data?.student_profile?.roll_no || '071/CSE2/2023'} • Section CSE-2
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => onNavigate('attendance')} className="btn btn-primary btn-sm">
              <QrCode size={16} /> QR Attendance Check-In
            </button>
            <button onClick={() => onNavigate('cgpa-simulator')} className="btn btn-secondary btn-sm">
              <TrendingUp size={16} /> "What-If" Simulator
            </button>
          </div>
        </div>

        {/* Highlights: Attendance Gauge + Predicted CGPA */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem' }}>
          {/* Smart Attendance Gauge */}
          <div className={`stat-card ${stats.is_attendance_critical ? 'danger' : 'success'}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>LIVE ATTENDANCE</span>
              <CheckCircle2 size={20} color={stats.is_attendance_critical ? 'var(--danger)' : 'var(--success)'} />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: stats.is_attendance_critical ? 'var(--danger)' : 'var(--text-primary)' }}>
              {stats.live_attendance}%
            </div>
            <div className="progress-bar-container">
              <div 
                className={`progress-bar-fill ${stats.is_attendance_critical ? 'danger' : 'success'}`} 
                style={{ width: `${Math.min(100, stats.live_attendance)}%` }}
              ></div>
            </div>
            <div style={{ fontSize: '0.75rem', color: stats.is_attendance_critical ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
              {stats.is_attendance_critical ? '⚠️ Critical: Under 75% GGSIPU threshold' : '✓ Safe: Above 75% eligibility requirement'}
            </div>
          </div>

          {/* CGPA Probability Predictor Box */}
          <div className="stat-card purple animate-pulse-glow">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>PREDICTED SEMESTER CGPA</span>
              <TrendingUp size={20} color="var(--accent-purple)" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>
              {stats.predicted_sgpa || 8.94} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>SGPA</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Expected Band: <strong>{stats.predicted_cgpa_range?.[0] || '8.65'} - {stats.predicted_cgpa_range?.[1] || '8.95'}</strong>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-purple)', fontWeight: 700 }}>
              Confidence Band: {stats.confidence_score || 88}% (High Accuracy)
            </div>
          </div>

          {/* Current CGPA */}
          <div className="stat-card info">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>CUMULATIVE CGPA</span>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{stats.current_cgpa || 8.78}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>76 Credits Earned so far</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600 }}>Dean's Honor Roll</div>
          </div>

          {/* Fee Payment Status */}
          <div className={`stat-card ${stats.fee_status === 'Paid' ? 'success' : 'warning'}`}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>SEMESTER FEES</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, textTransform: 'uppercase' }}>{stats.fee_status}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>B.Tech Sem 4 College Fee</div>
            {stats.fee_status !== 'Paid' && (
              <button onClick={() => onNavigate('fees')} className="btn btn-warning btn-sm" style={{ marginTop: '0.3rem' }}>
                Pay Online
              </button>
            )}
          </div>
        </div>

        {/* Assignments & Notices */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
          {/* Upcoming Assignments */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem' }}>Active Assignments & Tasks</h3>
              <button onClick={() => onNavigate('assignments')} className="btn btn-secondary btn-sm">
                View All
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {assignments.map(a => (
                <div key={a.id} style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{a.title}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      {a.subject_code} • Max Marks: {a.max_marks}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--danger)', fontWeight: 600 }}>
                      Due {new Date(a.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gamification Merit Badges */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Sparkles size={18} color="#eab308" />
                <h3 style={{ fontSize: '1rem' }}>Achievements & Badges</h3>
              </div>
              <span className="badge badge-warning">{stats.merit_points || 920} Points</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {(stats.badges || []).map((b, i) => (
                <div key={i} style={{
                  padding: '0.4rem 0.8rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 179, 8, 0.05) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: 'var(--warning)',
                  fontWeight: 700,
                  fontSize: '0.78rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  ★ {b}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1.25rem' }}>
              <button onClick={() => onNavigate('engagement')} className="btn btn-outline btn-sm" style={{ width: '100%' }}>
                View Full Merit Leaderboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // 4. PARENT DASHBOARD
  if (user?.role === 'parent') {
    const ward = data?.ward || {};
    const stats = data?.stats || {};
    const mentor = data?.mentor_contact || {};

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Banner */}
        <div className="glass-panel" style={{
          padding: '1.5rem 2rem',
          background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.1) 0%, rgba(79, 70, 229, 0.08) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem'
        }}>
          <div>
            <div className="badge badge-success" style={{ marginBottom: '0.4rem' }}>
              Parent & Guardian Portal
            </div>
            <h1 style={{ fontSize: '1.65rem' }}>Welcome, {user?.fullName}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
              Monitoring Ward: <strong>{ward.name}</strong> • Roll No: {ward.roll_no} • B.Tech CSE (Sem {ward.semester})
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button onClick={() => onNavigate('attendance')} className="btn btn-primary btn-sm">
              Detailed Attendance Report
            </button>
            <button onClick={() => onNavigate('fees')} className="btn btn-secondary btn-sm">
              Fee Invoices & Receipts
            </button>
          </div>
        </div>

        {/* Ward Academic Standing */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {/* Ward Attendance */}
          <div className={`stat-card ${stats.is_attendance_risk ? 'danger' : 'success'}`}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>WARD ATTENDANCE</span>
            <div style={{ fontSize: '2rem', fontWeight: 800, color: stats.is_attendance_risk ? 'var(--danger)' : 'var(--success)' }}>
              {stats.live_attendance}%
            </div>
            <div className="progress-bar-container">
              <div 
                className={`progress-bar-fill ${stats.is_attendance_risk ? 'danger' : 'success'}`}
                style={{ width: `${Math.min(100, stats.live_attendance)}%` }}
              ></div>
            </div>
            <div style={{ fontSize: '0.75rem', color: stats.is_attendance_risk ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
              {stats.is_attendance_risk ? '⚠️ BELOW 75% ATTENDANCE THRESHOLD' : '✓ Satisfies University Attendance Criteria'}
            </div>
          </div>

          {/* Current CGPA */}
          <div className="stat-card purple">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>WARD'S CGPA</span>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{ward.current_cgpa || '8.78'} / 10</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Class Rank #2 • Consistent Honor</div>
          </div>

          {/* Fee Due Status */}
          <div className={`stat-card ${stats.fee_status === 'Paid' ? 'success' : 'danger'}`}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>COLLEGE FEE STATUS</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{stats.fee_status}</div>
            {stats.fee_status !== 'Paid' ? (
              <button onClick={() => onNavigate('fees')} className="btn btn-danger btn-sm" style={{ marginTop: '0.35rem' }}>
                Pay Due Rs. {(stats.fee_due_amount || 85000).toLocaleString()}
              </button>
            ) : (
              <div style={{ fontSize: '0.75rem', color: 'var(--success)' }}>All Semester 4 Dues Settled</div>
            )}
          </div>

          {/* Faculty Mentor */}
          <div className="stat-card info">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>FACULTY MENTOR</span>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>{mentor.name}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{mentor.role}</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--info)', marginTop: '0.2rem' }}>{mentor.email}</div>
          </div>
        </div>

        {/* Recent Test Marks + Institutional Notices */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Latest Minor Exam Performance</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {(data?.recent_marks || []).map(m => (
                <div key={m.id} style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{m.subject_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{m.subject_code}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{m.total_score} / 100</div>
                    <span className="badge badge-success">Grade {m.letter_grade}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1rem', marginBottom: '1rem' }}>Important Communications for Parents</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {(data?.recent_notices || []).map(n => (
                <div key={n.id} style={{
                  padding: '0.75rem 0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-subtle)'
                }}>
                  <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{n.title}</div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.25rem' }}>
                    {n.content}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <div>Welcome to GTBIT ERP</div>;
}
