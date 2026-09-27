import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  TrendingUp,
  AlertTriangle,
  Sliders,
  CheckCircle2,
  HelpCircle,
  Sparkles,
  BarChart3,
  RotateCcw,
  Zap,
  Info,
  ShieldCheck,
  Award,
  Layers
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceLine,
  BarChart,
  Bar
} from 'recharts';

export default function CGPAProbabilityView() {
  const { user, token } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [whatIfAdjustments, setWhatIfAdjustments] = useState({});
  const [simulatedData, setSimulatedData] = useState(null);
  const [isSimulating, setIsSimulating] = useState(false);

  // Student selection for Admin/Faculty
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');

  useEffect(() => {
    if (user?.role === 'admin' || user?.role === 'faculty') {
      fetch('/api/students?semester=4', {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(r => r.json())
        .then(st => {
          setStudents(st);
          if (st.length > 0 && !selectedStudentId) {
            setSelectedStudentId(st[0].id);
          }
        })
        .catch(console.error);
    }
  }, [user?.role, token]);

  useEffect(() => {
    fetchAnalysis();
  }, [token, selectedStudentId, user?.role]);

  async function fetchAnalysis() {
    if (!token) return;
    setLoading(true);

    try {
      const targetId = (user?.role === 'admin' || user?.role === 'faculty') && selectedStudentId
        ? selectedStudentId
        : 'me';

      const res = await fetch(`/api/cgpa/analysis/${targetId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (res.ok) {
        const resData = await res.json();
        setData(resData);
        setSimulatedData(resData);
        setWhatIfAdjustments({});
      }
    } catch (err) {
      console.error('Error fetching CGPA probability analysis:', err);
    } finally {
      setLoading(false);
    }
  }

  // Handle What-If slider adjustments (Live client-side simulator with optional API sync)
  const handleSliderChange = async (subjectId, value) => {
    const updated = {
      ...whatIfAdjustments,
      [subjectId]: Number(value)
    };
    setWhatIfAdjustments(updated);

    // Call simulate API for exact mathematical precision
    setIsSimulating(true);
    try {
      const targetId = (user?.role === 'admin' || user?.role === 'faculty') && selectedStudentId
        ? selectedStudentId
        : 'me';

      const res = await fetch('/api/cgpa/simulate', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          studentId: targetId,
          whatIfAdjustments: updated
        })
      });

      if (res.ok) {
        const simRes = await res.json();
        setSimulatedData(simRes);
      }
    } catch (err) {
      console.error('Simulation error:', err);
    } finally {
      setIsSimulating(false);
    }
  };

  const resetSimulation = () => {
    setWhatIfAdjustments({});
    setSimulatedData(data);
  };

  if (loading) {
    return (
      <div style={{ padding: '3.5rem', textAlign: 'center', color: 'var(--text-muted)' }}>
        <div style={{
          width: '48px',
          height: '48px',
          margin: '0 auto 1.25rem auto',
          borderRadius: '50%',
          border: '3px solid var(--border-subtle)',
          borderTopColor: 'var(--role-accent)',
          animation: 'spin 0.8s linear infinite'
        }}></div>
        <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '0.4rem' }}>
          Computing Multi-Factor Statistical Forecast...
        </div>
        <div style={{ fontSize: '0.85rem' }}>Evaluating historical subject difficulty, continuous internal scores, and live attendance metrics...</div>
      </div>
    );
  }

  const currentDisplay = simulatedData || data;

  // Build Confidence Band trajectory data for Recharts Area/Line Chart
  const priorCGPA = currentDisplay?.current_cgpa || 8.78;
  const predSGPA = currentDisplay?.predicted_sgpa || 8.94;
  const sgpaLower = currentDisplay?.sgpa_range?.[0] || 8.65;
  const sgpaUpper = currentDisplay?.sgpa_range?.[1] || 8.95;

  const trajectoryData = [
    { semester: 'Sem 1', actual: 8.50, projected: 8.50, lowerBand: 8.50, upperBand: 8.50 },
    { semester: 'Sem 2', actual: 8.70, projected: 8.70, lowerBand: 8.70, upperBand: 8.70 },
    { semester: 'Sem 3', actual: priorCGPA, projected: priorCGPA, lowerBand: priorCGPA, upperBand: priorCGPA },
    {
      semester: 'Sem 4 (Forecast)',
      actual: null,
      projected: predSGPA,
      lowerBand: sgpaLower,
      upperBand: sgpaUpper
    }
  ];

  // Subject difficulty vs projected score comparison data
  const subjectCompareData = (currentDisplay?.subjects || []).map(s => ({
    name: s.subject_code,
    fullName: s.subject_name,
    projectedScore: s.predicted_score,
    difficultyPct: Math.round(s.difficulty_index * 100),
    attendance: s.attendance_pct
  }));

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="glass-panel" style={{
        padding: '1.75rem 2rem',
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.14) 0%, rgba(139, 92, 246, 0.08) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        borderLeft: '5px solid var(--role-accent)',
        boxShadow: '0 4px 20px var(--role-accent-glow)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginBottom: '0.4rem' }}>
            <span className="badge badge-primary" style={{ gap: '0.35rem' }}>
              <Sparkles size={13} /> Flagship Core Innovation (Module 2.G)
            </span>
            {Object.keys(whatIfAdjustments).length > 0 && (
              <span className="badge badge-warning">
                Live Simulation Active ({Object.keys(whatIfAdjustments).length} tweaks)
              </span>
            )}
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>CGPA Probability & Predictive Engine</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Estimates probable semester CGPA before results are declared using subject difficulty indices, internal marks, and live attendance.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span className="badge badge-info" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}>
            Engine: {currentDisplay?.engine || 'Statistical Regression v2.4'}
          </span>

          <button onClick={resetSimulation} className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <RotateCcw size={15} /> Reset Sliders
          </button>
        </div>
      </div>

      {/* Admin / Faculty Student Selector */}
      {(user?.role === 'admin' || user?.role === 'faculty') && (
        <div className="glass-panel" style={{ padding: '0.85rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>Inspect Student Academic Risk Model:</span>
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="form-select"
              style={{ width: '280px', padding: '0.4rem 0.75rem', borderRadius: 'var(--radius-sm)' }}
            >
              {students.map(s => (
                <option key={s.id} value={s.id}>
                  {s.full_name} ({s.roll_no}) - CGPA: {s.current_cgpa}
                </option>
              ))}
            </select>
          </div>

          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
            Proactively identifies at-risk students before university examinations.
          </div>
        </div>
      )}

      {/* Flagship Output Cards: Probable CGPA + Confidence Gauge + At-Risk Count */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '1rem'
      }}>
        {/* Predicted SGPA Card */}
        <div className="stat-card purple animate-pulse-glow" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>PROJECTED SEMESTER SGPA</span>
            <Zap size={20} color="var(--accent-purple)" />
          </div>

          <div style={{ fontSize: '2.75rem', fontWeight: 800, color: 'var(--accent-purple)', lineHeight: 1.1, margin: '0.5rem 0' }}>
            {currentDisplay?.predicted_sgpa}
          </div>

          <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            Probable Range: <strong>{currentDisplay?.sgpa_range?.[0]} - {currentDisplay?.sgpa_range?.[1]}</strong> SGPA
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Based on {currentDisplay?.total_semester_credits || 20} semester credits
          </div>
        </div>

        {/* Cumulative Predicted CGPA Card */}
        <div className="stat-card info" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>PROJECTED CUMULATIVE CGPA</span>
            <TrendingUp size={20} color="var(--info)" />
          </div>

          <div style={{ fontSize: '2.75rem', fontWeight: 800, color: 'var(--info)', lineHeight: 1.1, margin: '0.5rem 0' }}>
            {currentDisplay?.predicted_cgpa}
          </div>

          <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
            Confidence Band: <strong>{currentDisplay?.cgpa_range?.[0]} - {currentDisplay?.cgpa_range?.[1]}</strong>
          </div>
          <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
            Current CGPA: {currentDisplay?.current_cgpa} • Prior Credits: {currentDisplay?.total_credits_earned || 76}
          </div>
        </div>

        {/* Statistical Confidence Indicator */}
        <div className="stat-card success" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>CONFIDENCE SCORE</span>
            <ShieldCheck size={20} color="var(--success)" />
          </div>

          <div style={{ fontSize: '2.75rem', fontWeight: 800, color: 'var(--success)', lineHeight: 1.1, margin: '0.5rem 0' }}>
            {currentDisplay?.confidence_score}%
          </div>

          <div className="progress-bar-container" style={{ height: '8px', margin: '0.4rem 0' }}>
            <div 
              className="progress-bar-fill success"
              style={{ width: `${currentDisplay?.confidence_score}%` }}
            ></div>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
            {currentDisplay?.confidence_level} Reliability Model
          </div>
        </div>

        {/* Early Warning Flags Count */}
        <div className={`stat-card ${currentDisplay?.at_risk_count > 0 ? 'danger' : 'success'}`} style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)' }}>AT-RISK SUBJECT FLAGS</span>
            <AlertTriangle size={20} color={currentDisplay?.at_risk_count > 0 ? 'var(--danger)' : 'var(--success)'} />
          </div>

          <div style={{ fontSize: '2.75rem', fontWeight: 800, color: currentDisplay?.at_risk_count > 0 ? 'var(--danger)' : 'var(--success)', lineHeight: 1.1, margin: '0.5rem 0' }}>
            {currentDisplay?.at_risk_count || 0}
          </div>

          <div style={{ fontSize: '0.8rem', color: currentDisplay?.at_risk_count > 0 ? 'var(--danger)' : 'var(--success)', fontWeight: 600 }}>
            {currentDisplay?.at_risk_count > 0 
              ? 'Early warning triggered' 
              : 'All subjects safe above target'}
          </div>
        </div>
      </div>

      {/* Visual Recharts Confidence Band Area Chart & Subject Comparison */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(420px, 1fr))', gap: '1.25rem' }}>
        {/* Dynamic Confidence Band Chart */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>CGPA Confidence Band Trajectory</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Historical progression + Live simulated forecast interval [Upper, Lower]
              </p>
            </div>
            <span className="badge badge-purple">Live Interactive</span>
          </div>

          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trajectoryData}>
                <defs>
                  <linearGradient id="confidenceGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0.05}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="semester" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis domain={[7.5, 10.0]} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip formatter={(val) => Number(val).toFixed(2)} />
                <Area type="monotone" dataKey="upperBand" stroke="#8b5cf6" fillOpacity={1} fill="url(#confidenceGrad)" name="Upper Bound" />
                <Area type="monotone" dataKey="lowerBand" stroke="#6366f1" fillOpacity={0} name="Lower Bound" />
                <Line type="monotone" dataKey="projected" stroke="#4f46e5" strokeWidth={3} dot={{ r: 5 }} name="Expected CGPA" />
                <ReferenceLine y={8.0} stroke="#f59e0b" strokeDasharray="3 3" label={{ value: 'Distinction Bar', fill: '#f59e0b', fontSize: 10 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Subject Difficulty vs Projected Score Bar Chart */}
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h3 style={{ fontSize: '1.05rem', fontWeight: 700 }}>Subject Difficulty vs Projected Marks</h3>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Difficulty weighting penalization vs current projected marks out of 100
              </p>
            </div>
            <span className="badge badge-info">Courseware Model</span>
          </div>

          <div style={{ height: '240px', width: '100%' }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={subjectCompareData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} opacity={0.2} />
                <XAxis dataKey="name" tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <YAxis domain={[0, 100]} tick={{ fill: 'var(--text-secondary)', fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="projectedScore" fill="#4f46e5" name="Projected Score / 100" radius={[4, 4, 0, 0]} />
                <Bar dataKey="difficultyPct" fill="#ec4899" name="Difficulty Index %" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Early Warning Alerts Banner (if any subjects are at risk) */}
      {currentDisplay?.at_risk_subjects && currentDisplay.at_risk_subjects.length > 0 && (
        <div style={{
          padding: '1.25rem 1.5rem',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--danger-bg)',
          border: '1px solid var(--danger-border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <AlertTriangle size={20} color="var(--danger)" />
            <h3 style={{ fontSize: '1rem', color: 'var(--danger)', fontWeight: 700 }}>
              Proactive Academic Risk Flag (Action Required)
            </h3>
          </div>

          <p style={{ fontSize: '0.85rem', color: 'var(--text-primary)' }}>
            The probability engine has identified subjects with high difficulty indices or low coursework scores that may significantly drag down your semester CGPA:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
            {currentDisplay.at_risk_subjects.map((risk, rIdx) => (
              <div key={rIdx} style={{
                padding: '0.65rem 0.85rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontWeight: 700, color: 'var(--danger)' }}>{risk.subject_code} - {risk.subject_name}</span>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Reason: <em>{risk.reason}</em>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="badge badge-danger">Projected: Grade {risk.predicted_grade} ({risk.predicted_score}%)</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Interactive "What-If" Simulator & Subject Breakdown Matrix */}
      <div className="glass-panel" style={{ padding: '1.75rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sliders size={20} color="var(--primary)" />
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Interactive "What-If" Performance Simulator</h3>
            </div>
            <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
              Adjust sliders below to simulate hypothetical mark adjustments in upcoming exams and witness the instant live recalculation of your semester CGPA and confidence band! (Non-persisted calculation).
            </p>
          </div>

          {Object.keys(whatIfAdjustments).length > 0 && (
            <span className="badge badge-warning" style={{ fontSize: '0.8rem' }}>
              Simulation Active ({Object.keys(whatIfAdjustments).length} adjustments)
            </span>
          )}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {(currentDisplay?.subjects || []).map(sub => {
            const currentAdj = whatIfAdjustments[sub.subject_id] || 0;
            return (
              <div key={sub.subject_id} style={{
                padding: '1.25rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface-subtle)',
                border: `1px solid ${sub.is_at_risk ? 'var(--danger-border)' : 'var(--border-subtle)'}`,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.85rem'
              }}>
                {/* Header row */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <span style={{ fontWeight: 800, fontSize: '0.95rem' }}>{sub.subject_name}</span>
                      <span className="badge badge-primary">{sub.subject_code}</span>
                      <span className="badge badge-info">{sub.credits} Credits</span>
                      {sub.is_at_risk && (
                        <span className="badge badge-danger">At-Risk Warning</span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Difficulty Index: <strong>{sub.difficulty_index}</strong> (Pass %: {sub.historical_pass_pct}% | Avg: {sub.historical_avg_marks}) • Live Attendance: <strong>{sub.attendance_pct}%</strong>
                    </div>
                  </div>

                  {/* Predicted Grade & Score */}
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '1.35rem', fontWeight: 800, color: 'var(--primary)' }}>
                      {sub.predicted_score} <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>/ 100</span>
                    </div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>
                      Predicted Grade: <strong style={{ color: 'var(--success)' }}>{sub.predicted_grade}</strong> (Range: {sub.grade_range[0]} - {sub.grade_range[1]})
                    </div>
                  </div>
                </div>

                {/* Slider row */}
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '1rem',
                  padding: '0.5rem 0.75rem',
                  borderRadius: 'var(--radius-sm)',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-subtle)'
                }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, minWidth: '130px', color: 'var(--text-secondary)' }}>
                    Hypothetical Tweak:
                  </span>

                  <input
                    type="range"
                    min="-15"
                    max="15"
                    step="1"
                    value={currentAdj}
                    onChange={(e) => handleSliderChange(sub.subject_id, e.target.value)}
                    style={{ flex: 1, accentColor: 'var(--role-accent)', cursor: 'pointer' }}
                  />

                  <span style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: 800,
                    fontSize: '0.85rem',
                    minWidth: '55px',
                    textAlign: 'right',
                    color: currentAdj > 0 ? 'var(--success)' : (currentAdj < 0 ? 'var(--danger)' : 'var(--text-muted)')
                  }}>
                    {currentAdj > 0 ? `+${currentAdj}` : currentAdj} pts
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Model Mathematical Specification Info Box */}
      <div className="glass-panel" style={{ padding: '1.5rem', background: 'var(--bg-surface-subtle)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
          <Info size={18} color="var(--primary)" />
          <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>Model Architecture & Mathematical Grounding</h4>
        </div>
        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          The CGPA Probability engine uses a multi-factor regression model:
          <br />
          <strong>1. Difficulty Index (D):</strong> Computed as 1.0 - [0.55 * (Avg Marks / 100) + 0.45 * (Pass Rate / 100)], penalizing historically challenging subjects.
          <br />
          <strong>2. Continuous Assessment:</strong> Blends internal marks (65%) and assignment performance (35%).
          <br />
          <strong>3. Live Smart Attendance Multiplier:</strong> Sourced live from the attendance tracker; awards bonuses for &gt;85% while applying sharp exponential drags when dropping below the statutory 75% threshold.
        </p>
      </div>
    </div>
  );
}
