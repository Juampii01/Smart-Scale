"use client"

import { useEffect, useState } from "react"
import { UserPlus } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { isAdmin } from "@/lib/auth/permissions"
import { useEffectiveRole } from "@/lib/auth/view-as"
import { NewUserDialog } from "@/components/admin/new-user-dialog"
import { CentroOpPagesView } from "@/components/views/centro-op-pages-view"

// ─── Main View ─────────────────────────────────────────────────────────────────

export function AdminCentroOperativoView() {
  const [userRole, setUserRole] = useState<string | null>(null)
  const [newUserOpen, setNewUserOpen] = useState(false)

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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
            <h1 className="text-sm font-semibold uppercase tracking-widest text-foreground/70">Centro Operativo</h1>
          </div>
          <p className="text-xs text-foreground/30 ml-[18px]">
            Wiki interno tipo Notion. Páginas anidables con bloques, listas, código, checklists.
          </p>
        </div>

        {isAdmin(effectiveRole) && (
          <button
            onClick={() => setNewUserOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2 text-sm font-bold text-black hover:bg-[#ffe84d] transition-colors"
            title="Crear cuenta de usuario interna"
          >
            <UserPlus className="h-4 w-4" />
            Nuevo usuario
          </button>
        )}
      </div>

      <NewUserDialog open={newUserOpen} onClose={() => setNewUserOpen(false)} />

      <CentroOpPagesView userRole={effectiveRole} />
    </div>
  )
}
