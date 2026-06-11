"use client"

import { useEffect, useState } from "react"
import { Bell, BellRing, Loader2, Check } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { VAPID_PUBLIC_KEY } from "@/lib/push-public"

function urlBase64ToUint8Array(base64: string) {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/")
  const raw = atob(b64)
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)))
}

async function authHeader() {
  const { data: { session } } = await createClient().auth.getSession()
  return { Authorization: `Bearer ${session?.access_token ?? ""}`, "Content-Type": "application/json" }
}

/** Promesa con timeout para no colgarse esperando al service worker. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Timeout: ${label}`)), ms)),
  ])
}

type State = "idle" | "unsupported" | "subscribed" | "working"

/** Botón para activar notificaciones push en el dispositivo.
 *  - banner: muestra un cartel completo (para el portal cliente) que se oculta
 *    solo una vez activado o si no está soportado.
 *  - prompt: texto contextual mostrado junto al botón. */
export function PushOptIn({ banner = false, prompt }: { banner?: boolean; prompt?: string } = {}) {
  const [state, setState] = useState<State>("idle")
  const [msg,   setMsg]   = useState<string | null>(null)

  useEffect(() => {
    if (typeof window === "undefined") return
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported")
      return
    }
    // ¿Ya está suscripto?
    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => { if (sub) setState("subscribed") })
      .catch(() => {})
  }, [])

  const enable = async () => {
    setState("working"); setMsg(null)
    try {
      // Pedir permiso primero (debe ser dentro del gesto de click)
      const perm = await Notification.requestPermission()
      if (perm !== "granted") {
        setMsg(perm === "denied"
          ? "Permiso bloqueado. Activalo desde Ajustes → Notificaciones."
          : "No se concedió el permiso. Probá de nuevo.")
        setState("idle"); return
      }

      // Esperar al SW con timeout (en iOS recién instalado puede tardar)
      const reg = await withTimeout(navigator.serviceWorker.ready, 12000,
        "el service worker no se activó. Cerrá la app del todo y reabrila.")

      // Reusar suscripción existente o crear una nueva
      let sub = await reg.pushManager.getSubscription()
      if (!sub) {
        sub = await withTimeout(reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        }), 12000, "no se pudo crear la suscripción.")
      }

      const headers = await authHeader()
      const res = await fetch("/api/push/subscribe", {
        method: "POST", headers, body: JSON.stringify({ subscription: sub }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? `Error ${res.status} al registrar`)
      }

      // Push de prueba para confirmar
      await fetch("/api/push/test", { method: "POST", headers })
      setState("subscribed")
      setMsg("¡Listo! Te mandamos una notificación de prueba.")
    } catch (e: any) {
      setMsg(e?.message ?? "Error al activar notificaciones")
      setState("idle")
    }
  }

  if (state === "unsupported") return null

  // En modo banner, una vez activado no mostramos nada (no molestar)
  if (state === "subscribed") {
    if (banner) return null
    return (
      <div className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
        style={{ backgroundColor: "color-mix(in srgb, #22C55E 12%, transparent)", color: "#16A34A" }}>
        <Check size={14} /> Notificaciones activadas
      </div>
    )
  }

  const btn = (
    <button
      onClick={enable} disabled={state === "working"}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition active:scale-95 disabled:opacity-50 shrink-0"
      style={{ backgroundColor: "#ffde21", color: "#000" }}
    >
      {state === "working" ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
      Activar notificaciones
    </button>
  )

  if (banner) {
    return (
      <div className="flex items-center gap-3 rounded-xl border px-4 py-3 mb-4"
        style={{ borderColor: "color-mix(in srgb, #ffde21 35%, var(--border))", backgroundColor: "color-mix(in srgb, #ffde21 8%, transparent)" }}>
        <Bell size={18} className="shrink-0" style={{ color: "#ffde21" }} />
        <div className="flex-1 min-w-0">
          <p className="text-[13px] font-semibold text-foreground">{prompt ?? "Activá las notificaciones"}</p>
          {msg && <p className="text-[11px] mt-0.5" style={{ color: "var(--muted-foreground)" }}>{msg}</p>}
        </div>
        {btn}
      </div>
    )
  }

  return (
    <div className="inline-flex flex-col gap-1">
      {btn}
      {msg && <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{msg}</span>}
    </div>
  )
}
