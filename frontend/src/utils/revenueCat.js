// RevenueCat (Google Play Billing) integration for the native Capacitor app.
//
// All credentials come from build-time env vars (REACT_APP_*); nothing is hardcoded.
// On web (non-native platform) every function safely no-ops, so the Stripe
// checkout flow stays in charge of the web version.
//
// TODO for the account owner (none of these can be done without her logins):
//  1. Create a RevenueCat account at https://app.revenuecat.com and add an app.
//  2. In RevenueCat dashboard: connect the Google Play app (upload the service
//     credentials JSON from Play Console), create an Entitlement (suggested id: "pro"),
//     attach the Play subscription products to it, and create an Offering
//     (suggested id: "default") containing the monthly + yearly packages.
//  3. In Google Play Console: create the subscription products
//     (e.g. hormoscope_pro_monthly, hormoscope_pro_yearly) under Monetize > Subscriptions.
//  4. Set build-time env vars (see README):
//       REACT_APP_REVENUECAT_ANDROID_API_KEY  (public key, starts with "goog_")
//       REACT_APP_REVENUECAT_ENTITLEMENT_ID   (default: "pro")
//       REACT_APP_REVENUECAT_OFFERING_ID      (default: "default")
//     Optional package-identifier overrides:
//       REACT_APP_REVENUECAT_YEARLY_PACKAGE_ID / REACT_APP_REVENUECAT_MONTHLY_PACKAGE_ID
//  5. For server-side premium sync: in RevenueCat dashboard > Integrations > Webhooks,
//     add https://<backend-host>/api/webhooks/revenuecat with an Authorization
//     header value, and set the same value as REVENUECAT_WEBHOOK_AUTH on the backend,
//     plus REVENUECAT_SECRET_API_KEY (secret API key from RevenueCat dashboard).

import { Capacitor } from '@capacitor/core';

const ANDROID_API_KEY = process.env.REACT_APP_REVENUECAT_ANDROID_API_KEY || '';
const ENTITLEMENT_ID = process.env.REACT_APP_REVENUECAT_ENTITLEMENT_ID || 'pro';
const OFFERING_ID = process.env.REACT_APP_REVENUECAT_OFFERING_ID || 'default';
const YEARLY_PACKAGE_ID = process.env.REACT_APP_REVENUECAT_YEARLY_PACKAGE_ID || '';
const MONTHLY_PACKAGE_ID = process.env.REACT_APP_REVENUECAT_MONTHLY_PACKAGE_ID || '';

export const isNativeApp = () => {
  try {
    return Capacitor.isNativePlatform();
  } catch {
    return false;
  }
};

export const isBillingConfigured = () => isNativeApp() && ANDROID_API_KEY.length > 0;

let Purchases = null;
let configuredWithUserId = null;

async function loadPurchases() {
  if (Purchases) return Purchases;
  if (!isNativeApp()) return null;
  try {
    // Dynamic import keeps the web bundle free of the native plugin.
    const mod = await import('@revenuecat/purchases-capacitor');
    Purchases = mod.Purchases;
    return Purchases;
  } catch {
    return null;
  }
}

// Configure RevenueCat once and attach it to our backend user id so purchases
// follow the user across devices. Safe to call repeatedly.
export async function ensureRevenueCatUser(appUserId) {
  if (!isBillingConfigured()) return false;
  const P = await loadPurchases();
  if (!P) return false;
  try {
    if (configuredWithUserId === null) {
      await P.configure({ apiKey: ANDROID_API_KEY, appUserID: appUserId || undefined });
      configuredWithUserId = appUserId || null;
    } else if (appUserId && configuredWithUserId !== appUserId) {
      await P.logIn({ appUserID: appUserId });
      configuredWithUserId = appUserId;
    }
    return true;
  } catch {
    return false;
  }
}

export async function revenueCatLogOut() {
  if (!isBillingConfigured() || configuredWithUserId === null) return;
  try {
    await Purchases.logOut();
  } catch {
    // non-fatal
  }
  configuredWithUserId = null;
}

// Packages from the configured offering (prices come from the Play Store, localized).
export async function getPackages() {
  if (!isBillingConfigured()) return [];
  const P = await loadPurchases();
  if (!P) return [];
  try {
    const offerings = await P.getOfferings();
    const current = offerings?.current;
    const all = offerings?.all;
    const offering = (OFFERING_ID && OFFERING_ID !== 'default' && all)
      ? (all[OFFERING_ID] || current)
      : current;
    return offering?.availablePackages || [];
  } catch {
    return [];
  }
}

// Map the UI plan ('yearly' | 'monthly') to a RevenueCat package.
export function findPackageForPlan(packages, plan) {
  if (!packages || packages.length === 0) return null;
  const overrideId = plan === 'yearly' ? YEARLY_PACKAGE_ID : MONTHLY_PACKAGE_ID;
  if (overrideId) {
    const byId = packages.find((p) => p.identifier === overrideId);
    if (byId) return byId;
  }
  const wantType = plan === 'yearly' ? 'ANNUAL' : 'MONTHLY';
  const byType = packages.find((p) => (p.packageType || '').toUpperCase() === wantType);
  if (byType) return byType;
  // Last resort: single-package offering
  return packages.length === 1 ? packages[0] : null;
}

// Returns { cancelled: bool, isPro: bool, error?: string }
export async function purchasePlan(packages, plan) {
  const pkg = findPackageForPlan(packages, plan);
  if (!pkg) return { cancelled: false, isPro: false, error: 'no_package' };
  const P = await loadPurchases();
  if (!P) return { cancelled: false, isPro: false, error: 'unavailable' };
  try {
    const { customerInfo } = await P.purchasePackage({ aPackage: pkg });
    return { cancelled: false, isPro: hasProEntitlement(customerInfo) };
  } catch (err) {
    if (err && err.userCancelled) return { cancelled: true, isPro: false };
    return { cancelled: false, isPro: false, error: (err && err.message) || 'purchase_failed' };
  }
}

// Returns { isPro: bool }
export async function restorePurchases() {
  if (!isBillingConfigured()) return { isPro: false };
  const P = await loadPurchases();
  if (!P) return { isPro: false };
  try {
    const { customerInfo } = await P.restorePurchases();
    return { isPro: hasProEntitlement(customerInfo) };
  } catch {
    return { isPro: false };
  }
}

export function hasProEntitlement(customerInfo) {
  try {
    return Boolean(customerInfo?.entitlements?.active?.[ENTITLEMENT_ID]);
  } catch {
    return false;
  }
}

// Source of truth for "is this device entitled to Pro" on native.
export async function checkNativeProEntitlement() {
  if (!isBillingConfigured()) return false;
  const P = await loadPurchases();
  if (!P || configuredWithUserId === null) return false;
  try {
    const { customerInfo } = await P.getCustomerInfo();
    return hasProEntitlement(customerInfo);
  } catch {
    return false;
  }
}
