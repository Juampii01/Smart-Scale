"use client"

/**
 * Panel Interno — vista de demo, 100% estática (sin queries a Supabase).
 *
 * Pensada para mostrarle la forma del panel interno a alguien externo (ej.
 * OnePead) sin exponer ningún dato real de Ann — no lee ninguna tabla, todo
 * el contenido de esta pantalla está hardcodeado en cero/vacío. No confundir
 * con /admin/executive-dashboard, /admin/clients, /admin/leads o
 * /admin/payments (esas sí muestran datos reales).
 */

import { LayoutDashboard, UserCheck, Users2, DollarSign } from "lucide-react"
import { SectionHeader } from "@/components/ui/section-header"
import { StatTile } from "@/components/ui/stat-tile"

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-xl border border-dashed border-foreground/10 bg-foreground/[0.02] px-6 py-8 text-center">
      <p className="text-[13px] text-text-3">{label}</p>
    </div>
  )
}

export function AdminDemoPanelView() {
  return (
    <div className="pb-10 space-y-10">
      <div>
        <h1 className="text-[24px] font-bold text-foreground leading-tight">Panel Interno</h1>
        <p className="text-[13px] text-text-2 mt-0.5">
          Así se ve la estructura del panel de gestión — sin datos cargados todavía.
        </p>
      </div>

      {/* Dashboard Ejecutivo */}
      <div className="space-y-4">
        <SectionHeader icon={LayoutDashboard} title="Dashboard Ejecutivo" subtitle="KPIs generales del negocio" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatTile label="Revenue" displayValue="$0" />
          <StatTile label="Cash Collected" displayValue="$0" />
          <StatTile label="Clientes Activos" value={0} />
          <StatTile label="Cierres del Mes" value={0} />
        </div>
      </div>

      {/* Clientes */}
      <div className="space-y-4">
        <SectionHeader icon={UserCheck} title="Clientes" subtitle="Listado de clientes del CRM" />
        <EmptyState label="Todavía no hay clientes cargados." />
      </div>

      {/* Leads */}
      <div className="space-y-4">
        <SectionHeader icon={Users2} title="Leads" subtitle="Prospección" />
        <EmptyState label="Todavía no hay leads cargados." />
      </div>

      {/* Pagos */}
      <div className="space-y-4">
        <SectionHeader icon={DollarSign} title="Pagos" subtitle="Transacciones" />
        <EmptyState label="Todavía no hay pagos registrados." />
      </div>
    </div>
  )
}
