/**
 * Datos del Program Journey Checklist ("Posi") — única fuente de verdad.
 * Antes vivía hardcodeado dentro de components/views/program-checklist-view.tsx;
 * se extrae acá para que tanto la vista (cliente) como el chequeo de
 * finalización de nivel (servidor, lib/checklist-level-progress.ts) usen
 * exactamente los mismos datos — evita que se desincronicen.
 *
 * task_key = month.month + task.label (concatenado, sin separador) — así se
 * guarda hoy en client_checklist_progress, no tocar ese formato sin migrar datos.
 */

export const programData: Array<{
  month: string
  weeks: Array<{
    title: string
    note?: string
    tasks: Array<{ label: string; level: string; outcome: string; link: string }>
  }>
}> = [
  // ── MES 1 ──────────────────────────────────────────────────────────────────
  {
    month: "Mes 1 - Implementación, Visión + Modelo",
    weeks: [
      {
        title: "Semana 1 - Vision y Modelo",
        tasks: [
          { label: "Completar tu Form de Onboarding", level: "Start Here", outcome: "Orientación", link: "https://airtable.com/appRJNO1KYgg2A5NZ/pagGBbDxGKYjYTYAV/form" },
          { label: "Presentarte en Slack canal #general", level: "Start Here", outcome: "Orientación", link: "https://app.slack.com/client/T08TDSD3M2R/C08TDSDC00M" },
          { label: "Guardar los dias y horarios de las llamadas grupales en tu Calendario", level: "Start Here", outcome: "Orientación", link: "https://smartscale.space/calendar" },
          { label: "Separa 10 min cada lunes en tu calendario y lanza tus monday wins", level: "Start Here", outcome: "Hábito", link: "https://smartscale.space/monday-win" },
          { label: "Separa 15 min en tu calendario cada mes para tus monthly report", level: "Start Here", outcome: "Hábito", link: "/report-input" },
          { label: "Tu Nueva Identidad - Declaracion", level: "Nivel 1 — Mente & Visión", outcome: "Mentalidad", link: "https://www.skool.com/strategy-consulting/classroom/f41aa6b4?md=351ece87aa8a4c80914e6ce3f34af00e" },
          { label: "Pedir el libro Dollars Flow to me Easily", level: "Nivel 0 — Onboarding", outcome: "Orientación", link: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=0479e58fae32495ca6922040269a4faf" },
        ],
      },
      {
        title: "Semana 2 - Estableciendo Vision y Auditoria",
        note: "Solo si ya estás escalando y tienes autoridad suficiente puedes adelantarte y lanzar tu Quick Cash",
        tasks: [
          { label: "Quick Cash Menu (Elige el que mejor se adapte a tu instancia)", level: "Nivel 5 — Conexión & Fascinación", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/c886e8bf?md=0eebb30149694e84990fd7c3268544f8" },
          { label: "Lanza tu Cash Sprint", level: "Nivel 5 — Conexión & Fascinación", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/c886e8bf?md=0eebb30149694e84990fd7c3268544f8" },
          { label: "Calculando tu numero de libertad", level: "Nivel 0 — Onboarding", outcome: "Estrategia", link: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=b8270a0a8be84237a3d92e60b29982c1" },
          { label: "Tu Actual Sistema Operativo revisa el GPT", level: "Nivel 1 — Mente & Visión", outcome: "Estrategia", link: "https://chatgpt.com/g/g-695303d24ad08191955f15ba514cb456-descubre-tu-sistema-operativo-central" },
          { label: "Revisa Ann AI y guardalo en tus GPT's", level: "Nivel 2 — Tu Modelo", outcome: "Orientación", link: "https://chatgpt.com/g/g-695abe5acb4c8191a4092a38da71c883" },
          { label: "Accede a tu plataforma de performance y familiarizate", level: "Nivel 0 — Onboarding", outcome: "Plataforma", link: "https://smartscale.space/" },
          { label: "La Trampa del apalancamiento", level: "Nivel 2 — Tu Modelo", outcome: "Mentalidad", link: "https://www.skool.com/strategy-consulting/classroom/fa0f6055?md=6a92a4c76ae54f3b8ea194c6b629d509" },
        ],
      },
      {
        title: "Semana 3 - Metodo Matadolor",
        tasks: [
          { label: "Investigacion de Mercado para definir a tu Cliente Ideal", level: "Nivel 3 — Transformación & Fundamentos", outcome: "Oferta", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=5517d71b489548e6aa1ed63890d0a600" },
          { label: "Tu Avatar Worksheet", level: "Nivel 3 — Transformación & Fundamentos", outcome: "Oferta", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=57892d6c6c7040c6a6fd4e3f27ab38c4" },
          { label: "Programa Matadolor", level: "Nivel 3 — Transformación & Fundamentos", outcome: "Oferta", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=3114f6cc62a846a7a4f996697d45e075" },
        ],
      },
      {
        title: "Semana 4 - Transformacion & Diseño de Delivery",
        tasks: [
          { label: "Tu Roadmap", level: "Nivel 3 — Transformación & Fundamentos", outcome: "Estrategia", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=3038e1c85d064ea3af2e30952a1c71b6" },
          { label: "Tus Cinco P's", level: "Nivel 3 — Transformación & Fundamentos", outcome: "Oferta", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=52831138818048658b4fc9495ade5f61" },
          { label: "Tu Simple Oferta", level: "Nivel 3 — Transformación & Fundamentos", outcome: "Oferta", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=8ab64a0d4cf34a979f914fc2fd8eac62" },
          { label: "Constructor de tu Simple Oferta", level: "Nivel 3 — Transformación & Fundamentos", outcome: "Oferta", link: "https://chatgpt.com/g/g-695470be71ec8191b89266dbd1948663-simple-offer-builder" },
          { label: "CRM Hot List", level: "Nivel 0 — Onboarding", outcome: "Sistemas", link: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=a1738fc7ca8d49a7b4ecffb313fcac3d" },
        ],
      },
    ],
  },

  // ── MES 2 ──────────────────────────────────────────────────────────────────
  {
    month: "Mes 2 - Fascinacion y Conexion",
    weeks: [
      {
        title: "Semana 1 - Fascinacion y Conexion",
        tasks: [
          { label: "El Diamante de Autoridad & Optimizacion de BIO", level: "Nivel 5 — Conexión & Fascinación", outcome: "Marca", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=5a91a467141640bf89bd4b13141181c6" },
          { label: "Marketing de 1 hora — clase + Notion para estructurar", level: "Nivel 2 — Tu Modelo", outcome: "Marketing", link: "https://www.skool.com/strategy-consulting/classroom/522e3128?md=2d548c9f999c4c5db2793dc09ef28a90" },
          { label: "Tu creador inteligente y banco de ideas", level: "Nivel 5 — Conexión & Fascinación", outcome: "Contenido", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=b75b68859e534048bf6fcdec697b0457" },
          { label: "Tus Historias de Conversion", level: "Nivel 5 — Conexión & Fascinación", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=50f9815603874c5b859b0f70aac2d15a" },
          { label: "Crea tu calendario de contenido", level: "Nivel 5 — Conexión & Fascinación", outcome: "Contenido", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=dde2660eda3e48b09383936180dd1e1b" },
          { label: "Amplifica con follow me AD el contenido que ya te trae min 30% de leads calificados organicamente", level: "Nivel 5 — Conexión & Fascinación", outcome: "Contenido", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=2612acf4f7e64788b327f4568554abe0" },
          { label: "Tener al menos 15 piezas de contenido hablándole a tu ICP y aplicar el protocolo de Simple Ads", level: "Nivel 5 — Conexión & Fascinación", outcome: "Contenido", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=2612acf4f7e64788b327f4568554abe0" },
        ],
      },
      {
        title: "Semana 2 - Invitacion y Educacion",
        tasks: [
          { label: "Tu Simple Video (VSL)", level: "Nivel 6 — Invitación & Conversión", outcome: "Contenido", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=0bbae3a1de594f5b958e7affe859a652" },
          { label: "Youtube Mastery (1 video por semana)", level: "Nivel 7 — Educando", outcome: "YouTube", link: "https://www.skool.com/strategy-consulting/classroom/3b5a1f75?md=42479de7dc754395b7ae750d6ab6f974" },
          { label: "Elige el estilo de formato largo", level: "Nivel 7 — Educando", outcome: "YouTube", link: "https://www.skool.com/strategy-consulting/classroom/3b5a1f75?md=3adb1d05bc754fb9b0b32ec8f508bee5" },
          { label: "Elige el estilo de las miniaturas", level: "Nivel 7 — Educando", outcome: "YouTube", link: "https://www.skool.com/strategy-consulting/classroom/3b5a1f75?md=3c9f1620033e4fd78a72fddadb466b6f" },
          { label: "Lanza min 1 video de youtube a la semana", level: "Nivel 7 — Educando", outcome: "YouTube", link: "https://www.skool.com/strategy-consulting/classroom/3b5a1f75?md=3adb1d05bc754fb9b0b32ec8f508bee5" },
          { label: "Lanza 1 testimonio grabado con Riverside.io o zoom al mes", level: "Nivel 7 — Educando", outcome: "Prueba Social", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=40551f5eef354be0b3d39e19fcca079b" },
          { label: "Lanza como retargeting todos los testimonios", level: "Nivel 7 — Educando", outcome: "Prueba Social", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=e498e27a718a4fffbc45cf7e4dddcf0b" },
          { label: "Tu Offer Doc creacion", level: "Nivel 6 — Invitación & Conversión", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=9bfa0b4c8323478ca0436e75aa3ad902" },
          { label: "Tu Storytelling pineado en tu IG", level: "Nivel 5 — Conexión & Fascinación", outcome: "Marca", link: "https://www.instagram.com/p/DRSpznpEaD-/?img_index=1" },
          { label: "Tu Mecanismo Unico pineado en tu IG", level: "Nivel 3 — Transformación & Fundamentos", outcome: "Marca", link: "https://www.instagram.com/p/DHbiubtR6TT/?img_index=1" },
          { label: "Prueba social pineada en tu IG", level: "Nivel 3 — Transformación & Fundamentos", outcome: "Prueba Social", link: "https://www.instagram.com/p/DHbiubtR6TT/?img_index=1" },
          { label: "Optimiza tu calendario", level: "Nivel 5 — Conexión & Fascinación", outcome: "Hábito", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=dde2660eda3e48b09383936180dd1e1b" },
          { label: "Crea 1 post al dia (reel o carrousel)", level: "Nivel 5 — Conexión & Fascinación", outcome: "Contenido", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=2c6a3a66e89642188d34e5210dee125b" },
          { label: "Pinear valores, principales y aspiraciones en tu Instagram", level: "Nivel 5 — Conexión & Fascinación", outcome: "Marca", link: "https://www.instagram.com/p/DUYksVlEW2e/?img_index=1" },
          { label: "Pinear testimonios (screenshots o videos) en tu perfil de Instagram o highlights", level: "Nivel 3 — Transformación & Fundamentos", outcome: "Prueba Social", link: "https://www.instagram.com/p/DHbiubtR6TT/?img_index=1" },
        ],
      },
      {
        title: "Semana 3 - DM Closing y Prospeccion",
        tasks: [
          { label: "DM closing to chat flow", level: "Nivel 6 — Invitación & Conversión", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=a9d8934b41fd4138ab26c9fabc44322f" },
          { label: "Crea tu flow", level: "Nivel 6 — Invitación & Conversión", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=5a5803ca0e294156913c67c5a2d221ad" },
          { label: "Crea tu pitch de venta si todavia tomas llamadas", level: "Nivel 6 — Invitación & Conversión", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=7dd701d43d7a48209b5f061aa832abf8" },
          { label: "Crea tu Hot List y empieza a hablar con min 5 leads 5 estrellas al dia", level: "Nivel 6 — Invitación & Conversión", outcome: "Prospección", link: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=a1738fc7ca8d49a7b4ecffb313fcac3d" },
        ],
      },
      {
        title: "Semana 4 - Comunidad, Email y Marca",
        tasks: [
          { label: "Conecta tu dominio a KIT (o la plataforma que uses)", level: "Nivel 4 — Comunidad Email", outcome: "Email", link: "https://www.skool.com/strategy-consulting/classroom/b70c523e?md=e1e76ebea4364969bf2eaa75a0552461" },
          { label: "↳ Usá Google Workspace para tu email profesional (complementa el paso anterior)", level: "Nivel 4 — Comunidad Email", outcome: "Email", link: "https://www.skool.com/strategy-consulting/classroom/fa0f6055?md=8267f9e439f34297861b488bf7e79a7c" },
          { label: "Emails semanales", level: "Nivel 4 — Comunidad Email", outcome: "Email", link: "https://www.skool.com/strategy-consulting/classroom/b70c523e?md=e56ae4e1d4194784a40ae599215b24a8" },
          { label: "Crea tu mini-curso magnet en Youtube", level: "Nivel 4 — Comunidad Email", outcome: "YouTube", link: "https://www.skool.com/strategy-consulting/classroom/3b5a1f75?md=5edbbfa66f1047a0a814f29e6dd236a0" },
          { label: "Lanza tu automatizacion de bienvenida + secuencia de email a la mini serie", level: "Nivel 4 — Comunidad Email", outcome: "Email", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=87b3a0099ece4a03948b4dbdb3a77588" },
          { label: "Mapea tu Blueprint de Marca con Identidad", level: "Nivel 5 — Conexión & Fascinación", outcome: "Marca", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=cfd8870603c54aff944465e90f275111" },
        ],
      },
    ],
  },

  // ── MES 3 ──────────────────────────────────────────────────────────────────
  {
    month: "Mes 3 - No Negociables",
    weeks: [
      {
        title: "Semana 1 - No Negociables",
        tasks: [
          { label: "Estructura tus No Negociables diarios y semanales (trata de completarlos antes del medio dia)", level: "Nivel 0 — Onboarding", outcome: "Hábito", link: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=c5c75f6311a645a5867f213dde41731b" },
          { label: "Auditoria en la plataforma de performance", level: "Nivel 0 — Onboarding", outcome: "Auditoría", link: "/audit" },
        ],
      },
    ],
  },

  // ── MES 4 ──────────────────────────────────────────────────────────────────
  {
    month: "Mes 4 - Tu DDE Lanzamiento",
    weeks: [
      {
        title: "Lanzamiento",
        tasks: [
          { label: "Elige una fecha para tu workshop", level: "Nivel 5 — Conexión & Fascinación", outcome: "Workshop", link: "https://www.skool.com/strategy-consulting/classroom/c886e8bf?md=0eebb30149694e84990fd7c3268544f8" },
          { label: "Estructura titulo y tema principal del workshop", level: "Nivel 5 — Conexión & Fascinación", outcome: "Workshop", link: "https://www.skool.com/strategy-consulting/classroom/c886e8bf?md=0eebb30149694e84990fd7c3268544f8" },
          { label: "Crea la landing page del Workshop con el copy", level: "Nivel 4 — Comunidad Email", outcome: "Workshop", link: "https://www.skool.com/strategy-consulting/classroom/b70c523e?md=cfee5091576e4defb0465db9a37ac366" },
          { label: "Crea la secuencia de 5 dias de emails para el workshop", level: "Nivel 4 — Comunidad Email", outcome: "Email", link: "https://www.skool.com/strategy-consulting/classroom/b70c523e?md=7f86085e7e60436d806e9ee499de05ee" },
          { label: "Lanza la campaña en Ig, email y Youtube", level: "Nivel 5 — Conexión & Fascinación", outcome: "Lanzamiento", link: "" },
          { label: "Lanza tu primer Workshop y toma data", level: "Nivel 5 — Conexión & Fascinación", outcome: "Lanzamiento", link: "" },
        ],
      },
    ],
  },

  // ── MES 5 ──────────────────────────────────────────────────────────────────
  {
    month: "Mes 5 - Sistemas + AI",
    weeks: [
      {
        title: "Automatización y AI",
        tasks: [
          { label: "CRM y Base de Datos", level: "Nivel 8 — IA & Sistemas", outcome: "Sistemas", link: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=e40e73a9017a4d21a222c23cf1f15c16" },
          { label: "Crea tu propio Coach AI para ganar tiempo", level: "Nivel 8 — IA & Sistemas", outcome: "AI", link: "https://www.skool.com/strategy-consulting/classroom/70b44121?md=7921fc8744fe4ef08f93a16766fa2ed6" },
          { label: "Automatizando lo necesario", level: "Nivel 8 — IA & Sistemas", outcome: "AI", link: "https://www.skool.com/strategy-consulting/classroom/70b44121?md=4633193f06c64e6eb95614d4d9b511b4" },
        ],
      },
    ],
  },

  // ── MES 6 ──────────────────────────────────────────────────────────────────
  {
    month: "Mes 6 - Escalando",
    weeks: [
      {
        title: "Escalando",
        tasks: [
          { label: "Crear el Roadmap de tu Cliente", level: "Nivel 3 — Transformación & Fundamentos", outcome: "Entrega", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=3038e1c85d064ea3af2e30952a1c71b6" },
          { label: "Revisar tu proceso de Onboarding", level: "Nivel 3 — Transformación & Fundamentos", outcome: "Entrega", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=6ab1072e74324d14b2b666f30f5a7092" },
          { label: "Priorizando tu pipeline de leads 5 estrellas", level: "Nivel 6 — Invitación & Conversión", outcome: "Prospección", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=ad1eff5e3bc148dfb1fbaa577adad68c" },
          { label: "Auditoria de tu Ecosistema Circular", level: "Nivel 0 — Onboarding", outcome: "Auditoría", link: "https://smartscale.space/audit" },
          { label: "Enmarca tu Siguiente Paso para enfocarte", level: "Nivel 0 — Onboarding", outcome: "Estrategia", link: "" },
        ],
      },
    ],
  },
]

/** Niveles en orden — usado para mostrar progreso de forma consistente. */
export const LEVELS = [
  "Start Here",
  "Nivel 0 — Onboarding",
  "Nivel 1 — Mente & Visión",
  "Nivel 2 — Tu Modelo",
  "Nivel 3 — Transformación & Fundamentos",
  "Nivel 4 — Comunidad Email",
  "Nivel 5 — Conexión & Fascinación",
  "Nivel 6 — Invitación & Conversión",
  "Nivel 7 — Educando",
  "Nivel 8 — IA & Sistemas",
]

/** Agrupa los task_key (= month.month + task.label) por nivel. */
export function taskKeysByLevel(): Map<string, string[]> {
  const map = new Map<string, string[]>()
  for (const month of programData) {
    for (const week of month.weeks) {
      for (const task of week.tasks) {
        const key = month.month + task.label
        const arr = map.get(task.level) ?? []
        arr.push(key)
        map.set(task.level, arr)
      }
    }
  }
  return map
}
