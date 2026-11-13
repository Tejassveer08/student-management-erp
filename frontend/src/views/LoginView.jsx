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
  AlertTriangle,
  Eye,
  EyeOff,
  Zap,
  ChevronRight,
  Star
} from 'lucide-react';

export default function LoginView() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);

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

  const features = [
    'CGPA Probability Prediction',
    'Smart QR Attendance',
    'Real-time Analytics',
    'Role-based Access Control'
  ];

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '1.5rem',
      position: 'relative'
    }}>
      {/* Floating decorative elements */}
      <div style={{
        position: 'fixed',
        top: '15%',
        left: '8%',
        width: '180px',
        height: '180px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(79, 70, 229, 0.08) 0%, transparent 70%)',
        animation: 'floatOrb1 20s ease-in-out infinite',
        pointerEvents: 'none'
      }}></div>
      <div style={{
        position: 'fixed',
        bottom: '10%',
        right: '5%',
        width: '220px',
        height: '220px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(6, 182, 212, 0.08) 0%, transparent 70%)',
        animation: 'floatOrb2 25s ease-in-out infinite',
        pointerEvents: 'none'
      }}></div>

      <div className="animate-scale-in" style={{
        width: '100%',
        maxWidth: '960px',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
        gap: '0',
        borderRadius: 'var(--radius-xl)',
        overflow: 'hidden',
        boxShadow: 'var(--shadow-float)',
        border: '1px solid var(--border-subtle)',
        background: 'var(--bg-surface)'
      }}>
        {/* Left Column: Hero Branding */}
        <div style={{ 
          padding: '2.5rem',
          display: 'flex', 
          flexDirection: 'column', 
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, var(--bg-surface-subtle) 0%, var(--bg-surface) 100%)',
          borderRight: '1px solid var(--border-subtle)',
          position: 'relative',
          overflow: 'hidden'
        }}>
          {/* Top decorative gradient bar */}
          <div style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            height: '4px',
            background: 'linear-gradient(90deg, #4f46e5, #06b6d4, #8b5cf6, #f59e0b)',
            backgroundSize: '200% 100%',
            animation: 'gradientShift 4s ease infinite'
          }}></div>

          <div>
            {/* Logo */}
            <div className="animate-slide-left" style={{ display: 'flex', alignItems: 'center', gap: '0.85rem', marginBottom: '2rem', marginTop: '0.5rem' }}>
              <div style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #06b6d4 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                fontWeight: 900,
                fontSize: '1.5rem',
                boxShadow: '0 8px 24px rgba(79, 70, 229, 0.35)',
                position: 'relative',
                overflow: 'hidden'
              }}>
                G
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: '-100%',
                  width: '200%',
                  height: '100%',
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.25) 50%, transparent 100%)',
                  animation: 'shimmerProgress 3s infinite',
                  pointerEvents: 'none'
                }}></div>
              </div>
              <div>
                <h2 style={{ fontSize: '1.4rem', fontWeight: 900, letterSpacing: '-0.03em' }}>GTBIT ERP</h2>
                <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>
                  Guru Tegh Bahadur Institute of Technology (GGSIPU)
                </div>
              </div>
            </div>

            {/* Title */}
            <div className="animate-slide-left stagger-2">
              <h1 style={{ fontSize: '1.9rem', lineHeight: 1.15, marginBottom: '0.75rem', letterSpacing: '-0.03em' }}>
                Student Management<br />
                <span className="text-gradient" style={{ fontWeight: 900 }}>ERP System</span>
              </h1>

              <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', lineHeight: 1.65, marginBottom: '1.75rem' }}>
                A centralized platform uniting academic administration with predictive innovations—<strong>CGPA Probability Module</strong> and <strong>Smart Attendance Tracker</strong>.
              </p>
            </div>

            {/* Feature chips */}
            <div className="animate-slide-left stagger-3" style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem', marginBottom: '2rem' }}>
              {features.map((f, i) => (
                <span key={i} style={{
                  padding: '0.3rem 0.7rem',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '0.72rem',
                  fontWeight: 600,
                  background: 'var(--bg-surface-subtle)',
                  border: '1px solid var(--border-subtle)',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem'
                }}>
                  <Star size={10} color="var(--accent-amber)" fill="var(--accent-amber)" />
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Team Credits */}
          <div className="animate-slide-left stagger-4" style={{
            padding: '1rem 1.15rem',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface)',
            border: '1px solid var(--border-subtle)',
            fontSize: '0.76rem'
          }}>
            <div style={{ fontWeight: 800, color: 'var(--primary)', marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
              <GraduationCap size={13} />
              B.Tech CSE Project Team
            </div>
            <div style={{ color: 'var(--text-secondary)', lineHeight: 1.55, fontSize: '0.73rem' }}>
              Tejassveer Singh Vasant • Dev Sharma<br />
              Krishmeet Singh • Hargun Kaur
            </div>
            <div style={{ marginTop: '0.4rem', color: 'var(--text-muted)', fontSize: '0.68rem' }}>
              Guided by: <strong>Ms. Basanti Pal Nandi</strong> (Asst. Professor, CSE)
            </div>
          </div>
        </div>

        {/* Right Column: Auth Panel */}
        <div style={{ padding: '2.5rem', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
          <div className="animate-slide-right" style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
            fontSize: '1.05rem',
            fontWeight: 800,
            marginBottom: '0.45rem',
            color: 'var(--text-primary)'
          }}>
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg, #4f46e5, #06b6d4)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <Lock size={15} color="#fff" />
            </div>
            Campus Portal Sign In
          </div>

          <p className="animate-slide-right stagger-1" style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1.35rem', lineHeight: 1.5 }}>
            Enter your GTBIT institutional email, roll number, or employee ID along with your password.
          </p>

          {/* Manual Login Form */}
          <form onSubmit={handleManualLogin} className="animate-slide-right stagger-2">

            {error && (
              <div style={{
                padding: '0.55rem 0.75rem',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--danger-bg)',
                color: 'var(--danger)',
                fontSize: '0.78rem',
                marginBottom: '0.75rem',
                fontWeight: 600,
                border: '1px solid var(--danger-border)',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem'
              }}>
                <AlertTriangle size={14} />
                {error}
              </div>
            )}

            <div className="form-group" style={{ marginBottom: '0.65rem' }}>
              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ 
                  position: 'absolute', 
                  left: '0.8rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  type="text"
                  required
                  className="form-input"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Email, Roll No (e.g. 071/CSE2/2023), or Employee ID"
                  style={{ fontSize: '0.84rem', paddingLeft: '2.5rem' }}
                />
              </div>
            </div>

            <div className="form-group" style={{ marginBottom: '0.85rem' }}>
              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ 
                  position: 'absolute', 
                  left: '0.8rem', 
                  top: '50%', 
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)'
                }} />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  className="form-input"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  style={{ fontSize: '0.84rem', paddingLeft: '2.5rem', paddingRight: '2.5rem' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute',
                    right: '0.8rem',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    padding: 0,
                    color: 'var(--text-muted)'
                  }}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{ 
                width: '100%', 
                padding: '0.75rem',
                fontSize: '0.88rem',
                fontWeight: 700,
                borderRadius: 'var(--radius-md)',
                position: 'relative',
                overflow: 'hidden'
              }}
            >
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <div style={{
                    width: '16px',
                    height: '16px',
                    border: '2px solid rgba(255,255,255,0.3)',
                    borderTopColor: '#fff',
                    borderRadius: '50%',
                    animation: 'spin 0.6s linear infinite'
                  }}></div>
                  Authenticating...
                </div>
              ) : (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                  Sign In to ERP Portal
                  <ArrowRight size={16} />
                </div>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
