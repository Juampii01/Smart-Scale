"use client"

import { useEffect, useRef, useState } from "react"
import { createClient } from "@/lib/supabase"
import { User, Camera, Loader2, Check, Mail, Lock, UserRound, Trash2 } from "lucide-react"

const supabase = createClient()

type SaveState = "idle" | "saving" | "ok" | "error"

function useToken() {
  const getToken = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.access_token ?? null
  }
  return getToken
}

export function ProfileView() {
  const getToken = useToken()

  // Datos
  const [loading, setLoading] = useState(true)
  const [name, setName] = useState("")
  const [originalName, setOriginalName] = useState("")
  const [email, setEmail] = useState("")
  const [originalEmail, setOriginalEmail] = useState("")
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null)

  // Foto
  const fileRef = useRef<HTMLInputElement | null>(null)
  const [photoBusy, setPhotoBusy] = useState(false)
  const [photoMsg, setPhotoMsg] = useState<string | null>(null)

  // Estados de guardado por sección
  const [nameState, setNameState] = useState<SaveState>("idle")
  const [nameMsg, setNameMsg] = useState<string | null>(null)
  const [emailState, setEmailState] = useState<SaveState>("idle")
  const [emailMsg, setEmailMsg] = useState<string | null>(null)

  const [pwCurrent, setPwCurrent] = useState("")
  const [pw1, setPw1] = useState("")
  const [pw2, setPw2] = useState("")
  const [pwState, setPwState] = useState<SaveState>("idle")
  const [pwMsg, setPwMsg] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    ;(async () => {
      const token = await getToken()
      if (!token) { setLoading(false); return }
      const [pRes, aRes] = await Promise.all([
        fetch("/api/profile", { headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/profile/avatar", { headers: { Authorization: `Bearer ${token}` } }),
      ])
      if (!active) return
      if (pRes.ok) {
        const p = await pRes.json()
        setName(p.name ?? "")
        setOriginalName(p.name ?? "")
        setEmail(p.email ?? "")
        setOriginalEmail(p.email ?? "")
      }
      if (aRes.ok) {
        const a = await aRes.json()
        if (a.url) setAvatarUrl(a.url)
      }
      setLoading(false)
    })()
    return () => { active = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ───────── Foto ─────────
  const onPickPhoto = async (file: File) => {
    if (photoBusy) return
    setPhotoBusy(true); setPhotoMsg(null)
    try {
      const token = await getToken()
      if (!token) return
      const fd = new FormData()
      fd.append("file", file)
      const res = await fetch("/api/profile/avatar", { method: "POST", headers: { Authorization: `Bearer ${token}` }, body: fd })
      const data = await res.json()
      if (res.ok && data.url) {
        setAvatarUrl(data.url); setPhotoMsg("Foto actualizada")
        window.dispatchEvent(new CustomEvent("ss:profile-updated", { detail: { avatarUrl: data.url } }))
      }
      else setPhotoMsg(data.error ?? "No se pudo subir la foto")
    } finally { setPhotoBusy(false) }
  }

  const onRemovePhoto = async () => {
    if (photoBusy || !avatarUrl) return
    setPhotoBusy(true); setPhotoMsg(null)
    try {
      const token = await getToken()
      if (!token) return
      const res = await fetch("/api/profile/avatar", { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        setAvatarUrl(null); setPhotoMsg("Foto eliminada")
        window.dispatchEvent(new CustomEvent("ss:profile-updated", { detail: { avatarUrl: null } }))
      }
      else setPhotoMsg("No se pudo eliminar la foto")
    } finally { setPhotoBusy(false) }
  }

  // ───────── Nombre ─────────
  const saveName = async () => {
    setNameState("saving"); setNameMsg(null)
    try {
      const token = await getToken()
      if (!token) { setNameState("error"); setNameMsg("Sesión expirada"); return }
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim() }),
      })
      const data = await res.json()
      if (res.ok) {
        setOriginalName(data.name); setName(data.name); setNameState("ok"); setNameMsg("Nombre guardado")
        window.dispatchEvent(new CustomEvent("ss:profile-updated", { detail: { name: data.name } }))
      }
      else { setNameState("error"); setNameMsg(data.error ?? "No se pudo guardar") }
    } catch { setNameState("error"); setNameMsg("Error de red") }
  }

  // ───────── Email ─────────
  const saveEmail = async () => {
    const clean = email.trim().toLowerCase()
    if (!/^\S+@\S+\.\S+$/.test(clean)) { setEmailState("error"); setEmailMsg("Email inválido"); return }
    setEmailState("saving"); setEmailMsg(null)
    const { error } = await supabase.auth.updateUser({ email: clean })
    if (error) { setEmailState("error"); setEmailMsg(error.message) }
    else {
      setEmailState("ok")
      setEmailMsg("Te enviamos un mail de confirmación a la dirección nueva. El cambio se aplica al confirmarlo.")
    }
  }

  // ───────── Contraseña ─────────
  const savePassword = async () => {
    if (!pwCurrent) { setPwState("error"); setPwMsg("Ingresá tu contraseña actual"); return }
    if (pw1.length < 6) { setPwState("error"); setPwMsg("La nueva debe tener mínimo 6 caracteres"); return }
    if (pw1 !== pw2) { setPwState("error"); setPwMsg("Las contraseñas nuevas no coinciden"); return }
    if (pw1 === pwCurrent) { setPwState("error"); setPwMsg("La nueva contraseña debe ser distinta a la actual"); return }
    setPwState("saving"); setPwMsg(null)

    // Reauth: verificar la contraseña actual antes de cambiarla
    const { error: reauthErr } = await supabase.auth.signInWithPassword({ email: originalEmail, password: pwCurrent })
    if (reauthErr) { setPwState("error"); setPwMsg("La contraseña actual es incorrecta"); return }

    const { error } = await supabase.auth.updateUser({ password: pw1 })
    if (error) { setPwState("error"); setPwMsg(error.message) }
    else { setPwState("ok"); setPwMsg("Contraseña actualizada"); setPwCurrent(""); setPw1(""); setPw2("") }
  }

  const inputCls = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-foreground/40 outline-none focus:border-[#ffde21]/60 transition-colors"
  const labelCls = "block text-[13px] font-medium text-foreground/70 mb-1.5"

  const Btn = ({ onClick, disabled, state, children }: { onClick: () => void; disabled?: boolean; state: SaveState; children: React.ReactNode }) => (
    <button
      onClick={onClick}
      disabled={disabled || state === "saving"}
      className="inline-flex items-center gap-1.5 rounded-lg bg-[#ffde21] px-4 py-2 text-sm font-bold text-black transition hover:bg-[#ffe84d] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {state === "saving" ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : state === "ok" ? <Check className="h-3.5 w-3.5" /> : null}
      {children}
    </button>
  )

  const Msg = ({ state, msg }: { state: SaveState; msg: string | null }) =>
    msg ? (
      <p className={`mt-2 text-[12px] ${state === "error" ? "text-red-600 dark:text-red-400" : "text-emerald-700 dark:text-emerald-400"}`}>{msg}</p>
    ) : null

  if (loading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <div className="flex items-center gap-2 text-foreground/50"><Loader2 className="h-4 w-4 animate-spin" /> Cargando perfil…</div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Editar perfil</h1>
        <p className="text-sm text-foreground/50 mt-1">Actualizá tu foto, nombre, email y contraseña.</p>
      </div>

      {/* Foto */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold text-foreground mb-4">Foto de perfil</h2>
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            title="Cambiar foto"
            className="group relative flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-full border border-[#ffde21]/40 bg-[#ffde21]/10"
          >
            {avatarUrl
              ? <img src={avatarUrl} alt="Perfil" className="h-full w-full object-cover" />
              : <User className="h-8 w-8 text-[#ffde21]" />}
            <span className="absolute inset-0 hidden items-center justify-center bg-black/45 group-hover:flex">
              {photoBusy ? <Loader2 className="h-5 w-5 animate-spin text-white" /> : <Camera className="h-5 w-5 text-white" />}
            </span>
          </button>
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => fileRef.current?.click()}
                disabled={photoBusy}
                className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-foreground/[0.05] transition disabled:opacity-50"
              >
                <Camera className="h-3.5 w-3.5" /> {avatarUrl ? "Cambiar foto" : "Subir foto"}
              </button>
              {avatarUrl && (
                <button
                  onClick={onRemovePhoto}
                  disabled={photoBusy}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-background px-3 py-1.5 text-[13px] font-medium text-red-600 dark:text-red-400 hover:bg-foreground/[0.05] transition disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" /> Quitar
                </button>
              )}
            </div>
            <p className="text-[12px] text-foreground/40">JPG, PNG o WebP. Máximo 2MB.</p>
            {photoMsg && <p className="text-[12px] text-emerald-700 dark:text-emerald-400">{photoMsg}</p>}
          </div>
        </div>
        <input ref={fileRef} type="file" accept="image/*" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickPhoto(f); e.target.value = "" }} />
      </section>

      {/* Nombre */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4"><UserRound className="h-4 w-4 text-[#ffde21]" /> Nombre</h2>
        <label className={labelCls}>Tu nombre</label>
        <input className={inputCls} value={name} onChange={(e) => { setName(e.target.value); setNameState("idle"); setNameMsg(null) }} placeholder="Cómo querés que te llamemos" maxLength={60} />
        <Msg state={nameState} msg={nameMsg} />
        <div className="mt-4">
          <Btn onClick={saveName} state={nameState} disabled={name.trim() === originalName.trim() || name.trim().length < 2}>Guardar nombre</Btn>
        </div>
      </section>

      {/* Email */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4"><Mail className="h-4 w-4 text-[#ffde21]" /> Email</h2>
        <label className={labelCls}>Email de inicio de sesión</label>
        <input className={inputCls} type="email" value={email} onChange={(e) => { setEmail(e.target.value); setEmailState("idle"); setEmailMsg(null) }} placeholder="tu@email.com" />
        <Msg state={emailState} msg={emailMsg} />
        <div className="mt-4">
          <Btn onClick={saveEmail} state={emailState} disabled={email.trim().toLowerCase() === originalEmail.trim().toLowerCase() || !email.trim()}>Cambiar email</Btn>
        </div>
      </section>

      {/* Contraseña */}
      <section className="rounded-2xl border border-border bg-card p-5">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground mb-4"><Lock className="h-4 w-4 text-[#ffde21]" /> Contraseña</h2>
        <div className="space-y-3">
          <div>
            <label className={labelCls}>Contraseña actual</label>
            <input className={inputCls} type="password" value={pwCurrent} autoComplete="current-password" onChange={(e) => { setPwCurrent(e.target.value); setPwState("idle"); setPwMsg(null) }} placeholder="Tu contraseña actual" />
          </div>
          <div>
            <label className={labelCls}>Contraseña nueva</label>
            <input className={inputCls} type="password" value={pw1} autoComplete="new-password" onChange={(e) => { setPw1(e.target.value); setPwState("idle"); setPwMsg(null) }} placeholder="Mínimo 6 caracteres" />
          </div>
          <div>
            <label className={labelCls}>Repetir contraseña</label>
            <input className={inputCls} type="password" value={pw2} autoComplete="new-password" onChange={(e) => { setPw2(e.target.value); setPwState("idle"); setPwMsg(null) }} placeholder="Repetí la contraseña" />
          </div>
        </div>
        <Msg state={pwState} msg={pwMsg} />
        <div className="mt-4">
          <Btn onClick={savePassword} state={pwState} disabled={!pwCurrent || !pw1 || !pw2}>Actualizar contraseña</Btn>
        </div>
      </section>
    </div>
  )
}
