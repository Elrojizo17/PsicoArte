const CACHE_NAME = 'psicoarte-shell-v3'
const APP_SHELL = ['/', '/index.html', '/manifest.webmanifest', '/logo.png']

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)),
    )).then(() => self.clients.claim()),
  )
})

self.addEventListener('push', (event) => {
  let payload = {}

  if (event.data) {
    try {
      payload = event.data.json()
    } catch {
      payload = { body: event.data.text() }
    }
  }

  const title = payload.title || 'PsicoArte'
  const options = {
    body: payload.body || '',
    icon: payload.icon || '/logo.png',
    tag: payload.tag,
    data: { url: payload.url || '/' },
  }

  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const targetUrl = new URL(event.notification.data?.url || '/', self.location.origin)
  if (targetUrl.origin !== self.location.origin) {
    targetUrl.href = self.location.origin
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(async (clients) => {
      const openClient = clients.find((client) => new URL(client.url).origin === self.location.origin)
      if (openClient) {
        if ('navigate' in openClient) await openClient.navigate(targetUrl.href)
        return openClient.focus()
      }
      return self.clients.openWindow(targetUrl.href)
    }),
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return

  const url = new URL(event.request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname === '/api' || url.pathname.startsWith('/api/')) return
  if (event.request.headers.has('Authorization')) return

  event.respondWith(
    caches.match(event.request).then((cached) => {
      if (cached) return cached

      return fetch(event.request)
        .then((response) => {
          const clonedResponse = response.clone()
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clonedResponse))
          return response
        })
        .catch(() => caches.match('/index.html'))
    }),
  )
})
