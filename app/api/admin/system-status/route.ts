/**
 * GET /api/admin/system-status
 *
 * Alimenta el panel "Estado del Sistema" al tope de /admin/omni — el
 * inventario real de todo lo que ya corre en este sistema (crons, webhooks,
 * notificadores de Zapier/Slack) agrupado según el framework de 3 tipos de
 * agente (Asistentes/Consultores/Constructores) + un bucket de
 * Automatizaciones para lo disparado por evento, no por horario.
 *
 * JOB_REGISTRY es la única fuente de verdad de "qué existe" — se mergea acá
 * contra la última corrida real de cada uno (system_job_runs, o
 * omni_daily_briefings para los 2 crons que ya escriben ahí). Los items con
 * needsDecision nunca van a tener una corrida real (código muerto o cron no
 * registrado) — eso es exactamente la señal que los delata.
 */
import { NextRequest, NextResponse } from "next/server"
import { createServiceClient } from "@/lib/supabase-service"
import { requireOmniOwner } from "@/lib/auth/api-guards"

export const runtime = "nodejs"
export const dynamic = "force-dynamic"

type Bucket = "asistentes" | "consultores" | "constructores" | "automatizaciones"
type Source = "system_job_runs" | "omni_daily_briefings" | "static"

interface RegistryEntry {
  key: string
  name: string
  description: string
  trigger: string
  bucket: Bucket
  source: Source
  sourceKey: string          // job_name en system_job_runs, o `type` en omni_daily_briefings
  needsDecision?: boolean
  staticStatus?: "ok" | "idle"   // solo para source: "static" (no tiene corrida que consultar)
}

