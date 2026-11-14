import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import permissions from '../config/permissions.json';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('erp_token') || null);
  const [studentProfile, setStudentProfile] = useState(null);
  const [facultyProfile, setFacultyProfile] = useState(null);
  const [parentProfile, setParentProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [theme, setTheme] = useState(() => {
    try {
      return localStorage.getItem('erp_theme') ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    } catch {
      return 'light';
    }
  });
  const hasLoggedOut = useRef(false);

  // Synchronize data-theme and data-role on document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    try { localStorage.setItem('erp_theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);

  useEffect(() => {
    if (user?.role) {
      document.documentElement.setAttribute('data-role', user.role.toLowerCase());
    } else {
      document.documentElement.setAttribute('data-role', 'student');
    }
  }, [user?.role]);

  const toggleTheme = () => {
    setTheme(prev => (prev === 'light' ? 'dark' : 'light'));
  };

  // Verify and fetch profile on token load
  useEffect(() => {
    async function loadUser() {
      if (!token) {
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
          // Token expired — show login screen
          localStorage.removeItem('erp_token');
          setToken(null);
          setUser(null);
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
    let res;
    try {
      res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
    } catch {
      throw new Error('Backend server is unreachable. Please ensure the backend is running on port 5000.');
    }

    let data;
    try {
      data = await res.json();
    } catch {
      data = null;
    }

    if (!res.ok) {
      const errorMsg = data?.error || (res.status === 502 || res.status === 504 
        ? 'Backend server is not running or unreachable (Port 5000).' 
        : `Server error (${res.status})`);
      throw new Error(errorMsg);
    }

    hasLoggedOut.current = false;
    localStorage.setItem('erp_token', data.token);
    setToken(data.token);
    setUser(data.user);
    setStudentProfile(data.student);
    setFacultyProfile(data.faculty);
    setParentProfile(data.parent);
    return data;
  };

  const changePassword = async (currentPassword, newPassword) => {
    const res = await fetch('/api/auth/change-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Could not change password');
    return data;
  };

  const logout = () => {
    hasLoggedOut.current = true;
    localStorage.removeItem('erp_token');
    setToken(null);
    setUser(null);
    setStudentProfile(null);
    setFacultyProfile(null);
    setParentProfile(null);
  };

  const hasPermission = (module, action = 'read') => {
    if (!user || !user.role) return false;
    const roleKey = user.role.toLowerCase();
    const roleRules = permissions[roleKey];
    if (!roleRules) return false;
    const actions = roleRules[module];
    if (!actions || !Array.isArray(actions)) return false;
    return actions.includes(action);
  };

  const roleMeta = {
    admin: { label: 'Administration', title: 'Dean & Administration', badge: 'Admin' },
    faculty: { label: 'Faculty', title: 'Faculty Console', badge: 'Faculty' },
    parent: { label: 'Guardian', title: 'Parent Portal', badge: 'Parent' },
    student: { label: 'Student', title: 'Student Console', badge: 'Student' }
  }[user?.role?.toLowerCase() || 'student'] || { label: 'Member', title: 'ERP', badge: 'Member' };

  const refreshProfile = async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/auth/me', { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setStudentProfile(data.student);
        setFacultyProfile(data.faculty);
        setParentProfile(data.parent);
      }
    } catch { /* ignore */ }
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
      changePassword,
      hasPermission,
      roleMeta,
      refreshProfile,
      permissions
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
