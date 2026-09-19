import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import logger from '../utils/logger';

const PremiumContext = createContext(null);
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export function PremiumProvider({ children }) {
  const { token, user } = useAuth();
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!token) {
      setIsPro(false);
      setLoading(false);
      return;
    }
    try {
      const res = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` } });
      setIsPro(res.data?.is_premium === true);
    } catch (err) {
      logger.error('Premium status check failed:', err);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => { refresh(); }, [refresh, user?.id]);

  const value = useMemo(() => ({
    isPro,
    loading,
    initialized: true,
    refreshCustomerInfo: refresh,
  }), [isPro, loading, refresh]);

  return <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>;
}

export function usePremium() {
  const ctx = useContext(PremiumContext);
  if (!ctx) return { isPro: false, loading: false, initialized: false, refreshCustomerInfo: async () => {} };
  return ctx;
}
