import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  FileText,
  Plus,
  Upload,
  CheckCircle2,
  Clock,
  Download,
  AlertCircle,
  FileCheck,
  X
} from 'lucide-react';

export default function AssignmentsView() {
  const { user, token } = useAuth();
  const [assignments, setAssignments] = useState([]);
  const [studyMaterials, setStudyMaterials] = useState([]);
  const [activeTab, setActiveTab] = useState('assignments'); // 'assignments' or 'materials'
  const [loading, setLoading] = useState(true);

  // Submit Modal (Student)
  const [activeAssignmentForSubmit, setActiveAssignmentForSubmit] = useState(null);
  const [submissionText, setSubmissionText] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  // Create Assignment Modal (Faculty)
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [subjects, setSubjects] = useState([]);
  const [newAssign, setNewAssign] = useState({
    subjectId: '',
    title: '',
    description: '',
    maxMarks: 20,
    dueDate: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16)
  });

  useEffect(() => {
    fetchData();
  }, [token]);

  async function fetchData() {
    if (!token) return;
    setLoading(true);
    try {
      const [asRes, smRes, subRes] = await Promise.all([
        fetch('/api/assignments?semester=4', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/assignments/study-materials', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/academics/subjects?semester=4', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (asRes.ok) setAssignments(await asRes.json());
      if (smRes.ok) setStudyMaterials(await smRes.json());
      if (subRes.ok) {
        const sList = await subRes.json();
        setSubjects(sList);
        if (sList.length > 0 && !newAssign.subjectId) {
          setNewAssign(prev => ({ ...prev, subjectId: sList[0].id }));
        }
      }
    } catch (err) {
      console.error('Error fetching assignments:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    if (!activeAssignmentForSubmit) return;

    try {
      const res = await fetch(`/api/assignments/${activeAssignmentForSubmit.id}/submit`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          submissionText: submissionText || 'Online Submission with Github code link',
          fileUrl: fileUrl || 'https://gtbit.ac.in/uploads/student_assignment.pdf'
        })
      });

      if (res.ok) {
        alert('Assignment submitted successfully!');
        setActiveAssignmentForSubmit(null);
        fetchData();
      }
    } catch (err) {
      alert('Submission error: ' + err.message);
    }
  };

  const handleCreateAssignment = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/assignments', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(newAssign)
      });

      if (res.ok) {
        alert('Assignment created & distributed to students!');
        setShowCreateModal(false);
        fetchData();
      }
    } catch (err) {
      alert('Error creating assignment: ' + err.message);
    }
  };

  const isFacultyOrAdmin = user?.role === 'admin' || user?.role === 'faculty';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem 2rem',
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(16, 185, 129, 0.08) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>
            Academic Tasks & Repositories (Module 2.H)
          </div>
          <h1 style={{ fontSize: '1.75rem' }}>Assignments & Course Notes Repository</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Assignment submission tracking, faculty grading, deadline management, and downloadable course notes.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isFacultyOrAdmin && (
            <button onClick={() => setShowCreateModal(true)} className="btn btn-primary btn-sm">
              <Plus size={16} /> Create New Assignment
            </button>
          )}

          <div style={{ display: 'flex', background: 'var(--bg-surface-subtle)', padding: '0.25rem', borderRadius: 'var(--radius-md)' }}>
            <button
              onClick={() => setActiveTab('assignments')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: activeTab === 'assignments' ? 700 : 500,
                cursor: 'pointer',
                background: activeTab === 'assignments' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'assignments' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              Assignments ({assignments.length})
            </button>
            <button
              onClick={() => setActiveTab('materials')}
              style={{
                padding: '0.4rem 0.85rem',
                borderRadius: 'var(--radius-sm)',
                border: 'none',
                fontSize: '0.8rem',
                fontWeight: activeTab === 'materials' ? 700 : 500,
                cursor: 'pointer',
                background: activeTab === 'materials' ? 'var(--primary)' : 'transparent',
                color: activeTab === 'materials' ? '#fff' : 'var(--text-secondary)'
              }}
            >
              Lecture Notes ({studyMaterials.length})
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: Assignments */}
      {activeTab === 'assignments' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {assignments.map(a => {
            const isDuePassed = new Date() > new Date(a.due_date);
            const mySub = a.my_submission;

            return (
              <div key={a.id} className="glass-panel" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <h3 style={{ fontSize: '1.1rem' }}>{a.title}</h3>
                      <span className="badge badge-info">{a.subject_code}</span>
                      <span className="badge badge-primary">{a.subject_name}</span>
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                      Assigned by {a.faculty_name} • Max Marks: <strong>{a.max_marks}</strong>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontSize: '0.75rem', color: isDuePassed ? 'var(--danger)' : 'var(--text-secondary)', fontWeight: 600 }}>
                      Deadline: {new Date(a.due_date).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </div>
                    {isDuePassed && <span className="badge badge-danger">Due Passed</span>}
                  </div>
                </div>

                <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                  {a.description}
                </p>

                {/* Submission Status Row */}
                <div style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  paddingTop: '0.75rem',
                  borderTop: '1px solid var(--border-subtle)',
                  flexWrap: 'wrap',
                  gap: '0.5rem'
                }}>
                  <div>
                    {mySub ? (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span className={`badge badge-${mySub.status === 'Graded' ? 'success' : 'primary'}`}>
                          Status: {mySub.status}
                        </span>
                        {mySub.marks_obtained !== null && (
                          <span style={{ fontWeight: 800, fontSize: '0.85rem', color: 'var(--success)' }}>
                            Score: {mySub.marks_obtained} / {a.max_marks}
                          </span>
                        )}
                        {mySub.faculty_feedback && (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            Feedback: "{mySub.faculty_feedback}"
                          </span>
                        )}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {user?.role === 'student' ? 'No submission recorded yet.' : `${a.total_submissions || 0} Submissions received`}
                      </span>
                    )}
                  </div>

                  {user?.role === 'student' && (
                    <button
                      onClick={() => setActiveAssignmentForSubmit(a)}
                      className="btn btn-primary btn-sm"
                    >
                      <Upload size={14} /> {mySub ? 'Resubmit Assignment' : 'Upload Submission'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 2: Lecture Notes & Study Materials */}
      {activeTab === 'materials' && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
          gap: '1rem'
        }}>
          {studyMaterials.map(m => (
            <div key={m.id} className="glass-panel" style={{ padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-primary">{m.subject_code}</span>
                <span className="badge badge-info">{m.file_type} • {m.file_size}</span>
              </div>

              <div>
                <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{m.title}</h4>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>
                  {m.unit_name} • Uploaded by {m.uploaded_by}
                </div>
              </div>

              <div style={{ marginTop: 'auto', paddingTop: '0.5rem' }}>
                <a
                  href={m.file_url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-outline btn-sm"
                  style={{ width: '100%' }}
                >
                  <Download size={14} /> Download Course Material
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Student Submit Modal */}
      {activeAssignmentForSubmit && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Submit: {activeAssignmentForSubmit.title}</h3>
              <button onClick={() => setActiveAssignmentForSubmit(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleStudentSubmit}>
              <div className="form-group">
                <label className="form-label">Submission Solution Description / Github Repo Link</label>
                <textarea
                  className="form-textarea"
                  value={submissionText}
                  onChange={(e) => setSubmissionText(e.target.value)}
                  placeholder="Enter comments, implementation details or GitHub link..."
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Report PDF / Project File Link</label>
                <input
                  type="url"
                  className="form-input"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://gtbit.ac.in/uploads/assignment.pdf"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => setActiveAssignmentForSubmit(null)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Submit Work
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Assignment Modal for Faculty */}
      {showCreateModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '540px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Create & Publish Assignment</h3>
              <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleCreateAssignment}>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <select
                  className="form-select"
                  value={newAssign.subjectId}
                  onChange={(e) => setNewAssign({ ...newAssign, subjectId: Number(e.target.value) })}
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Assignment Title *</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={newAssign.title}
                  onChange={(e) => setNewAssign({ ...newAssign, title: e.target.value })}
                  placeholder="e.g. Dynamic Programming Knapsack Assignment"
                />
              </div>

              <div className="form-group">
                <label className="form-label">Problem Statement & Instructions</label>
                <textarea
                  className="form-textarea"
                  value={newAssign.description}
                  onChange={(e) => setNewAssign({ ...newAssign, description: e.target.value })}
                  placeholder="Detailed guidelines, test cases, and grading criteria..."
                  required
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Maximum Marks</label>
                  <input
                    type="number"
                    className="form-input"
                    value={newAssign.maxMarks}
                    onChange={(e) => setNewAssign({ ...newAssign, maxMarks: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Submission Due Date</label>
                  <input
                    type="datetime-local"
                    required
                    className="form-input"
                    value={newAssign.dueDate}
                    onChange={(e) => setNewAssign({ ...newAssign, dueDate: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Publish to Students
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