const JOB_REGISTRY: RegistryEntry[] = [
  // ─── Asistentes (cron) ──────────────────────────────────────────────────
  { key: "billing-alerts", name: "Alertas de cobro", description: "Genera las próximas cuotas y avisa por Slack/email cuando una está por vencer, vencida, o el programa está por renovarse.", trigger: "diario 12:00 UTC", bucket: "asistentes", source: "system_job_runs", sourceKey: "billing-alerts" },
  { key: "reminders", name: "Recordatorios a clientes", description: "Empuja a quien le falta cargar su Monday Win, su Reporte Mensual, o lleva 7+ días sin entrar al portal.", trigger: "diario 11:00 UTC", bucket: "asistentes", source: "system_job_runs", sourceKey: "reminders" },
  { key: "call-reminders", name: "Recordatorios de llamadas", description: "Avisa por push cuando hay una llamada agendada hoy, y de nuevo 5 minutos antes de que empiece.", trigger: "cada 5 minutos", bucket: "asistentes", source: "system_job_runs", sourceKey: "call-reminders" },
  { key: "omni-community", name: "Análisis de comunidad", description: "Lee Slack (canales generales + #cl-*) y arma el briefing diario de qué está pasando en la comunidad.", trigger: "diario 11:30 UTC", bucket: "asistentes", source: "omni_daily_briefings", sourceKey: "community" },
  { key: "omni-leads", name: "Análisis de leads vs. cierres", description: "Cruza la calidad de los leads del día con cómo terminaron cerrando, para detectar patrones.", trigger: "diario 11:30 UTC", bucket: "asistentes", source: "omni_daily_briefings", sourceKey: "leads" },
  { key: "omni-prospecting", name: "Riesgo de prospección", description: "Analiza las conversaciones de prospección del día y marca qué leads están en riesgo de perderse.", trigger: "diario 11:30 UTC", bucket: "asistentes", source: "omni_daily_briefings", sourceKey: "prospecting" },
  { key: "omni-unanswered", name: "Resumen de sin responder", description: "Cuenta cuántas conversaciones (Instagram + Slack) quedaron sin responder en el día.", trigger: "diario 23:00 UTC", bucket: "asistentes", source: "omni_daily_briefings", sourceKey: "unanswered" },
  { key: "settle-monthly-metrics", name: "Cierre de métricas mensuales", description: "Precalcula y cachea las métricas mensuales de cada setter. El archivo existe pero el cron nunca se registró en vercel.json.", trigger: "no configurado", bucket: "asistentes", source: "system_job_runs", sourceKey: "settle-monthly-metrics", needsDecision: true },
  { key: "content-analyzer", name: "Análisis de contenido", description: "Qué posts y reels traen DMs que después cierran — no solo likes.", trigger: "próximamente", bucket: "asistentes", source: "static", sourceKey: "content-analyzer", staticStatus: "idle" },
  { key: "ads-analyzer", name: "Análisis de Ads", description: "Qué campañas traen clientes reales, no solo clics baratos.", trigger: "próximamente", bucket: "asistentes", source: "static", sourceKey: "ads-analyzer", staticStatus: "idle" },
  { key: "revenue-analyzer", name: "Análisis de Revenue", description: "De dónde viene realmente la plata — qué programa, qué canal, qué setter.", trigger: "próximamente", bucket: "asistentes", source: "static", sourceKey: "revenue-analyzer", staticStatus: "idle" },

  // ─── Consultores ────────────────────────────────────────────────────────
  { key: "ann-chat", name: "Ann (asistente del cliente)", description: "Chat con acceso al playbook y a los datos reales de cada cliente — le da consejos a medida, no genéricos.", trigger: "a demanda (desde el portal del cliente)", bucket: "consultores", source: "static", sourceKey: "ann-chat", staticStatus: "ok" },

  // ─── Constructores ──────────────────────────────────────────────────────
  { key: "builder", name: "Constructor de agentes", description: "Agente y sandbox ya creados (Managed Agents) — falta conectar un token de GitHub para que pueda pushear y abrir PRs contra este repo.", trigger: "configurado, falta credencial de GitHub", bucket: "constructores", source: "static", sourceKey: "builder", staticStatus: "idle" },
  { key: "error-watch", name: "Error Watch (autodiagnóstico)", description: "Detecta errores/warnings nuevos en app_logs (dedupeados) y le pide al Constructor un diagnóstico de solo lectura — nunca aplica un fix solo, avisa por push para que se autorice manualmente.", trigger: "cada 30 minutos", bucket: "constructores", source: "system_job_runs", sourceKey: "error-watch" },

  // ─── Automatizaciones (webhooks + notificadores, disparados por evento) ──
  { key: "webhook-payment", name: "Webhook: Pagos (Stripe)", description: "Recibe confirmaciones de pago de Stripe (vía Zapier) y las guarda.", trigger: "on-demand", bucket: "automatizaciones", source: "system_job_runs", sourceKey: "webhook:payment" },
  { key: "webhook-recording", name: "Webhook: Grabaciones", description: "Recibe el link de grabación de una llamada y lo guarda para el calendario.", trigger: "on-demand", bucket: "automatizaciones", source: "system_job_runs", sourceKey: "webhook:recording" },
  { key: "webhook-payfunnels", name: "Webhook: Pago PayFunnels", description: "Onboarding automático completo cuando alguien paga en la landing: crea cliente, cuotas, cuenta del portal y manda el contrato.", trigger: "on-demand", bucket: "automatizaciones", source: "system_job_runs", sourceKey: "webhook:payfunnels" },
  { key: "webhook-lead", name: "Webhook: Lead externo", description: "Recibe un lead taggeado desde un CRM externo (GHL/ActiveCampaign/HubSpot) y lo guarda.", trigger: "on-demand", bucket: "automatizaciones", source: "system_job_runs", sourceKey: "webhook:lead" },
  { key: "webhook-client", name: "Webhook: Alta de cliente", description: "Alta manual de cliente vía formulario externo (Airtable).", trigger: "on-demand", bucket: "automatizaciones", source: "system_job_runs", sourceKey: "webhook:client" },
  { key: "webhook-signnow", name: "Webhook: Contrato firmado", description: "SignNow avisa cuando un cliente firma — dispara los 3 emails de onboarding (Skool/Slack/Plataforma).", trigger: "on-demand", bucket: "automatizaciones", source: "system_job_runs", sourceKey: "webhook:signnow-contract-signed" },
  { key: "zapier-onboarded", name: "Zapier: Cliente onboarded", description: "Avisa a Slack (vía Zapier) cuando se da de alta un cliente nuevo.", trigger: "on-demand", bucket: "automatizaciones", source: "system_job_runs", sourceKey: "zapier:zapierClientOnboarded" },
  { key: "zapier-eod", name: "Zapier: EOD de setter", description: "Avisa a Slack cuando un setter carga su EOD del día.", trigger: "on-demand", bucket: "automatizaciones", source: "system_job_runs", sourceKey: "zapier:zapierEODSubmitted" },
  { key: "zapier-task", name: "Zapier: Evento de tarea", description: "Avisa a Slack cuando se crea, mueve, asigna o completa una tarea del Kanban.", trigger: "on-demand", bucket: "automatizaciones", source: "system_job_runs", sourceKey: "zapier:zapierTaskEvent" },
  { key: "zapier-onboarding-status", name: "Zapier: Estado de onboarding", description: "Avisa a Slack cuando se firma el contrato, cuando el onboarding queda 100% completo, y cuando un pago de PayFunnels no se pudo procesar automáticamente.", trigger: "on-demand", bucket: "automatizaciones", source: "system_job_runs", sourceKey: "zapier:zapierOnboardingStatusChanged" },
  { key: "zapier-report", name: "Zapier: Reporte mensual", description: "Definido en el código pero nunca se llama desde ningún lado.", trigger: "on-demand", bucket: "automatizaciones", source: "system_job_runs", sourceKey: "zapier:zapierReportCompleted", needsDecision: true },
  { key: "zapier-sale", name: "Zapier: Venta registrada", description: "Definido en el código pero nunca se llama desde ningún lado.", trigger: "on-demand", bucket: "automatizaciones", source: "system_job_runs", sourceKey: "zapier:zapierSaleRegistered", needsDecision: true },
  { key: "slack-onboarded", name: "Slack: Cliente onboarded", description: "Crea el canal #cl-{nombre} y postea el resumen de onboarding del cliente nuevo.", trigger: "on-demand", bucket: "automatizaciones", source: "system_job_runs", sourceKey: "slack:notifyClientOnboarded" },
]

