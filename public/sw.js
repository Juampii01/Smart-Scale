// Service Worker de Smart Scale (PWA)
// Estrategia conservadora: network-first para navegación (siempre datos frescos),
// con fallback a caché solo si no hay red. No cachea respuestas de /api ni de Supabase.

const CACHE = "smartscale-v3"
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
      .catch(async () => {
        const cached = (await caches.match(request)) || (await caches.match("/dashboard"))
        if (cached) return cached

        // Nada cacheado (primera visita a esta URL) + falla de red — antes
        // esto resolvía en `undefined` y el navegador mostraba su propio
        // error nativo ("no se pudo cargar la página") sin ninguna forma de
        // recuperarse. La mayoría de estas fallas en mobile son un blip
        // momentáneo de la red, así que reintentamos una vez tras una
        // pequeña espera antes de rendirnos.
        await new Promise((resolve) => setTimeout(resolve, 800))
        try {
          return await fetch(request)
        } catch {
          return new Response(
            "Sin conexión por un momento. Recargá la página para reintentar.",
            { status: 503, headers: { "Content-Type": "text/plain; charset=utf-8" } }
          )
        }
      })
  )
})

// ─── Web Push ───────────────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  let data = {}
  try { data = event.data ? event.data.json() : {} } catch (e) { data = {} }
  const title = data.title || "Smart Scale"
  const options = {
    body: data.body || "",
    icon: "/smartscale-icon-192.png",
    badge: "/smartscale-icon-192.png",
    data: { url: data.url || "/" },
    vibrate: [80, 40, 80],
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const target = (event.notification.data && event.notification.data.url) || "/"
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      // Si ya hay una ventana abierta, enfocarla y navegar
      for (const client of clientList) {
        if ("focus" in client) { client.focus(); if ("navigate" in client) client.navigate(target); return }
      }
      if (self.clients.openWindow) return self.clients.openWindow(target)
    })
  )
})
