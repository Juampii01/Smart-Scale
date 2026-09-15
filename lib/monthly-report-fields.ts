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
 */

export const FIELD_GROUPS = [
  {
    key: "business",
    label: "Business",
    color: "bg-emerald-500",
    fields: [
      { key: "total_revenue",   label: "Revenue total",       type: "number", hint: "USD" },
      { key: "cash_collected",  label: "Cash Collected",      type: "number", hint: "USD" },
      { key: "mrr",             label: "MRR",                 type: "number", hint: "USD" },
      { key: "ad_spend",        label: "Inversión en Ads",    type: "number", hint: "USD" },
      { key: "software_costs",  label: "Costos de Software",  type: "number", hint: "USD" },
      { key: "variable_costs",  label: "Costos Variables",    type: "number", hint: "USD" },
    ],
  },
  {
    key: "sales",
    label: "Sales",
    color: "bg-accent",
    fields: [
      { key: "scheduled_calls",      label: "Llamadas Agendadas",     type: "number" },
      { key: "attended_calls",       label: "Llamadas Atendidas",     type: "number" },
      { key: "qualified_calls",      label: "Llamadas Calificadas",   type: "number" },
      { key: "aplications",          label: "Aplicaciones",           type: "number" },
      { key: "inbound_messages",     label: "Mensajes Entrantes",     type: "number" },
      { key: "offer_docs_sent",      label: "OfferDocs Enviados",     type: "number" },
      { key: "offer_docs_responded", label: "OfferDocs Respondidos",  type: "number" },
      { key: "cierres_por_offerdoc", label: "Cierres por OfferDoc",   type: "number" },
      { key: "new_clients",          label: "Nuevos Clientes",        type: "number", highlight: true },
      { key: "active_clients",       label: "Clientes Activos",       type: "number" },
      { key: "case_studies",         label: "Casos de Éxito",         type: "number", hint: "total acumulado" },
    ],
  },
  {
    key: "shortform",
    label: "Formato Corto",
    color: "bg-pink-500",
    fields: [
      { key: "short_followers", label: "Seguidores",         type: "number" },
      { key: "short_reach",     label: "Alcance",            type: "number" },
      { key: "short_posts",     label: "Posts Publicados",   type: "number" },
    ],
  },
  {
    key: "youtube",
    label: "YouTube",
    color: "bg-red-500",
    fields: [
      { key: "yt_subscribers",     label: "Suscriptores",              type: "number" },
      { key: "yt_new_subscribers", label: "Nuevos Suscriptores",       type: "number" },
      { key: "yt_monthly_audience",label: "Audiencia Mensual",         type: "number" },
      { key: "yt_views",           label: "Vistas",                    type: "number" },
      { key: "yt_watch_time",      label: "Tiempo de Reproducción (hs)",type: "number" },
      { key: "yt_videos",          label: "Videos Publicados",         type: "number" },
    ],
  },
  {
    key: "email",
    label: "Email",
    color: "bg-blue-500",
    fields: [
      { key: "email_subscribers",     label: "Total Subscribers",    type: "number" },
      { key: "email_new_subscribers", label: "Nuevos Suscriptores",  type: "number" },
      { key: "email_sent",            label: "Emails Sent",          type: "number" },
      { key: "email_open_rate",       label: "Open Rate (%)",        type: "number" },
    ],
  },
  {
    key: "reflection",
    label: "Reflection",
    color: "bg-secondary",
    fields: [
      { key: "biggest_win",    label: "Mayor Logro del Mes",                                    type: "text" },
      { key: "next_focus",     label: "Próximo Enfoque",                                        type: "text" },
      { key: "support_needed", label: "Soporte Necesario",                                      type: "text" },
      { key: "improvements",   label: "Mejoras",                                                type: "text" },
      { key: "nps_score",      label: "¿Cuánto recomendarías Smart Scale?",  type: "number", hint: "del 1 al 10", min: 1, max: 10 },
    ],
  },
] as const

/** Todas las claves de campo que el formulario puede llegar a mandar. */
export const ALL_FIELD_KEYS: readonly string[] = FIELD_GROUPS.flatMap((group) =>
  group.fields.map((field) => field.key)
)

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
      `[monthly-reports/save] Campos de FIELD_GROUPS sin allowlist en NUMERIC_FIELDS/TEXT_FIELDS: ${missing.join(", ")}`
    )
  }
}
