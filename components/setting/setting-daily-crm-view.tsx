"use client"

import { useState, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Download } from "lucide-react"

interface CRMLog {
  id: string
  date: string
  setter_name: string | null
  setter_role: string | null
  new_conversations: number
  inbound_applications: number
  conversations_replied: number
  outbound_leads: number
  outbound_replies: number
  qualified_leads: number
  offer_docs_sent: number
  offer_doc_responses: number
  calls_done: number
  notes: string | null
}

interface SettingDailyCRMViewProps {
  logs: CRMLog[]
}

function pct(num: number, den: number): string {
  if (!den) return "—"
  return `${Math.round((num / den) * 100)}%`
}

function getColorClass(percentage: number | null): string {
  if (percentage === null) return ""
  if (percentage >= 80) return "bg-green-100 dark:bg-green-950 text-green-800 dark:text-green-200"
  if (percentage >= 50) return "bg-yellow-100 dark:bg-yellow-950 text-yellow-800 dark:text-yellow-200"
  return "bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-200"
}

function parsePercentage(str: string): number | null {
  if (str === "—") return null
  const match = str.match(/(\d+)/)
  return match ? parseInt(match[1]) : null
}

export function SettingDailyCRMView({ logs }: SettingDailyCRMViewProps) {
  const [sortBy, setSortBy] = useState<"date" | "setter">("date")

  const sortedLogs = useMemo(() => {
    const sorted = [...logs]
    if (sortBy === "date") {
      sorted.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    } else {
      sorted.sort((a, b) => (a.setter_name || "").localeCompare(b.setter_name || ""))
    }
    return sorted
  }, [logs, sortBy])

  const handleExportCSV = () => {
    const headers = [
      "Fecha",
      "Setter",
      "Convos",
      "Apps Inbound",
      "Respuestas",
      "Inbound %",
      "Leads Out",
      "Resp Out",
      "Outbound %",
      "Qualified",
      "Docs",
      "Doc Resp",
      "Doc %",
      "Calls",
      "Notas",
    ]

    const rows = sortedLogs.map((log) => {
      const inboundPct = pct(log.conversations_replied, log.inbound_applications)
      const outboundPct = pct(log.outbound_replies, log.outbound_leads)
      const docPct = pct(log.offer_doc_responses, log.offer_docs_sent)

      return [
        log.date,
        log.setter_name || "—",
        log.new_conversations,
        log.inbound_applications,
        log.conversations_replied,
        inboundPct,
        log.outbound_leads,
        log.outbound_replies,
        outboundPct,
        log.qualified_leads,
        log.offer_docs_sent,
        log.offer_doc_responses,
        docPct,
        log.calls_done,
        log.notes || "—",
      ]
    })

    const csv = [
      headers.join(","),
      ...rows.map((r) => r.map((v) => `"${v}"`).join(",")),
    ].join("\n")

    const blob = new Blob([csv], { type: "text/csv" })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `crm-daily-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">CRM Diario Detallado</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Desglose completo de métricas día por día
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as "date" | "setter")}
            className="px-3 py-2 rounded-lg border border-border bg-foreground/[0.03] text-sm font-medium outline-none focus:border-[#ffde21]/50"
          >
            <option value="date">Ordenar por Fecha</option>
            <option value="setter">Ordenar por Setter</option>
          </select>
          <button
            onClick={handleExportCSV}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-foreground/[0.03] text-sm font-medium hover:bg-foreground/[0.06] transition-colors"
            title="Descargar como CSV"
          >
            <Download className="h-4 w-4" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      {logs.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <p>No hay registros aún</p>
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/50">
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Fecha
                </th>
                <th className="px-3 py-3 text-left text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Setter
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Convos
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  📥 Inbound
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Apps
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Resp
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  %
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  📤 Outbound
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Leads
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Resp
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  %
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  🎯 Conversion
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Qual
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Docs
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Resp
                </th>
                <th className="px-3 py-3 text-center text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  %
                </th>
                <th className="px-3 py-3 text-right text-xs font-semibold text-muted-foreground whitespace-nowrap">
                  Calls
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedLogs.map((log) => {
                const inboundPct = pct(log.conversations_replied, log.inbound_applications)
                const outboundPct = pct(log.outbound_replies, log.outbound_leads)
                const docPct = pct(log.offer_doc_responses, log.offer_docs_sent)

                const inboundColor = getColorClass(parsePercentage(inboundPct))
                const outboundColor = getColorClass(parsePercentage(outboundPct))
                const docColor = getColorClass(parsePercentage(docPct))

                return (
                  <tr
                    key={log.id}
                    className="border-b border-border/50 last:border-0 hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-3 py-2 font-medium text-foreground whitespace-nowrap">
                      {new Date(log.date).toLocaleDateString("es-AR", {
                        weekday: "short",
                        day: "numeric",
                        month: "short",
                      })}
                    </td>
                    <td className="px-3 py-2 text-foreground/75 text-xs whitespace-nowrap">
                      {log.setter_name}
                      {log.setter_role && (
                        <span className="ml-1 text-foreground/50">({log.setter_role})</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground/85">
                      {log.new_conversations}
                    </td>

                    {/* Inbound */}
                    <td className="px-3 py-2 text-center"></td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground/85">
                      {log.inbound_applications}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground/85">
                      {log.conversations_replied}
                    </td>
                    <td className={`px-3 py-2 text-center font-semibold rounded ${inboundColor}`}>
                      {inboundPct}
                    </td>

                    {/* Outbound */}
                    <td className="px-3 py-2 text-center"></td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground/85">
                      {log.outbound_leads}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground/85">
                      {log.outbound_replies}
                    </td>
                    <td className={`px-3 py-2 text-center font-semibold rounded ${outboundColor}`}>
                      {outboundPct}
                    </td>

                    {/* Conversion */}
                    <td className="px-3 py-2 text-center"></td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground/85">
                      {log.qualified_leads}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground/85">
                      {log.offer_docs_sent}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground/85">
                      {log.offer_doc_responses}
                    </td>
                    <td className={`px-3 py-2 text-center font-semibold rounded ${docColor}`}>
                      {docPct}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-foreground/85">
                      {log.calls_done}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {logs.length > 0 && (
        <p className="mt-4 text-[11px] text-foreground/40">
          {logs.length} {logs.length === 1 ? "registro" : "registros"} · Verde (&gt;80%), Amarillo (50-80%), Rojo (&lt;50%)
        </p>
      )}
    </Card>
  )
}
