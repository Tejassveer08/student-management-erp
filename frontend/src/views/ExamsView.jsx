import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Award,
  Calendar,
  FileCheck,
  CheckCircle2,
  Printer,
  Download,
  Plus,
  Edit3,
  User,
  X
} from 'lucide-react';

export default function ExamsView() {
  const { user, token } = useAuth();
  const [exams, setExams] = useState([]);
  const [reportCard, setReportCard] = useState(null);
  const [students, setStudents] = useState([]);
  const [selectedStudentId, setSelectedStudentId] = useState('');
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);

  // Mark Entry Modal (Faculty/Admin)
  const [showMarkModal, setShowMarkModal] = useState(false);
  const [markForm, setMarkForm] = useState({
    examId: 1,
    subjectId: '',
    studentId: '',
    internalAssessment: 21,
    assignmentScore: 13,
    externalExam: 50,
    remarks: 'Good analytical skills'
  });

  useEffect(() => {
    fetchExams();
  }, [token, selectedStudentId]);

  async function fetchExams() {
    if (!token) return;
    setLoading(true);

    try {
      const [exRes, stRes, subRes] = await Promise.all([
        fetch('/api/exams', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/students?semester=4', { headers: { 'Authorization': `Bearer ${token}` } }),
        fetch('/api/academics/subjects?semester=4', { headers: { 'Authorization': `Bearer ${token}` } })
      ]);

      if (exRes.ok) setExams(await exRes.json());
      if (stRes.ok) {
        const stList = await stRes.json();
        setStudents(stList);
        if (stList.length > 0 && !selectedStudentId) {
          setSelectedStudentId(stList[0].id);
        }
      }
      if (subRes.ok) {
        const subList = await subRes.json();
        setSubjects(subList);
        if (subList.length > 0 && !markForm.subjectId) {
          setMarkForm(prev => ({ ...prev, subjectId: subList[0].id }));
        }
      }

      // Fetch Report card
      const targetId = selectedStudentId || 1;
      const repRes = await fetch(`/api/exams/report-card/${targetId}`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (repRes.ok) {
        setReportCard(await repRes.json());
      }
    } catch (err) {
      console.error('Error fetching exam records:', err);
    } finally {
      setLoading(false);
    }
  }

  const handleMarkSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch('/api/exams/marks', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(markForm)
      });

      const data = await res.json();
      if (res.ok) {
        alert(`Marks recorded! Total Score: ${data.total_score}/100 (Grade ${data.letter_grade})`);
        setShowMarkModal(false);
        fetchExams();
      } else {
        alert(data.error || 'Failed to enter marks');
      }
    } catch (err) {
      alert('Error: ' + err.message);
    }
  };

  const handlePrintReportCard = () => {
    window.print();
  };

  const isFacultyOrAdmin = user?.role === 'admin' || user?.role === 'faculty';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      {/* Banner */}
      <div className="glass-panel" style={{
        padding: '1.5rem 2rem',
        background: 'linear-gradient(135deg, rgba(79, 70, 229, 0.12) 0%, rgba(245, 158, 11, 0.08) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '1rem'
      }}>
        <div>
          <div className="badge badge-primary" style={{ marginBottom: '0.4rem' }}>
            Examination & Grade Reporting (Module 2.F)
          </div>
          <h1 style={{ fontSize: '1.75rem' }}>Examinations, Continuous Assessment & Results</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.2rem' }}>
            Mid-Term Minors, End-Term Majors, marks entry, automatic SGPA & CGPA marksheet generation.
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          {isFacultyOrAdmin && (
            <button onClick={() => setShowMarkModal(true)} className="btn btn-primary btn-sm">
              <Plus size={16} /> Enter / Update Student Marks
            </button>
          )}

          <button onClick={handlePrintReportCard} className="btn btn-secondary btn-sm">
            <Printer size={16} /> Print / Save Marksheet PDF
          </button>
        </div>
      </div>

      {/* Examination Schedules */}
      <div className="glass-panel" style={{ padding: '1.5rem' }}>
        <h3 style={{ fontSize: '1.15rem', marginBottom: '1rem' }}>Active & Upcoming Examination Schedules</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1rem' }}>
          {exams.map(e => (
            <div key={e.id} style={{
              padding: '1.15rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.5rem'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-info">{e.exam_type} Exam</span>
                <span className={`badge badge-${e.status === 'Results_Declared' ? 'success' : 'primary'}`}>
                  {e.status.replace('_', ' ')}
                </span>
              </div>

              <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{e.name}</h4>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Semester {e.semester} • Academic Session {e.academic_year}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
                Schedule Window: <strong>{e.start_date}</strong> to <strong>{e.end_date}</strong>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Student Marksheet Selector (Admin/Faculty/Parent) */}
      <div className="glass-panel" style={{ padding: '1rem 1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Select Student Marksheet:</span>
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="form-select"
            style={{ width: '280px', padding: '0.4rem 0.75rem' }}
          >
            {students.map(s => (
              <option key={s.id} value={s.id}>
                {s.full_name} ({s.roll_no})
              </option>
            ))}
          </select>
        </div>

        <span className="badge badge-success">Official University Grading Template</span>
      </div>

      {/* Official Formatted Marksheet / Report Card Container */}
      {reportCard && (
        <div className="glass-panel" style={{
          padding: '2.5rem',
          background: '#ffffff',
          color: '#0f172a',
          boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
          border: '2px solid #cbd5e1',
          borderRadius: 'var(--radius-lg)'
        }} id="printableMarksheet">
          {/* Institution Header */}
          <div style={{ textAlign: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '1.25rem', marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '1.35rem', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {reportCard.institution.name}
            </h2>
            <div style={{ fontSize: '0.85rem', color: '#475569', fontWeight: 600, marginTop: '0.2rem' }}>
              {reportCard.institution.affiliate}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
              {reportCard.institution.accreditation}
            </div>
            <div style={{
              display: 'inline-block',
              margin: '0.75rem 0 0 0',
              padding: '0.25rem 1rem',
              borderRadius: '9999px',
              background: '#e0e7ff',
              color: '#3730a3',
              fontSize: '0.8rem',
              fontWeight: 800,
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              Official Statement of Grades (Semester 4)
            </div>
          </div>

          {/* Student Dossier Matrix */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: '0.85rem',
            padding: '1rem',
            background: '#f8fafc',
            borderRadius: '8px',
            marginBottom: '1.5rem',
            fontSize: '0.85rem'
          }}>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>STUDENT NAME:</span>
              <div style={{ fontWeight: 800 }}>{reportCard.student.name}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>ROLL NUMBER:</span>
              <div style={{ fontWeight: 800, fontFamily: 'monospace' }}>{reportCard.student.roll_no}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>ENROLLMENT NO:</span>
              <div style={{ fontWeight: 800, fontFamily: 'monospace' }}>{reportCard.student.enrollment_no}</div>
            </div>
            <div>
              <span style={{ color: '#64748b', fontSize: '0.75rem' }}>PROGRAMME & BRANCH:</span>
              <div style={{ fontWeight: 700 }}>{reportCard.student.course} ({reportCard.student.section})</div>
            </div>
          </div>

          {/* Marksheet Subjects Table */}
          <div style={{ overflowX: 'auto', marginBottom: '1.5rem' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #94a3b8' }}>
                  <th style={{ padding: '0.75rem', fontWeight: 700 }}>Sub Code</th>
                  <th style={{ padding: '0.75rem', fontWeight: 700 }}>Course Title</th>
                  <th style={{ padding: '0.75rem', fontWeight: 700 }}>Credits</th>
                  <th style={{ padding: '0.75rem', fontWeight: 700 }}>Internal (40)</th>
                  <th style={{ padding: '0.75rem', fontWeight: 700 }}>External (60)</th>
                  <th style={{ padding: '0.75rem', fontWeight: 700 }}>Total (100)</th>
                  <th style={{ padding: '0.75rem', fontWeight: 700 }}>Grade</th>
                  <th style={{ padding: '0.75rem', fontWeight: 700 }}>Grade Point</th>
                </tr>
              </thead>
              <tbody>
                {(reportCard.subjects || []).map((m, idx) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #e2e8f0' }}>
                    <td style={{ padding: '0.75rem', fontFamily: 'monospace', fontWeight: 700 }}>{m.subject_code}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 600 }}>{m.subject_name}</td>
                    <td style={{ padding: '0.75rem' }}>{m.credits}</td>
                    <td style={{ padding: '0.75rem' }}>{(m.internal_assessment + m.assignment_score).toFixed(1)}</td>
                    <td style={{ padding: '0.75rem' }}>{m.external_exam}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 800 }}>{m.total_score}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 800, color: '#4f46e5' }}>{m.letter_grade}</td>
                    <td style={{ padding: '0.75rem', fontWeight: 700 }}>{m.grade_points}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Performance Summary Banner */}
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem 1.5rem',
            background: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            marginBottom: '1.75rem'
          }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>TOTAL CREDITS EARNED</div>
              <div style={{ fontSize: '1.25rem', fontWeight: 800 }}>{reportCard.academic_metrics.semester_credits}</div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>SEMESTER SGPA</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#4f46e5' }}>
                {reportCard.academic_metrics.semester_sgpa}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>CUMULATIVE CGPA</div>
              <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#059669' }}>
                {reportCard.academic_metrics.cumulative_cgpa}
              </div>
            </div>

            <div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>RESULT STATUS</div>
              <div style={{
                fontSize: '1rem',
                fontWeight: 800,
                color: '#059669',
                background: '#d1fae5',
                padding: '0.25rem 0.75rem',
                borderRadius: '6px'
              }}>
                {reportCard.academic_metrics.status}
              </div>
            </div>
          </div>

          {/* Signatures */}
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2.5rem', paddingTop: '1.5rem', borderTop: '1px dashed #cbd5e1' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Prepared by: Examination Cell</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>GTBIT Evaluation Wing</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Ms. Basanti Pal Nandi</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Head of Department / Guide</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontWeight: 700, fontSize: '0.85rem' }}>Controller of Examinations</div>
              <div style={{ fontSize: '0.75rem', color: '#64748b' }}>GGSIP University, New Delhi</div>
            </div>
          </div>
        </div>
      )}

      {/* Mark Entry Modal for Faculty */}
      {showMarkModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '520px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.25rem' }}>Enter Student Marks</h3>
              <button onClick={() => setShowMarkModal(false)} className="btn btn-secondary btn-sm" style={{ padding: '0.3rem' }}>
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleMarkSubmit}>
              <div className="form-group">
                <label className="form-label">Subject</label>
                <select
                  className="form-select"
                  value={markForm.subjectId}
                  onChange={(e) => setMarkForm({ ...markForm, subjectId: Number(e.target.value) })}
                >
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.code} - {s.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Student</label>
                <select
                  className="form-select"
                  value={markForm.studentId}
                  onChange={(e) => setMarkForm({ ...markForm, studentId: Number(e.target.value) })}
                  required
                >
                  <option value="">Select Student...</option>
                  {students.map(s => (
                    <option key={s.id} value={s.id}>{s.full_name} ({s.roll_no})</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '0.75rem' }}>
                <div className="form-group">
                  <label className="form-label">Internal (25)</label>
                  <input
                    type="number"
                    step="0.5"
                    max="25"
                    min="0"
                    required
                    className="form-input"
                    value={markForm.internalAssessment}
                    onChange={(e) => setMarkForm({ ...markForm, internalAssessment: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Assignment (15)</label>
                  <input
                    type="number"
                    step="0.5"
                    max="15"
                    min="0"
                    required
                    className="form-input"
                    value={markForm.assignmentScore}
                    onChange={(e) => setMarkForm({ ...markForm, assignmentScore: Number(e.target.value) })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">External (60)</label>
                  <input
                    type="number"
                    step="0.5"
                    max="60"
                    min="0"
                    required
                    className="form-input"
                    value={markForm.externalExam}
                    onChange={(e) => setMarkForm({ ...markForm, externalExam: Number(e.target.value) })}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Remarks / Feedback</label>
                <input
                  type="text"
                  className="form-input"
                  value={markForm.remarks}
                  onChange={(e) => setMarkForm({ ...markForm, remarks: e.target.value })}
                  placeholder="e.g. Excellent performance in problem solving"
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button type="button" onClick={() => setShowMarkModal(false)} className="btn btn-secondary">
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary">
                  Record Marks
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
