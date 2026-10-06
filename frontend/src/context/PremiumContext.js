import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import axios from 'axios';
import { useAuth } from './AuthContext';
import logger from '../utils/logger';
import {
  isBillingConfigured,
  ensureRevenueCatUser,
  checkNativeProEntitlement,
} from '../utils/revenueCat';

const PremiumContext = createContext(null);
const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

// TEST-ONLY: internal tester allowlist grants Pro without a purchase.
// This is for the internal-testing track only. REMOVE BEFORE PRODUCTION LAUNCH.
const TESTER_ALLOWLIST = [
  'prymedpilot@gmail.com',
  'stroker@stroker.net',
  'tchvez@gmail.com',
  'dizzalina@yahoo.com',
  'cweiler1228@gmail.com',
  'aramirezbh4587@gmail.com',
  'elena.zimareva95@gmail.com',
  'abeinphoenix@yahoo.com',
  'oliverisholson@gmail.com',
  'mbracewell619@gmail.com',
  'yokothepunk@gmail.com',
  'bray10bad@gmail.com',
  'durhangisselle@gmail.com',
  'gracieburch2479@gmail.com',
];

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
    // TEST-ONLY bypass: internal testers get Pro free during testing.
    // REMOVE BEFORE PRODUCTION LAUNCH.
    if (user?.email && TESTER_ALLOWLIST.includes(user.email.toLowerCase())) {
      setIsPro(true);
      setLoading(false);
      return;
    }
    // Native app (Google Play build): RevenueCat entitlement is the source of truth.
    if (isBillingConfigured()) {
      try {
        const ready = await ensureRevenueCatUser(user?.id);
        if (ready) {
          setIsPro(await checkNativeProEntitlement());
          setLoading(false);
          return;
        }
      } catch (err) {
        logger.error('RevenueCat entitlement check failed:', err);
      }
      // fall through to backend check if RevenueCat is unreachable
    }
    // Web (Stripe flow): backend is the source of truth.
    try {
      const res = await axios.get(`${API}/auth/me`, { headers: { Authorization: `Bearer ${token}` }, timeout: 15000 });
      setIsPro(res.data?.is_premium === true);
    } catch (err) {
      logger.error('Premium status check failed:', err);
    } finally {
      setLoading(false);
    }
  }, [token, user?.id]);

  useEffect(() => { refresh(); }, [refresh]);

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
