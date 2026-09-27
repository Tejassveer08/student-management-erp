import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Bell,
  Plus,
  Pin,
  Search,
  Filter,
  AlertTriangle,
  Calendar,
  Briefcase,
  Award,
  X
} from 'lucide-react';

export default function NoticesView() {
  const { user, token } = useAuth();
  const [notices, setNotices] = useState([]);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [audience, setAudience] = useState('');
  const [loading, setLoading] = useState(true);

  // Publish Modal (Admin/Faculty)
  const [showPublishModal, setShowPublishModal] = useState(false);
  const [newNotice, setNewNotice] = useState({
    title: '',
    content: '',
    category: 'General',
    targetAudience: 'All',
    isPinned: false
  });

  useEffect(() => {
    fetchNotices();
  }, [token, search, category, audience]);

  async function fetchNotices() {
    if (!token) return;
    setLoading(true);
    try {
      let url = '/api/notices?';
      if (search) url += `search=${encodeURIComponent(search)}&`;
      if (category) url += `category=${encodeURIComponent(category)}&`;
      if (audience) url += `audience=${encodeURIComponent(audience)}&`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        setNotices(await res.json());
      }
    } catch (err) {
      console.error('Error fetching notices:', err);
    } finally {
      setLoading(false);
    }
  }

  const handlePublishSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/notices', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newNotice)
      });

      if (res.ok) {
        alert('Notice broadcasted successfully!');
        setShowPublishModal(false);
        setNewNotice({ title: '', content: '', category: 'General', targetAudience: 'All', isPinned: false });
        fetchNotices();
      }
    } catch (err) {
      alert('Error publishing notice: ' + err.message);
    }
  };

  const isFacultyOrAdmin = user?.role === 'admin' || user?.role === 'faculty';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem 2rem',
        background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.08) 0%, rgba(79, 70, 229, 0.08) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>
            Institutional Bulletin & Dispatch (Module 2.J)
          </div>
          <h1 style={{ fontSize: '1.75rem' }}>Notices, Circulars & Announcements</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Official notices across departments, examination schedules, placement updates, and urgent advisories.
          </p>
        </div>

        {isFacultyOrAdmin && (
          <button onClick={() => setShowPublishModal(true)} className="btn btn-primary btn-sm">
            <Plus size={16} /> Broadcast New Notice
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            placeholder="Search circulars, keywords or authors..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="form-input"
            style={{ paddingLeft: '2.4rem' }}
          />
          <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        </div>

        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="form-select"
          style={{ width: '160px' }}
        >
          <option value="">All Categories</option>
          <option value="Urgent">Urgent Advisories</option>
          <option value="Academic">Academic</option>
          <option value="Exam">Examinations</option>
          <option value="Placement">Placements & TnP</option>
          <option value="Event">Fest & Events</option>
        </select>

        <select
          value={audience}
          onChange={(e) => setAudience(e.target.value)}
          className="form-select"
          style={{ width: '160px' }}
        >
          <option value="">All Audiences</option>
          <option value="Students">Students</option>
          <option value="Faculty">Faculty</option>
          <option value="Parents">Parents</option>
        </select>
      </div>

      {/* Notices Feed */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
        {notices.map(n => {
          const isUrgent = n.category === 'Urgent';
          return (
            <div
              key={n.id}
              className="glass-panel"
              style={{
                padding: '1.5rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                borderLeft: isUrgent ? '4px solid var(--danger)' : (n.is_pinned ? '4px solid var(--primary)' : '1px solid var(--border-subtle)')
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  {n.is_pinned === 1 && (
                    <span className="badge badge-primary">
                      <Pin size={12} /> Pinned Circular
                    </span>
                  )}
                  <span className={`badge badge-${isUrgent ? 'danger' : (n.category === 'Placement' ? 'info' : 'primary')}`}>
                    {n.category}
                  </span>
                  <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>
                    Target: {n.target_audience}
                  </span>
                </div>

                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Posted {new Date(n.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                </div>
              </div>

              <div>
                <h3 style={{ fontSize: '1.15rem', color: isUrgent ? 'var(--danger)' : 'var(--text-primary)' }}>
                  {n.title}
                </h3>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                  Issued by: <strong>{n.posted_by}</strong>
                </div>
              </div>

              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
                {n.content}
              </p>
            </div>
          );
        })}
      </div>

      {/* Publish Notice Modal */}
      {showPublishModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Broadcast Notice / Circular</h3>
              <button onClick={() => setShowPublishModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePublishSubmit}>
              <div className="form-group">
                <label className="form-label">Notice Title *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={newNotice.title}
                  onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                  placeholder="e.g. Schedule for Mid-Term Examination 2026"
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Category</label>
                  <select
                    className="form-select"
                    value={newNotice.category}
                    onChange={(e) => setNewNotice({ ...newNotice, category: e.target.value })}
                  >
                    <option value="General">General</option>
                    <option value="Urgent">Urgent</option>
                    <option value="Academic">Academic</option>
                    <option value="Exam">Exam</option>
                    <option value="Placement">Placement</option>
                    <option value="Event">Event</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Audience</label>
                  <select
                    className="form-select"
                    value={newNotice.targetAudience}
                    onChange={(e) => setNewNotice({ ...newNotice, targetAudience: e.target.value })}
                  >
                    <option value="All">All Campuses</option>
                    <option value="Students">Students Only</option>
                    <option value="Faculty">Faculty Only</option>
                    <option value="Parents">Parents Only</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Notice Content *</label>
                <textarea
                  required
                  className="form-textarea"
                  value={newNotice.content}
                  onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
                  placeholder="Official notification text, statutory compliance directives, or event guidelines..."
                  style={{ minHeight: '120px' }}
                />
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1.25rem' }}>
                <input
                  type="checkbox"
                  id="pinCheck"
                  checked={newNotice.isPinned}
                  onChange={(e) => setNewNotice({ ...newNotice, isPinned: e.target.checked })}
                />
                <label htmlFor="pinCheck" style={{ fontSize: '0.825rem', cursor: 'pointer', fontWeight: 600 }}>
                  Pin this circular to top of campus dashboard
                </label>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
                <button type="button" onClick={() => setShowPublishModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Publish Circular
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
