import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Briefcase,
  DollarSign,
  Building,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Award,
  Sparkles,
  ExternalLink,
  ChevronRight
} from 'lucide-react';

export default function PlacementsView() {
  const { user, token } = useAuth();
  const [drives, setDrives] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [applyingId, setApplyingId] = useState(null);

  useEffect(() => {
    fetchPlacements();
  }, [token]);

  async function fetchPlacements() {
    if (!token) return;
    setLoading(true);

    try {
      const [dRes, sRes] = await Promise.all([
        fetch('/api/placements/drives', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/placements/stats', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (dRes.ok) setDrives(await dRes.json());
      if (sRes.ok) setStats(await sRes.json());
    } catch (err) {
      console.error('Error fetching placements:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleApply = async (driveId) => {
    setApplyingId(driveId);
    try {
      const res = await fetch('/api/placements/apply', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          driveId,
          resumeLink: 'https://gtbit.ac.in/resumes/my_resume.pdf'
        })
      });

      const data = await res.json();
      if (res.ok) {
        alert(data.message || 'Application submitted successfully to TnP cell!');
        fetchPlacements();
      } else {
        alert(data.error || 'Application failed');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    } finally {
      setApplyingId(null);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem 2rem',
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>
            Training & Placement Cell (TnP Managed - Module 2.L)
          </div>
          <h1 style={{ fontSize: '1.75rem' }}>Campus Placements & Internship Drives</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Corporate recruitment opportunities, CGPA eligibility screening, and interview tracking.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <span className="badge badge-success">Batch 2027 Drives Active</span>
          <span className="badge badge-info">Highest: 28.0 LPA</span>
        </div>
      </div>

      {/* Placement Statistics Overview */}
      {stats && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: '1rem'
        }}>
          <div className="stat-card success">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>HIGHEST SALARY OFFER</span>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--success)' }}>
              {stats.highest_package_lpa} <span style={{ fontSize: '1rem' }}>LPA</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Google India Core Systems</div>
          </div>

          <div className="stat-card purple">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>AVERAGE CTC PACKAGE</span>
            <div style={{ fontSize: '2.25rem', fontWeight: 800, color: 'var(--accent-purple)' }}>
              {stats.average_package_lpa} <span style={{ fontSize: '1rem' }}>LPA</span>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>B.Tech Computer Science & Engg</div>
          </div>

          <div className="stat-card info">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>RECRUITMENT DRIVES</span>
            <div style={{ fontSize: '2.25rem', fontWeight: 800 }}>{stats.total_drives}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Top Product & Tech Firms</div>
          </div>

          <div className="stat-card warning">
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>INTERVIEWS IN PROGRESS</span>
            <div style={{ fontSize: '2.25rem', fontWeight: 800 }}>{stats.total_offers}</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Shortlisted Candidates</div>
          </div>
        </div>
      )}

      {/* Drives List */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '1.25rem' }}>Corporate Campus Drives & Eligibility</h3>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {drives.map(d => (
            <div key={d.id} style={{
              padding: '1.25rem 1.5rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '1rem'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', minWidth: '300px', flex: 1 }}>
                <div style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '12px',
                  background: '#ffffff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: 'var(--shadow-sm)',
                  flexShrink: 0
                }}>
                  <Building size={28} color="#4f46e5" />
                </div>

                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <h4 style={{ fontSize: '1.1rem', fontWeight: 800 }}>{d.company_name}</h4>
                    <span className="badge badge-primary">{d.ctc_lpa} LPA</span>
                    <span className={`badge badge-${d.is_eligible ? 'success' : 'danger'}`}>
                      {d.is_eligible ? `Eligible (>= ${d.eligibility_min_cgpa} CGPA)` : `Requires ${d.eligibility_min_cgpa} CGPA`}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    {d.role_title} • {d.job_location}
                  </div>

                  <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.35rem', lineHeight: 1.4 }}>
                    {d.description}
                  </p>
                </div>
              </div>

              {/* Actions & Application Status */}
              <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.4rem' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Drive Date: <strong>{d.drive_date}</strong> (Deadline: {d.deadline})
                </div>

                {d.has_applied ? (
                  <span className="badge badge-info" style={{ fontSize: '0.8rem', padding: '0.4rem 0.8rem' }}>
                    ✓ Applied: {d.application_status}
                  </span>
                ) : (
                  user?.role === 'student' && (
                    <button
                      onClick={() => handleApply(d.id)}
                      disabled={!d.is_eligible || applyingId === d.id}
                      className="btn btn-primary btn-sm"
                    >
                      {applyingId === d.id ? 'Submitting...' : (d.is_eligible ? 'Apply with 1-Click' : 'CGPA Ineligible')}
                    </button>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
