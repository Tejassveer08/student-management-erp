import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Flag,
  Users,
  Search,
  Send,
  CheckCircle2,
  XCircle,
  Clock,
  MessageSquare,
  CalendarCheck,
  ShieldCheck,
  Edit3,
  Plus,
  X
} from 'lucide-react';

export default function SocietiesView({ onNavigate }) {
  const { user, token } = useAuth();
  const isFaculty = user?.role === 'faculty';
  const isAdmin = user?.role === 'admin';
  const isStudent = user?.role === 'student';
  const isParent = user?.role === 'parent';

  const [activeTab, setActiveTab] = useState(isFaculty || isParent ? 'duty' : 'directory');
  const [societies, setSocieties] = useState([]);
  const [dutyRequests, setDutyRequests] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [studentsList, setStudentsList] = useState([]);
  const [facultyList, setFacultyList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All');

  // Apply Modal (Student)
  const [applySociety, setApplySociety] = useState(null);
  const [applyMessage, setApplyMessage] = useState('');

  // Direct Contact Coordinator Modal (Student)
  const [contactSociety, setContactSociety] = useState(null);
  const [contactMessage, setContactMessage] = useState('');

  // Coordinator Applications Drawer/Modal
  const [coordSocietyId, setCoordSocietyId] = useState(null);
  const [coordApplications, setCoordApplications] = useState([]);

  // Admin Edit Society Modal
  const [editSociety, setEditSociety] = useState(null);
  const [editForm, setEditForm] = useState({ description: '', category: '', coordinatorStudentId: '', coordinatorFacultyId: '' });

  // Submit Society Duty Attendance Request Modal (Student)
  const [showDutyModal, setShowDutyModal] = useState(false);
  const [dutyForm, setDutyForm] = useState({
    societyId: '',
    classSubjectId: '',
    date: new Date().toISOString().split('T')[0],
    sessionPeriod: '10:00 - 11:00',
    activityTitle: '',
    reason: ''
  });

  // Faculty Review Remarks map
  const [remarksMap, setRemarksMap] = useState({});

  const showToastMsg = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 4000);
  };

  useEffect(() => {
    if (token) fetchAll();
  }, [token, user?.role]);

  async function fetchAll() {
    setLoading(true);
    try {
      const reqs = [
        fetch('/api/societies', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/societies/attendance-requests', { headers: { Authorization: `Bearer ${token}` } }),
        fetch('/api/academics/subjects?semester=4', { headers: { Authorization: `Bearer ${token}` } })
      ];
      if (isAdmin) {
        reqs.push(fetch('/api/students?semester=4', { headers: { Authorization: `Bearer ${token}` } }));
        reqs.push(fetch('/api/faculty', { headers: { Authorization: `Bearer ${token}` } }));
      }

      const [socRes, dutyRes, subRes, stRes, facRes] = await Promise.all(reqs);

      if (socRes?.ok) {
        const sData = await socRes.json();
        setSocieties(sData);
        if (sData.length > 0 && !dutyForm.societyId) {
          setDutyForm(prev => ({ ...prev, societyId: sData[0].id }));
        }
        const coordinated = sData.find(s => s.is_coordinator);
        if (coordinated && !coordSocietyId) {
          setCoordSocietyId(coordinated.id);
        }
      }
      if (dutyRes?.ok) setDutyRequests(await dutyRes.json());
      if (subRes?.ok) {
        const subData = await subRes.json();
        setSubjects(subData);
        if (subData.length > 0 && !dutyForm.classSubjectId) {
          setDutyForm(prev => ({ ...prev, classSubjectId: subData[0].id }));
        }
      }
      if (stRes?.ok) setStudentsList(await stRes.json());
      if (facRes?.ok) setFacultyList(await facRes.json());
    } catch (err) {
      console.error('Error loading societies data:', err);
    } finally {
      setLoading(false);
    }
  }

  const coordinatedSocieties = societies.filter(s => s.is_coordinator);

  useEffect(() => {
    if (coordSocietyId && token && (isAdmin || coordinatedSocieties.some(s => s.id === Number(coordSocietyId)))) {
      loadApplications(coordSocietyId);
    }
  }, [coordSocietyId, societies.length]);

  async function loadApplications(socId) {
    try {
      const res = await fetch(`/api/societies/${socId}/applications`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) setCoordApplications(await res.json());
    } catch (err) {
      console.error('Error loading applications:', err);
    }
  }

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    if (!applySociety) return;
    const res = await fetch(`/api/societies/${applySociety.id}/apply`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ applicationMessage: applyMessage })
    });
    const data = await res.json();
    if (res.ok) {
      showToastMsg(data.message);
      setApplySociety(null);
      setApplyMessage('');
      fetchAll();
    } else {
      alert(data.error || 'Failed to submit application');
    }
  };

  const handleContactSubmit = async (e) => {
    e.preventDefault();
    if (!contactSociety || !contactMessage.trim()) return;
    const res = await fetch(`/api/societies/${contactSociety.id}/contact`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: contactMessage })
    });
    const data = await res.json();
    if (res.ok) {
      showToastMsg(`Message sent to ${contactSociety.name} coordinator via Forum!`);
      setContactSociety(null);
      setContactMessage('');
    } else {
      alert(data.error || 'Could not send message');
    }
  };

  const handleDecideApplication = async (applicationId, status) => {
    const res = await fetch(`/api/societies/applications/${applicationId}/decide`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    const data = await res.json();
    if (res.ok) {
      showToastMsg(`Application ${status}!`);
      if (coordSocietyId) loadApplications(coordSocietyId);
      fetchAll();
    } else {
      alert(data.error || 'Action failed');
    }
  };

  const handleDutySubmit = async (e) => {
    e.preventDefault();
    const res = await fetch('/api/societies/attendance-requests', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(dutyForm)
    });
    const data = await res.json();
    if (res.ok) {
      showToastMsg(data.message);
      setShowDutyModal(false);
      setDutyForm(prev => ({ ...prev, activityTitle: '', reason: '' }));
      fetchAll();
    } else {
      alert(data.error || 'Failed to submit duty request');
    }
  };

  const handleDecideDuty = async (reqId, status) => {
    const res = await fetch(`/api/societies/attendance-requests/${reqId}/decide`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, remarks: remarksMap[reqId] || '' })
    });
    const data = await res.json();
    if (res.ok) {
      showToastMsg(data.message);
      fetchAll();
    } else {
      alert(data.error || 'Decision failed');
    }
  };

  const handleAdminSaveSociety = async (e) => {
    e.preventDefault();
    if (!editSociety) return;
    const res = await fetch(`/api/societies/${editSociety.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        description: editForm.description,
        category: editForm.category,
        coordinatorStudentId: editForm.coordinatorStudentId ? Number(editForm.coordinatorStudentId) : null,
        coordinatorFacultyId: editForm.coordinatorFacultyId ? Number(editForm.coordinatorFacultyId) : null
      })
    });
    if (res.ok) {
      showToastMsg(`${editSociety.name} updated successfully!`);
      setEditSociety(null);
      fetchAll();
    } else {
      const err = await res.json();
      alert(err.error || 'Update failed');
    }
  };

  const categories = ['All', ...Array.from(new Set(societies.map(s => s.category || 'General')))];
  const filteredSocieties = societies.filter(s => {
    const matchesCat = categoryFilter === 'All' || s.category === categoryFilter;
    const matchesSearch = !searchQuery.trim() ||
      s.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (s.description || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCat && matchesSearch;
  });

  const pendingDutyCount = dutyRequests.filter(r => r.status === 'pending').length;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {toast && (
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
          {toast}
        </div>
      )}

      {/* Header Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem 2rem',
        background: 'linear-gradient(135deg, rgba(16, 185, 129, 0.12) 0%, rgba(79, 70, 229, 0.08) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem',
        borderLeft: '5px solid var(--role-accent)'
      }}>
        <div>
          <div className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>
            GTBIT Student Societies & Duty Leave
          </div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800 }}>Campus Societies & Duty Attendance</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            {isParent
              ? 'Read-only view of your ward’s society-duty attendance exemptions and approval status.'
              : 'Browse GTBIT societies, apply for membership, message coordinators, and manage society-duty attendance credits.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', alignItems: 'center' }}>
          {isStudent && (
            <button onClick={() => setShowDutyModal(true)} className="btn btn-primary btn-sm">
              <Plus size={16} /> Request Society Duty Attendance
            </button>
          )}

          {!isParent && (
            <div style={{ display: 'flex', background: 'var(--bg-surface-subtle)', padding: '0.25rem', borderRadius: 'var(--radius-md)', gap: '0.2rem' }}>
              <button
                onClick={() => setActiveTab('directory')}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: activeTab === 'directory' ? 700 : 500,
                  cursor: 'pointer',
                  background: activeTab === 'directory' ? 'var(--primary)' : 'transparent',
                  color: activeTab === 'directory' ? '#fff' : 'var(--text-secondary)'
                }}
              >
                Societies ({societies.length})
              </button>

              <button
                onClick={() => setActiveTab('duty')}
                style={{
                  padding: '0.4rem 0.85rem',
                  borderRadius: 'var(--radius-sm)',
                  border: 'none',
                  fontSize: '0.8rem',
                  fontWeight: activeTab === 'duty' ? 700 : 500,
                  cursor: 'pointer',
                  background: activeTab === 'duty' ? 'var(--primary)' : 'transparent',
                  color: activeTab === 'duty' ? '#fff' : 'var(--text-secondary)'
                }}
              >
                Duty Attendance ({pendingDutyCount} pending)
              </button>

              {(isAdmin || coordinatedSocieties.length > 0) && (
                <button
                  onClick={() => setActiveTab('coordinator')}
                  style={{
                    padding: '0.4rem 0.85rem',
                    borderRadius: 'var(--radius-sm)',
                    border: 'none',
                    fontSize: '0.8rem',
                    fontWeight: activeTab === 'coordinator' ? 700 : 500,
                    cursor: 'pointer',
                    background: activeTab === 'coordinator' ? 'var(--primary)' : 'transparent',
                    color: activeTab === 'coordinator' ? '#fff' : 'var(--text-secondary)'
                  }}
                >
                  Coordinator Queue
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* TAB 1: SOCIETIES DIRECTORY */}
      {activeTab === 'directory' && !isParent && (
        <>
          <div className="glass-panel" style={{ padding: '1rem 1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: '420px' }}>
              <Search size={16} style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="form-input"
                style={{ paddingLeft: '2.25rem' }}
                placeholder="Search GTBIT societies..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
              {categories.map(cat => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`btn btn-sm ${categoryFilter === cat ? 'btn-primary' : 'btn-secondary'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(310px, 1fr))', gap: '1rem' }}>
            {filteredSocieties.map(soc => {
              const myMem = soc.my_membership;
              return (
                <div key={soc.id} className="glass-panel" style={{ padding: '1.35rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                    <div>
                      <span className="badge badge-info" style={{ fontSize: '0.68rem', marginBottom: '0.35rem' }}>
                        {soc.category || 'General'}
                      </span>
                      <h3 style={{ fontSize: '1.08rem', fontWeight: 800 }}>{soc.name}</h3>
                    </div>
                    {soc.is_coordinator && (
                      <span className="badge badge-warning">You are Coordinator</span>
                    )}
                    {!soc.is_coordinator && myMem && (
                      <span className={`badge badge-${myMem.status === 'approved' ? 'success' : myMem.status === 'rejected' ? 'danger' : 'warning'}`}>
                        {myMem.status.toUpperCase()}
                      </span>
                    )}
                  </div>

                  <p style={{ fontSize: '0.83rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                    {soc.description}
                  </p>

                  <div style={{
                    padding: '0.65rem 0.75rem',
                    borderRadius: 'var(--radius-md)',
                    background: 'var(--bg-surface-subtle)',
                    fontSize: '0.76rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem'
                  }}>
                    <div>
                      Student Coordinator:{' '}
                      <strong>{soc.coordinator_student_name ? `${soc.coordinator_student_name} (${soc.coordinator_student_roll})` : 'Unassigned'}</strong>
                    </div>
                    <div>
                      Faculty Mentor: <strong>{soc.coordinator_faculty_name || 'Unassigned'}</strong> • Members: <strong>{soc.approved_member_count || 0}</strong>
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.4rem', flexWrap: 'wrap' }}>
                    {isStudent && !soc.is_coordinator && myMem?.status !== 'approved' && (
                      <button onClick={() => setApplySociety(soc)} className="btn btn-primary btn-sm" style={{ flex: 1 }}>
                        <Send size={14} /> {myMem?.status === 'pending' ? 'Update Application' : 'Apply to Join'}
                      </button>
                    )}

                    {isStudent && (
                      <button onClick={() => setContactSociety(soc)} className="btn btn-outline btn-sm">
                        <MessageSquare size={14} /> Message Coordinator
                      </button>
                    )}

                    {isAdmin && (
                      <>
                        <button
                          onClick={() => {
                            setEditSociety(soc);
                            setEditForm({
                              description: soc.description || '',
                              category: soc.category || 'General',
                              coordinatorStudentId: soc.coordinator_student_id || '',
                              coordinatorFacultyId: soc.coordinator_faculty_id || ''
                            });
                          }}
                          className="btn btn-secondary btn-sm"
                        >
                          <Edit3 size={14} /> Configure
                        </button>
                        <button
                          onClick={() => {
                            setCoordSocietyId(soc.id);
                            setActiveTab('coordinator');
                          }}
                          className="btn btn-outline btn-sm"
                        >
                          Applications ({soc.pending_applications_count || 0})
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* TAB 2: SOCIETY DUTY ATTENDANCE QUEUE / HISTORY */}
      {activeTab === 'duty' && (
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>
                {isFaculty ? 'Faculty Society Attendance Approval Queue' : isParent ? 'Ward’s Society Duty Attendance History' : 'Society Duty Attendance Requests'}
              </h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Approved requests mark matching lecture sessions as Present (Society Duty), counting toward the 75% GGSIPU threshold.
              </p>
            </div>
            {isStudent && (
              <button onClick={() => setShowDutyModal(true)} className="btn btn-primary btn-sm">
                <Plus size={15} /> New Duty Request
              </button>
            )}
          </div>

          {dutyRequests.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No society attendance exemption requests found.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              {dutyRequests.map(req => (
                <div key={req.id} style={{
                  padding: '1.15rem 1.25rem',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-subtle)',
                  border: `1px solid ${req.status === 'pending' ? 'var(--warning-border)' : 'var(--border-subtle)'}`,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.6rem'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                        <span style={{ fontWeight: 800, fontSize: '1rem' }}>{req.activity_title}</span>
                        <span className="badge badge-primary">{req.society_name}</span>
                        <span className="badge badge-info">{req.subject_code} — {req.subject_name}</span>
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                        Student: <strong>{req.student_name}</strong> ({req.roll_no}) • Date: <strong>{req.date}</strong> {req.session_period ? `(${req.session_period})` : ''} • Routed to: <strong>{req.assigned_faculty_name || 'Subject Faculty'}</strong>
                      </div>
                    </div>

                    <span className={`badge badge-${req.status === 'approved' ? 'success' : req.status === 'rejected' ? 'danger' : 'warning'}`}>
                      {req.status.toUpperCase()}
                    </span>
                  </div>

                  {req.reason && (
                    <div style={{ fontSize: '0.83rem', color: 'var(--text-secondary)' }}>
                      {req.reason}
                    </div>
                  )}

                  {req.reviewer_remarks && (
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                      Faculty Remarks: "{req.reviewer_remarks}"
                    </div>
                  )}

                  {(isFaculty || isAdmin) && req.status === 'pending' && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', paddingTop: '0.4rem', borderTop: '1px solid var(--border-subtle)' }}>
                      <input
                        type="text"
                        className="form-input"
                        style={{ flex: '1 1 220px', padding: '0.35rem 0.65rem', fontSize: '0.8rem' }}
                        placeholder="Optional approval/rejection remarks..."
                        value={remarksMap[req.id] || ''}
                        onChange={(e) => setRemarksMap(prev => ({ ...prev, [req.id]: e.target.value }))}
                      />
                      <button onClick={() => handleDecideDuty(req.id, 'approved')} className="btn btn-success btn-sm">
                        <CheckCircle2 size={14} /> Approve & Credit Present
                      </button>
                      <button onClick={() => handleDecideDuty(req.id, 'rejected')} className="btn btn-danger btn-sm">
                        <XCircle size={14} /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: COORDINATOR APPLICATION QUEUE */}
      {activeTab === 'coordinator' && (isAdmin || coordinatedSocieties.length > 0) && (
        <div className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
            <div>
              <h3 style={{ fontSize: '1.15rem', fontWeight: 800 }}>Membership Application Queue</h3>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Review incoming student applications and reply to applicant inquiries in the Forum.
              </p>
            </div>

            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <select
                className="form-select"
                style={{ width: '260px' }}
                value={coordSocietyId || ''}
                onChange={(e) => setCoordSocietyId(Number(e.target.value))}
              >
                {(isAdmin ? societies : coordinatedSocieties).map(s => (
                  <option key={s.id} value={s.id}>{s.name} ({s.pending_applications_count || 0} pending)</option>
                ))}
              </select>
              {onNavigate && (
                <button onClick={() => onNavigate('forum')} className="btn btn-outline btn-sm">
                  <MessageSquare size={14} /> Open Society Messages
                </button>
              )}
            </div>
          </div>

          {coordApplications.length === 0 ? (
            <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
              No applications received for this society yet.
            </div>
          ) : (
            <div className="table-container">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Student</th>
                    <th>Roll / Section</th>
                    <th>Application Note</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {coordApplications.map(app => (
                    <tr key={app.id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{app.student_name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{app.student_email}</div>
                      </td>
                      <td>{app.roll_no} • {app.section}</td>
                      <td style={{ maxWidth: '340px', fontSize: '0.82rem' }}>{app.application_message}</td>
                      <td>
                        <span className={`badge badge-${app.status === 'approved' ? 'success' : app.status === 'rejected' ? 'danger' : 'warning'}`}>
                          {app.status.toUpperCase()}
                        </span>
                      </td>
                      <td>
                        {app.status === 'pending' ? (
                          <div style={{ display: 'flex', gap: '0.4rem' }}>
                            <button onClick={() => handleDecideApplication(app.id, 'approved')} className="btn btn-success btn-sm">
                              Approve
                            </button>
                            <button onClick={() => handleDecideApplication(app.id, 'rejected')} className="btn btn-danger btn-sm">
                              Reject
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Decided</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* APPLY MODAL */}
      {applySociety && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Apply to {applySociety.name}</h3>
              <button onClick={() => setApplySociety(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleApplySubmit}>
              <div className="form-group">
                <label className="form-label">Why do you want to join? (Short Message)</label>
                <textarea
                  className="form-textarea"
                  value={applyMessage}
                  onChange={(e) => setApplyMessage(e.target.value)}
                  placeholder="Share your interest, skills, or relevant experience..."
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setApplySociety(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Submit Application</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONTACT COORDINATOR MODAL */}
      {contactSociety && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '480px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Message {contactSociety.name} Coordinator</h3>
              <button onClick={() => setContactSociety(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={16} />
              </button>
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
              Messages create or continue a private society-scoped thread in the Student-Teacher Forum with {contactSociety.coordinator_student_name || 'the coordinator'}.
            </p>
            <form onSubmit={handleContactSubmit}>
              <div className="form-group">
                <label className="form-label">Your Message</label>
                <textarea
                  className="form-textarea"
                  value={contactMessage}
                  onChange={(e) => setContactMessage(e.target.value)}
                  placeholder="Ask about auditions, interviews, or society activities..."
                  required
                />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setContactSociety(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Send via Forum</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* REQUEST SOCIETY DUTY ATTENDANCE MODAL */}
      {showDutyModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Request Society Duty Attendance</h3>
              <button onClick={() => setShowDutyModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleDutySubmit}>
              <div className="form-group">
                <label className="form-label">Society *</label>
                <select className="form-select" value={dutyForm.societyId} onChange={(e) => setDutyForm({ ...dutyForm, societyId: Number(e.target.value) })}>
                  {societies.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Class / Subject Missed *</label>
                <select className="form-select" value={dutyForm.classSubjectId} onChange={(e) => setDutyForm({ ...dutyForm, classSubjectId: Number(e.target.value) })}>
                  {subjects.map(sub => <option key={sub.id} value={sub.id}>{sub.code} - {sub.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Date *</label>
                  <input type="date" required className="form-input" value={dutyForm.date} onChange={(e) => setDutyForm({ ...dutyForm, date: e.target.value })} />
                </div>
                <div className="form-group">
                  <label className="form-label">Session / Period</label>
                  <input type="text" className="form-input" placeholder="e.g. 10:00 - 11:00" value={dutyForm.sessionPeriod} onChange={(e) => setDutyForm({ ...dutyForm, sessionPeriod: e.target.value })} />
                </div>
              </div>
              <div className="form-group">
                <label className="form-label">Event / Society Activity *</label>
                <input type="text" required className="form-input" placeholder="e.g. GDSC Cloud Study Jam" value={dutyForm.activityTitle} onChange={(e) => setDutyForm({ ...dutyForm, activityTitle: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Duty Details / Reason</label>
                <textarea className="form-textarea" placeholder="Explain your role or duty..." value={dutyForm.reason} onChange={(e) => setDutyForm({ ...dutyForm, reason: e.target.value })} />
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setShowDutyModal(false)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Submit to Subject Faculty</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ADMIN EDIT SOCIETY MODAL */}
      {editSociety && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h3 style={{ fontSize: '1.2rem' }}>Configure: {editSociety.name}</h3>
              <button onClick={() => setEditSociety(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={16} />
              </button>
            </div>
            <form onSubmit={handleAdminSaveSociety}>
              <div className="form-group">
                <label className="form-label">Category</label>
                <input type="text" className="form-input" value={editForm.category} onChange={(e) => setEditForm({ ...editForm, category: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Description</label>
                <textarea className="form-textarea" value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} />
              </div>
              <div className="form-group">
                <label className="form-label">Designated Student Coordinator</label>
                <select className="form-select" value={editForm.coordinatorStudentId} onChange={(e) => setEditForm({ ...editForm, coordinatorStudentId: e.target.value })}>
                  <option value="">-- Unassigned --</option>
                  {studentsList.map(st => <option key={st.id} value={st.id}>{st.full_name} ({st.roll_no})</option>)}
                </select>
              </div>
              <div className="form-group">
                <label className="form-label">Faculty Mentor</label>
                <select className="form-select" value={editForm.coordinatorFacultyId} onChange={(e) => setEditForm({ ...editForm, coordinatorFacultyId: e.target.value })}>
                  <option value="">-- Unassigned --</option>
                  {facultyList.map(f => <option key={f.id} value={f.id}>{f.full_name} ({f.employee_id})</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1rem' }}>
                <button type="button" onClick={() => setEditSociety(null)} className="btn btn-secondary">Cancel</button>
                <button type="submit" className="btn btn-primary">Save Changes</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

