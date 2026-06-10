// Service Worker de Smart Scale (PWA)
// Estrategia conservadora: network-first para navegación (siempre datos frescos),
// con fallback a caché solo si no hay red. No cachea respuestas de /api ni de Supabase.

const CACHE = "smartscale-v1"
const OFFLINE_ASSETS = ["/smartscale-icon-192.png", "/smartscale-icon-512.png"]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(OFFLINE_ASSETS)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    )
  )
  self.clients.claim()
})

self.addEventListener("fetch", (event) => {
  const { request } = event
  // Solo GET; nunca interceptar API ni auth
  if (request.method !== "GET") return
  const url = new URL(request.url)
  if (url.pathname.startsWith("/api") || url.hostname.includes("supabase")) return

  // Network-first con fallback a caché (para que la app abra sin red)
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok && request.url.startsWith(self.location.origin)) {
          const copy = res.clone()
          caches.open(CACHE).then((c) => c.put(request, copy))
        }
        return res
      })
      .catch(() => caches.match(request).then((cached) => cached || caches.match("/dashboard")))
  )
})
