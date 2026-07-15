"use client"

import { useEffect, useState } from "react"
import { AnimatePresence, motion } from "motion/react"
import { Sparkles, Bell, FileText, Image as ImageIcon, LayoutDashboard, Rocket, X } from "lucide-react"

const SEEN_KEY = "ss_whatsnew_v3"

const NEWS = [
  { icon: Bell,            title: "Notificaciones al celular", desc: "Instalá la app y enterate de tus llamadas y recordatorios al instante." },
  { icon: Sparkles,        title: "Ann AI",                    desc: "Tu asistente de negocio: cruza la metodología de Ann con tus números." },
  { icon: FileText,        title: "Llenar reporte, más simple", desc: "Monday Win, Cha-Ching y Reporte Mensual, todo desde un solo lugar." },
  { icon: ImageIcon,       title: "Tu foto de perfil",          desc: "Subí tu imagen y personalizá tu cuenta." },
  { icon: LayoutDashboard, title: "Nuevo diseño",               desc: "Más ordenado, más rápido y pensado también para el celular." },
]

export function WhatsNew3() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (typeof window === "undefined") return
    try {
      if (!localStorage.getItem(SEEN_KEY)) setOpen(true)
    } catch {}
  }, [])

  const close = () => {
    try { localStorage.setItem(SEEN_KEY, "1") } catch {}
    setOpen(false)
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center p-4"
          style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) close() }}
        >
          <motion.div
            className="w-full max-w-md overflow-hidden rounded-2xl shadow-2xl"
            style={{ backgroundColor: "var(--card)", border: "1px solid var(--border)" }}
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 260, damping: 26 }}
          >
            {/* Header */}
            <div className="relative px-6 pt-7 pb-5 text-center" style={{ background: "linear-gradient(135deg, rgba(255,222,33,0.18), transparent 70%)" }}>
              <button onClick={close} className="absolute right-3 top-3 p-1 rounded-lg hover:opacity-70" aria-label="Cerrar">
                <X className="h-4 w-4" style={{ color: "var(--muted-foreground)" }} />
              </button>
              <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[#dafc69] shadow-[0_0_28px_rgba(255,222,33,0.4)]">
                <Rocket className="h-6 w-6 text-black" />
              </div>
              <h2 className="text-xl font-extrabold tracking-tight text-foreground">Llegó Smart Scale 3.0</h2>
              <p className="text-[13px] text-foreground/50 mt-1">Esto es lo nuevo que tenemos para vos</p>
            </div>

            {/* Lista de novedades */}
            <div className="px-5 py-4 space-y-3">
              {NEWS.map((n, i) => {
                const Icon = n.icon
                return (
                  <div key={i} className="flex items-start gap-3">
                    <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg" style={{ backgroundColor: "color-mix(in srgb, #dafc69 14%, transparent)" }}>
                      <Icon className="h-4 w-4 text-[#dafc69]" />
                    </span>
                    <div>
                      <p className="text-[13.5px] font-semibold text-foreground leading-tight">{n.title}</p>
                      <p className="text-[12px] text-foreground/50 mt-0.5 leading-snug">{n.desc}</p>
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-1">
              <button
                onClick={close}
                className="w-full rounded-xl bg-[#dafc69] py-2.5 text-sm font-bold text-black transition hover:bg-[#f2ffc0] active:scale-[0.98]"
              >
                ¡Vamos! 🚀
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
