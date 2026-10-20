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

// Journal Companion is a SEPARATE product from Pro (Angelita, Oct 19, 2026):
// its own entitlement and its own offering. Pro state never unlocks it.
const COMPANION_ENTITLEMENT_ID = process.env.REACT_APP_REVENUECAT_COMPANION_ENTITLEMENT_ID || 'journal_companion';
const COMPANION_OFFERING_ID = process.env.REACT_APP_REVENUECAT_COMPANION_OFFERING_ID || 'journal_companion';
export const COMPANION_ENTITLEMENT = COMPANION_ENTITLEMENT_ID;

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

// The native billing plugin can hang indefinitely when Google Play services
// are unavailable (Angelita hit a stuck Restore and a never-loading price on
// Oct 20, 2026). Every billing call is raced against a timeout so the UI
// always settles with an answer she can act on or show me.
function withTimeout(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out`)), ms)),
  ]);
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

// ---------- Journal Companion (separate from Pro) ----------

export function companionEntitlementInfo(customerInfo) {
  try {
    const ent = customerInfo?.entitlements?.active?.[COMPANION_ENTITLEMENT_ID];
    if (!ent) return { active: false, willRenew: false, expiresDate: null };
    return {
      active: true,
      willRenew: ent.willRenew !== false,
      expiresDate: ent.expirationDate || null,
    };
  } catch {
    return { active: false, willRenew: false, expiresDate: null };
  }
}

export function hasCompanionEntitlement(customerInfo) {
  return companionEntitlementInfo(customerInfo).active;
}

function companionPeriodText(pkg) {
  const period = (pkg?.product?.subscriptionPeriod || '').toUpperCase();
  if (period.includes('Y')) return '/year';
  if (period.includes('W')) return '/week';
  return '/month';
}

// The monthly package from the dedicated journal_companion offering (never
// the current/default offering), with the real Google Play price attached.
// Always resolves to a detailed result: { pkg, priceString, periodText,
// error }. When pkg is null, error carries the real reason so the purchase
// screen can show it and offer a retry instead of a dead disabled button.
export async function getCompanionPackage(appUserId) {
  const fail = (error) => ({ pkg: null, priceString: '', periodText: '/month', error });
  if (!isBillingConfigured()) return fail('Purchases are available in the Android app.');
  // Configure before fetching offerings: on a cold screen this used to race
  // the context-level configure and come back empty.
  if (appUserId) await ensureRevenueCatUser(appUserId);
  const P = await loadPurchases();
  if (!P) return fail('Purchases are not available on this device.');
  try {
    const offerings = await withTimeout(P.getOfferings(), 25000, 'Loading the subscription');
    const offering = offerings?.all?.[COMPANION_OFFERING_ID] || null;
    if (!offering) return fail('The Journal Companion offering could not be found in Google Play yet.');
    const pkgs = offering.availablePackages || [];
    const monthly = pkgs.find((p) => (p.packageType || '').toUpperCase() === 'MONTHLY')
      || pkgs.find((p) => p.identifier === '$rc_monthly')
      || pkgs[0];
    if (!monthly) return fail('The Journal Companion plan is not available in Google Play yet.');
    return {
      pkg: monthly,
      priceString: monthly.product?.priceString || '',
      periodText: companionPeriodText(monthly),
      error: null,
    };
  } catch (err) {
    return fail((err && err.message) || 'The subscription could not be loaded from Google Play.');
  }
}

// Returns { status: 'active' | 'pending' | 'cancelled' | 'error', info?, message? }
// 'pending' covers Google Play deferred/pending payments: the purchase went
// through but the entitlement is not active until Google completes it.
export async function purchaseCompanion(appUserId) {
  const found = await getCompanionPackage(appUserId);
  if (!found || !found.pkg) return { status: 'error', message: (found && found.error) || 'The subscription is not available right now.' };
  const P = await loadPurchases();
  if (!P) return { status: 'error', message: 'Purchases are not available on this device.' };
  try {
    const { customerInfo } = await withTimeout(P.purchasePackage({ aPackage: found.pkg }), 300000, 'The purchase');
    const info = companionEntitlementInfo(customerInfo);
    if (info.active) return { status: 'active', info };
    return { status: 'pending' };
  } catch (err) {
    if (err && err.userCancelled) return { status: 'cancelled' };
    const text = `${(err && err.code) || ''} ${(err && err.message) || ''}`.toLowerCase();
    if (text.includes('pending')) return { status: 'pending' };
    if (text.includes('timed out')) return { status: 'error', message: 'The purchase did not finish. If Google Play completed it, tap Restore Purchases below.' };
    return { status: 'error', message: (err && err.message) || 'Purchase could not be completed.' };
  }
}

// Returns { status: 'active' | 'none' | 'error', info?, message? }
export async function restoreCompanion() {
  if (!isBillingConfigured()) return { status: 'error', message: 'Purchases are not available on this device.' };
  const P = await loadPurchases();
  if (!P) return { status: 'error', message: 'Purchases are not available on this device.' };
  try {
    const { customerInfo } = await withTimeout(P.restorePurchases(), 30000, 'Restore');
    const info = companionEntitlementInfo(customerInfo);
    return info.active ? { status: 'active', info } : { status: 'none' };
  } catch (err) {
    const timedOut = err && /timed out/.test(err.message || '');
    return { status: 'error', message: timedOut ? 'Restore is taking too long. Check your connection and try again.' : ((err && err.message) || 'Restore could not be completed.') };
  }
}

export async function checkNativeCompanionEntitlement() {
  if (!isBillingConfigured()) return { active: false, willRenew: false, expiresDate: null };
  const P = await loadPurchases();
  if (!P || configuredWithUserId === null) return { active: false, willRenew: false, expiresDate: null };
  try {
    const { customerInfo } = await P.getCustomerInfo();
    return companionEntitlementInfo(customerInfo);
  } catch {
    return { active: false, willRenew: false, expiresDate: null };
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
