import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

const AuthContext = createContext(null);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('token');
    } catch (e) {
      return null;
    }
  });
  const [loading, setLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await axios.get(`${API}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
        timeout: 90000
      });
      setUser(res.data);
    } catch (e) {
      localStorage.removeItem('token');
      setToken(null);
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (token) {
      fetchUser();
    } else {
      setLoading(false);
    }
  }, [token, fetchUser]);

  const login = useCallback(async (email, password) => {
    let res;
    try {
      res = await axios.post(`${API}/auth/login`, { email, password, ...consent }, { timeout: 90000 });
    } catch (firstErr) {
      if (firstErr.response) throw firstErr;
      res = await axios.post(`${API}/auth/login`, { email, password }, { timeout: 90000 });
    }
    localStorage.setItem('token', res.data.access_token);
    setToken(res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  const signup = useCallback(async (email, password, consent = {}) => {
    let res;
    try {
      res = await axios.post(`${API}/auth/signup`, { email, password, ...consent }, { timeout: 90000 });
    } catch (firstErr) {
      if (firstErr.response) throw firstErr;
      res = await axios.post(`${API}/auth/signup`, { email, password, ...consent }, { timeout: 90000 });
    }
    localStorage.setItem('token', res.data.access_token);
    setToken(res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  // v61 (Angelita, Nov 1, 2026): anonymous start. No email, no
  // password, no name: the backend creates an anonymous auto-account
  // from just the two consent confirmations and returns a token.
  const startAnonymous = useCallback(async (consent = {}) => {
    let res;
    try {
      res = await axios.post(`${API}/auth/anonymous`, { ...consent }, { timeout: 90000 });
    } catch (firstErr) {
      if (firstErr.response) throw firstErr;
      res = await axios.post(`${API}/auth/anonymous`, { ...consent }, { timeout: 90000 });
    }
    localStorage.setItem('token', res.data.access_token);
    setToken(res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  }, []);

  // v62 (Angelita, Nov 2, 2026): upgrade path for accounts created
  // anonymously under v61. The user adds a real email, a password she
  // chooses, and her name; the backend converts the SAME account, so
  // her logs, journal, wishlist and partner link all carry over.
  const attachEmail = useCallback(async (email, password, name) => {
    const res = await axios.post(`${API}/auth/attach-email`, { email, password, name }, {
      headers: { Authorization: `Bearer ${token}` },
      timeout: 90000,
    });
    localStorage.setItem('token', res.data.access_token);
    setToken(res.data.access_token);
    setUser(res.data.user);
    return res.data.user;
  }, [token]);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const updateUser = useCallback((updatedData) => {
    setUser(prev => ({ ...prev, ...updatedData }));
  }, []);

  const value = useMemo(
    () => ({ user, token, loading, login, signup, startAnonymous, attachEmail, logout, updateUser, fetchUser }),
    [user, token, loading, login, signup, startAnonymous, attachEmail, logout, updateUser, fetchUser]
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthContext;
