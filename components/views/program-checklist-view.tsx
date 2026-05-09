"use client"

import { useState, useEffect, useCallback, useRef } from "react"
import { ExternalLink, ChevronDown, Loader2, Eye } from "lucide-react"
import { createClient } from "@/lib/supabase"
import { useActiveClient, useActiveClientName, useOwnClient } from "@/components/layout/dashboard-layout"

// ─── Data ─────────────────────────────────────────────────────────────────────

const programData: Array<{
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
          { label: "Amplifica con follow me AD el contenido que ya te trae min 30% de leads calificados organicamente", level: "Nivel 5 — Conexión & Fascinación", outcome: "Contenido", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=2a5b1b985dc645078b8f3e23097090ed" },
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

// ─── Color maps ───────────────────────────────────────────────────────────────

const levelColors: Record<string, string> = {
  "Start Here":                              "bg-blue-500/15 text-blue-500 border-blue-500/40",
  "Nivel 0 — Onboarding":                    "bg-red-500/15 text-red-500 border-red-500/40", // 🔴
  "Nivel 1 — Mente & Visión":                "bg-orange-500/15 text-orange-500 border-orange-500/40", // 🟠
  "Nivel 2 — Tu Modelo":                     "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/40", // 🟡
  "Nivel 3 — Transformación & Fundamentos":  "bg-green-500/15 text-green-600 dark:text-green-400 border-green-500/40", // 🟢
  "Nivel 4 — Comunidad Email":               "bg-blue-600/15 text-blue-600 dark:text-blue-400 border-blue-600/40", // 🔵
  "Nivel 5 — Conexión & Fascinación":        "bg-violet-500/15 text-violet-500 border-violet-500/40", // 🟤
  "Nivel 6 — Invitación & Conversión":       "bg-purple-500/15 text-purple-500 border-purple-500/40", // 🟣
  "Nivel 7 — Educando":                      "bg-foreground/[0.06] text-foreground/60 border-foreground/20", // ⚫
  "Nivel 8 — IA & Sistemas":                 "bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border-cyan-500/40", // 🤖
}

// Pills compatibles con light + dark mode. En light: fondo emerald-100 + texto emerald-800.
// En dark: fondo emerald-900/40 + texto emerald-300 (look original).
const OUTCOME_PILL = "bg-emerald-100 dark:bg-emerald-900/40"
const OUTCOME_TEXT = "text-emerald-800 dark:text-emerald-300"
const OUTCOME_BORDER = "border-emerald-400/50 dark:border-emerald-600/30"

const outcomeColors: Record<string, { bg: string; text: string; border: string; emoji: string }> = {
  "Orientación":   { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "✅" },
  "Visión Clara":  { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🎯" },
  "Hábito":        { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🔁" },
  "Mentalidad":    { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🧠" },
  "Oferta":        { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "💼" },
  "Estrategia":    { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "♟️" },
  "Ventas":        { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "💰" },
  "Contenido":     { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🎬" },
  "Email":         { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "📧" },
  "Marca":         { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "✨" },
  "Marketing":     { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "📈" },
  "Prueba Social": { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "⭐" },
  "Prospección":   { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🎯" },
  "YouTube":       { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "▶️" },
  "Auditoría":     { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🔍" },
  "Workshop":      { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🎤" },
  "Lanzamiento":   { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🚀" },
  "Sistemas":      { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "⚙️" },
  "AI":            { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "🤖" },
  "Entrega":       { bg: OUTCOME_PILL, text: OUTCOME_TEXT, border: OUTCOME_BORDER, emoji: "📦" },
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProgramChecklistView() {
  const activeClientId   = useActiveClient()
  const activeClientName = useActiveClientName()
  const ownClientId      = useOwnClient()

  const isViewingOther = !!activeClientId && !!ownClientId && activeClientId !== ownClientId

  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({})
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({})
  const [completed, setCompleted] = useState<Record<string, boolean>>({})
  const [loading, setLoading]     = useState(true)
  const [savingKeys, setSavingKeys] = useState<Set<string>>(new Set())

  // UI prefs (open/closed) siguen en localStorage — no son data del cliente
  useEffect(() => {
    const savedOpenMonths = localStorage.getItem("program-checklist-openMonths")
    const savedOpenWeeks = localStorage.getItem("program-checklist-openWeeks")
    if (savedOpenMonths) {
      setOpenMonths(JSON.parse(savedOpenMonths))
    } else {
      setOpenMonths({ [programData[0].month]: true })
      setOpenWeeks({ [programData[0].month + programData[0].weeks[0].title]: true })
    }
    if (savedOpenWeeks) setOpenWeeks(JSON.parse(savedOpenWeeks))
  }, [])

  useEffect(() => { localStorage.setItem("program-checklist-openMonths", JSON.stringify(openMonths)) }, [openMonths])
  useEffect(() => { localStorage.setItem("program-checklist-openWeeks", JSON.stringify(openWeeks)) }, [openWeeks])

  // Carga el progreso del cliente activo desde Supabase
  const supabaseRef = useRef(createClient())
  const loadProgress = useCallback(async () => {
    if (!activeClientId) {
      setCompleted({})
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const { data: { session } } = await supabaseRef.current.auth.getSession()
      if (!session) { setCompleted({}); return }
      const res = await fetch(`/api/checklist-progress?client_id=${encodeURIComponent(activeClientId)}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) { setCompleted({}); return }
      const json = await res.json()
      const map: Record<string, boolean> = {}
      for (const k of (json.tasks ?? []) as string[]) map[k] = true
      setCompleted(map)
    } catch {
      setCompleted({})
    } finally {
      setLoading(false)
    }
  }, [activeClientId])

  useEffect(() => { loadProgress() }, [loadProgress])

  const toggleMonth = (key: string) => setOpenMonths((p) => ({ ...p, [key]: !p[key] }))
  const toggleWeek  = (key: string) => setOpenWeeks((p) => ({ ...p, [key]: !p[key] }))

  const toggleTask = async (key: string) => {
    if (!activeClientId) return
    const next = !completed[key]
    // Optimista
    setCompleted((p) => ({ ...p, [key]: next }))
    setSavingKeys((s) => { const n = new Set(s); n.add(key); return n })
    try {
      const { data: { session } } = await supabaseRef.current.auth.getSession()
      if (!session) return
      await fetch("/api/checklist-progress", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ client_id: activeClientId, task_key: key, completed: next }),
      })
    } catch {
      // Rollback en error
      setCompleted((p) => ({ ...p, [key]: !next }))
    } finally {
      setSavingKeys((s) => { const n = new Set(s); n.delete(key); return n })
    }
  }

  const totalTasks = programData.flatMap((m) => m.weeks.flatMap((w) => w.tasks)).length
  const completedCount = Object.values(completed).filter(Boolean).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-foreground/70">Program Journey Checklist</h1>
          {loading && <Loader2 className="h-3.5 w-3.5 text-foreground/40 animate-spin" />}
        </div>
        <p className="text-xs text-foreground/30 ml-[18px]">Ecosistema circular mínimo viable · {completedCount}/{totalTasks} tareas completadas</p>
      </div>

      {/* Banner de "viendo cliente" — solo cuando admin está viendo otro cliente */}
      {isViewingOther && (
        <div className="flex items-center gap-3 rounded-2xl border border-[#ffde21]/25 bg-[#ffde21]/[0.05] px-4 py-3">
          <Eye className="h-4 w-4 text-[#ffde21] flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[#ffde21]/80">Viendo otro cliente</p>
            <p className="text-[13px] text-foreground/75 mt-0.5">
              Estás viendo el checklist de <span className="font-semibold text-foreground">{activeClientName ?? "(sin nombre)"}</span>. Los cambios que hagas se guardan en su cuenta.
            </p>
          </div>
        </div>
      )}

      {/* Estado vacío si no hay cliente activo */}
      {!activeClientId && !loading && (
        <div className="rounded-2xl border border-dashed border-foreground/[0.08] bg-foreground/[0.02] px-5 py-10 text-center text-sm text-foreground/40">
          No hay un cliente activo seleccionado. Cambiá de perfil desde el menú superior para ver un checklist.
        </div>
      )}

      {/* Table */}
      <div className="rounded-2xl border border-foreground/[0.08] bg-card overflow-hidden">

        {/* Column headers */}
        <div className="grid grid-cols-[130px_minmax(280px,1fr)_280px_180px_100px_180px] border-b border-foreground/[0.07] bg-foreground/[0.03]">
          {["STATUS","IMPLEMENTATION MILESTONE","LEVEL","OUTCOME","ROADMAP","URL"].map((col) => (
            <div key={col} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-foreground/55">
              {col}
            </div>
          ))}
        </div>

        {/* Months */}
        {programData.map((month) => {
          const monthTasks = month.weeks.flatMap((w) => w.tasks)
          const monthDone  = monthTasks.filter((t) => completed[month.month + t.label]).length
          const monthTotal = monthTasks.length
          const monthPct   = monthTotal ? Math.round((monthDone / monthTotal) * 100) : 0
          const isMonthOpen = openMonths[month.month]

          return (
            <div key={month.month} className="border-t border-foreground/[0.07] first:border-t-0">

              {/* Month row */}
              <div
                onClick={() => toggleMonth(month.month)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-foreground/[0.02] transition-colors select-none"
              >
                <ChevronDown
                  className={`h-4 w-4 flex-shrink-0 text-foreground/40 transition-transform duration-200 ${isMonthOpen ? "rotate-0" : "-rotate-90"}`}
                />
                <span className="flex-1 text-[14px] font-bold text-foreground">{month.month}</span>
                {/* Progress right */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[12px] text-foreground/40 tabular-nums">{monthDone}/{monthTotal}</span>
                  <div className="w-32 h-1.5 bg-foreground/[0.08] rounded-full overflow-hidden">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${monthPct}%`,
                        backgroundColor: monthPct === 100 ? "#34d399" : "#ffde21",
                      }}
                    />
                  </div>
                  <span className="text-[12px] text-foreground/40 tabular-nums w-8 text-right">{monthPct}%</span>
                </div>
              </div>

              {/* Weeks */}
              {isMonthOpen && month.weeks.map((week) => {
                const weekKey   = month.month + week.title
                const weekDone  = week.tasks.filter((t) => completed[month.month + t.label]).length
                const isWeekOpen = openWeeks[weekKey]

                return (
                  <div key={week.title} className="border-t border-foreground/[0.05]">

                    {/* Week row */}
                    <div
                      onClick={() => toggleWeek(weekKey)}
                      className="flex items-center gap-3 pl-10 pr-4 py-2.5 cursor-pointer hover:bg-foreground/[0.02] transition-colors select-none bg-foreground/[0.01]"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 flex-shrink-0 text-foreground/30 transition-transform duration-200 ${isWeekOpen ? "rotate-0" : "-rotate-90"}`}
                      />
                      <span className="h-4 w-[3px] rounded-full bg-[#ffde21]/60 flex-shrink-0" />
                      <span className="flex-1 text-[13px] font-semibold text-foreground/70">{week.title}</span>
                      <span className="text-[11px] text-foreground/30 tabular-nums flex-shrink-0">
                        {weekDone}/{week.tasks.length}
                      </span>
                    </div>

                    {/* Note banner */}
                    {isWeekOpen && week.note && (
                      <div className="mx-4 mt-2 mb-1 flex items-start gap-2.5 rounded-lg border border-amber-400 bg-amber-100 px-4 py-2.5 dark:border-amber-400/20 dark:bg-amber-500/[0.07]">
                        <span className="text-amber-700 text-[11px] flex-shrink-0 mt-0.5 dark:text-amber-400">⚡</span>
                        <p className="text-[11px] text-amber-900 leading-snug dark:text-amber-300/80">{week.note}</p>
                      </div>
                    )}

                    {/* Task rows */}
                    {isWeekOpen && week.tasks.map((task) => {
                      const taskKey = month.month + task.label
                      const isDone  = completed[taskKey]
                      const lc      = levelColors[task.level] ?? "bg-foreground/[0.04] text-foreground/40 border-foreground/10"
                      const oc      = outcomeColors[task.outcome]

                      return (
                        <div
                          key={task.label}
                          className={`grid grid-cols-[130px_minmax(280px,1fr)_280px_180px_100px_180px] border-t border-foreground/[0.04] transition-colors duration-150 ${
                            isDone ? "bg-[#ffde21]/[0.02]" : "hover:bg-foreground/[0.015]"
                          }`}
                        >
                          {/* STATUS */}
                          <div
                            className="flex items-center gap-2.5 px-4 py-3 cursor-pointer"
                            onClick={() => toggleTask(taskKey)}
                          >
                            <div
                              className={`h-5 w-5 rounded-full flex-shrink-0 border-2 flex items-center justify-center transition-all duration-200 ${
                                isDone
                                  ? "border-emerald-500 bg-emerald-500"
                                  : "border-foreground/20 bg-transparent"
                              }`}
                            >
                              {isDone && (
                                <svg className="h-2.5 w-2.5 text-foreground" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <span className={`text-[11px] ${isDone ? "text-emerald-700 dark:text-emerald-400" : "text-foreground/35"}`}>
                              {isDone ? "Completado" : "No iniciado"}
                            </span>
                          </div>

                          {/* MILESTONE */}
                          <div className="flex items-center px-4 py-3 min-w-0">
                            <span className={`text-[13px] leading-snug ${isDone ? "line-through text-foreground/25" : "text-foreground/75"}`}>
                              {task.label}
                            </span>
                          </div>

                          {/* LEVEL */}
                          <div className="flex items-center px-4 py-3">
                            <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${lc}`}>
                              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70 flex-shrink-0" />
                              {task.level}
                            </span>
                          </div>

                          {/* OUTCOME */}
                          <div className="flex items-center px-4 py-3">
                            {oc ? (
                              <span className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap ${oc.bg} ${oc.text} ${oc.border}`}>
                                {task.outcome} {oc.emoji}
                              </span>
                            ) : (
                              <span className="text-[11px] text-foreground/20">—</span>
                            )}
                          </div>

                          {/* ROADMAP */}
                          <div className="flex items-center px-4 py-3">
                            <span className="text-[11px] text-foreground/25 truncate">{week.title.split(" - ")[0]}</span>
                          </div>

                          {/* URL */}
                          <div className="flex items-center px-4 py-3">
                            {task.link === "pending" ? (
                              <span className="inline-flex items-center rounded-md border border-amber-400 bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/[0.07] dark:text-amber-400/70">
                                Módulo en creación
                              </span>
                            ) : task.link ? (
                              <a
                                href={task.link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-[11px] text-foreground/35 hover:text-[#ffde21] transition-colors truncate max-w-full"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">
                                  {task.link.replace(/^https?:\/\//, "").replace(/\?.*$/, "")}
                                </span>
                              </a>
                            ) : (
                              <span className="text-[11px] text-foreground/15">—</span>
                            )}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )
        })}
      </div>
    </div>
  )
}
