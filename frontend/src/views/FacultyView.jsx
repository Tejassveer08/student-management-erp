import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Users,
  Plus,
  BookOpen,
  Clock,
  Mail,
  Phone,
  Building,
  CheckCircle2,
  X
} from 'lucide-react';

export default function FacultyView() {
  const { user, token } = useAuth();
  const [faculty, setFaculty] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [formData, setFormData] = useState({
    fullName: '',
    email: '',
    phone: '',
    employeeId: '',
    designation: 'Assistant Professor',
    qualification: 'M.Tech (CSE), Ph.D',
    weeklyWorkloadHours: 16,
    officeRoom: 'Room 302-B'
  });

  useEffect(() => {
    fetchFaculty();
  }, [token]);

  async function fetchFaculty() {
    if (!token) return;
    setLoading(true);
    try {
      const res = await fetch('/api/faculty', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setFaculty(data);
      }
    } catch (err) {
      console.error('Error fetching faculty:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleAddFaculty = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/faculty', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (res.ok) {
        alert('Faculty member onboarded successfully!');
        setShowAddModal(false);
        fetchFaculty();
      } else {
        alert(data.error || 'Failed to add faculty');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const isAdmin = user?.role === 'admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem 2rem',
        background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.12) 0%, rgba(79, 70, 229, 0.08) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>
            Faculty & Staff Directory (Module 2.C)
          </div>
          <h1 style={{ fontSize: '1.75rem' }}>Faculty Profiles & Workload Allocation</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Department allocation, weekly teaching hours tracking, and faculty-to-class mapping.
          </p>
        </div>

        {isAdmin && (
          <button onClick={() => setShowAddModal(true)} className="btn btn-primary btn-sm">
            <Plus size={16} /> Add Faculty Member
          </button>
        )}
      </div>

      {/* Faculty Cards Grid */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
        gap: '1.25rem'
      }}>
        {faculty.map(f => (
          <div key={f.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <img
                src={f.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80'}
                alt={f.full_name}
                style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <h3 style={{ fontSize: '1.1rem' }}>{f.full_name}</h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--primary)', fontWeight: 600 }}>
                  {f.designation}
                </div>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                  ID: {f.employee_id} • {f.department_name}
                </div>
              </div>
            </div>

            <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-subtle)', fontSize: '0.78rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Qualifications:</span>
                <span style={{ fontWeight: 600 }}>{f.qualification}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
                <span style={{ color: 'var(--text-muted)' }}>Office Room:</span>
                <span style={{ fontWeight: 600 }}>{f.office_room}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Weekly Workload:</span>
                <span style={{ fontWeight: 700, color: 'var(--primary)' }}>{f.weekly_workload_hours} hrs/week</span>
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.4rem', textTransform: 'uppercase' }}>
                Allocated Subjects:
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                {(f.assigned_subjects || []).map(s => (
                  <span key={s.id} className="badge badge-info" style={{ fontSize: '0.72rem' }}>
                    {s.code}: {s.name}
                  </span>
                ))}
              </div>
            </div>

            <div style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '0.75rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
              <span>{f.email}</span>
              <span className="badge badge-success">Available</span>
            </div>
          </div>
        ))}
      </div>

      {/* Add Faculty Modal */}
      {showAddModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Add New Faculty Member</h3>
              <button onClick={() => setShowAddModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddFaculty}>
              <div className="form-group">
                <label className="form-label">Full Name *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={formData.fullName}
                  onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                  placeholder="e.g. Dr. Harpreet Kaur"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">College Email *</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. harpreet@gtbit.ac.in"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Employee ID *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={formData.employeeId}
                    onChange={(e) => setFormData({ ...formData, employeeId: e.target.value })}
                    placeholder="e.g. FAC-CSE-004"
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Designation</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.designation}
                    onChange={(e) => setFormData({ ...formData, designation: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Workload (Hrs/Week)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={formData.weeklyWorkloadHours}
                    onChange={(e) => setFormData({ ...formData, weeklyWorkloadHours: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => setShowAddModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Faculty Profile
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
