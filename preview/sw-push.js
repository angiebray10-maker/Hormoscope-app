// Service Worker for Push Notifications - horMoscope Ai

self.addEventListener('push', function(event) {
  console.log('[Service Worker] Push Received.');
  
  let data = {
    title: 'horMoscope Ai',
    body: 'Check in with your cycle today!',
    icon: '/logo192.png',
    badge: '/logo192.png',
    url: '/'
  };
  
  try {
    if (event.data) {
      data = event.data.json();
    }
  } catch (e) {
    console.log('[Service Worker] Error parsing push data:', e);
  }
  
  const options = {
    body: data.body,
    icon: data.icon || '/logo192.png',
    badge: data.badge || '/logo192.png',
    vibrate: [100, 50, 100],
    data: {
      url: data.url || '/',
      dateOfArrival: Date.now()
    },
    actions: [
      {
        action: 'open',
        title: 'Open App'
      },
      {
        action: 'close',
        title: 'Dismiss'
      }
    ],
    tag: 'hormoscope-daily',
    renotify: true
  };
  
  event.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', function(event) {
  console.log('[Service Worker] Notification click received.');
  
  event.notification.close();
  
  if (event.action === 'close') {
    return;
  }
  
  // Open the app
  const urlToOpen = event.notification.data?.url || '/';
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then(function(clientList) {
        // Check if app is already open
        for (let i = 0; i < clientList.length; i++) {
          const client = clientList[i];
          if (client.url.includes(self.location.origin) && 'focus' in client) {
            client.navigate(urlToOpen);
            return client.focus();
          }
        }
        // Open new window if app not open
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});

self.addEventListener('install', function(event) {
  console.log('[Service Worker] Installing push service worker...');
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  console.log('[Service Worker] Push service worker activated.');
  event.waitUntil(clients.claim());
});
