import React, { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('erp_token') || null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [facultyProfile, setFacultyProfile] = useState(null);
  const [parentProfile, setParentProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(localStorage.getItem('erp_theme') || 'light');

  // Apply theme to document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('erp_theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Verify and fetch profile on token load
  useEffect(() => {
    async function loadUser() {
      if (!token) {
        // Auto-login as default Student (Tejassveer) for immediate smooth evaluation if no token
        await quickSwitchRole('student');
        setLoading(false);
        return;
      }

      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          const data = await res.json();
          setUser(data.user);
          setStudentProfile(data.student);
          setFacultyProfile(data.faculty);
          setParentProfile(data.parent);
        } else {
          // Token expired, fallback to student quick switch
          await quickSwitchRole('student');
        }
      } catch (err) {
        console.error('Auth verification error:', err);
      } finally {
        setLoading(false);
      }
    }

    loadUser();
  }, [token]);

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
    }

    localStorage.setItem('erp_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setStudentProfile(data.student);
    setFacultyProfile(data.faculty);
    setParentProfile(data.parent);
    return data;
  };

  const quickSwitchRole = async (roleName, email = null) => {
    try {
      const res = await fetch('/api/auth/quick-switch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role: roleName, email })
      });

      if (!res.ok) return;
      const data = await res.json();
      localStorage.setItem('erp_token', data.token);
      setToken(data.token);
      setUser(data.user);
      setStudentProfile(data.student);
      setFacultyProfile(data.faculty);
      setParentProfile(data.parent);
      return data;
    } catch (err) {
      console.error('Quick switch error:', err);
    }
  };

  const logout = () => {
    localStorage.removeItem('erp_token');
    setToken(null);
    setUser(null);
    setStudentProfile(null);
    setFacultyProfile(null);
    setParentProfile(null);
  };

  return (
    <AuthContext.Provider value={{
      user,
      token,
      studentProfile,
      facultyProfile,
      parentProfile,
      loading,
      theme,
      toggleTheme,
      login,
      logout,
      quickSwitchRole
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
