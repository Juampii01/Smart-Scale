/**
 * Generadores de datos ficticios para el botón "Testear" (solo visible para developer).
 *
 * Permiten a un developer disparar el flujo completo de cada formulario
 * (incluyendo notificaciones a Slack/Zapier) sin tener que tipear datos a mano.
 * Todo el texto generado lleva el prefijo [TEST] para que sea obvio en los destinos.
 */

export function randInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

const WINS = [
  "Cerré 2 clientes nuevos a $3k cada uno desde DM",
  "Lancé mi primer video de YouTube y llegó a 1.2k views",
  "Armé el Offer Doc nuevo y subió la tasa de respuesta",
  "Sistematicé el follow-up y recuperé 3 leads fríos",
  "Primer mes arriba de $10k de cash collected",
]

const FOCUS = [
  "Grabar y publicar 1 video largo de YouTube",
  "Duplicar el volumen de DMs salientes diarios",
  "Terminar el módulo de Ofertas y aplicar el framework",
  "Optimizar el guion de llamada para la objeción de precio",
  "Montar la secuencia de email de bienvenida",
]

const BLOCKERS = [
  "No sé cómo cerrar la objeción de precio, ¿hay algún script?",
  "Me cuesta calificar leads rápido en el DM, ¿algún filtro?",
  "No tengo claro qué métrica priorizar este mes",
  "¿Cómo estructuro el Offer Doc para que respondan más?",
  "Necesito feedback sobre mi pitch de la llamada",
]

const TEXTS = [
  "Mejoró el cierre y la calidad de los leads.",
  "Buen mes en contenido, falta consolidar ventas.",
  "Foco en sistematizar la prospección.",
  "Necesito apoyo con la parte de ofertas.",
  "Avanzamos bien, próximo paso es escalar ads.",
]

/** Genera el payload de un Monday Win de prueba. */
export function fakeMondayWin() {
  return {
    logro_1: `[TEST] ${pick(WINS)}`,
    logro_2: `[TEST] ${pick(WINS)}`,
    logro_3: `[TEST] ${pick(WINS)}`,
    una_sola_cosa: `[TEST] ${pick(FOCUS)}`,
    bloqueo: `[TEST] ${pick(BLOCKERS)}`,
  }
}

/** Genera valores ficticios para el formulario de Reporte Mensual.
 *  Las claves coinciden con FIELD_GROUPS de report-input-view. */
export function fakeMonthlyReport(): Record<string, string> {
  const num = (min: number, max: number) => String(randInt(min, max))
  return {
    total_revenue: num(5000, 50000),
    cash_collected: num(4000, 45000),
    mrr: num(2000, 20000),
    ad_spend: num(500, 8000),
    software_costs: num(100, 1500),
    variable_costs: num(200, 5000),
    scheduled_calls: num(10, 80),
    attended_calls: num(8, 70),
    qualified_calls: num(5, 50),
    aplications: num(5, 40),
    inbound_messages: num(50, 500),
    offer_docs_sent: num(5, 40),
    offer_docs_responded: num(3, 30),
    cierres_por_offerdoc: num(1, 15),
    new_clients: num(1, 12),
    active_clients: num(5, 40),
    short_followers: num(500, 20000),
    short_reach: num(1000, 100000),
    short_posts: num(4, 30),
    yt_subscribers: num(100, 10000),
    yt_new_subscribers: num(10, 1000),
    yt_monthly_audience: num(1000, 50000),
    yt_views: num(2000, 200000),
    yt_watch_time: num(50, 5000),
    yt_videos: num(1, 12),
    email_subscribers: num(200, 15000),
    email_new_subscribers: num(20, 1500),
    biggest_win: `[TEST] ${pick(WINS)}`,
    next_focus: `[TEST] ${pick(FOCUS)}`,
    support_needed: `[TEST] ${pick(BLOCKERS)}`,
    improvements: `[TEST] ${pick(TEXTS)}`,
    nps_score: num(7, 10),
  }
}

/** Genera valores ficticios para el formulario EOD del setter. */
export function fakeEodLog() {
  return {
    new_conversations: randInt(10, 60),
    conversations_replied: randInt(5, 40),
    qualified_leads: randInt(2, 20),
    offer_docs_sent: randInt(1, 15),
    offer_doc_responses: randInt(1, 10),
    calls_done: randInt(0, 8),
    notes: `[TEST] ${pick(TEXTS)}`,
  }
}
