import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  QrCode,
  CheckCircle2,
  XCircle,
  Clock,
  AlertTriangle,
  Download,
  Users,
  Calendar,
  Sparkles,
  RefreshCw,
  Plus,
  Search,
  Check,
  Percent,
  ShieldAlert,
  Edit3
} from 'lucide-react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Legend
} from 'recharts';

export default function AttendanceView() {
  const { user, token } = useAuth();
  const [summary, setSummary] = useState(null);
  const [trends, setTrends] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);

  // Admin Override Modal State
  const [showOverrideModal, setShowOverrideModal] = useState(false);
  const [overrideRecordId, setOverrideRecordId] = useState('');
  const [overrideStatus, setOverrideStatus] = useState('Present');
  const [overrideReason, setOverrideReason] = useState('Approved university duty leave for technical symposium');
  const [overrideLoading, setOverrideLoading] = useState(false);
  const [overrideToast, setOverrideToast] = useState(null);

  // Faculty session creation & QR state
  const [showQRModal, setShowQRModal] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const [qrCountdown, setQrCountdown] = useState(900); // 15 mins
  const [selectedSubjectId, setSelectedSubjectId] = useState('');
  const [selectedSection, setSelectedSection] = useState('CSE-2');
  const [topicCovered, setTopicCovered] = useState('');

  // Student QR check-in state
  const [showStudentCheckinModal, setShowStudentCheckinModal] = useState(false);
  const [inputToken, setInputToken] = useState('GTB-QR-LIVE-SESSION-8821');
  const [checkinStatus, setCheckinStatus] = useState(null);

  // Faculty One-Tap Matrix state
  const [oneTapRecords, setOneTapRecords] = useState({});
  const [isSavingOneTap, setIsSavingOneTap] = useState(false);

  // Filter for student inspection (Admin/Faculty)
  const [inspectedStudentId, setInspectedStudentId] = useState('');

  useEffect(() => {
    fetchData();
  }, [token, inspectedStudentId, user?.role]);

  async function fetchData() {
    if (!token) return;
    setLoading(true);

    try {
      // 1. Fetch Summary
      const summaryUrl = inspectedStudentId 
        ? `/api/attendance/summary?studentId=${inspectedStudentId}`
        : '/api/attendance/summary';
      
      const sumRes = await fetch(summaryUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (sumRes.ok) {
        const sumData = await sumRes.json();
        setSummary(sumData);
      }

      // 2. Fetch Trends
      const trendUrl = inspectedStudentId
        ? `/api/attendance/trends?studentId=${inspectedStudentId}`
        : '/api/attendance/trends';
      const trRes = await fetch(trendUrl, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (trRes.ok) {
        const trData = await trRes.json();
        setTrends(trData);
      }

      // 3. Fetch Subjects
      const subRes = await fetch('/api/academics/subjects?semester=4', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (subRes.ok) {
        const subData = await subRes.json();
        setSubjects(subData);
        if (subData.length > 0 && !selectedSubjectId) {
          setSelectedSubjectId(subData[0].id);
        }
      }

      // 4. Fetch Students (for one-tap matrix)
      const stRes = await fetch('/api/students?semester=4&section=CSE-2', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (stRes.ok) {
        const stData = await stRes.json();
        setStudents(stData);
        // Initialize one-tap status: default all to Present
        const initialStatus = {};
        stData.forEach(s => {
          initialStatus[s.id] = 'Present';
        });
        setOneTapRecords(initialStatus);
      }
    } catch (err) {
      console.error('Error fetching attendance data:', err);
    } finally {
      setLoading(false);
    }
  }

  // Timer countdown for active QR session
  useEffect(() => {
    if (!activeSession || qrCountdown <= 0) return;
    const interval = setInterval(() => {
      setQrCountdown(prev => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeSession, qrCountdown]);

  // Create Faculty QR Session
  const handleCreateSession = async () => {
    try {
      const res = await fetch('/api/attendance/create-session', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subjectId: selectedSubjectId,
          section: selectedSection,
          semester: 4,
          topicCovered: topicCovered || 'Daily Lecture & Core Problem Set',
          durationMinutes: 15
        })
      });

      if (res.ok) {
        const data = await res.json();
        setActiveSession(data);
        setQrCountdown(900);
        setShowQRModal(true);
      }
    } catch (err) {
      alert('Error creating attendance session: ' + err.message);
    }
  };

  // Student QR Check-in
  const handleStudentCheckin = async () => {
    setCheckinStatus(null);
    try {
      const res = await fetch('/api/attendance/qr-checkin', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ sessionToken: inputToken })
      });

      const data = await res.json();
      if (res.ok) {
        setCheckinStatus({ success: true, message: data.message });
        fetchData();
      } else {
        setCheckinStatus({ success: false, message: data.error || 'Check-in failed' });
      }
    } catch (err) {
      setCheckinStatus({ success: false, message: err.message });
    }
  };

  // Save One-Tap Bulk Attendance Matrix
  const handleSaveOneTap = async () => {
    setIsSavingOneTap(true);
    try {
      const records = Object.entries(oneTapRecords).map(([studentId, status]) => ({
        studentId: Number(studentId),
        status
      }));

      const res = await fetch('/api/attendance/bulk-mark', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: activeSession ? activeSession.sessionId : 1,
          records
        })
      });

      if (res.ok) {
        alert('One-tap attendance successfully recorded for class!');
        fetchData();
      }
    } catch (err) {
      alert('Error saving bulk attendance: ' + err.message);
    } finally {
      setIsSavingOneTap(false);
    }
  };

  // Export Attendance CSV
  const handleExportCSV = () => {
    if (!summary?.subjects) return;
    let csvContent = 'data:text/csv;charset=utf-8,';
    csvContent += 'Subject Code,Subject Name,Faculty,Total Classes,Attended,Late,Absent,Attendance %\n';
    summary.subjects.forEach(s => {
      csvContent += `"${s.subject_code}","${s.subject_name}","${s.faculty_name || 'N/A'}",${s.total_classes},${s.present_count},${s.late_count},${s.absent_count},${s.attendance_percentage}%\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `GTBIT_Attendance_Report_${summary.student_name || 'Sem4'}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleOverrideSubmit = async () => {
    if (!overrideRecordId || !overrideReason) {
      alert('Attendance Record ID and mandatory justification are required');
      return;
    }
    setOverrideLoading(true);
    try {
      const res = await fetch('/api/attendance/override', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recordId: Number(overrideRecordId),
          status: overrideStatus,
          reason: overrideReason
        })
      });
      if (res.ok) {
        setOverrideToast(`Record #${overrideRecordId} successfully updated with audit trail!`);
        setShowOverrideModal(false);
        setTimeout(() => setOverrideToast(null), 4000);
        fetchData();
      } else {
        const err = await res.json();
        alert(`Override failed: ${err.error || 'Server error'}`);
      }
    } catch (e) {
      alert(`Network error: ${e.message}`);
    } finally {
      setOverrideLoading(false);
    }
  };

  const isFacultyOrAdmin = user?.role === 'admin' || user?.role === 'faculty';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Toast Alert */}
      {overrideToast && (
        <div style={{
          padding: '0.85rem 1.25rem',
          borderRadius: 'var(--radius-md)',
          background: 'var(--success-bg)',
          border: '1px solid var(--success-border)',
          color: 'var(--success)',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <CheckCircle2 size={18} />
          {overrideToast}
        </div>
      )}

      {/* Header Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem 2rem',
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(79, 70, 229, 0.08) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        borderLeft: '5px solid var(--role-accent)',
        boxShadow: '0 4px 20px var(--role-accent-glow)'
      }}>
        <div>
          <div className="badge badge-info" style={{ marginBottom: '0.4rem' }}>
            Enhanced ERP Capability (Module 2.D)
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Smart Attendance Tracker</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Real-time percentage monitoring, dynamic QR codes, one-tap marking, and automated 75% threshold alerts.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {user?.role === 'admin' && (
            <button 
              onClick={() => setShowOverrideModal(true)} 
              className="btn btn-warning btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontWeight: 700 }}
            >
              <ShieldAlert size={16} /> Compliance Audit Override
            </button>
          )}

          {isFacultyOrAdmin && (
            <button onClick={() => setShowQRModal(true)} className="btn btn-primary btn-sm">
              <QrCode size={16} /> Launch Live QR Session
            </button>
          )}

          {user?.role === 'student' && (
            <button onClick={() => setShowStudentCheckinModal(true)} className="btn btn-success btn-sm">
              <QrCode size={16} /> QR Check-In Scanner
            </button>
          )}

          <button onClick={handleExportCSV} className="btn btn-secondary btn-sm">
            <Download size={16} /> Export CSV Report
          </button>
        </div>
      </div>

      {/* Admin / Faculty Student Selector to inspect any student's threshold */}
      {isFacultyOrAdmin && (
        <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Inspect Student Attendance:</span>
            <select 
              value={inspectedStudentId}
              onChange={(e) => setInspectedStudentId(e.target.value)}
              className="form-select"
              style={{ width: '280px', padding: '0.4rem 0.75rem' }}
            >
              <option value="">Default (Active User Context)</option>
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.roll_no}) {s.is_attendance_critical ? '⚠️ [<75% RISK]' : '✓ [Safe]'}
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Mandatory GGSIPU Examination Eligibility Threshold: <strong>75.0%</strong>
          </div>
        </div>
      )}

      {/* Overall Status Banner & 75% Threshold Alert */}
      {summary && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '1rem'
        }}>
          {/* Main Percentage Card */}
          <div className={`stat-card ${summary.is_at_risk ? 'danger' : 'success'}`} style={{ gridColumn: 'span 2' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>OVERALL SEMESTER ATTENDANCE</span>
                <div style={{ fontSize: '2.5rem', fontWeight: 800, color: summary.is_at_risk ? 'var(--danger)' : 'var(--success)' }}>
                  {summary.overall_percentage}%
                </div>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span className={`badge badge-${summary.is_at_risk ? 'danger' : 'success'}`} style={{ fontSize: '0.85rem', padding: '0.4rem 0.85rem' }}>
                  {summary.is_at_risk ? '⚠️ DETENTION RISK (<75%)' : '✓ EXAM ELIGIBLE (>=75%)'}
                </span>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem' }}>
                  Attended {summary.total_attended} of {summary.total_conducted} conducted lectures
                </div>
              </div>
            </div>

            <div className="progress-bar-container" style={{ height: '10px', marginTop: '0.5rem' }}>
              <div 
                className={`progress-bar-fill ${summary.is_at_risk ? 'danger' : 'success'}`}
                style={{ width: `${Math.min(100, summary.overall_percentage)}%` }}
              ></div>
            </div>

            {summary.is_at_risk ? (
              <div style={{ fontSize: '0.8rem', color: 'var(--danger)', fontWeight: 600, marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <AlertTriangle size={16} /> Automated alerts sent to student and registered parents. Risk of being barred from End-Term exams.
              </div>
            ) : (
              <div style={{ fontSize: '0.8rem', color: 'var(--success)', fontWeight: 600, marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <CheckCircle2 size={16} /> Consistent attendance. Qualified for university examination admit card.
              </div>
            )}
          </div>

          {/* Quick Metrics */}
          <div className="stat-card info">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>CLASSES ATTENDED</span>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{summary.total_attended}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Present + 0.5x Late sessions</div>
          </div>

          <div className="stat-card purple">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>SUBJECTS TRACKED</span>
            <div style={{ fontSize: '2rem', fontWeight: 800 }}>{summary.subjects?.length || 5}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Computer Science & Engg</div>
          </div>
        </div>
      )}

      {/* Flagship Innovation: Attendance Progression & Trend Line Chart */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 700 }}>Attendance Progression & Longitudinal Trend</h3>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              Temporal attendance compliance tracking vs 75% GGSIPU statutory examination eligibility requirement
            </p>
          </div>
          <span className="badge badge-success" style={{ fontWeight: 700 }}>
            Mandatory Compliance Bar: 75%
          </span>
        </div>

        <div style={{ height: '220px', width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={trends.length > 0 ? trends : [
              { date: '2026-03-01', percentage: 91.5 },
              { date: '2026-03-08', percentage: 89.0 },
              { date: '2026-03-15', percentage: 86.4 },
              { date: '2026-03-22', percentage: 88.5 }
            ]}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
              <XAxis dataKey="date" tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <YAxis domain={[50, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 11 }} />
              <Tooltip formatter={(val) => `${val}%`} />
              <Line type="monotone" dataKey="percentage" stroke="var(--role-accent)" strokeWidth={3} dot={{ r: 4 }} name="Attendance %" />
              <ReferenceLine y={75} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={2} label={{ value: '75% Threshold', fill: '#ef4444', fontSize: 11, position: 'right' }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Subject-Wise Attendance Breakdown Table */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div>
            <h3 style={{ fontSize: '1.1rem' }}>Subject-Wise Real-Time Breakdown</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Individual threshold checks and classes needed to achieve or maintain 75% attendance.
            </p>
          </div>
        </div>

        <div className="table-container">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Faculty</th>
                <th>Conducted</th>
                <th>Present</th>
                <th>Late</th>
                <th>Absent</th>
                <th>Percentage</th>
                <th>Status</th>
                <th>Requirement Calculator</th>
              </tr>
            </thead>
            <tbody>
              {(summary?.subjects || []).map(sub => (
                <tr key={sub.subject_id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{sub.subject_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{sub.subject_code} • {sub.credits} Credits</div>
                  </td>
                  <td>{sub.faculty_name || 'CSE Faculty'}</td>
                  <td style={{ fontWeight: 600 }}>{sub.total_classes}</td>
                  <td style={{ color: 'var(--success)', fontWeight: 600 }}>{sub.present_count}</td>
                  <td style={{ color: 'var(--warning)', fontWeight: 600 }}>{sub.late_count}</td>
                  <td style={{ color: 'var(--danger)', fontWeight: 600 }}>{sub.absent_count}</td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 800, width: '45px', color: sub.is_below_threshold ? 'var(--danger)' : 'var(--text-primary)' }}>
                        {sub.attendance_percentage}%
                      </span>
                      <div className="progress-bar-container" style={{ width: '70px', height: '6px' }}>
                        <div 
                          className={`progress-bar-fill ${sub.is_below_threshold ? 'danger' : 'success'}`}
                          style={{ width: `${Math.min(100, sub.attendance_percentage)}%` }}
                        ></div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge badge-${sub.is_below_threshold ? 'danger' : 'success'}`}>
                      {sub.is_below_threshold ? 'Below 75%' : 'Satisfactory'}
                    </span>
                  </td>
                  <td>
                    {sub.is_below_threshold ? (
                      <span style={{ fontSize: '0.75rem', color: 'var(--danger)', fontWeight: 700 }}>
                        Must attend next <strong>{sub.classes_needed_for_75}</strong> lectures
                      </span>
                    ) : (
                      <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                        Safe to miss up to <strong>{sub.safe_leaves_allowed}</strong> classes
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Faculty One-Tap Matrix (For Quick Roll Call) */}
      {isFacultyOrAdmin && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.1rem' }}>Faculty One-Tap Attendance Roll Call (CSE-2)</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Click to toggle Present, Absent, or Late for each student in the section.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button 
                onClick={() => {
                  const updated = {};
                  students.forEach(s => { updated[s.id] = 'Present'; });
                  setOneTapRecords(updated);
                }} 
                className="btn btn-secondary btn-sm"
              >
                Mark All Present
              </button>

              <button 
                onClick={handleSaveOneTap} 
                disabled={isSavingOneTap}
                className="btn btn-primary btn-sm"
              >
                {isSavingOneTap ? 'Saving...' : 'Submit Session Attendance'}
              </button>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '0.85rem'
          }}>
            {students.map(st => {
              const status = oneTapRecords[st.id] || 'Present';
              return (
                <div key={st.id} style={{
                  padding: '0.85rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-subtle)',
                  border: `1px solid ${status === 'Present' ? 'var(--success-border)' : (status === 'Late' ? 'var(--warning-border)' : 'var(--danger-border)')}`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between'
                }}>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>{st.full_name}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                      Roll: {st.roll_no} • Overall: {st.live_attendance_pct}%
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.25rem' }}>
                    <button
                      onClick={() => setOneTapRecords({ ...oneTapRecords, [st.id]: 'Present' })}
                      className={`btn btn-sm ${status === 'Present' ? 'btn-success' : 'btn-secondary'}`}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                    >
                      P
                    </button>
                    <button
                      onClick={() => setOneTapRecords({ ...oneTapRecords, [st.id]: 'Late' })}
                      className={`btn btn-sm ${status === 'Late' ? 'btn-warning' : 'btn-secondary'}`}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem', background: status === 'Late' ? '#f59e0b' : 'transparent', color: status === 'Late' ? '#fff' : 'inherit' }}
                    >
                      L
                    </button>
                    <button
                      onClick={() => setOneTapRecords({ ...oneTapRecords, [st.id]: 'Absent' })}
                      className={`btn btn-sm ${status === 'Absent' ? 'btn-danger' : 'btn-secondary'}`}
                      style={{ padding: '0.25rem 0.5rem', fontSize: '0.72rem' }}
                    >
                      A
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Dynamic QR Session Generator Modal for Faculty */}
      {showQRModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', textAlign: 'center' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>
              Live Dynamic QR Attendance Session
            </h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.5rem' }}>
              Project this QR Code or share the OTP token with students in the lecture hall.
            </p>

            {/* Mock Dynamic QR Code Pattern */}
            <div style={{
              width: '220px',
              height: '220px',
              margin: '0 auto 1.25rem auto',
              background: '#ffffff',
              padding: '1rem',
              borderRadius: 'var(--radius-lg)',
              border: '2px dashed var(--primary)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 8px 24px var(--primary-glow)'
            }}>
              <QrCode size={160} color="#0f172a" />
              <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#0f172a', marginTop: '0.4rem', fontFamily: 'var(--font-mono)' }}>
                {activeSession?.sessionToken || 'GTB-QR-LIVE-SESSION-8821'}
              </div>
            </div>

            <div style={{
              padding: '0.75rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-subtle)',
              marginBottom: '1.5rem'
            }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Session Expiry Countdown:</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)', fontFamily: 'var(--font-mono)' }}>
                {Math.floor(qrCountdown / 60)}:{(qrCountdown % 60).toString().padStart(2, '0')}
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Token auto-rotates every 15 minutes to prevent remote proxy attendance.
              </div>
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button onClick={() => setShowQRModal(false)} className="btn btn-secondary">
                Close Window
              </button>
              <button onClick={handleCreateSession} className="btn btn-primary">
                Regenerate New Token
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Student QR Check-in Simulator Modal */}
      {showStudentCheckinModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '440px' }}>
            <h3 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>Student Mobile QR Check-In</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Scan the projected classroom QR code or enter the session token announced by faculty:
            </p>

            <div className="form-group">
              <label className="form-label">Live Session Token / OTP</label>
              <input
                type="text"
                className="form-input"
                value={inputToken}
                onChange={(e) => setInputToken(e.target.value)}
                placeholder="e.g. GTB-QR-LIVE-SESSION-8821"
                style={{ fontFamily: 'var(--font-mono)', letterSpacing: '0.05em', fontWeight: 600 }}
              />
            </div>

            {checkinStatus && (
              <div style={{
                padding: '0.75rem',
                borderRadius: 'var(--radius-md)',
                marginBottom: '1rem',
                fontSize: '0.85rem',
                fontWeight: 600,
                background: checkinStatus.success ? 'var(--success-bg)' : 'var(--danger-bg)',
                color: checkinStatus.success ? 'var(--success)' : 'var(--danger)',
                border: `1px solid ${checkinStatus.success ? 'var(--success-border)' : 'var(--danger-border)'}`
              }}>
                {checkinStatus.message}
              </div>
            )}

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button onClick={() => setShowStudentCheckinModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button onClick={handleStudentCheckin} className="btn btn-primary">
                Confirm Check-In
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Admin Compliance Override Modal (Mandatory Audit Logging) */}
      {showOverrideModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.4rem' }}>
              <ShieldAlert size={20} color="var(--danger)" />
              <h3 style={{ fontSize: '1.2rem', fontWeight: 800 }}>Admin Attendance Override</h3>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.25rem' }}>
              Superuser authority to correct locked attendance records. Requires a mandatory audit log justification.
            </p>

            <div className="form-group">
              <label className="form-label">Attendance Record ID</label>
              <input
                type="number"
                className="form-input"
                placeholder="e.g. 627"
                value={overrideRecordId}
                onChange={(e) => setOverrideRecordId(e.target.value)}
              />
            </div>

            <div className="form-group">
              <label className="form-label">New Corrected Status</label>
              <select
                className="form-select"
                value={overrideStatus}
                onChange={(e) => setOverrideStatus(e.target.value)}
              >
                <option value="Present">Present (Full Credit)</option>
                <option value="Late">Late (0.5x Credit)</option>
                <option value="Absent">Absent (Zero Credit)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Mandatory Audit Justification / Reason</label>
              <textarea
                className="form-input"
                rows="3"
                placeholder="e.g. Official university symposium attendance duty leave sanctioned by HOD"
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
              <button onClick={() => setShowOverrideModal(false)} className="btn btn-secondary">
                Cancel
              </button>
              <button 
                onClick={handleOverrideSubmit} 
                disabled={overrideLoading}
                className="btn btn-primary"
                style={{ background: 'var(--role-accent)', fontWeight: 700 }}
              >
                {overrideLoading ? 'Logging & Overriding...' : 'Confirm Audit Override'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
