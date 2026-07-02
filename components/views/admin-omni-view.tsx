"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Sparkles, MessageCircle, FileText, Megaphone, DollarSign, Cog } from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase"

// Piloto interno — solo el dueño del proyecto, ni el resto de los admins (Ann incluida).
const OMNI_OWNER_EMAIL = "juampiacosta158@gmail.com"

// Módulos de Omni. El piloto arranca con el Agente de Conversaciones (DMs de Ann);
// el resto son la expansión natural, mismo molde apuntado a otra fuente.
const MODULES = [
  {
    key:    "conversaciones",
    name:   "Agente de Conversaciones",
    desc:   "Analiza los DMs de Ann: encuentra los mejores leads, qué los convierte y cuáles se enfrían.",
    icon:   MessageCircle,
    status: "piloto" as const,
  },
  {
    key:    "contenido",
    name:   "Contenido",
    desc:   "Qué posts y reels traen DMs que después cierran — no solo likes.",
    icon:   FileText,
    status: "proximamente" as const,
  },
  {
    key:    "ads",
    name:   "Ads",
    desc:   "Qué anuncio trae prospectos que cierran vs. curiosos, y caídas de calidad.",
    icon:   Megaphone,
    status: "proximamente" as const,
  },
  {
    key:    "revenue",
    name:   "Revenue",
    desc:   "Dónde se cae la plata en el funnel; cash cobrado y proyección.",
    icon:   DollarSign,
    status: "proximamente" as const,
  },
  {
    key:    "operaciones",
    name:   "Operaciones",
    desc:   "Responde SOPs y procesos del negocio al instante.",
    icon:   Cog,
    status: "proximamente" as const,
  },
]

const DATA_SOURCES = ["Instagram DMs", "Instagram contenido", "Meta Ads", "CRM", "Slack"]

export function AdminOmniView() {
  const router = useRouter()
  const [allowed, setAllowed] = useState<boolean | null>(null) // null = verificando

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then((res: Awaited<ReturnType<typeof supabase.auth.getUser>>) => {
      const email = res.data?.user?.email?.toLowerCase() ?? null
      if (email === OMNI_OWNER_EMAIL) {
        setAllowed(true)
      } else {
        setAllowed(false)
        router.replace("/admin/executive-dashboard")
      }
    })
  }, [router])

  if (!allowed) return null

  return (
    <div className="space-y-8">

      {/* Hero */}
      <div>
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl border border-[#ffde21]/25 bg-[#ffde21]/[0.12]">
            <Sparkles className="h-5 w-5 text-[#ffde21]" />
          </span>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">Omni</h1>
            <p className="text-sm text-foreground/40">Sistema operativo de IA · Piloto con Ann</p>
          </div>
        </div>
        <p className="mt-4 max-w-2xl text-sm leading-relaxed text-foreground/60">
          El sector donde vive el sistema de IA de Ann. Mira el negocio todos los días,
          encuentra los mejores leads y dónde se escapa la plata — empezando por donde
          Ann cierra: los DMs.
        </p>
      </div>

      {/* Módulos */}
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/35">Módulos</p>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {MODULES.map(m => {
            const isPiloto = m.status === "piloto"
            return (
              <div
                key={m.key}
                className={cn(
                  "rounded-2xl border p-4",
                  isPiloto ? "border-[#ffde21]/25 bg-[#ffde21]/[0.04]" : "border-foreground/[0.07] bg-card",
                )}
              >
                <div className="flex items-center justify-between">
                  <span className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg",
                    isPiloto ? "bg-[#ffde21]/[0.12] text-[#ffde21]" : "bg-foreground/[0.05] text-foreground/40",
                  )}>
                    <m.icon className="h-4 w-4" />
                  </span>
                  <span className={cn(
                    "rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider",
                    isPiloto ? "bg-[#ffde21]/[0.12] text-[#ffde21]" : "bg-foreground/[0.05] text-foreground/40",
                  )}>
                    {isPiloto ? "Piloto" : "Próximamente"}
                  </span>
                </div>
                <h3 className="mt-3 text-[14px] font-semibold text-foreground">{m.name}</h3>
                <p className="mt-1 text-[12.5px] leading-relaxed text-foreground/55">{m.desc}</p>
              </div>
            )
          })}
        </div>
      </div>

      {/* Fuentes de datos */}
      <div>
        <p className="mb-3 text-[11px] font-bold uppercase tracking-[0.12em] text-foreground/35">Fuentes de datos</p>
        <div className="flex flex-wrap gap-2">
          {DATA_SOURCES.map(s => (
            <span
              key={s}
              className="inline-flex items-center gap-1.5 rounded-lg border border-foreground/[0.08] bg-foreground/[0.02] px-3 py-1.5 text-[12px] text-foreground/50"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/25" />
              {s}
            </span>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-foreground/35">
          Conexiones por configurar — el piloto arranca con los DMs de Instagram.
        </p>
      </div>

    </div>
  )
}
