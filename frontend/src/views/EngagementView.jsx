import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Trophy,
  Sparkles,
  BookOpen,
  Target,
  CheckCircle2,
  TrendingUp,
  Brain,
  Compass,
  Award,
  Clock,
  Plus
} from 'lucide-react';

export default function EngagementView() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('leaderboard'); // 'leaderboard', 'study-plan', 'career'
  const [leaderboard, setLeaderboard] = useState([]);
  const [studyPlan, setStudyPlan] = useState(null);
  const [careerRecs, setCareerRecs] = useState(null);
  const [loading, setLoading] = useState(true);

  // Log study progress state
  const [loggingSubjectId, setLoggingSubjectId] = useState(null);
  const [loggedHours, setLoggedHours] = useState(1);

  useEffect(() => {
    fetchData();
  }, [token]);

  async function fetchData() {
    if (!token) return;
    setLoading(true);

    try {
      const [lbRes, spRes, crRes] = await Promise.all([
        fetch('/api/engagement/leaderboard', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/engagement/study-plan/me', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/engagement/career-recommendations/me', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (lbRes.ok) setLeaderboard(await lbRes.json());
      if (spRes.ok) setStudyPlan(await spRes.json());
      if (crRes.ok) setCareerRecs(await crRes.json());
    } catch (err) {
      console.error('Error fetching engagement metrics:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleLogStudyTime = async (subjectId) => {
    try {
      const res = await fetch('/api/engagement/study-plan/progress', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          subjectId,
          addHours: loggedHours
        })
      });

      if (res.ok) {
        alert(`Successfully logged ${loggedHours} hours of revision!`);
        setLoggingSubjectId(null);
        fetchData();
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem 2rem',
        background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.12) 0%, rgba(79, 70, 229, 0.08) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div className="badge badge-warning" style={{ marginBottom: '0.4rem' }}>
            Engagement & Student Support (Module 2.M)
          </div>
          <h1 style={{ fontSize: '1.75rem' }}>Student Engagement, Merit & AI Insights</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Merit leaderboard, achievement badges, personalized smart study planner, and AI career navigation.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-surface-subtle)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
          <button
            onClick={() => setActiveTab('leaderboard')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: activeTab === 'leaderboard' ? 700 : 500,
              cursor: 'pointer',
              background: activeTab === 'leaderboard' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'leaderboard' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            🏆 Leaderboard
          </button>

          <button
            onClick={() => setActiveTab('study-plan')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: activeTab === 'study-plan' ? 700 : 500,
              cursor: 'pointer',
              background: activeTab === 'study-plan' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'study-plan' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            📅 Smart Study Planner
          </button>

          <button
            onClick={() => setActiveTab('career')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: activeTab === 'career' ? 700 : 500,
              cursor: 'pointer',
              background: activeTab === 'career' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'career' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            🤖 AI Career Compass
          </button>
        </div>
      </div>

      {/* TAB 1: GAMIFIED MERIT LEADERBOARD */}
      {activeTab === 'leaderboard' && (
        <div className="glass-panel" style={{ padding: '1.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem' }}>Department Merit Leaderboard (CSE-2)</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Ranks computed from academic exam performance, attendance regularity, and assignment timeliness.
              </p>
            </div>
            <span className="badge badge-warning">Top Performers of 2026</span>
          </div>

          <div className="table-container">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Rank</th>
                  <th>Student</th>
                  <th>Roll Number</th>
                  <th>CGPA</th>
                  <th>Academic Score</th>
                  <th>Attendance Regularity</th>
                  <th>Merit Points</th>
                  <th>Badges Earned</th>
                </tr>
              </thead>
              <tbody>
                {leaderboard.map(st => (
                  <tr key={st.student_id} style={{ background: st.rank <= 3 ? 'rgba(79, 70, 229, 0.03)' : 'transparent' }}>
                    <td>
                      <span style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '28px',
                        height: '28px',
                        borderRadius: '50%',
                        fontWeight: 800,
                        fontSize: '0.85rem',
                        background: st.rank === 1 ? '#fbbf24' : (st.rank === 2 ? '#94a3b8' : (st.rank === 3 ? '#d97706' : 'var(--bg-surface-subtle)')),
                        color: st.rank <= 3 ? '#ffffff' : 'var(--text-secondary)'
                      }}>
                        {st.rank}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem' }}>
                        <img 
                          src={st.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'} 
                          alt={st.student_name}
                          style={{ width: '32px', height: '32px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <span style={{ fontWeight: 700 }}>{st.student_name}</span>
                      </div>
                    </td>
                    <td style={{ fontFamily: 'var(--font-mono)' }}>{st.roll_no}</td>
                    <td style={{ fontWeight: 800, color: 'var(--primary)' }}>{st.current_cgpa}</td>
                    <td>{st.academic_score} pts</td>
                    <td>{st.attendance_score} pts</td>
                    <td>
                      <span style={{ fontWeight: 800, fontSize: '1rem', color: 'var(--warning)' }}>
                        {st.total_merit_points}
                      </span>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.3rem' }}>
                        {(st.badges || []).map((b, idx) => (
                          <span key={idx} className="badge badge-warning" style={{ fontSize: '0.68rem', padding: '0.15rem 0.45rem' }}>
                            ★ {b}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 2: PERSONALIZED SMART STUDY PLANNER */}
      {activeTab === 'study-plan' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.5rem' }}>
              <div>
                <h3 style={{ fontSize: '1.15rem' }}>Personalized Adaptive Study Planner</h3>
                <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)' }}>
                  Generated automatically using your weak-subject scores and live attendance data from the Smart Attendance Tracker.
                </p>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span className="badge badge-primary">
                  Weekly Target: {studyPlan?.weekly_target_total_hours || 24} Hours
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(studyPlan?.planner_items || []).map(item => (
                <div key={item.subject_id} style={{
                  padding: '1.25rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-subtle)',
                  border: `1px solid ${item.priority === 'Critical' ? 'var(--danger-border)' : 'var(--border-subtle)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.75rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <h4 style={{ fontSize: '1rem', fontWeight: 800 }}>{item.subject_name}</h4>
                        <span className="badge badge-info">{item.subject_code}</span>
                        <span className={`badge badge-${item.priority === 'Critical' ? 'danger' : (item.priority === 'High' ? 'warning' : 'primary')}`}>
                          Priority: {item.priority}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                        Difficulty Index: <strong>{item.difficulty_index}</strong> • Attendance: <strong>{item.live_attendance_pct}%</strong>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>
                        {item.completed_hours_this_week} / {item.recommended_weekly_hours} hrs
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Logged this week</div>
                    </div>
                  </div>

                  {/* Weak topics advice */}
                  <div style={{
                    padding: '0.65rem 0.85rem',
                    background: 'var(--bg-surface)',
                    borderRadius: '6px',
                    fontSize: '0.8rem',
                    color: 'var(--text-secondary)'
                  }}>
                    🎯 Recommended Focus Topics: <strong>{item.weak_topics}</strong>
                  </div>

                  {/* Progress bar & log action */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="progress-bar-container" style={{ flex: 1, height: '8px' }}>
                      <div 
                        className={`progress-bar-fill ${item.progress_pct >= 80 ? 'success' : (item.progress_pct >= 40 ? 'warning' : 'danger')}`}
                        style={{ width: `${Math.min(100, item.progress_pct)}%` }}
                      ></div>
                    </div>

                    {loggingSubjectId === item.subject_id ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <input
                          type="number"
                          step="0.5"
                          min="0.5"
                          max="8"
                          value={loggedHours}
                          onChange={(e) => setLoggedHours(Number(e.target.value))}
                          className="form-input"
                          style={{ width: '70px', padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                        />
                        <button onClick={() => handleLogStudyTime(item.subject_id)} className="btn btn-success btn-sm">
                          Save
                        </button>
                        <button onClick={() => setLoggingSubjectId(null)} className="btn btn-secondary btn-sm">
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => {
                          setLoggingSubjectId(item.subject_id);
                          setLoggedHours(1.5);
                        }}
                        className="btn btn-outline btn-sm"
                      >
                        <Plus size={14} /> Log Study Time
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: AI CAREER COMPASS */}
      {activeTab === 'career' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Brain size={22} color="var(--primary)" />
                <h3 style={{ fontSize: '1.2rem' }}>AI-Powered Skill & Career Recommendations</h3>
              </div>
              <p style={{ fontSize: '0.825rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                Derived from your academic performance trends, coursework strengths in OS, Networks, Algorithms & AI, and placement requirements.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {(careerRecs?.recommendations || []).map((rec, idx) => (
                <div key={idx} style={{
                  padding: '1.5rem',
                  borderRadius: 'var(--radius-lg)',
                  background: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.85rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <h4 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{rec.role}</h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                        Industry Demand: <strong style={{ color: 'var(--success)' }}>{rec.market_demand}</strong>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '1.5rem', fontWeight: 800, color: 'var(--primary)' }}>
                        {rec.fit_score}%
                      </div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>Skill Compatibility Match</div>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.85rem' }}>
                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--success)', marginBottom: '0.35rem' }}>
                        ✓ Proven Academic Strengths:
                      </div>
                      <ul style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: '1.1rem' }}>
                        {rec.matching_strengths.map((s, sIdx) => (
                          <li key={sIdx}>{s}</li>
                        ))}
                      </ul>
                    </div>

                    <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'var(--bg-surface)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--warning)', marginBottom: '0.35rem' }}>
                        ⚡ High-Impact Skill Gaps to Bridge:
                      </div>
                      <ul style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', paddingLeft: '1.1rem' }}>
                        {rec.growth_areas.map((g, gIdx) => (
                          <li key={gIdx}>{g}</li>
                        ))}
                      </ul>
                    </div>
                  </div>

                  <div style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--primary-glow)',
                    border: '1px solid rgba(79, 70, 229, 0.25)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    fontSize: '0.78rem',
                    flexWrap: 'wrap',
                    gap: '0.5rem'
                  }}>
                    <span>Recommended Industry Certifications: <strong>{rec.recommended_certifications.join(' • ')}</strong></span>
                    <span className="badge badge-primary">Curated Roadmap</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
