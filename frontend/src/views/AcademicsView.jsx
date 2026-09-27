import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Calendar,
  BookOpen,
  Clock,
  Layers,
  MapPin,
  Plus,
  Users
} from 'lucide-react';

export default function AcademicsView() {
  const { user, token } = useAuth();
  const [subjects, setSubjects] = useState([]);
  const [timetable, setTimetable] = useState([]);
  const [activeDay, setActiveDay] = useState('Monday');
  const [loading, setLoading] = useState(true);

  const days = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];

  useEffect(() => {
    fetchAcademics();
  }, [token]);

  async function fetchAcademics() {
    if (!token) return;
    setLoading(true);

    try {
      const [subRes, ttRes] = await Promise.all([
        fetch('/api/academics/subjects?semester=4', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/academics/timetable?semester=4&section=CSE-2', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (subRes.ok) setSubjects(await subRes.json());
      if (ttRes.ok) setTimetable(await ttRes.json());
    } catch (err) {
      console.error('Error fetching academic data:', err);
    } finally {
      setLoading(false);
    }
  }

  const filteredSlots = timetable.filter(t => t.day_of_week === activeDay);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem 2rem',
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(79, 70, 229, 0.08) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>
            Academic Curriculum & Timetable (Module 2.E)
          </div>
          <h1 style={{ fontSize: '1.75rem' }}>Curriculum & Weekly Class Schedule</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Department of Computer Science & Engineering • Section CSE-2 • Semester 4
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <span className="badge badge-info">Course: B.Tech CSE</span>
          <span className="badge badge-success">Academic Year 2025-2026</span>
        </div>
      </div>

      {/* Interactive Timetable Tabs & Schedule Grid */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h3 style={{ fontSize: '1.15rem' }}>Weekly Interactive Schedule</h3>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
              Select a weekday to view scheduled lectures, labs, faculty and room allocations.
            </p>
          </div>

          {/* Weekday Switcher */}
          <div style={{ display: 'flex', gap: '0.35rem', background: 'var(--bg-surface-subtle)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
            {days.map(d => (
              <button
                key={d}
                onClick={() => setActiveDay(d)}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: activeDay === d ? 700 : 500,
                  cursor: 'pointer',
                  background: activeDay === d ? 'var(--primary)' : 'transparent',
                  color: activeDay === d ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        {/* Timetable Slot Cards */}
        {filteredSlots.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            No lectures scheduled for {activeDay}.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
            {filteredSlots.map(slot => (
              <div key={slot.id} style={{
                padding: '1.15rem',
                borderRadius: 'var(--radius-md)',
                background: 'var(--bg-surface-subtle)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.65rem'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-primary" style={{ fontFamily: 'var(--font-mono)' }}>
                    {slot.start_time} - {slot.end_time}
                  </span>
                  <span className="badge badge-info">{slot.subject_code}</span>
                </div>

                <div>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{slot.subject_name}</h4>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '0.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <Users size={14} /> Faculty: {slot.faculty_name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                    <MapPin size={14} /> Room / Venue: <strong>{slot.room_no}</strong>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Semester 4 Subjects Curriculum Matrix */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Semester 4 Subject Catalog & Difficulty Ratings</h3>
        <div className="table-container">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Subject Name</th>
                <th>Credits</th>
                <th>Type</th>
                <th>Assigned Faculty</th>
                <th>Difficulty Index</th>
                <th>Historical Pass %</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map(s => (
                <tr key={s.id}>
                  <td style={{ fontWeight: 700, fontFamily: 'var(--font-mono)' }}>{s.code}</td>
                  <td style={{ fontWeight: 600 }}>{s.name}</td>
                  <td>{s.credits} Credits</td>
                  <td>
                    <span className={`badge badge-${s.type === 'Theory' ? 'primary' : 'warning'}`}>
                      {s.type}
                    </span>
                  </td>
                  <td>{s.faculty_name || 'Prof. CSE'}</td>
                  <td>
                    <span style={{
                      fontWeight: 700,
                      color: s.difficulty_index >= 0.65 ? 'var(--danger)' : (s.difficulty_index >= 0.45 ? 'var(--warning)' : 'var(--success)')
                    }}>
                      {s.difficulty_index} ({s.difficulty_index >= 0.65 ? 'Hard' : (s.difficulty_index >= 0.45 ? 'Moderate' : 'Easy')})
                    </span>
                  </td>
                  <td style={{ fontWeight: 600 }}>{s.historical_pass_pct}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
