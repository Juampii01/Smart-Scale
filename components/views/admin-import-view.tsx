"use client"

import { useState, useCallback } from "react"
import { createClient } from "@/lib/supabase"
import { useActiveClient } from "@/components/layout/dashboard-layout"
import { Loader2, Upload, Check, AlertCircle } from "lucide-react"

// ─── Types ────────────────────────────────────────────────────────────────────

interface MonthRow {
  month:            string   // YYYY-MM
  label:            string   // "Enero 2024"
  ad_spend:         string
  cash_collected:   string
  total_revenue:    string
  new_clients:      string
  scheduled_calls:  string
  attended_calls:   string
  qualified_calls:  string
  aplications:      string
  active_clients:   string
  software_costs:   string
  variable_costs:   string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const MONTHS_2024: { month: string; label: string }[] = [
  { month: "2024-01", label: "Enero 2024"      },
  { month: "2024-02", label: "Febrero 2024"    },
  { month: "2024-03", label: "Marzo 2024"      },
  { month: "2024-04", label: "Abril 2024"      },
  { month: "2024-05", label: "Mayo 2024"       },
  { month: "2024-06", label: "Junio 2024"      },
  { month: "2024-07", label: "Julio 2024"      },
  { month: "2024-08", label: "Agosto 2024"     },
  { month: "2024-09", label: "Septiembre 2024" },
  { month: "2024-10", label: "Octubre 2024"    },
  { month: "2024-11", label: "Noviembre 2024"  },
  { month: "2024-12", label: "Diciembre 2024"  },
]

const COLUMNS: { key: keyof Omit<MonthRow, "month" | "label">; label: string; fmt: "money" | "number" }[] = [
  { key: "ad_spend",        label: "Ad Spend",        fmt: "money"  },
  { key: "cash_collected",  label: "Cash Cobrado",    fmt: "money"  },
  { key: "total_revenue",   label: "Revenue",         fmt: "money"  },
  { key: "software_costs",  label: "Costos Software", fmt: "money"  },
  { key: "variable_costs",  label: "Costos Variable", fmt: "money"  },
  { key: "new_clients",     label: "Nuevos Clientes", fmt: "number" },
  { key: "active_clients",  label: "Clientes Activos",fmt: "number" },
  { key: "scheduled_calls", label: "Calls Agendadas", fmt: "number" },
  { key: "attended_calls",  label: "Calls Realizadas",fmt: "number" },
  { key: "qualified_calls", label: "Calls Calificadas",fmt:"number" },
  { key: "aplications",     label: "Aplicaciones",    fmt: "number" },
]

function emptyRow(month: string, label: string): MonthRow {
  return {
    month, label,
    ad_spend: "", cash_collected: "", total_revenue: "",
    new_clients: "", scheduled_calls: "", attended_calls: "",
    qualified_calls: "", aplications: "", active_clients: "",
    software_costs: "", variable_costs: "",
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AdminImportView() {
  const activeClient = useActiveClient()

  const [year, setYear] = useState<"2024" | "2023">("2024")

  const months = MONTHS_2024.map(m => ({
    ...m,
    month: m.month.replace("2024", year),
    label: m.label.replace("2024", year),
  }))

  const [rows,     setRows]     = useState<MonthRow[]>(() =>
    months.map(m => emptyRow(m.month, m.label))
  )
  const [saving,   setSaving]   = useState(false)
  const [saved,    setSaved]    = useState<string[]>([])   // months that saved OK
  const [errors,   setErrors]   = useState<Record<string, string>>({})
  const [done,     setDone]     = useState(false)

  const updateCell = (rowIdx: number, key: keyof MonthRow, val: string) => {
    setRows(prev => prev.map((r, i) => i === rowIdx ? { ...r, [key]: val } : r))
  }

  const getSession = async () => {
    const supabase = createClient()
    const { data: { session } } = await supabase.auth.getSession()
    return session
  }

  const handleImport = async () => {
    if (!activeClient) return
    setSaving(true)
    setSaved([])
    setErrors({})
    setDone(false)

    const session = await getSession()
    if (!session) { setSaving(false); return }

    const newSaved: string[] = []
    const newErrors: Record<string, string> = {}

    for (const row of rows) {
      // Skip completely empty rows
      const hasData = COLUMNS.some(c => row[c.key] !== "")
      if (!hasData) continue

      const body: Record<string, any> = {
        client_id: activeClient,
        month:     row.month,
      }

      for (const col of COLUMNS) {
        const raw = row[col.key]
        if (raw === "") continue
        const n = parseFloat(String(raw).replace(/[^0-9.-]/g, ""))
        if (!isNaN(n)) body[col.key] = n
      }

      try {
        const res = await fetch("/api/monthly-reports/save", {
          method:  "POST",
          headers: {
            "Content-Type":  "application/json",
            "Authorization": `Bearer ${session.access_token}`,
          },
          body: JSON.stringify(body),
        })
        if (res.ok) {
          newSaved.push(row.month)
        } else {
          const j = await res.json().catch(() => ({}))
          newErrors[row.month] = j.error ?? "Error desconocido"
        }
      } catch (e: any) {
        newErrors[row.month] = e?.message ?? "Error de red"
      }
    }

    setSaved(newSaved)
    setErrors(newErrors)
    setDone(true)
    setSaving(false)
  }

  const filledCount = rows.filter(r => COLUMNS.some(c => r[c.key] !== "")).length

  if (!activeClient) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <AlertCircle className="h-8 w-8 text-amber-400/50 mb-3" />
        <p className="text-white/40 text-sm">
          Seleccioná un cliente en el selector de arriba para importar datos.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Importar datos históricos</h1>
          <p className="text-sm text-white/40 mt-0.5">
            Completá los datos de cada mes y presioná Importar. Los meses vacíos se omiten.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {/* Year selector */}
          <div className="flex items-center gap-1 rounded-xl border border-white/[0.08] bg-[#111113] p-1">
            {(["2024", "2023"] as const).map(y => (
              <button
                key={y}
                onClick={() => {
                  setYear(y)
                  setRows(MONTHS_2024.map(m => emptyRow(m.month.replace("2024", y), m.label.replace("2024", y))))
                  setSaved([])
                  setErrors({})
                  setDone(false)
                }}
                className={`h-7 rounded-lg px-3 text-[12px] font-semibold transition-all ${
                  year === y
                    ? "bg-[#ffde21] text-black"
                    : "text-white/40 hover:text-white"
                }`}
              >
                {y}
              </button>
            ))}
          </div>

          <button
            onClick={handleImport}
            disabled={saving || filledCount === 0}
            className="flex items-center gap-2 h-9 rounded-xl bg-[#ffde21] px-5 text-[13px] font-bold text-black hover:bg-[#ffe84d] transition-all disabled:opacity-40"
          >
            {saving
              ? <Loader2 className="h-4 w-4 animate-spin" />
              : <Upload className="h-4 w-4" />}
            {saving ? "Importando..." : `Importar ${filledCount > 0 ? `(${filledCount} mes${filledCount !== 1 ? "es" : ""})` : ""}`}
          </button>
        </div>
      </div>

      {/* Result banner */}
      {done && (
        <div className={`flex items-start gap-3 rounded-xl border px-4 py-3 text-[13px] ${
          Object.keys(errors).length > 0
            ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
            : "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
        }`}>
          {Object.keys(errors).length === 0
            ? <Check className="h-4 w-4 shrink-0 mt-0.5" />
            : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
          <div>
            {saved.length > 0 && (
              <p>{saved.length} mes{saved.length !== 1 ? "es" : ""} importado{saved.length !== 1 ? "s" : ""} correctamente.</p>
            )}
            {Object.keys(errors).length > 0 && (
              <div className="mt-1 space-y-0.5">
                {Object.entries(errors).map(([m, msg]) => (
                  <p key={m} className="text-[12px] opacity-70">{m}: {msg}</p>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Spreadsheet grid */}
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111113]">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse" style={{ minWidth: "900px" }}>
            <thead>
              <tr className="border-b border-white/[0.06] bg-white/[0.02]">
                <th className="sticky left-0 z-10 bg-[#0e0e10] px-4 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-white/30 whitespace-nowrap w-[140px]">
                  Mes
                </th>
                {COLUMNS.map(col => (
                  <th key={col.key} className="px-3 py-3 text-left text-[11px] font-bold uppercase tracking-widest text-white/25 whitespace-nowrap">
                    <span className="block">{col.label}</span>
                    <span className="text-white/15 text-[9px] normal-case font-normal tracking-normal">{col.fmt === "money" ? "USD" : "#"}</span>
                  </th>
                ))}
                <th className="px-3 py-3 text-center text-[11px] text-white/20 w-[60px]">OK</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, rowIdx) => {
                const isSaved = saved.includes(row.month)
                const hasError = !!errors[row.month]
                const hasData = COLUMNS.some(c => row[c.key] !== "")

                return (
                  <tr
                    key={row.month}
                    className="border-b border-white/[0.04] group"
                    style={{ backgroundColor: isSaved ? "rgba(16,185,129,0.04)" : "#111113" }}
                  >
                    {/* Month label */}
                    <td className="sticky left-0 z-10 px-4 py-2.5 whitespace-nowrap" style={{ backgroundColor: isSaved ? "rgba(16,185,129,0.06)" : "#0e0e10" }}>
                      <span className={`text-[13px] font-semibold ${isSaved ? "text-emerald-300" : "text-white/80"}`}>
                        {row.label}
                      </span>
                    </td>

                    {/* Data cells */}
                    {COLUMNS.map(col => (
                      <td key={col.key} className="px-2 py-2">
                        <input
                          type="text"
                          inputMode="decimal"
                          value={row[col.key]}
                          placeholder="—"
                          onChange={e => updateCell(rowIdx, col.key, e.target.value)}
                          className={`w-full rounded-lg border bg-transparent px-2.5 py-1.5 text-[13px] tabular-nums text-white placeholder:text-white/15 focus:outline-none transition-all ${
                            isSaved
                              ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                              : hasError
                                ? "border-red-500/30 bg-red-500/[0.03]"
                                : "border-transparent hover:border-white/[0.08] focus:border-white/20 focus:bg-white/[0.03]"
                          }`}
                          style={{ minWidth: col.fmt === "money" ? "90px" : "70px" }}
                        />
                      </td>
                    ))}

                    {/* Status */}
                    <td className="px-3 py-2.5 text-center">
                      {isSaved
                        ? <Check className="h-4 w-4 text-emerald-400 mx-auto" />
                        : hasError
                          ? <AlertCircle className="h-4 w-4 text-red-400 mx-auto" title={errors[row.month]} />
                          : hasData
                            ? <div className="h-1.5 w-1.5 rounded-full bg-[#ffde21]/60 mx-auto" />
                            : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Field reference */}
      <div className="rounded-2xl border border-white/[0.05] bg-[#111113] px-5 py-4">
        <p className="text-[11px] font-bold uppercase tracking-widest text-white/25 mb-3">
          Referencia de campos (Google Sheets → Dashboard)
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
          {[
            ["Ad Spend", "Ad Spend"],
            ["ROI Cash / Cash Collected", "Cash Cobrado"],
            ["ROI Revenue / Revenue", "Revenue"],
            ["Costos de Software", "Costos Software"],
            ["Costos Variables", "Costos Variable"],
            ["New Clients / Cierres", "Nuevos Clientes"],
            ["Active Clients", "Clientes Activos"],
            ["Pitched Calls / Agendadas", "Calls Agendadas"],
            ["Booked / Show Up Calls", "Calls Realizadas"],
            ["Qualified Calls", "Calls Calificadas"],
            ["New Leads / Aplicaciones", "Aplicaciones"],
          ].map(([from, to]) => (
            <div key={from} className="flex items-center gap-1.5 text-[11px]">
              <span className="text-white/35">{from}</span>
              <span className="text-white/20">→</span>
              <span className="text-[#ffde21]/60 font-medium">{to}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  )
}
