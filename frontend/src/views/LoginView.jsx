import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  Shield,
  GraduationCap,
  Users,
  HeartHandshake,
  ArrowRight,
  Sparkles,
  Lock,
  Mail,
  AlertTriangle
} from 'lucide-react';

export default function LoginView() {
  const { login, quickSwitchRole } = useAuth();
  const [email, setEmail] = useState('tejassveer@gtbit.ac.in');
  const [password, setPassword] = useState('student123');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleManualLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const demoAccounts = [
    { role: 'student', label: 'Student (Tejassveer)', email: 'tejassveer@gtbit.ac.in', pass: 'student123', icon: GraduationCap, color: '#4f46e5', desc: 'Roll: 071/CSE2/2023 • 8.78 CGPA' },
    { role: 'student', label: 'Student (Dev Sharma)', email: 'dev.sharma@gtbit.ac.in', pass: 'student123', icon: GraduationCap, color: '#06b6d4', desc: 'Roll: 605/CSE2/2023 • 8.45 CGPA' },
    { role: 'student', label: 'Student (Aman - Risk Demo)', email: 'aman.gupta@gtbit.ac.in', pass: 'student123', icon: AlertTriangle, color: '#ef4444', desc: 'Attendance 67.5% (< 75% Risk)' },
    { role: 'faculty', label: 'Faculty (Ms. Basanti Pal Nandi)', email: 'faculty.nandi@gtbit.ac.in', pass: 'faculty123', icon: Users, color: '#8b5cf6', desc: 'Assistant Professor & Guide' },
    { role: 'admin', label: 'Admin (HOD / Dean)', email: 'admin@gtbit.ac.in', pass: 'admin123', icon: Shield, color: '#10b981', desc: 'Complete Campus Administration' },
    { role: 'parent', label: 'Parent (Mr. Kuldeep Singh)', email: 'parent.tejassveer@gmail.com', pass: 'parent123', icon: HeartHandshake, color: '#f59e0b', desc: 'Parent Portal of Tejassveer' }
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '2rem 1rem'
    }}>
      <div className="glass-panel" style={{
        width: '100%',
        maxWidth: '900px',
        padding: '2.5rem',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))',
        gap: '2.5rem',
        boxShadow: 'var(--shadow-xl)',
        background: 'var(--bg-surface)'
      }}>
        {/* Left Column: College Crest & Info */}
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div style={{
                width: '48px',
                height: '48px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '1.5rem',
                boxShadow: '0 6px 18px rgba(79, 70, 229, 0.4)'
              }}>
                G
              </div>
              <div>
                <h2 style={{ fontSize: '1.35rem', fontWeight: 800, letterSpacing: '-0.02em' }}>GTBIT ERP</h2>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  Guru Tegh Bahadur Institute of Technology (GGSIPU)
                </div>
              </div>
            </div>

            <h1 style={{ fontSize: '1.85rem', lineHeight: 1.2, marginBottom: '0.75rem' }}>
              Student Management ERP System
            </h1>

            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              A centralized web platform uniting academic administration with predictive innovations:
              the <strong>CGPA Probability Module</strong> and <strong>Smart Attendance Tracker</strong>.
            </p>

            {/* Synopsis Authors Credit */}
            <div style={{
              padding: '1rem',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-subtle)',
              border: '1px solid var(--border-subtle)',
              fontSize: '0.78rem'
            }}>
              <div style={{ fontWeight: 700, color: 'var(--primary)', marginBottom: '0.35rem' }}>
                B.Tech CSE Project Team:
              </div>
              <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
                • Tejassveer Singh Vasant (07113202723)<br />
                • Dev Sharma (60513202724)<br />
                • Krishmeet Singh (60713202724)<br />
                • Hargun Kaur (08313202723)
              </div>
              <div style={{ marginTop: '0.4rem', color: 'var(--text-muted)', fontSize: '0.72rem' }}>
                Guided by: <strong>Ms. Basanti Pal Nandi</strong> (Assistant Professor, CSE Dept)
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: 1-Click Persona Demo Access */}
        <div>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
            fontSize: '0.85rem',
            fontWeight: 700,
            marginBottom: '0.75rem',
            color: 'var(--primary)'
          }}>
            <Sparkles size={16} /> Instant 1-Click Persona Access
          </div>

          <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
            Click any account below to enter the portal immediately without typing passwords:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginBottom: '1.5rem' }}>
            {demoAccounts.map((demo, idx) => {
              const Icon = demo.icon;
              return (
                <button
                  key={idx}
                  type="button"
                  onClick={() => quickSwitchRole(demo.role, demo.email)}
                  style={{
                    padding: '0.65rem 0.85rem',
                    borderRadius: 'var(--radius-md)',
                    border: '1px solid var(--border-subtle)',
                    background: 'var(--bg-surface-subtle)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    cursor: 'pointer',
                    fontFamily: 'inherit',
                    textAlign: 'left',
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = demo.color;
                    e.currentTarget.style.transform = 'translateX(4px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border-subtle)';
                    e.currentTarget.style.transform = 'translateX(0)';
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                    <div style={{
                      width: '32px',
                      height: '32px',
                      borderRadius: '8px',
                      background: demo.color,
                      color: '#ffffff',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      flexShrink: 0
                    }}>
                      <Icon size={16} />
                    </div>
                    <div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                        {demo.label}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                        {demo.desc}
                      </div>
                    </div>
                  </div>

                  <ArrowRight size={14} color="var(--text-muted)" />
                </button>
              );
            })}
          </div>

          {/* Manual Login Accordion / Form */}
          <form onSubmit={handleManualLogin} style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '1rem' }}>
            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
              Or Sign In With Custom Credentials
            </div>

            {error && (
              <div style={{
                padding: '0.5rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                fontSize: '0.75rem',
                marginBottom: '0.75rem'
              }}>
                {error}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '0.65rem' }}>
              <input
                type="email"
                required
                className="form-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Institutional Email"
                style={{ fontSize: '0.825rem' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
              <input
                type="password"
                required
                className="form-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                style={{ fontSize: '0.825rem' }}
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary btn-sm"
              style={{ width: '100%' }}
            >
              {loading ? 'Authenticating...' : 'Sign In to ERP Portal'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
