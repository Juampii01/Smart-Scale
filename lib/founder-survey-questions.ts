/**
 * Preguntas de la encuesta de "Sistema Operativo" que llena la founder desde
 * /admin/actualizar-sistema — reemplaza la Capa 1 (Contexto: business.md /
 * marketing.md / delivery.md) por un formulario en vez de markdown a mano.
 * Las respuestas se guardan en founder_operating_system, una fila por sección.
 */

export type QuestionType = "single" | "multi" | "text"

export interface SurveyQuestion {
  key: string
  label: string
  type: QuestionType
  options?: string[]
  placeholder?: string
}

export interface SurveySection {
  section: "negocio" | "marketing" | "entrega"
  title: string
  subtitle: string
  questions: SurveyQuestion[]
}

export const SURVEY_SECTIONS: SurveySection[] = [
  {
    section: "negocio",
    title: "Contexto de Negocio",
    subtitle: "Quién sos, a quién servís, cómo funciona la operación",
    questions: [
      { key: "descripcion", type: "text", label: "¿Cómo describirías Smart Scale en una frase, a alguien que nunca escuchó de la marca?" },
      { key: "programa_principal", type: "single", label: "¿Cuál es tu programa principal hoy?", options: ["Grupal", "Híbrido", "Ambos por igual", "Otro"] },
      { key: "cliente_ideal", type: "multi", label: "¿Quién es tu cliente ideal? (elegí todas las que apliquen)", options: ["Coaches / consultores", "Infoproductores", "Agencias", "Ecommerce", "Otro"] },
      { key: "diferencial", type: "text", label: "¿Qué problema puntual resuelve Smart Scale que la competencia no resuelve igual de bien?" },
      { key: "organizacion_equipo", type: "single", label: "¿Cómo está organizado el equipo hoy?", options: ["Founder + setters", "Founder + team + setters", "Full team con roles definidos", "Otro"] },
      { key: "meta_6_meses", type: "text", label: "¿Cuál es la meta de negocio más importante para los próximos 6 meses?" },
    ],
  },
  {
    section: "marketing",
    title: "Contexto de Marketing",
    subtitle: "Crecimiento y audiencia — acá es donde Ann hace el trabajo más pesado de análisis",
    questions: [
      { key: "fuente_leads", type: "multi", label: "¿De dónde viene la mayoría de tus leads hoy?", options: ["Instagram orgánico", "Ads pagos", "Referidos", "Contenido / YouTube", "Otro"] },
      { key: "canal_principal", type: "single", label: "¿Cuál es tu canal de contenido principal?", options: ["Instagram", "YouTube", "TikTok", "Newsletter / Email", "Otro"] },
      { key: "contenido_que_convierte", type: "text", label: "¿Qué tipo de contenido te trae mejores leads (no solo likes)?" },
      { key: "funnel_pago", type: "single", label: "¿Tenés un funnel de pago automatizado (landing + checkout) o todo pasa por un setter?", options: ["Todo automatizado", "Todo por setter", "Mixto"] },
      { key: "cuello_botella_marketing", type: "text", label: "¿Cuál es tu mayor cuello de botella en marketing hoy?" },
    ],
  },
  {
    section: "entrega",
    title: "Contexto de Entrega",
    subtitle: "Tu mecanismo único de entrega, tu modelo y tu propiedad intelectual",
    questions: [
      { key: "mecanismo_entrega", type: "text", label: "¿Cuál es tu mecanismo único de entrega? (lo que hace que tu forma de dar resultados sea diferente)" },
      { key: "modelo_entrega", type: "single", label: "¿Cómo es el modelo de entrega principal?", options: ["Grupal (comunidad + calls grupales)", "1:1", "Híbrido (grupal + 1:1)", "Otro"] },
      { key: "incluye_programa", type: "multi", label: "¿Qué incluye el programa hoy?", options: ["Playbook / SOPs", "Calls semanales", "Comunidad en Slack / Skool", "Ann AI (asistente)", "Otro"] },
      { key: "propiedad_intelectual", type: "text", label: "¿Cuál es tu propiedad intelectual más valiosa? (el framework, método o proceso que es tuyo)" },
      { key: "duracion_programa", type: "single", label: "¿Cuánto dura el programa?", options: ["6 meses", "3 meses", "Otro / variable"] },
    ],
  },
]
