/**
 * Definición de campos del Reporte Mensual — fuente única compartida entre
 * la vista (`report-input-view.tsx`) y el route de guardado
 * (`app/api/monthly-reports/save/route.ts`).
 *
 * Se movió acá (en vez de vivir solo en el componente) para que el route de
 * guardado pueda importar `ALL_FIELD_KEYS` sin arrastrar el componente
 * cliente completo, y para que `assertFieldCoverage` pueda comparar contra
 * la MISMA lista que ve el formulario — si viviera duplicada en el route,
 * alguien podría agregar un campo acá y olvidarse de actualizar la copia,
 * exactamente el bug que este chequeo existe para evitar.
 *
 * `STEPS` reemplaza al viejo `FIELD_GROUPS` (6 bloques por canal) por 5
 * pasos por etapa del embudo — wizard de 5 pasos, ver
 * components/views/report-input-view.tsx.
 */

export interface ReportFieldDef {
  key: string
  label: string
  type: "number" | "text"
  hint?: string
  min?: number
  max?: number
  highlight?: boolean
  /** "db": viene de GET /api/monthly-reports/prefill (cash_collected, mrr,
   *  new_clients, active_clients). "delta": se calcula en vivo contra el
   *  mes anterior (yt_new_subscribers, email_new_subscribers). */
  auto?: "db" | "delta"
  /** Slider 0–10 con la barra llena (conf_*) — nps_score usa 1–10, el rango
   *  real de su columna (CHECK nps_score BETWEEN 1 AND 10), no 0–10. */
  slider?: { min: number; max: number }
}

export interface ReportStepDef {
  key: string
  number: number
  name: string
  subtitle: string
  description: string
  color: string
  trackedTitle?: string
  trackedFields?: ReportFieldDef[]
  manualFields: ReportFieldDef[]
  foldedBlock?: { title: string; fields: ReportFieldDef[] }
  additionalFields?: ReportFieldDef[]
}

