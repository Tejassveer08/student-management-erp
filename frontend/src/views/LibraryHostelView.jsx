import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  BookOpen,
  Building2,
  Search,
  CheckCircle2,
  Clock,
  AlertCircle,
  Plus,
  Users,
  X
} from 'lucide-react';

export default function LibraryHostelView() {
  const { user, token } = useAuth();
  const [activeTab, setActiveTab] = useState('library'); // 'library' or 'hostel'
  const [books, setBooks] = useState([]);
  const [myIssues, setMyIssues] = useState([]);
  const [hostelRooms, setHostelRooms] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [token, search]);

  async function fetchData() {
    if (!token) return;
    setLoading(true);

    try {
      const [bRes, miRes, hrRes] = await Promise.all([
        fetch(`/api/library/books${search ? `?search=${encodeURIComponent(search)}` : ''}`, { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/library/my-issues', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/library/rooms', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (bRes.ok) setBooks(await bRes.json());
      if (miRes.ok) setMyIssues(await miRes.json());
      if (hrRes.ok) setHostelRooms(await hrRes.json());
    } catch (err) {
      console.error('Error fetching library/hostel records:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem 2rem',
        background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.12) 0%, rgba(139, 92, 246, 0.08) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div className="badge badge-info" style={{ marginBottom: '0.4rem' }}>
            Campus Living & Knowledge Center (Module 2.K)
          </div>
          <h1 style={{ fontSize: '1.75rem' }}>Library Catalog & Hostel Management</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Book borrowing, due dates, automated fines, and hostel residential room allocations.
          </p>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: 'flex', background: 'var(--bg-surface-subtle)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
          <button
            onClick={() => setActiveTab('library')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: activeTab === 'library' ? 700 : 500,
              cursor: 'pointer',
              background: activeTab === 'library' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'library' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            Library Catalog ({books.length})
          </button>
          <button
            onClick={() => setActiveTab('hostel')}
            style={{
              padding: '0.4rem 0.85rem',
              borderRadius: 'var(--radius-sm)',
              border: 'none',
              fontSize: '0.8rem',
              fontWeight: activeTab === 'hostel' ? 700 : 500,
              cursor: 'pointer',
              background: activeTab === 'hostel' ? 'var(--primary)' : 'transparent',
              color: activeTab === 'hostel' ? '#fff' : 'var(--text-secondary)'
            }}
          >
            Hostel Rooms ({hostelRooms.length})
          </button>
        </div>
      </div>

      {/* TAB 1: LIBRARY */}
      {activeTab === 'library' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Active Issues for this student (if any) */}
          {myIssues.length > 0 && (
            <div className="glass-panel" style={{ padding: '1.25rem 1.5rem', background: 'var(--primary-glow)', border: '1px solid rgba(79, 70, 229, 0.3)' }}>
              <h3 style={{ fontSize: '1rem', color: 'var(--primary)', marginBottom: '0.65rem' }}>
                Your Currently Issued Books ({myIssues.length})
              </h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {myIssues.map(issue => (
                  <div key={issue.id} style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    background: 'var(--bg-surface)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <span style={{ fontWeight: 700, fontSize: '0.85rem' }}>{issue.title}</span>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                        ISBN: {issue.isbn} • Shelf: {issue.shelf_location}
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600 }}>Due: {issue.due_date}</div>
                      <span className={`badge badge-${issue.status === 'Issued' ? 'success' : 'danger'}`}>
                        {issue.status} {issue.fine_amount > 0 && `(Fine: Rs. ${issue.fine_amount})`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Search bar */}
          <div className="glass-panel" style={{ padding: '0.85rem 1.25rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="text"
                placeholder="Search library catalog by title, author, or ISBN..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="form-input"
                style={{ paddingLeft: '2.4rem' }}
              />
              <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            </div>
          </div>

          {/* Books Grid */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1rem'
          }}>
            {books.map(b => (
              <div key={b.id} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span className="badge badge-primary">{b.category}</span>
                  <span className={`badge badge-${b.available_copies > 0 ? 'success' : 'danger'}`}>
                    {b.available_copies > 0 ? `${b.available_copies} Available` : 'All Issued'}
                  </span>
                </div>

                <div>
                  <h4 style={{ fontSize: '1rem', fontWeight: 700 }}>{b.title}</h4>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                    Author: {b.author}
                  </div>
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                    {b.edition} • ISBN: {b.isbn}
                  </div>
                </div>

                <div style={{
                  marginTop: 'auto',
                  paddingTop: '0.65rem',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  fontSize: '0.75rem',
                  color: 'var(--text-muted)'
                }}>
                  <span>Shelf: <strong>{b.shelf_location}</strong></span>
                  <span>Total: {b.total_copies} copies</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 2: HOSTEL */}
      {activeTab === 'hostel' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          <div className="glass-panel" style={{ padding: '1.5rem' }}>
            <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Campus Residential Accommodation</h3>
            
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: '1rem'
            }}>
              {hostelRooms.map(r => {
                const isFull = r.occupied_count >= r.capacity;
                return (
                  <div key={r.id} style={{
                    padding: '1.25rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface-subtle)',
                    border: '1px solid var(--border-subtle)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.65rem'
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span className="badge badge-info">{r.block_name}</span>
                      <span className={`badge badge-${isFull ? 'danger' : 'success'}`}>
                        {isFull ? 'Full Capacity' : `${r.capacity - r.occupied_count} Vacancies`}
                      </span>
                    </div>

                    <div>
                      <h4 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Room {r.room_no}</h4>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Floor {r.floor} • Capacity: {r.capacity} Residents
                      </div>
                    </div>

                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                      Occupants: <strong>{r.occupants_names || 'None (Vacant)'}</strong>
                    </div>

                    <div style={{
                      marginTop: 'auto',
                      paddingTop: '0.65rem',
                      borderTop: '1px solid var(--border-subtle)',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: '0.78rem'
                    }}>
                      <span style={{ color: 'var(--text-muted)' }}>Hostel Fee:</span>
                      <span style={{ fontWeight: 800, color: 'var(--primary)' }}>
                        Rs. {r.fee_per_semester.toLocaleString()} / sem
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
