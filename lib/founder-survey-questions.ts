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
    subtitle: "Quién sos, a quién servís de verdad, y qué reglas no se rompen — ni vos ni un agente de IA",
    questions: [
      {
        key: "descripcion", type: "text",
        label: "En una frase, sin jerga de marketing: ¿qué es Smart Scale y qué cambia concretamente para quien lo compra?",
        placeholder: "Ej: 'Le doy a coaches que ya facturan pero no pueden soltar el día a día, un sistema para escalar sin depender de ellos.' — no 'ayudamos a crecer negocios'.",
      },
      { key: "programa_principal", type: "single", label: "¿Cuál es tu programa principal hoy?", options: ["Grupal", "Híbrido", "Ambos por igual", "Otro"] },
      { key: "cliente_ideal", type: "multi", label: "¿Quién es tu cliente ideal? (elegí todas las que apliquen)", options: ["Coaches / consultores", "Infoproductores", "Agencias", "Ecommerce", "Otro"] },
      {
        key: "avatar_momento_dolor", type: "text",
        label: "Contame de tu cliente ideal: ¿en qué momento de su negocio está, y cuál es la frustración puntual (no 'quiere crecer') que lo trae a buscarte justo ahora?",
        placeholder: "Ej: 'Factura $8-15k/mes pero no puede tomarse un día libre sin que todo se frene — llegó al techo de lo que puede hacer solo.'",
      },
      {
        key: "diferencial", type: "text",
        label: "¿Qué hace Smart Scale que la competencia directa no hace, o no hace tan bien? Sé específico — 'mejor calidad' no cuenta.",
      },
      { key: "organizacion_equipo", type: "single", label: "¿Cómo está organizado el equipo hoy?", options: ["Founder + setters", "Founder + team + setters", "Full team con roles definidos", "Otro"] },
      {
        key: "limites_ia", type: "text",
        label: "¿Qué decisiones NO querés que un agente de IA tome solo, sin que vos o tu equipo lo revisen antes?",
        placeholder: "Ej: prometer un reembolso, responderle a un cliente enojado, cambiar un precio o una fecha de pago, hablar en tu nombre con un cliente VIP.",
      },
      {
        key: "meta_6_meses", type: "text",
        label: "¿Cuál es la meta de negocio más importante para los próximos 6 meses? Si podés, poné un número (revenue, clientes activos, retención, lo que sea que estés mirando).",
      },
    ],
  },
  {
    section: "marketing",
    title: "Contexto de Marketing",
    subtitle: "Crecimiento y audiencia con números reales — acá es donde Ann hace el trabajo más pesado de análisis",
    questions: [
      { key: "fuente_leads", type: "multi", label: "¿De dónde viene la mayoría de tus leads hoy?", options: ["Instagram orgánico", "Ads pagos", "Referidos", "Contenido / YouTube", "Otro"] },
      { key: "canal_principal", type: "single", label: "¿Cuál es tu canal de contenido principal?", options: ["Instagram", "YouTube", "TikTok", "Newsletter / Email", "Otro"] },
      {
        key: "tono_voz", type: "single",
        label: "¿Cómo describirías el tono de voz de la marca? (esto define cómo escribe Ann cuando habla en tu nombre)",
        options: ["Directo y sin filtro", "Cercano y motivador", "Educativo / técnico", "Premium / exclusivo", "Otro"],
      },
      {
        key: "mensaje_clave", type: "text",
        label: "¿Cuál es el mensaje o promesa central que repetís en tu contenido y ads? La frase que, si la escuchás, sabés que es de Smart Scale.",
      },
      {
        key: "contenido_que_convierte", type: "text",
        label: "¿Qué tipo de contenido puntual te trae mejores leads — no likes, leads que después cierran?",
        placeholder: "Ej: 'Videos donde muestro un cliente real con su facturación antes/después', no 'contenido de valor'.",
      },
      { key: "funnel_pago", type: "single", label: "¿Tenés un funnel de pago automatizado (landing + checkout) o todo pasa por un setter?", options: ["Todo automatizado", "Todo por setter", "Mixto"] },
      {
        key: "metricas_funnel", type: "text",
        label: "Si los tenés a mano (aunque sea aproximado): ¿cuántos leads entran por semana, qué % agenda una llamada, y qué % de esas llamadas cierra?",
        placeholder: "Ej: '~40 leads/semana, 25% agenda call, 30% de las calls cierra' — un estimado a ojo sirve, no hace falta el dato exacto.",
      },
      {
        key: "objecion_principal", type: "text",
        label: "¿Cuál es la objeción #1 que escuchás antes de que alguien compre, y cómo la respondés hoy?",
        placeholder: "Ej: '\"No tengo tiempo para esto\" — le muestro que el sistema le devuelve tiempo, no le saca más.'",
      },
      {
        key: "cuello_botella_marketing", type: "text",
        label: "¿En qué paso puntual del funnel se te cae más gente hoy — no en general, sino dónde específicamente se rompe?",
        placeholder: "Ej: 'Agendan la call pero no se presentan', o 'cierran interés en el contenido pero no completan el formulario de aplicación'.",
      },
    ],
  },
  {
    section: "entrega",
    title: "Contexto de Entrega",
    subtitle: "Tu mecanismo único, tu propiedad intelectual, y las señales tempranas de que algo anda mal con un cliente",
    questions: [
      { key: "mecanismo_entrega", type: "text", label: "¿Cuál es tu mecanismo único de entrega? (lo que hace que tu forma de dar resultados sea diferente)" },
      { key: "modelo_entrega", type: "single", label: "¿Cómo es el modelo de entrega principal?", options: ["Grupal (comunidad + calls grupales)", "1:1", "Híbrido (grupal + 1:1)", "Otro"] },
      { key: "incluye_programa", type: "multi", label: "¿Qué incluye el programa hoy?", options: ["Playbook / SOPs", "Calls semanales", "Comunidad en Slack / Skool", "Ann AI (asistente)", "Otro"] },
      {
        key: "curriculum_semanal", type: "text",
        label: "A grandes rasgos, ¿qué se trabaja semana a semana o mes a mes? No hace falta el detalle exacto — con la idea general alcanza para que Ann pueda ubicar en qué etapa está cada cliente.",
      },
      {
        key: "momento_riesgo_churn", type: "text",
        label: "¿En qué momento del programa un cliente suele frustrarse o empezar a pensar en irse? ¿Qué señales lo anticipan?",
        placeholder: "Ej: 'Entre la semana 3 y 4, cuando ya vieron el sistema pero todavía no vieron resultado propio — dejan de postear en la comunidad.'",
      },
      {
        key: "definicion_resultado", type: "text",
        label: "¿Cómo definís que un cliente 'tuvo resultado' con Smart Scale? ¿Qué tiene que pasar concretamente para que lo consideres un caso de éxito?",
      },
      { key: "propiedad_intelectual", type: "text", label: "¿Cuál es tu propiedad intelectual más valiosa? (el framework, método o proceso que es tuyo)" },
      { key: "duracion_programa", type: "single", label: "¿Cuánto dura el programa?", options: ["6 meses", "3 meses", "Otro / variable"] },
    ],
  },
]
