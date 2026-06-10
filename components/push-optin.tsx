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

type State = "idle" | "unsupported" | "subscribed" | "working"

/** Botón para activar notificaciones push en el dispositivo. */
export function PushOptIn() {
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
      const perm = await Notification.requestPermission()
      if (perm !== "granted") { setMsg("Permiso denegado. Activalo desde los ajustes del navegador."); setState("idle"); return }

      const reg = await navigator.serviceWorker.ready
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
      })

      const headers = await authHeader()
      const res = await fetch("/api/push/subscribe", {
        method: "POST", headers, body: JSON.stringify({ subscription: sub }),
      })
      if (!res.ok) throw new Error("No se pudo registrar la suscripción")

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

  if (state === "subscribed") {
    return (
      <div className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold"
        style={{ backgroundColor: "color-mix(in srgb, #22C55E 12%, transparent)", color: "#16A34A" }}>
        <Check size={14} /> Notificaciones activadas
      </div>
    )
  }

  return (
    <div className="inline-flex flex-col gap-1">
      <button
        onClick={enable} disabled={state === "working"}
        className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs font-bold transition active:scale-95 disabled:opacity-50"
        style={{ backgroundColor: "#ffde21", color: "#000" }}
      >
        {state === "working" ? <Loader2 size={14} className="animate-spin" /> : <BellRing size={14} />}
        Activar notificaciones
      </button>
      {msg && <span className="text-[11px]" style={{ color: "var(--muted-foreground)" }}>{msg}</span>}
    </div>
  )
}
