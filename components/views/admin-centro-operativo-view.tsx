"use client"

import { useEffect, useState } from "react"
import { UserPlus, NotebookText, ListChecks, Layers, Target } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { isAdmin } from "@/lib/auth/permissions"
import { useEffectiveRole, useIsOwnSectorInternal } from "@/lib/auth/view-as"
import { NewUserDialog } from "@/components/admin/new-user-dialog"
import { CentroOpPagesView } from "@/components/views/centro-op-pages-view"
import { AdminSOPsView } from "@/components/views/admin-sops-view"
import { AdminProspeccionView } from "@/components/views/admin-prospeccion-view"
import { SectionHeader } from "@/components/ui/section-header"

// ─── Tabs ──────────────────────────────────────────────────────────────────────

type CentroOpTab = "notion" | "sops" | "prospeccion"

const ANN_ONLY_TABS: Array<{ id: CentroOpTab; label: string; icon: any }> = [
  { id: "notion", label: "Notion", icon: NotebookText },
  { id: "sops",   label: "SOPs",   icon: ListChecks   },
]
const PROSPECCION_TAB: { id: CentroOpTab; label: string; icon: any } =
  { id: "prospeccion", label: "Prospección", icon: Target }

// ─── Main View ─────────────────────────────────────────────────────────────────

export function AdminCentroOperativoView() {
  const [userRole, setUserRole] = useState<string | null>(null)
  const [newUserOpen, setNewUserOpen] = useState(false)
  const [tab, setTab] = useState<CentroOpTab>("notion")

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return
      supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
        .then(({ data: prof }) => setUserRole((prof as any)?.role ?? null))
    })
  }, [])

  // Si admin está en modo "view as", el contenido se filtra como ese rol
  const effectiveRole = useEffectiveRole(userRole)

  // Notion/SOPs son contenido de Ann — el sector interno de un cliente
  // (no Smart Scale) solo ve el tab de Prospección.
  const { isOwnSectorInternal } = useIsOwnSectorInternal()
  const CENTRO_OP_TABS = isOwnSectorInternal ? [...ANN_ONLY_TABS, PROSPECCION_TAB] : [PROSPECCION_TAB]

  useEffect(() => {
    if (!isOwnSectorInternal && tab !== "prospeccion") setTab("prospeccion")
  }, [isOwnSectorInternal, tab])

  return (
    <div className="space-y-4">
      {/* Header */}
      <SectionHeader
        icon={Layers}
        title="Centro Operativo"
        subtitle="Wiki interno tipo Notion. Páginas anidables con bloques, listas, código, checklists."
        action={
          isAdmin(effectiveRole) && (
            <button
              onClick={() => setNewUserOpen(true)}
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#dafc69] px-4 py-2 text-sm font-bold text-black hover:bg-[#f2ffc0] transition-colors"
              title="Crear cuenta de usuario interna"
            >
              <UserPlus className="h-4 w-4" />
              Nuevo usuario
            </button>
          )
        }
      />

      <NewUserDialog open={newUserOpen} onClose={() => setNewUserOpen(false)} />

      {/* Tabs nav */}
      <div className="flex items-center gap-1 border-b border-foreground/[0.08]">
        {CENTRO_OP_TABS.map(t => {
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
      {tab === "notion"      && <CentroOpPagesView userRole={effectiveRole} />}
      {tab === "sops"        && <AdminSOPsView userRole={effectiveRole} />}
      {tab === "prospeccion" && <AdminProspeccionView />}
    </div>
  )
}
