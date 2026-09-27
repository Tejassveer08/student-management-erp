import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  GraduationCap,
  Search,
  Plus,
  Filter,
  Eye,
  Edit,
  Trash2,
  Mail,
  Phone,
  UserCheck,
  AlertTriangle,
  CheckCircle2,
  X,
  UploadCloud,
  Key,
  Copy,
  Check,
  ShieldCheck,
  FileSpreadsheet
} from 'lucide-react';

export default function StudentsView() {
  const { user, token } = useAuth();
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [selectedSemester, setSelectedSemester] = useState('4');
  const [selectedSection, setSelectedSection] = useState('');
  const [loading, setLoading] = useState(true);

  // Profile Modal
  const [activeStudent, setActiveStudent] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // New Admission Modal
  const [showAdmissionModal, setShowAdmissionModal] = useState(false);
  const [showBatchModal, setShowBatchModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editStudentData, setEditStudentData] = useState(null);

  // Success Credential Notification Modal
  const [createdCredentials, setCreatedCredentials] = useState(null);
  const [copiedKey, setCopiedKey] = useState(false);

  const initialFormState = {
    fullName: '',
    email: '',
    phone: '',
    rollNo: '',
    enrollmentNo: '',
    semester: 4,
    section: 'CSE-2',
    dob: '2005-05-15',
    bloodGroup: 'B+',
    address: 'New Delhi, Delhi NCR',
    parentName: '',
    parentPhone: '',
    initialCgpa: 8.2,
    password: 'student123'
  };

  const [formData, setFormData] = useState(initialFormState);
  const [batchCsvText, setBatchCsvText] = useState('');
  const [batchProcessing, setBatchProcessing] = useState(false);
  const [batchResult, setBatchResult] = useState(null);

  useEffect(() => {
    fetchStudents();
  }, [token, search, selectedSemester, selectedSection]);

  async function fetchStudents() {
    if (!token) return;
    setLoading(true);

    try {
      let url = `/api/students?semester=${selectedSemester}`;
      if (search) url += `&search=${encodeURIComponent(search)}`;
      if (selectedSection) url += `&section=${encodeURIComponent(selectedSection)}`;

      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setStudents(data);
      }
    } catch (err) {
      console.error('Error fetching students:', err);
    } finally {
      setLoading(false);
    }
  }

  async function viewStudentProfile(id) {
    setProfileLoading(true);
    try {
      const res = await fetch(`/api/students/${id}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setActiveStudent(data);
      }
    } catch (err) {
      console.error('Error viewing student profile:', err);
    } finally {
      setProfileLoading(false);
    }
  }

  const handleAdmissionSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (res.ok) {
        setShowAdmissionModal(false);
        setCreatedCredentials({
          fullName: formData.fullName,
          email: formData.email,
          rollNo: formData.rollNo,
          password: formData.password || 'student123'
        });
        setFormData(initialFormState);
        fetchStudents();
      } else {
        alert(data.error || 'Admission registration failed');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editStudentData) return;

    try {
      const res = await fetch(`/api/students/${editStudentData.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          fullName: editStudentData.full_name,
          phone: editStudentData.phone,
          semester: Number(editStudentData.semester),
          section: editStudentData.section,
          currentCgpa: Number(editStudentData.current_cgpa),
          status: editStudentData.status,
          address: editStudentData.address,
          parentName: editStudentData.parent_name,
          parentPhone: editStudentData.parent_phone
        })
      });

      if (res.ok) {
        alert('Student information updated successfully!');
        setShowEditModal(false);
        setEditStudentData(null);
        fetchStudents();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to update student');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handleDeleteStudent = async (id, name) => {
    if (!window.confirm(`Are you sure you want to permanently remove "${name}" from the system registry?`)) {
      return;
    }

    try {
      const res = await fetch(`/api/students/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        alert(`Student "${name}" deleted.`);
        fetchStudents();
      } else {
        const d = await res.json();
        alert(d.error || 'Failed to delete student');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const loadSampleBatch = () => {
    const sample = `Karan Malhotra, karan.m@gtbit.ac.in, 608/CSE2/2023, 08513202723, 4, CSE-2, 9811234567, 8.4
Jasleen Kaur, jasleen.k@gtbit.ac.in, 609/CSE2/2023, 08613202723, 4, CSE-2, 9811234568, 8.9
Aarav Sehgal, aarav.s@gtbit.ac.in, 610/CSE2/2023, 08713202723, 4, CSE-2, 9811234569, 7.8`;
    setBatchCsvText(sample);
  };

  const handleBatchImport = async () => {
    if (!batchCsvText.trim()) {
      alert('Please enter or paste student records.');
      return;
    }

    setBatchProcessing(true);
    setBatchResult(null);

    const lines = batchCsvText.trim().split('\n');
    const parsedStudents = [];

    for (const line of lines) {
      const parts = line.split(',').map(s => s.trim());
      if (parts.length >= 4) {
        parsedStudents.push({
          fullName: parts[0],
          email: parts[1],
          rollNo: parts[2],
          enrollmentNo: parts[3],
          semester: parts[4] ? Number(parts[4]) : 4,
          section: parts[5] || 'CSE-2',
          phone: parts[6] || '',
          initialCgpa: parts[7] ? Number(parts[7]) : 8.0,
          password: 'student123'
        });
      }
    }

    if (parsedStudents.length === 0) {
      alert('No valid rows found. Please format as: Name, Email, RollNo, EnrollmentNo, Semester, Section');
      setBatchProcessing(false);
      return;
    }

    try {
      const res = await fetch('/api/students/batch', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ studentsList: parsedStudents })
      });

      const data = await res.json();
      setBatchResult(data);
      fetchStudents();
    } catch (err) {
      alert('Batch import error: ' + err.message);
    } finally {
      setBatchProcessing(false);
    }
  };

  const canManage = user?.role === 'admin' || user?.role === 'faculty';
  const isAdmin = user?.role === 'admin';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem 2rem',
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.1) 0%, rgba(6, 182, 212, 0.08) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>
            Academic Registry (Module 2.B)
          </div>
          <h1 style={{ fontSize: '1.75rem' }}>Student Profile & Admission Management</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Centralized digital records, admissions, personal profiles, contact details, and student login credentials.
          </p>
        </div>

        {canManage && (
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setShowBatchModal(true)} 
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <UploadCloud size={16} /> Batch Class Import
            </button>
            <button 
              onClick={() => setShowAdmissionModal(true)} 
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <Plus size={16} /> Register New Student
            </button>
          </div>
        )}
      </div>

      {/* Filter and Search Bar */}
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', flex: 1, minWidth: '280px' }}>
          <div style={{ position: 'relative', flex: 1, minWidth: '220px' }}>
            <input
              type="text"
              placeholder="Search by student name, roll no, or enrollment..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="form-input"
              style={{ paddingLeft: '2.4rem' }}
            />
            <Search size={16} style={{ position: 'absolute', left: '0.85rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          </div>

          <select
            value={selectedSemester}
            onChange={(e) => setSelectedSemester(e.target.value)}
            className="form-select"
            style={{ width: '150px' }}
          >
            <option value="4">Semester 4</option>
            <option value="3">Semester 3</option>
            <option value="2">Semester 2</option>
            <option value="1">Semester 1</option>
          </select>

          <select
            value={selectedSection}
            onChange={(e) => setSelectedSection(e.target.value)}
            className="form-select"
            style={{ width: '150px' }}
          >
            <option value="">All Sections</option>
            <option value="CSE-2">Section CSE-2</option>
            <option value="CSE-1">Section CSE-1</option>
          </select>
        </div>

        <span className="badge badge-info">{students.length} Enrolled Students</span>
      </div>

      {/* Students Directory Table */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
            Loading students...
          </div>
        ) : (
          <div className="table-container">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Student Info</th>
                  <th>Roll / Enrollment No</th>
                  <th>Branch & Section</th>
                  <th>Live Attendance</th>
                  <th>Current CGPA</th>
                  <th>Parent / Guardian</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {students.map((st) => (
                  <tr key={st.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <img
                          src={st.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'}
                          alt={st.full_name}
                          style={{ width: '38px', height: '38px', borderRadius: '50%', objectFit: 'cover' }}
                        />
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{st.full_name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{st.email}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600, fontFamily: 'monospace', fontSize: '0.85rem' }}>{st.roll_no}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{st.enrollment_no}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{st.course_code || 'B.Tech CSE'}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Sem {st.semester} • {st.section}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 700 }}>{st.live_attendance_pct}%</span>
                        {st.is_attendance_critical ? (
                          <span className="badge badge-danger">Risk (&lt;75%)</span>
                        ) : (
                          <span className="badge badge-success">Safe</span>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{st.current_cgpa}</div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>76 Credits</div>
                    </td>
                    <td>
                      <div style={{ fontSize: '0.825rem', fontWeight: 600 }}>{st.parent_name || 'Guardian'}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>{st.parent_phone || 'N/A'}</div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <button 
                          onClick={() => viewStudentProfile(st.id)}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: '0.35rem 0.55rem' }}
                          title="View Complete Dossier"
                        >
                          <Eye size={14} /> View
                        </button>
                        {canManage && (
                          <button 
                            onClick={() => {
                              setEditStudentData({ ...st });
                              setShowEditModal(true);
                            }}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.35rem 0.55rem' }}
                            title="Edit Student Information"
                          >
                            <Edit size={14} /> Edit
                          </button>
                        )}
                        {isAdmin && (
                          <button 
                            onClick={() => handleDeleteStudent(st.id, st.full_name)}
                            className="btn btn-danger btn-sm"
                            style={{ padding: '0.35rem 0.55rem' }}
                            title="Delete Student"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Detailed Student Profile Modal */}
      {activeStudent && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Comprehensive Student Dossier</h3>
              <button onClick={() => setActiveStudent(null)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', padding: '1rem', background: 'var(--bg-surface-subtle)', borderRadius: 'var(--radius-md)', marginBottom: '1.25rem' }}>
              <img 
                src={activeStudent.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150&auto=format&fit=crop&q=80'} 
                alt={activeStudent.full_name} 
                style={{ width: '56px', height: '56px', borderRadius: '50%', objectFit: 'cover' }}
              />
              <div>
                <h4 style={{ fontSize: '1.15rem' }}>{activeStudent.full_name}</h4>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  Roll No: <strong>{activeStudent.roll_no}</strong> • Enrollment: <strong>{activeStudent.enrollment_no}</strong>
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  {activeStudent.course_name} • Semester {activeStudent.semester} ({activeStudent.section})
                </div>
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>CUMULATIVE CGPA</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{activeStudent.current_cgpa} / 10</div>
              </div>

              <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>LIVE ATTENDANCE</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: activeStudent.attendance?.is_at_risk ? 'var(--danger)' : 'var(--success)' }}>
                  {activeStudent.attendance?.attendance_percentage}%
                </div>
              </div>

              <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-subtle)' }}>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>BLOOD GROUP / DOB</div>
                <div style={{ fontSize: '0.95rem', fontWeight: 700 }}>{activeStudent.blood_group || 'O+'} • {activeStudent.dob}</div>
              </div>
            </div>

            <div style={{ fontSize: '0.85rem', marginBottom: '1rem' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Permanent Residential Address:</div>
              <div style={{ color: 'var(--text-secondary)' }}>{activeStudent.address || 'New Delhi, Delhi NCR'}</div>
            </div>

            <div style={{ fontSize: '0.85rem', marginBottom: '1.5rem', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'var(--bg-surface-subtle)' }}>
              <div style={{ fontWeight: 700, marginBottom: '0.25rem' }}>Registered Parent / Guardian Details:</div>
              <div style={{ color: 'var(--text-secondary)' }}>Name: {activeStudent.parent_name || 'N/A'}</div>
              <div style={{ color: 'var(--text-secondary)' }}>Phone: {activeStudent.parent_phone || 'N/A'}</div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setActiveStudent(null)} className="btn btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* New Student Admission Registration Modal */}
      {showAdmissionModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '640px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem' }}>Register New Student Admission</h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Creates student profile and provisions their portal login credentials.
                </p>
              </div>
              <button onClick={() => setShowAdmissionModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={18} />
              </button>
            </div>

            {/* Credential Generation Notice */}
            <div style={{
              background: 'rgba(79, 70, 229, 0.08)',
              border: '1px solid rgba(79, 70, 229, 0.25)',
              borderRadius: 'var(--radius-sm)',
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.825rem',
              display: 'flex',
              gap: '0.6rem',
              alignItems: 'flex-start'
            }}>
              <Key size={18} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong style={{ color: 'var(--primary)' }}>Auto-Provisioned Login Credentials</strong>
                <div style={{ color: 'var(--text-secondary)', marginTop: '2px' }}>
                  The student can immediately log into this ERP system with their <strong>Email</strong> and the password specified below (default: <code>student123</code>).
                </div>
              </div>
            </div>

            <form onSubmit={handleAdmissionSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Full Name *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={formData.fullName}
                    onChange={(e) => setFormData({ ...formData, fullName: e.target.value })}
                    placeholder="e.g. Jasleen Kaur"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">College Email (Username) *</label>
                  <input
                    type="email"
                    required
                    className="form-input"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. jasleen.k@gtbit.ac.in"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Class Roll Number *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={formData.rollNo}
                    onChange={(e) => setFormData({ ...formData, rollNo: e.target.value })}
                    placeholder="e.g. 095/CSE2/2023"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">University Enrollment No *</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    value={formData.enrollmentNo}
                    onChange={(e) => setFormData({ ...formData, enrollmentNo: e.target.value })}
                    placeholder="e.g. 09513202723"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Semester</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    className="form-input"
                    value={formData.semester}
                    onChange={(e) => setFormData({ ...formData, semester: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Section</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.section}
                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                    placeholder="e.g. CSE-2"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Student Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    placeholder="+91 98111 XXXXX"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Initial CGPA</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    className="form-input"
                    value={formData.initialCgpa}
                    onChange={(e) => setFormData({ ...formData, initialCgpa: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Parent / Guardian Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.parentName}
                    onChange={(e) => setFormData({ ...formData, parentName: e.target.value })}
                    placeholder="Parent / Guardian Name"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Parent Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.parentPhone}
                    onChange={(e) => setFormData({ ...formData, parentPhone: e.target.value })}
                    placeholder="+91 98111 XXXXX"
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Initial Login Password</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    placeholder="Default: student123"
                  />
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '3px' }}>
                    The student can change their password anytime after logging in.
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => setShowAdmissionModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Admit Student & Create Credentials
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Student Modal */}
      {showEditModal && editStudentData && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '580px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Edit Student: {editStudentData.full_name}</h3>
              <button onClick={() => setShowEditModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.85rem' }}>
                <div className="form-group">
                  <label className="form-label">Full Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editStudentData.full_name || ''}
                    onChange={(e) => setEditStudentData({ ...editStudentData, full_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Phone Number</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editStudentData.phone || ''}
                    onChange={(e) => setEditStudentData({ ...editStudentData, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Semester</label>
                  <input
                    type="number"
                    min="1"
                    max="8"
                    className="form-input"
                    value={editStudentData.semester || 4}
                    onChange={(e) => setEditStudentData({ ...editStudentData, semester: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Section</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editStudentData.section || ''}
                    onChange={(e) => setEditStudentData({ ...editStudentData, section: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Current CGPA</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="10"
                    className="form-input"
                    value={editStudentData.current_cgpa || ''}
                    onChange={(e) => setEditStudentData({ ...editStudentData, current_cgpa: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Academic Status</label>
                  <select
                    className="form-select"
                    value={editStudentData.status || 'Active'}
                    onChange={(e) => setEditStudentData({ ...editStudentData, status: e.target.value })}
                  >
                    <option value="Active">Active</option>
                    <option value="On Leave">On Leave</option>
                    <option value="Suspended">Suspended</option>
                    <option value="Alumni">Alumni</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">Parent / Guardian Name</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editStudentData.parent_name || ''}
                    onChange={(e) => setEditStudentData({ ...editStudentData, parent_name: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Parent Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editStudentData.parent_phone || ''}
                    onChange={(e) => setEditStudentData({ ...editStudentData, parent_phone: e.target.value })}
                  />
                </div>

                <div className="form-group" style={{ gridColumn: 'span 2' }}>
                  <label className="form-label">Residential Address</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editStudentData.address || ''}
                    onChange={(e) => setEditStudentData({ ...editStudentData, address: e.target.value })}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => setShowEditModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Save Changes
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Batch Class Import Modal */}
      {showBatchModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '680px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FileSpreadsheet size={20} color="var(--primary)" />
                  Batch Student & Class Roster Import
                </h3>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  Quickly enroll multiple students from your class roster in one step.
                </p>
              </div>
              <button onClick={() => setShowBatchModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={18} />
              </button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem' }}>
                <label className="form-label" style={{ marginBottom: 0 }}>
                  Enter or Paste Student Roster (CSV format):
                </label>
                <button 
                  onClick={loadSampleBatch}
                  className="btn btn-secondary btn-sm"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                >
                  Load Sample Roster (3 Students)
                </button>
              </div>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>
                Format per line: <code>Full Name, Email, RollNo, EnrollmentNo, Semester, Section, Phone, CGPA</code>
              </p>
              <textarea
                rows="7"
                className="form-input"
                style={{ fontFamily: 'monospace', fontSize: '0.825rem' }}
                placeholder={`Karan Malhotra, karan.m@gtbit.ac.in, 608/CSE2/2023, 08513202723, 4, CSE-2, 9811234567, 8.4
Jasleen Kaur, jasleen.k@gtbit.ac.in, 609/CSE2/2023, 08613202723, 4, CSE-2, 9811234568, 8.9`}
                value={batchCsvText}
                onChange={(e) => setBatchCsvText(e.target.value)}
              />
            </div>

            {batchResult && (
              <div style={{
                padding: '0.85rem',
                borderRadius: 'var(--radius-sm)',
                background: batchResult.successCount > 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                border: `1px solid ${batchResult.successCount > 0 ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'}`,
                marginBottom: '1rem',
                fontSize: '0.85rem'
              }}>
                <div style={{ fontWeight: 700, color: batchResult.successCount > 0 ? 'var(--success)' : 'var(--danger)' }}>
                  {batchResult.message}
                </div>
                {batchResult.errors && batchResult.errors.length > 0 && (
                  <ul style={{ margin: '0.4rem 0 0 1.2rem', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                    {batchResult.errors.map((er, idx) => (
                      <li key={idx}>{er}</li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button onClick={() => setShowBatchModal(false)} className="btn btn-secondary">
                Done / Close
              </button>
              <button 
                onClick={handleBatchImport} 
                disabled={batchProcessing} 
                className="btn btn-primary"
              >
                {batchProcessing ? 'Importing Roster...' : 'Process & Register All Students'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Credential Generated Notification */}
      {createdCredentials && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px', textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              background: 'rgba(16, 185, 129, 0.15)',
              color: 'var(--success)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 1rem'
            }}>
              <CheckCircle2 size={32} />
            </div>

            <h3 style={{ fontSize: '1.3rem', marginBottom: '0.35rem' }}>Student Registered Successfully!</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '1.25rem' }}>
              <strong>{createdCredentials.fullName}</strong> (Roll: {createdCredentials.rollNo}) has been admitted into the institutional registry.
            </p>

            <div style={{
              background: 'var(--bg-surface-subtle)',
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              textAlign: 'left',
              marginBottom: '1.25rem',
              border: '1px solid var(--border-color)'
            }}>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '0.5rem', fontWeight: 700 }}>
                STUDENT LOGIN CREDENTIALS
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.4rem', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Login Email / User:</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace' }}>{createdCredentials.email}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Initial Password:</span>
                <span style={{ fontWeight: 700, fontFamily: 'monospace', color: 'var(--primary)' }}>{createdCredentials.password}</span>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem' }}>
              <button 
                onClick={() => {
                  navigator.clipboard.writeText(`Email: ${createdCredentials.email}\nPassword: ${createdCredentials.password}`);
                  setCopiedKey(true);
                  setTimeout(() => setCopiedKey(false), 2000);
                }} 
                className="btn btn-secondary"
              >
                {copiedKey ? <><Check size={16} /> Copied!</> : <><Copy size={16} /> Copy Credentials</>}
              </button>
              <button onClick={() => setCreatedCredentials(null)} className="btn btn-primary">
                Done
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
