// errornote service worker — offline mode + push notifications.
//
// Cache strategy:
//   - Static assets (/_next/static, /fonts, /images, /icons, /sounds): cache-first
//   - HTML navigations: network-first → /offline.html (NEVER cache personalized HTML)
//   - Manifest, root document, icons: precached on install
//   - API/auth: NEVER cached. Failed POSTs are queued client-side via
//     lib/offline-queue (IndexedDB) and replayed when navigator.onLine is
//     true again. Caching API GETs caused stale fossilization counts.
//
// Bumping VERSION invalidates older caches on activate.
// v3: 인증된(개인화) HTML 내비게이션을 더 이상 캐시하지 않는다. 이전엔 공용 static 캐시에
//     각 사용자 페이지를 써서 오프라인 시 다른 사용자의 페이지가 보일 수 있었고, 매 이동마다
//     불필요한 Cache 쓰기가 발생했다.

const VERSION = 'v3'
const STATIC_CACHE = `errornote-static-${VERSION}`
const ALL_CACHES = [STATIC_CACHE]

const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/manifest.json',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/apple-touch-icon.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) =>
      // addAll is atomic — if any URL 404s the install fails. Use individual
      // adds so a missing optional asset doesn't break SW install entirely.
      Promise.all(
        PRECACHE_URLS.map((url) =>
          cache.add(url).catch((err) => {
            console.warn('[sw] precache miss:', url, err)
          })
        )
      )
    )
  )
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => !ALL_CACHES.includes(k)).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return

  // Never intercept API or auth routes — let the client see real network
  // failures so lib/offline-queue can stash POSTs into IndexedDB.
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/auth/')) {
    return
  }

  // Cache-first for versioned static assets.
  if (
    url.pathname.startsWith('/_next/static/') ||
    url.pathname.startsWith('/fonts/') ||
    url.pathname.startsWith('/images/') ||
    url.pathname.startsWith('/icons/') ||
    url.pathname.startsWith('/sounds/')
  ) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (res.ok && res.type === 'basic') {
              const copy = res.clone()
              caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
            }
            return res
          })
      )
    )
    return
  }

  // Network-only for HTML navigations; fall back to /offline.html when down.
  // 개인화 페이지라 캐시에 저장하지 않는다(다른 사용자 페이지 노출·불필요한 쓰기 방지).
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match('/offline.html').then((r) => r || Response.error())
      )
    )
    return
  }

  // Default: cache-first with network fallback.
  event.respondWith(
    caches.match(request).then(
      (cached) =>
        cached ||
        fetch(request).then((res) => {
          if (res.ok && res.type === 'basic') {
            const copy = res.clone()
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, copy))
          }
          return res
        })
    )
  )
})

// Background Sync — opportunistic when supported (Chrome/Edge/Android).
// iOS Safari does not implement Background Sync; iOS relies on the client-side
// online listener in components/OfflineQueueFlusher.tsx instead. This handler
// is purely a best-effort booster and never the primary mechanism.
self.addEventListener('sync', (event) => {
  if (event.tag !== 'errornote-offline-flush') return
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        client.postMessage({ type: 'errornote/flush-offline-queue' })
      }
    })
  )
})

// Web Push handler — payload format: { title, body, url }
self.addEventListener('push', (event) => {
  if (!event.data) return
  let payload = {}
  try {
    payload = event.data.json()
  } catch {
    payload = { title: 'errornote', body: event.data.text() }
  }
  const { title = 'errornote', body = '', url = '/' } = payload
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url },
    })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = event.notification.data?.url || '/'
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(target))
      if (existing) return existing.focus()
      return self.clients.openWindow(target)
    })
  )
})
