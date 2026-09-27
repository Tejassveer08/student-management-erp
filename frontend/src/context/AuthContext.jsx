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
  const [theme, setTheme] = useState(localStorage.getItem('erp_theme') || 'light');
  const hasLoggedOut = useRef(false);

  // Synchronize data-theme and data-role on document element
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('erp_theme', theme);
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
        // If user explicitly logged out, stay on login screen
        if (hasLoggedOut.current) {
          setLoading(false);
          return;
        }
        // First visit with no token — auto-login for demo convenience
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
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Login failed');
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
    admin: { label: 'Admin (Dean & HOD)', accent: '#4f46e5', badge: 'Dean & Administration' },
    faculty: { label: 'Faculty Console', accent: '#0d9488', badge: 'Professor & Guide' },
    parent: { label: 'Parent Portal', accent: '#d97706', badge: 'Guardian / Ward Monitor' },
    student: { label: 'Student Console', accent: '#2563eb', badge: 'Undergraduate Scholar' }
  }[user?.role?.toLowerCase() || 'student'] || { label: 'User', accent: '#4f46e5', badge: 'ERP Member' };

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
      quickSwitchRole,
      hasPermission,
      roleMeta,
      permissions
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
