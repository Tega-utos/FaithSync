self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

// Web Push Event Handler
self.addEventListener('push', (event) => {
  if (!event.data) return;

  try {
    const data = event.data.json();
    const title = data.title || 'FaithSync';
    const options = {
      body: data.body || '',
      icon: data.icon || '/assets/logo.png',
      badge: data.badge || '/assets/logo.png',
      data: {
        url: data.url || (data.data && data.data.url) || '/home',
      },
      vibrate: [100, 50, 100],
      tag: data.tag || undefined,
      renotify: true,
    };

    event.waitUntil(self.registration.showNotification(title, options));
  } catch (err) {
    console.error('Error handling push event in SW:', err);
    const text = event.data.text();
    event.waitUntil(
      self.registration.showNotification('FaithSync', {
        body: text,
        icon: '/assets/logo.png',
        badge: '/assets/logo.png',
        data: { url: '/home' },
      })
    );
  }
});

// Notification Click Handler: Focus existing tab or open destination URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) || '/home';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url && 'focus' in client) {
          if (client.url.includes(targetUrl)) {
            return client.focus();
          }
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
