// Push Notification utilities for HORMOscope
import logger from './logger';

const VAPID_PUBLIC_KEY = process.env.REACT_APP_VAPID_PUBLIC_KEY;
const log = (...args) => logger.log(...args);
const logErr = (...args) => logger.error(...args);

// Convert base64 to Uint8Array for applicationServerKey
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Check if push notifications are supported
export function isPushSupported() {
  return 'serviceWorker' in navigator && 'PushManager' in window;
}

// Check current permission status
export function getNotificationPermission() {
  if (!isPushSupported()) return 'unsupported';
  return Notification.permission; // 'granted', 'denied', or 'default'
}

// Register service worker and subscribe to push
export async function subscribeToPush(token) {
  if (!isPushSupported()) {
    log('Push notifications not supported');
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register('/sw-push.js');
    log('Service Worker registered:', registration);

    await navigator.serviceWorker.ready;

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      log('Notification permission denied');
      return null;
    }

    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY)
    });

    log('Push subscription:', subscription);

    const response = await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/push/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(subscription)
    });

    if (response.ok) {
      log('Subscription saved to server');
      return subscription;
    } else {
      logErr('Failed to save subscription');
      return null;
    }
  } catch (error) {
    logErr('Error subscribing to push:', error);
    return null;
  }
}

// Unsubscribe from push
export async function unsubscribeFromPush(token) {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (subscription) {
      await subscription.unsubscribe();

      await fetch(`${process.env.REACT_APP_BACKEND_URL}/api/push/unsubscribe`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ endpoint: subscription.endpoint })
      });

      log('Unsubscribed from push notifications');
      return true;
    }
    return false;
  } catch (error) {
    logErr('Error unsubscribing:', error);
    return false;
  }
}

// Check if already subscribed
export async function isSubscribed() {
  if (!isPushSupported()) return false;

  try {
    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();
    return !!subscription;
  } catch (error) {
    return false;
  }
}