export const STEPS: ReportStepDef[] = [
  {
    key: "atraer",
    number: 1,
    name: "Atraer",
    subtitle: "Fascinate",
    description: "Ganar atención y hacer crecer la audiencia arriba del embudo.",
    color: "#E0A33F",
    trackedTitle: "Lo que ya cargamos por vos",
    trackedFields: [
      { key: "short_followers", label: "Seguidores", type: "number" },
      { key: "short_posts", label: "Posts publicados", type: "number" },
    ],
    manualFields: [
      { key: "conf_short_form", label: "Confianza en formato corto", type: "number", slider: { min: 0, max: 10 } },
      { key: "ad_spend", label: "Inversión en ads", type: "number", hint: "USD" },
    ],
    additionalFields: [
      { key: "short_reach", label: "Alcance", type: "number" },
    ],
  },
  {
    key: "educar",
    number: 2,
    name: "Educar",
    subtitle: "Educate",
    description: "Construir confianza con contenido largo y con el email.",
    color: "#4FB8CF",
    trackedTitle: "Lo que ya cargamos por vos",
    trackedFields: [
      { key: "yt_subscribers", label: "Suscriptores", type: "number" },
      { key: "yt_views", label: "Vistas", type: "number" },
      { key: "yt_videos", label: "Videos publicados", type: "number" },
    ],
    manualFields: [
      { key: "conf_long_form", label: "Confianza en formato largo", type: "number", slider: { min: 0, max: 10 } },
      { key: "yt_monthly_audience", label: "Audiencia mensual", type: "number" },
      { key: "yt_watch_time", label: "Tiempo de reproducción", type: "number", hint: "hs" },
      { key: "yt_new_subscribers", label: "Nuevos suscriptores", type: "number", auto: "delta" },
      { key: "conf_email", label: "Confianza en email", type: "number", slider: { min: 0, max: 10 } },
      { key: "email_subscribers", label: "Total de suscriptores", type: "number" },
      { key: "email_new_subscribers", label: "Nuevos suscriptores", type: "number", auto: "delta" },
      { key: "email_sent", label: "Emails enviados", type: "number" },
      { key: "email_open_rate", label: "Open rate (%)", type: "number", min: 0, max: 100 },
    ],
  },
  {
    key: "invitar",
    number: 3,
    name: "Invitar",
    subtitle: "Invite",
    description: "Convertir la atención en conversaciones, ofertas y clientes firmados.",
    color: "#7C8CF0",
    manualFields: [
      { key: "new_clients", label: "Nuevos clientes", type: "number", highlight: true, auto: "db" },
      { key: "cash_collected", label: "Cash collected", type: "number", hint: "USD", auto: "db" },
      { key: "new_business_value", label: "Valor de contratos firmados", type: "number", hint: "USD" },
      { key: "offer_docs_sent", label: "OfferDocs enviados", type: "number" },
      { key: "inbound_messages", label: "Mensajes entrantes", type: "number" },
    ],
    foldedBlock: {
      title: "Llamadas de ventas — si todavía no cerrás por DM",
      fields: [
        { key: "scheduled_calls", label: "Llamadas agendadas", type: "number" },
        { key: "attended_calls", label: "Llamadas atendidas", type: "number" },
      ],
    },
    additionalFields: [
      { key: "total_revenue", label: "Revenue total", type: "number", hint: "USD" },
      { key: "qualified_calls", label: "Llamadas calificadas", type: "number" },
      { key: "aplications", label: "Aplicaciones", type: "number" },
      { key: "offer_docs_responded", label: "OfferDocs respondidos", type: "number" },
      { key: "cierres_por_offerdoc", label: "Cierres por OfferDoc", type: "number" },
    ],
  },
  {
    key: "transformar",
    number: 4,
    name: "Transformar",
    subtitle: "Transform",
    description: "Entregar resultados, retener clientes y hacer crecer lo recurrente.",
    color: "#C9E45C",
    manualFields: [
      { key: "mrr", label: "MRR", type: "number", hint: "USD", auto: "db" },
      { key: "active_clients", label: "Clientes activos", type: "number", auto: "db" },
      { key: "case_studies", label: "Casos de éxito", type: "number", hint: "total acumulado" },
      { key: "conf_business", label: "Confianza en el negocio", type: "number", slider: { min: 0, max: 10 } },
      { key: "software_costs", label: "Costos de software", type: "number", hint: "USD" },
      { key: "variable_costs", label: "Costos variables", type: "number", hint: "USD" },
    ],
  },
  {
    key: "reflexion",
    number: 5,
    name: "Reflexión",
    subtitle: "",
    description: "Frenar un momento: puntuar el mes y dejar armado el que viene.",
    color: "#E28BB0",
    manualFields: [
      { key: "nps_score", label: "¿Cuánto recomendarías Smart Scale?", type: "number", slider: { min: 1, max: 10 } },
      { key: "recommendation", label: "Recomendación", type: "text" },
      { key: "biggest_win", label: "Mayor logro del mes", type: "text" },
      { key: "support_needed", label: "Soporte necesario", type: "text" },
      { key: "next_focus", label: "Próximo enfoque", type: "text" },
    ],
    additionalFields: [
      { key: "improvements", label: "Mejoras", type: "text" },
    ],
  },
]

/** Todas las claves de campo que el wizard puede llegar a mandar (tracked +
 *  manual + plegado + campos adicionales, de los 5 pasos). */
export const ALL_FIELD_KEYS: readonly string[] = STEPS.flatMap((step) => [
  ...(step.trackedFields ?? []),
  ...step.manualFields,
  ...(step.foldedBlock?.fields ?? []),
  ...(step.additionalFields ?? []),
].map((f) => f.key))

/**
 * Falla en cuanto se importa el módulo si algún campo del formulario quedó
 * afuera de los dos allowlists de guardado — el bug que se comió
 * `email_sent`/`email_open_rate` en silencio durante meses.
 */
export function assertFieldCoverage(
  numericFields: readonly string[],
  textFields: readonly string[]
): void {
  const covered = new Set<string>([...numericFields, ...textFields])
  const missing = ALL_FIELD_KEYS.filter((key) => !covered.has(key))
  if (missing.length > 0) {
    throw new Error(
      `[monthly-reports/save] Campos del formulario sin allowlist en NUMERIC_FIELDS/TEXT_FIELDS: ${missing.join(", ")}`
    )
  }
}
