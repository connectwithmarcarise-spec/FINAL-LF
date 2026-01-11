import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [role, setRole] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const response = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setUser(response.data.user);
      setRole(response.data.role);
    } catch (error) {
      console.error('Auth error:', error);
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
      setRole(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  const studentLogin = async (rollNumber, dob) => {
    const response = await axios.post(`${API}/auth/student/login`, {
      roll_number: rollNumber,
      dob: dob
    });
    const { token: newToken, user: userData, role: userRole } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    setRole(userRole);
    return response.data;
  };

  const adminLogin = async (username, password) => {
    const response = await axios.post(`${API}/auth/admin/login`, {
      username,
      password
    });
    const { token: newToken, user: userData, role: userRole } = response.data;
    localStorage.setItem('token', newToken);
    setToken(newToken);
    setUser(userData);
    setRole(userRole);
    return response.data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setRole(null);
  };

  const value = {
    user,
    role,
    token,
    loading,
    studentLogin,
    adminLogin,
    logout,
    isAuthenticated: !!token && !!user,
    isStudent: role === 'student',
    isAdmin: role === 'admin' || role === 'super_admin',
    isSuperAdmin: role === 'super_admin'
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