const BRIEFING_TYPES = ["community", "leads", "prospecting", "unanswered"]

export async function GET(req: NextRequest) {
  const jwt = (req.headers.get("authorization") ?? "").replace("Bearer ", "")
  const user = await requireOmniOwner(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })

  const sb = createServiceClient()

  // Última corrida por job_name — se trae un lote razonable ya ordenado por
  // el índice (job_name, ran_at desc) y se queda con la primera ocurrencia
  // de cada nombre en JS (evita depender de "distinct on" de PostgREST).
  const [{ data: runsRaw }, { data: briefingsRaw }] = await Promise.all([
    sb.from("system_job_runs")
      .select("job_name, status, detail, ran_at")
      .order("ran_at", { ascending: false })
      .limit(500),
    sb.from("omni_daily_briefings")
      .select("type, created_at")
      .in("type", BRIEFING_TYPES)
      .order("created_at", { ascending: false })
      .limit(200),
  ])

  const latestRunByName = new Map<string, { status: string; detail: string | null; ran_at: string }>()
  for (const row of runsRaw ?? []) {
    if (!latestRunByName.has(row.job_name)) {
      latestRunByName.set(row.job_name, { status: row.status, detail: row.detail, ran_at: row.ran_at })
    }
  }

  const latestBriefingByType = new Map<string, string>()
  for (const row of briefingsRaw ?? []) {
    if (!latestBriefingByType.has(row.type)) latestBriefingByType.set(row.type, row.created_at)
  }

  const items = JOB_REGISTRY.map(entry => {
    if (entry.source === "static") {
      return {
        key: entry.key,
        name: entry.name,
        description: entry.description,
        trigger: entry.trigger,
        bucket: entry.bucket,
        lastRanAt: null as string | null,
        status: entry.staticStatus ?? "idle",
        detail: null as string | null,
        needsDecision: false,
      }
    }
    if (entry.source === "omni_daily_briefings") {
      const lastRanAt = latestBriefingByType.get(entry.sourceKey) ?? null
      return {
        key: entry.key,
        name: entry.name,
        description: entry.description,
        trigger: entry.trigger,
        bucket: entry.bucket,
        lastRanAt,
        status: lastRanAt ? "ok" : "idle",
        detail: null as string | null,
        needsDecision: false,
      }
    }
    // system_job_runs
    const run = latestRunByName.get(entry.sourceKey)
    return {
      key: entry.key,
      name: entry.name,
      description: entry.description,
      trigger: entry.trigger,
      bucket: entry.bucket,
      lastRanAt: run?.ran_at ?? null,
      status: entry.needsDecision ? "warning" : run ? (run.status as "ok" | "error") : "idle",
      detail: run?.detail ?? null,
      needsDecision: entry.needsDecision ?? false,
    }
  })

  const byBucket = (b: Bucket) => items.filter(i => i.bucket === b)

  return NextResponse.json({
    asistentes:       byBucket("asistentes"),
    consultores:      byBucket("consultores"),
    constructores:    byBucket("constructores"),
    automatizaciones: byBucket("automatizaciones"),
  })
}
