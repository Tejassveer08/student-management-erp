import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  User,
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
  QrCode,
  ShieldCheck,
  ChevronDown,
  Activity,
  Layers,
  Award,
  Zap,
  Check,
  ExternalLink,
  Info
} from 'lucide-react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
  LineChart,
  Line,
  CartesianGrid
} from 'recharts';
import confetti from 'canvas-confetti';

export default function DashboardView({ onNavigate }) {
  const { user, token, roleMeta } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedWardId, setSelectedWardId] = useState(null);

  // Parent Payment Modal State
  const [showPayModal, setShowPayModal] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);
  const [paymentSuccessToast, setPaymentSuccessToast] = useState(null);

  useEffect(() => {
    if (!token) return;
    fetchDashboard(selectedWardId);
  }, [token, user?.role, selectedWardId]);

  async function fetchDashboard(wardId = null) {
    setLoading(true);
    try {
      const url = wardId ? `/api/dashboard/summary?wardId=${wardId}` : '/api/dashboard/summary';
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const resData = await res.json();
        setData(resData);
        if (resData.active_ward && !selectedWardId) {
          setSelectedWardId(resData.active_ward.student_id);
        }
      }
    } catch (err) {
      console.error('Dashboard load error:', err);
    } finally {
      setLoading(false);
    }
  }

  // Handle Parent Online Fee Payment Modal
  const handleFeePaymentSubmit = async () => {
    if (!data?.ward?.student_id && !selectedWardId) return;
    setIsProcessingPayment(true);
    const targetStudentId = data?.ward?.student_id || selectedWardId;
    const amountToPay = data?.stats?.fee_due_amount || 85000;

    try {
      const res = await fetch('/api/fees/pay', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId: targetStudentId,
          amount: amountToPay,
          paymentMode: paymentMethod.toUpperCase(),
          transactionRef: `GTB-${Date.now()}`
        })
      });

      if (res.ok) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
        setPaymentSuccessToast(`Payment of ₹${amountToPay.toLocaleString()} settled successfully! Receipt generated.`);
        setShowPayModal(false);
        setTimeout(() => setPaymentSuccessToast(null), 5000);
        // Refresh dashboard data
        fetchDashboard(targetStudentId);
      } else {
        const err = await res.json();
        alert(`Payment error: ${err.error || 'Transaction failed'}`);
      }
    } catch (e) {
      alert(`Network error: ${e.message}`);
    } finally {
      setIsProcessingPayment(false);
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '4rem 1rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{ position: 'relative', width: '56px', height: '56px', margin: '0 auto 1.5rem auto' }}>
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            border: '3px solid var(--border-subtle)',
            borderTopColor: 'var(--role-accent)',
            animation: 'spin 0.8s linear infinite'
          }}></div>
          <div style={{
            position: 'absolute',
            inset: '8px',
            borderRadius: '50%',
            border: '3px solid transparent',
            borderBottomColor: 'var(--secondary)',
            animation: 'spin 1.2s linear infinite reverse'
          }}></div>
        </div>
        <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
          Loading Dashboard
        </div>
        <div style={{ fontSize: '0.82rem' }}>Synchronizing academic data and analytics...</div>
        {/* Skeleton cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginTop: '2rem', maxWidth: '900px', marginLeft: 'auto', marginRight: 'auto' }}>
          {[1,2,3,4].map(i => (
            <div key={i} className="skeleton" style={{ height: '100px', borderRadius: 'var(--radius-md)' }}></div>
          ))}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 1. ADMIN DASHBOARD
  // =========================================================================
  if (user?.role === 'admin') {
    const stats = data?.stats || {};
    const auditLogs = data?.recent_audit_logs || [];
    const threshold = data?.threshold || 75.0;

    // Fee breakdown data for Recharts Pie
    const totalCollected = stats.total_fees_collected || 340000;
    const totalPending = Math.max(0, (stats.total_fee_demand || 425000) - totalCollected);
    const feePieData = [
      { name: 'Collected Fees', value: totalCollected, color: '#10b981' },
      { name: 'Outstanding Dues', value: totalPending, color: '#f59e0b' }
    ];

    // Attendance distribution data
    const attendanceBarData = [
      { section: 'CSE-1', rate: 91.2 },
      { section: 'CSE-2', rate: stats.average_attendance || 88.5 },
      { section: 'CSE-3', rate: 84.0 },
      { section: 'IT-1', rate: 86.4 }
    ];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} className="animate-view-in">
        {/* Institutional Command Center Banner */}
        <div className="glass-panel animate-slide-up" style={{
          padding: '1.75rem 2rem',
          background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(6, 182, 212, 0.08) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderLeft: '5px solid var(--role-accent)',
          boxShadow: '0 4px 20px var(--role-accent-glow)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span className="badge" style={{ background: 'var(--role-badge-bg)', color: 'var(--role-accent)', fontWeight: 800 }}>
                INSTITUTIONAL COMMAND CONSOLE
              </span>
              <span className="badge badge-success">Full System CRUD Authority</span>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Welcome, Dean & Administration</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
              Guru Tegh Bahadur Institute of Technology • Multi-Role Policy & Governance Control
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => onNavigate('settings')} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <ShieldCheck size={16} /> Governance Policies & Audits
            </button>
            <button onClick={() => onNavigate('attendance')} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <QrCode size={16} /> Attendance Control
            </button>
            <button onClick={() => onNavigate('cgpa-simulator')} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <TrendingUp size={16} /> CGPA Analytics
            </button>
          </div>
        </div>

        {/* 4 Key Institutional KPIs */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem'
        }}>
          <div className="stat-card info animate-card-in stagger-1">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>TOTAL ENROLLED</span>
              <GraduationCap size={20} color="var(--info)" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.35rem 0' }}>{stats.total_students || 5} Students</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Active in B.Tech CSE (Sem 4)</div>
          </div>

          <div className="stat-card purple animate-card-in stagger-2">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>FACULTY CORPS</span>
              <Users size={20} color="var(--accent-purple)" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.35rem 0' }}>{stats.total_faculty || 3} Faculty</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Avg Workload: 16 hrs/week</div>
          </div>

          <div className="stat-card success animate-card-in stagger-3">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>CAMPUS ATTENDANCE</span>
              <CheckCircle2 size={20} color="var(--success)" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.35rem 0' }}>{stats.average_attendance || 88.5}%</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Policy Threshold: &gt;={threshold}%</div>
          </div>

          <div className="stat-card warning animate-card-in stagger-4">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>FEE REVENUE RECOVERY</span>
              <DollarSign size={20} color="var(--warning)" />
            </div>
            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.35rem 0' }}>{stats.fee_collection_rate || 80}%</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              ₹{(stats.total_fees_collected || 0).toLocaleString()} of ₹{(stats.total_fee_demand || 0).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Visual Charts: Fee Collection Donut + Attendance Comparison */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem' }}>
          {/* Fee Collection Donut Chart */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Fee Recovery & Financial Health</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>B.Tech Semester 4 Collection Distribution</p>
              </div>
              <button onClick={() => onNavigate('fees')} className="btn btn-secondary btn-sm">
                View Ledger
              </button>
            </div>

            <div style={{ height: '220px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={feePieData}
                    cx="50%"
                    cy="50%"
                    innerRadius={55}
                    outerRadius={85}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {feePieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => `₹${Number(value).toLocaleString()}`} />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Section-Wise Attendance Benchmark Bar Chart */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div>
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Section Attendance Benchmarks</h3>
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Comparative attendance compliance vs 75% bar</p>
              </div>
              <span className="badge badge-primary">Target: 75% Min</span>
            </div>

            <div style={{ height: '220px', width: '100%' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attendanceBarData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                  <XAxis dataKey="section" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <YAxis domain={[50, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                  <Tooltip formatter={(value) => `${value}%`} />
                  <Bar dataKey="rate" fill="var(--role-accent)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Proactive At-Risk Warning + Recent Audit Trail */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.25rem' }}>
          {/* Proactive At-Risk Students */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <AlertTriangle size={18} color="var(--danger)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Early-Warning Risk Cohort</h3>
              </div>
              <span className="badge badge-danger">1 Student Below {threshold}%</span>
            </div>

            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '0.85rem' }}>
              Students flagged by the CGPA Probability Engine & Smart Attendance Tracker who breach the institutional detention threshold:
            </p>

            <div style={{
              padding: '0.85rem 1rem',
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
                  Live Attendance: <strong>67.5%</strong> (&lt; {threshold}% threshold) • High Risk in Algo
                </div>
              </div>
              <button onClick={() => onNavigate('cgpa-simulator')} className="btn btn-danger btn-sm">
                Inspect Risk
              </button>
            </div>
          </div>

          {/* Recent Administrative Audit Trail */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Activity size={18} color="var(--role-accent)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Recent Regulatory Audit Trail</h3>
              </div>
              <button onClick={() => onNavigate('settings')} className="btn btn-secondary btn-sm">
                Full Log
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {auditLogs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', padding: '1rem', textAlign: 'center' }}>
                  No administrative overrides recorded.
                </div>
              ) : (
                auditLogs.slice(0, 4).map(l => (
                  <div key={l.id} style={{
                    padding: '0.6rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.78rem'
                  }}>
                    <div>
                      <div style={{ fontWeight: 600 }}>{l.action}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        By {l.user_email || 'Admin'} • {l.reason || 'Governance'}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(l.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // =========================================================================
  // 2. FACULTY DASHBOARD
  // =========================================================================
  if (user?.role === 'faculty') {
    const stats = data?.stats || {};
    const schedule = data?.today_schedule || [];
    const assignedClasses = data?.assigned_classes || [];
    const atRisk = data?.at_risk_students || [];

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Faculty Academic Console Banner */}
        <div className="glass-panel" style={{
          padding: '1.75rem 2rem',
          background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.12) 0%, rgba(20, 184, 166, 0.06) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          borderLeft: '5px solid var(--role-accent)',
          boxShadow: '0 4px 20px var(--role-accent-glow)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span className="badge" style={{ background: 'var(--role-badge-bg)', color: 'var(--role-accent)', fontWeight: 800 }}>
                FACULTY ACADEMIC CONSOLE
              </span>
              <span className="badge badge-info">Scoped to Assigned Courses & Sections</span>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Welcome, {user?.fullName}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
              Assistant Professor • Computer Science & Engineering (Assigned to Section CSE-2)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => onNavigate('attendance')} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <QrCode size={16} /> One-Tap QR Attendance
            </button>
            <button onClick={() => onNavigate('assignments')} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <FileCheck size={16} /> Grade Submissions ({stats.pending_grading || 0})
            </button>
          </div>
        </div>

        {/* 4 Faculty Metrics */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '1rem' }}>
          <div className="stat-card info">
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>MAPPED SUBJECTS</span>
            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.35rem 0' }}>{stats.assigned_subjects_count || 2} Courses</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Algorithms & Software Engg</div>
          </div>

          <div className="stat-card success">
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>TODAY'S TEACHING</span>
            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.35rem 0' }}>{stats.today_classes_count || 2} Lectures</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>Room 302 & Lab 4</div>
          </div>

          <div className="stat-card warning">
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>PENDING EVALUATION</span>
            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.35rem 0' }}>{stats.pending_grading || 0} Submissions</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--warning)', fontWeight: 600 }}>Minor Assignment 1</div>
          </div>

          <div className="stat-card purple">
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>WEEKLY WORKLOAD</span>
            <div style={{ fontSize: '2rem', fontWeight: 800, margin: '0.35rem 0' }}>{stats.weekly_workload || 16} Hours</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Theory & Practical Labs</div>
          </div>
        </div>

        {/* Today's Teaching Schedule & Assigned Subjects */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.25rem' }}>
          {/* Schedule */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Calendar size={18} color="var(--role-accent)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Today's Teaching Schedule</h3>
              </div>
              <button onClick={() => onNavigate('academics')} className="btn btn-secondary btn-sm">
                Full Timetable
              </button>
            </div>

            {schedule.length === 0 ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', padding: '1.5rem', textAlign: 'center' }}>
                No lectures scheduled for today.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {schedule.map(s => (
                  <div key={s.id} style={{
                    padding: '0.85rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.subject_name}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.15rem' }}>
                        {s.subject_code} • Section: <strong>{s.section}</strong> • {s.room_no}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <span className="badge" style={{ background: 'var(--role-badge-bg)', color: 'var(--role-accent)', fontWeight: 700 }}>
                        {s.start_time} - {s.end_time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Assigned Classes (faculty_class_map scoped) */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Layers size={18} color="var(--role-accent)" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Mapped Classes & Subjects</h3>
              </div>
              <span className="badge badge-info">DB Scoped</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {assignedClasses.map((ac, idx) => (
                <div key={idx} style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{ac.subject_name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      {ac.subject_code} • Sem {ac.semester} • Section {ac.section}
                    </div>
                  </div>
                  <button onClick={() => onNavigate('attendance')} className="btn btn-outline btn-sm">
                    Mark
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* In-Section Low Attendance Students (< 75%) */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <AlertTriangle size={18} color="var(--danger)" />
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>In-Section Low-Attendance Students (&lt;75% Detention Warning)</h3>
            </div>
            <span className="badge badge-danger">{atRisk.length} Student At Risk</span>
          </div>

          {atRisk.length === 0 ? (
            <div style={{ color: 'var(--success)', fontSize: '0.85rem', padding: '1rem', textAlign: 'center' }}>
              ✓ All students in your assigned sections are currently compliant above 75%.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {atRisk.map(st => (
                <div key={st.student_id} style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--danger-bg)',
                  border: '1px solid var(--danger-border)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--danger)' }}>
                      {st.student_name} (Roll: {st.roll_no})
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                      Current Live Attendance: <strong>{st.attendance_pct}%</strong> (Below university threshold of 75%)
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: '0.5rem' }}>
                    <button onClick={() => onNavigate('students')} className="btn btn-secondary btn-sm">
                      View Profile
                    </button>
                    <button onClick={() => alert(`Detention warning dispatched to ${st.student_name} and linked parent.`)} className="btn btn-danger btn-sm">
                      Issue Warning
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // =========================================================================
  // 3. PARENT DASHBOARD (Multi-Ward Support + Fee Payment Modal)
  // =========================================================================
  if (user?.role === 'parent') {
    const ward = data?.active_ward || data?.ward || {};
    const linkedWards = data?.linked_wards || [];
    const stats = data?.stats || {};
    const recentGrades = data?.recent_grades || [];
    const mentor = data?.mentor_contact || {};

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {paymentSuccessToast && (
          <div style={{
            padding: '1rem 1.5rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--success-bg)',
            border: '1px solid var(--success-border)',
            color: 'var(--success)',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            boxShadow: '0 4px 15px rgba(16, 185, 129, 0.25)'
          }}>
            <CheckCircle2 size={20} />
            {paymentSuccessToast}
          </div>
        )}

        {/* Parent & Guardian Portal Banner with Multi-Ward Switcher */}
        <div className="glass-panel" style={{
          padding: '1.75rem 2rem',
          background: 'linear-gradient(135deg, rgba(217, 119, 6, 0.12) 0%, rgba(245, 158, 11, 0.06) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
          borderLeft: '5px solid var(--role-accent)',
          boxShadow: '0 4px 20px var(--role-accent-glow)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span className="badge" style={{ background: 'var(--role-badge-bg)', color: 'var(--role-accent)', fontWeight: 800 }}>
                PARENT & GUARDIAN PORTAL
              </span>
              <span className="badge badge-success">Official Guardian Access</span>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Welcome, {user?.fullName}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
              Real-time academic monitoring, fee settlement and attendance compliance.
            </p>
          </div>

          {/* Multi-Ward Switcher Dropdown (Crucial Parent Feature) */}
          <div style={{
            background: 'var(--bg-surface)',
            padding: '0.65rem 1rem',
            borderRadius: 'var(--radius-lg)',
            border: '2px solid var(--role-accent)',
            boxShadow: '0 4px 14px var(--role-accent-glow)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.75rem'
          }}>
            <User size={18} color="var(--role-accent)" />
            <div>
              <div style={{ fontSize: '0.68rem', fontWeight: 800, textTransform: 'uppercase', color: 'var(--role-accent)' }}>
                Active Ward Selection
              </div>
              <select
                value={ward.student_id || selectedWardId || ''}
                onChange={(e) => {
                  const id = Number(e.target.value);
                  setSelectedWardId(id);
                  fetchDashboard(id);
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  fontWeight: 700,
                  fontSize: '0.95rem',
                  color: 'var(--text-primary)',
                  cursor: 'pointer',
                  outline: 'none',
                  padding: '0.1rem 0'
                }}
              >
                {linkedWards.map(lw => (
                  <option key={lw.student_id} value={lw.student_id} style={{ background: 'var(--bg-surface)', color: 'var(--text-primary)' }}>
                    {lw.student_name} ({lw.relationship || 'Ward'} - Sem {lw.semester})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Ward Academic Standing Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
          {/* Ward Attendance Gauge */}
          <div className={`stat-card ${stats.is_attendance_risk ? 'danger' : 'success'}`}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>WARD ATTENDANCE RATE</span>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: stats.is_attendance_risk ? 'var(--danger)' : 'var(--success)', margin: '0.35rem 0' }}>
              {stats.live_attendance}%
            </div>
            <div className="progress-bar-container" style={{ height: '8px' }}>
              <div 
                className={`progress-bar-fill ${stats.is_attendance_risk ? 'danger' : 'success'}`} 
                style={{ width: `${Math.min(100, stats.live_attendance)}%` }}
              ></div>
            </div>
            <div style={{ fontSize: '0.75rem', color: stats.is_attendance_risk ? 'var(--danger)' : 'var(--success)', fontWeight: 600, marginTop: '0.35rem' }}>
              {stats.is_attendance_risk ? '⚠️ Below 75% GGSIPU Requirement' : '✓ Satisfies University Attendance Criteria'}
            </div>
          </div>

          {/* Ward Predicted CGPA */}
          <div className="stat-card purple">
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>PREDICTED SEMESTER CGPA</span>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--accent-purple)', margin: '0.35rem 0' }}>
              {ward.current_cgpa || '8.78'} / 10
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Confidence Band: <strong>8.65 - 8.95</strong>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 600, marginTop: '0.2rem' }}>
              Dean's Honor Roll Track
            </div>
          </div>

          {/* Fee Payment & Settlement Action */}
          <div className={`stat-card ${stats.fee_status === 'Paid' ? 'success' : 'warning'}`}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>SEMESTER COLLEGE FEES</span>
            <div style={{ fontSize: '1.75rem', fontWeight: 800, margin: '0.35rem 0', textTransform: 'uppercase' }}>
              {stats.fee_status}
            </div>
            {stats.fee_status !== 'Paid' ? (
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--danger)', fontWeight: 600, marginBottom: '0.4rem' }}>
                  Due Amount: ₹{(stats.fee_due_amount || 85000).toLocaleString()}
                </div>
                <button 
                  onClick={() => setShowPayModal(true)} 
                  className="btn btn-warning btn-sm"
                  style={{ width: '100%', fontWeight: 700 }}
                >
                  <CreditCard size={14} /> Pay Fees Online
                </button>
              </div>
            ) : (
              <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                ✓ All dues cleared for Sem {ward.semester || 4}
              </div>
            )}
          </div>

          {/* Faculty Mentor Contact Card */}
          <div className="stat-card info">
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>ASSIGNED FACULTY MENTOR</span>
            <div style={{ fontSize: '1.15rem', fontWeight: 800, marginTop: '0.35rem' }}>{mentor.name || 'Ms. Basanti Pal Nandi'}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Project Guide & Mentor</div>
            <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.65rem' }}>
              <a href={`mailto:${mentor.email || 'faculty.nandi@gtbit.ac.in'}`} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                <Mail size={13} /> Email
              </a>
              <button onClick={() => alert(`Calling Mentor: ${mentor.phone || '+91 98110 54321'}`)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem 0.6rem', fontSize: '0.75rem' }}>
                <Phone size={13} /> Call
              </button>
            </div>
          </div>
        </div>

        {/* Latest Subject Grades & Transcripts */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Ward's Latest Coursework & Examination Marks</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Performance metrics for {ward.student_name} (Roll: {ward.roll_no})
              </p>
            </div>
            <button onClick={() => onNavigate('exams')} className="btn btn-secondary btn-sm">
              View Transcripts
            </button>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table className="data-table" style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th>Subject</th>
                  <th>Internal Assessment</th>
                  <th>Attendance Rate</th>
                  <th>Predicted Grade</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {recentGrades.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '1.5rem', color: 'var(--text-muted)' }}>
                      No recent assessment marks declared yet.
                    </td>
                  </tr>
                ) : (
                  recentGrades.map((g, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: 600 }}>{g.subject_name}</td>
                      <td>{g.internal_assessment ? `${g.internal_assessment} / 25` : 'Pending'}</td>
                      <td>
                        <span style={{ fontWeight: 700, color: g.attendance_pct < 75 ? 'var(--danger)' : 'var(--success)' }}>
                          {g.attendance_pct || 90}%
                        </span>
                      </td>
                      <td>
                        <span className="badge badge-primary">{g.predicted_grade || 'A+'}</span>
                      </td>
                      <td>
                        <span className="badge badge-success">Good Standing</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Parent Fee Payment Modal */}
        {showPayModal && (
          <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.65)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '1rem'
          }}>
            <div className="glass-panel" style={{
              width: '100%',
              maxWidth: '480px',
              padding: '2rem',
              background: 'var(--bg-surface)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              display: 'flex',
              flexDirection: 'column',
              gap: '1.25rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>College Fee Settlement</h3>
                <button onClick={() => setShowPayModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.2rem 0.5rem' }}>✕</button>
              </div>

              <div style={{ padding: '1rem', background: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)' }}>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Ward Name</div>
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>{ward.student_name}</div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Roll No: {ward.roll_no} • Sem {ward.semester}</div>

                <div style={{ borderTop: '1px solid var(--border-subtle)', marginTop: '0.75rem', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontWeight: 600 }}>Total Payable Amount:</span>
                  <span style={{ fontWeight: 800, color: 'var(--role-accent)', fontSize: '1.15rem' }}>
                    ₹{(stats.fee_due_amount || 85000).toLocaleString()}
                  </span>
                </div>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, display: 'block', marginBottom: '0.5rem' }}>
                  Select Payment Gateway
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
                  {['upi', 'card', 'netbanking'].map(mode => (
                    <button
                      key={mode}
                      onClick={() => setPaymentMethod(mode)}
                      className={`btn btn-sm ${paymentMethod === mode ? 'btn-primary' : 'btn-secondary'}`}
                      style={{ textTransform: 'uppercase', fontSize: '0.75rem', fontWeight: 700 }}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.5rem' }}>
                <button 
                  onClick={() => setShowPayModal(false)} 
                  className="btn btn-secondary" 
                  style={{ flex: 1 }}
                >
                  Cancel
                </button>
                <button 
                  onClick={handleFeePaymentSubmit} 
                  disabled={isProcessingPayment}
                  className="btn btn-primary" 
                  style={{ flex: 2, background: 'var(--role-accent)', color: '#fff', fontWeight: 700 }}
                >
                  {isProcessingPayment ? 'Processing...' : `Authorize ₹${(stats.fee_due_amount || 85000).toLocaleString()}`}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // =========================================================================
  // 4. STUDENT DASHBOARD
  // =========================================================================
  if (user?.role === 'student') {
    const stats = data?.stats || {};
    const assignments = data?.upcoming_assignments || [];
    const notices = data?.recent_notices || [];

    // Calculate classes needed to reach 75% if below
    const currentAtt = stats.live_attendance || 88.0;
    const isUnderThreshold = stats.is_attendance_critical;

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {/* Student Learning Console Banner */}
        <div className="glass-panel" style={{
          padding: '1.75rem 2rem',
          background: 'linear-gradient(135deg, rgba(37, 99, 235, 0.12) 0%, rgba(59, 130, 246, 0.06) 100%)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1.25rem',
          borderLeft: '5px solid var(--role-accent)',
          boxShadow: '0 4px 20px var(--role-accent-glow)'
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <span className="badge" style={{ background: 'var(--role-badge-bg)', color: 'var(--role-accent)', fontWeight: 800 }}>
                STUDENT LEARNING CONSOLE
              </span>
              <span className="badge badge-success">Rank #{stats.merit_rank || 2} on Campus</span>
            </div>
            <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Welcome back, {user?.fullName}</h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
              Roll No: {data?.student_profile?.roll_no || '071/CSE2/2023'} • Section CSE-2 (Sem 4)
            </p>
          </div>

          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button onClick={() => onNavigate('attendance')} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <QrCode size={16} /> QR Check-In
            </button>
            <button onClick={() => onNavigate('cgpa-simulator')} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <TrendingUp size={16} /> Launch "What-If" Simulator
            </button>
          </div>
        </div>

        {/* 4 Flagship Student Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '1rem' }}>
          {/* Smart Attendance Gauge */}
          <div className={`stat-card ${isUnderThreshold ? 'danger' : 'success'}`}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>LIVE ATTENDANCE</span>
              <CheckCircle2 size={20} color={isUnderThreshold ? 'var(--danger)' : 'var(--success)'} />
            </div>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: isUnderThreshold ? 'var(--danger)' : 'var(--text-primary)', margin: '0.35rem 0' }}>
              {currentAtt}%
            </div>
            <div className="progress-bar-container" style={{ height: '8px' }}>
              <div 
                className={`progress-bar-fill ${isUnderThreshold ? 'danger' : 'success'}`} 
                style={{ width: `${Math.min(100, currentAtt)}%` }}
              ></div>
            </div>
            <div style={{ fontSize: '0.75rem', color: isUnderThreshold ? 'var(--danger)' : 'var(--success)', fontWeight: 600, marginTop: '0.35rem' }}>
              {isUnderThreshold 
                ? '⚠️ Critical: Under 75% GGSIPU standard' 
                : '✓ Safe: Satisfies exam eligibility criteria'}
            </div>
          </div>

          {/* CGPA Probability Predictor Box */}
          <div className="stat-card purple animate-pulse-glow">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>PREDICTED SEMESTER CGPA</span>
              <TrendingUp size={20} color="var(--accent-purple)" />
            </div>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--accent-purple)', margin: '0.35rem 0' }}>
              {stats.predicted_sgpa || 8.94} <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>SGPA</span>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Confidence Band: <strong>{stats.predicted_cgpa_range?.[0] || '8.65'} - {stats.predicted_cgpa_range?.[1] || '8.95'}</strong>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'var(--accent-purple)', fontWeight: 700, marginTop: '0.2rem' }}>
              Reliability Score: {stats.confidence_score || 88}%
            </div>
          </div>

          {/* Cumulative Prior CGPA */}
          <div className="stat-card info">
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>CUMULATIVE CGPA</span>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--info)', margin: '0.35rem 0' }}>
              {stats.current_cgpa || 8.78}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>76 University Credits Earned</div>
            <div style={{ fontSize: '0.72rem', color: 'var(--success)', fontWeight: 700, marginTop: '0.2rem' }}>
              Dean's Honor Roll Member
            </div>
          </div>

          {/* Gamified Merit Rank & Points */}
          <div className="stat-card warning">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>MERIT SCORE & XP</span>
              <Sparkles size={20} color="#eab308" />
            </div>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: '#eab308', margin: '0.35rem 0' }}>
              {stats.merit_points || 920} <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>XP</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Campus Leaderboard: <strong>Rank #2</strong></div>
            <div style={{ fontSize: '0.72rem', color: 'var(--warning)', fontWeight: 700, marginTop: '0.2rem' }}>
              Level 4 Scholar Badge Active
            </div>
          </div>
        </div>

        {/* Assignments & Gamification Badges */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: '1.25rem' }}>
          {/* Upcoming Assignments with Upload Action */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Upcoming Assignments & Coursework</h3>
              <button onClick={() => onNavigate('assignments')} className="btn btn-secondary btn-sm">
                View All
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              {assignments.map(a => (
                <div key={a.id} style={{
                  padding: '0.85rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{a.title}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                      {a.subject_code} • Max Marks: {a.max_marks}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.72rem', color: 'var(--danger)', fontWeight: 700 }}>
                      Due {new Date(a.due_date).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                    <button onClick={() => onNavigate('assignments')} className="btn btn-primary btn-sm" style={{ marginTop: '0.25rem', padding: '0.2rem 0.6rem', fontSize: '0.7rem' }}>
                      Submit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Gamified Achievement Badges Widget */}
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Award size={18} color="#eab308" />
                <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>Merit Badges & Achievements</h3>
              </div>
              <span className="badge badge-warning">{stats.merit_points || 920} Points</span>
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
              {(stats.badges || []).map((b, i) => (
                <div key={i} style={{
                  padding: '0.45rem 0.85rem',
                  borderRadius: 'var(--radius-full)',
                  background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.15) 0%, rgba(234, 179, 8, 0.05) 100%)',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  color: 'var(--warning)',
                  fontWeight: 700,
                  fontSize: '0.8rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.35rem'
                }}>
                  ★ {b}
                </div>
              ))}
            </div>

            <div style={{ marginTop: '1.25rem' }}>
              <button onClick={() => onNavigate('engagement')} className="btn btn-outline btn-sm" style={{ width: '100%', fontWeight: 700 }}>
                View Full Campus Leaderboard
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <div>Unknown role dashboard</div>;
}
