const CACHE_NAME    = 'gcd-v1'
const STATIC_CACHE  = 'gcd-static-v1'
const API_CACHE     = 'gcd-api-v1'

// Driver API routes worth caching for offline reads
const DRIVER_API_PATTERNS = [
  '/api/shifts',
  '/api/leaves',
]

// ── Install: pre-cache the offline fallback page ────────────────
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.add('/offline.html'))
      .then(() => self.skipWaiting())
  )
})

// ── Activate: remove stale caches from previous versions ────────
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys
          .filter(k => k !== CACHE_NAME && k !== STATIC_CACHE && k !== API_CACHE)
          .map(k => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  )
})

// ── Fetch: routing by request type ──────────────────────────────
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Only handle same-origin or known API origin
  if (!url.origin.includes(self.location.origin.replace(/:\d+$/, ''))
      && !DRIVER_API_PATTERNS.some(p => url.pathname.startsWith(p))) {
    return
  }

  // 1. Next.js static assets (_next/static) — cache-first, immutable
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.open(STATIC_CACHE).then(cache =>
        cache.match(request).then(cached => {
          if (cached) return cached
          return fetch(request).then(res => {
            if (res.ok) cache.put(request, res.clone())
            return res
          })
        })
      )
    )
    return
  }

  // 2. Driver API reads (GET only) — network-first, cache fallback
  if (
    request.method === 'GET' &&
    DRIVER_API_PATTERNS.some(p => url.pathname.startsWith(p))
  ) {
    event.respondWith(
      fetch(request)
        .then(res => {
          if (res.ok) {
            const clone = res.clone()
            caches.open(API_CACHE).then(c => c.put(request, clone))
          }
          return res
        })
        .catch(() =>
          caches.open(API_CACHE).then(c => c.match(request)).then(cached =>
            cached || new Response(JSON.stringify({ error: 'Offline', offline: true }), {
              status:  503,
              headers: { 'Content-Type': 'application/json' },
            })
          )
        )
    )
    return
  }

  // 3. HTML navigation — network-first, offline.html fallback
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.open(CACHE_NAME).then(c => c.match('/offline.html'))
      )
    )
    return
  }
})

// ── Background Sync: replay queued offline actions ───────────────
self.addEventListener('sync', event => {
  if (event.tag === 'gcd-offline-queue') {
    event.waitUntil(replayFromClients())
  }
})

async function replayFromClients() {
  const all = await self.clients.matchAll({ type: 'window' })
  for (const client of all) {
    client.postMessage({ type: 'SW_REPLAY_QUEUE' })
  }
}

// ── Push notifications (existing) ───────────────────────────────
self.addEventListener('push', event => {
  let data = {}
  try { data = event.data?.json() || {} } catch(e) {}

  event.waitUntil(
    self.registration.showNotification(data.title || 'GCD Notice', {
      body:    data.body || '',
      icon:    '/logo.webp',
      badge:   '/logo.webp',
      data:    { url: data.url || '/driver' },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    })
  )
})

self.addEventListener('notificationclick', event => {
  event.notification.close()
  const url = event.notification.data?.url || '/driver'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      const match = list.find(c => c.url.includes(url))
      if (match) return match.focus()
      return clients.openWindow(url)
    })
  )
})
