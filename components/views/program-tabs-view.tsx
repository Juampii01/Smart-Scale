"use client"

/**
 * Wrapper de la página /program-checklist.
 *
 * 3 tabs:
 *   - Programa    → checklist genérica de los 6 meses (hardcoded)
 *   - Documentos  → multi-page tipo Notion por cliente (4 docs auto-seeded)
 *   - Playbook    → un solo documento por cliente, admin-only edita texto
 */

import { useEffect, useState } from "react"
import { ListChecks, FileText, BookOpen } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { ProgramChecklistView } from "./program-checklist-view"
import { ClientPlaybookView } from "./client-playbook-view"
import { ClientPlaybookMainView } from "./client-playbook-main-view"

type Tab = "programa" | "documentos" | "playbook"

const TABS: Array<{ id: Tab; label: string; icon: any }> = [
  { id: "programa",   label: "Programa",   icon: ListChecks },
  { id: "documentos", label: "Documentos", icon: FileText   },
  { id: "playbook",   label: "Playbook",   icon: BookOpen   },
]

export function ProgramTabsView() {
  const [tab, setTab] = useState<Tab>("programa")
  const [userRole, setUserRole] = useState<string | null>(null)

  // Restaurar tab desde localStorage
  useEffect(() => {
    if (typeof window === "undefined") return
    const stored = window.localStorage.getItem("programTab")
    if (stored === "programa" || stored === "documentos" || stored === "playbook") {
      setTab(stored)
    }
  }, [])

  // Persistir tab
  useEffect(() => {
    if (typeof window === "undefined") return
    window.localStorage.setItem("programTab", tab)
  }, [tab])

  // Cargar rol del usuario una vez
  useEffect(() => {
    let mounted = true
    const sb = createClient()
    ;(async () => {
      const { data: { user } } = await sb.auth.getUser()
      if (!user) return
      const { data: profile } = await sb
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle()
      if (mounted) setUserRole((profile as any)?.role ?? null)
    })()
    return () => { mounted = false }
  }, [])

  return (
    <div className="space-y-5">
      {/* Tabs nav */}
      <div className="flex items-center gap-1 border-b border-foreground/[0.08]">
        {TABS.map(t => {
          const Icon = t.icon
          const active = tab === t.id
          return (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={`relative inline-flex items-center gap-1.5 px-3 py-2 text-[13px] font-semibold transition-colors -mb-px ${
                active
                  ? "text-foreground"
                  : "text-foreground/45 hover:text-foreground/70"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
              {active && (
                <span className="absolute bottom-0 left-2 right-2 h-0.5 bg-[#dafc69] rounded-full" />
              )}
            </button>
          )
        })}
      </div>

      {/* Contenido */}
      {tab === "programa"   && <ProgramChecklistView />}
      {tab === "documentos" && <ClientPlaybookView userRole={userRole} />}
      {tab === "playbook"   && <ClientPlaybookMainView userRole={userRole} />}
    </div>
  )
}
