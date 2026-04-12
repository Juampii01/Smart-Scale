"use client"

import { useState, useEffect } from "react"
import { ExternalLink, ChevronDown } from "lucide-react"

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
          { label: "Tu Nueva Identidad - Declaracion", level: "Start Here", outcome: "Mentalidad", link: "https://www.skool.com/strategy-consulting/classroom/f41aa6b4?md=351ece87aa8a4c80914e6ce3f34af00e" },
          { label: "Pedir el libro Dollars Flow to me Easily", level: "Start Here", outcome: "Orientación", link: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=0479e58fae32495ca6922040269a4faf" },
        ],
      },
      {
        title: "Semana 2 - Estableciendo Vision y Auditoria",
        note: "Solo si ya estás escalando y tienes autoridad suficiente puedes adelantarte y lanzar tu Quick Cash",
        tasks: [
          { label: "Quick Cash Menu (Elige el que mejor se adapte a tu instancia)", level: "Nivel 1 — Visión", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/c886e8bf?md=0eebb30149694e84990fd7c3268544f8" },
          { label: "Lanza tu Cash Sprint", level: "Nivel 1 — Visión", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/c886e8bf?md=0eebb30149694e84990fd7c3268544f8" },
          { label: "Calculando tu numero de libertad", level: "Nivel 1 — Visión", outcome: "Estrategia", link: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=b8270a0a8be84237a3d92e60b29982c1" },
          { label: "Tu Actual Sistema Operativo revisa el GPT", level: "Nivel 1 — Visión", outcome: "Estrategia", link: "https://chatgpt.com/g/g-695303d24ad08191955f15ba514cb456-descubre-tu-sistema-operativo-central" },
          { label: "Revisa Ann AI y guardalo en tus GPT's", level: "Start Here", outcome: "Orientación", link: "https://chatgpt.com/g/g-695abe5acb4c8191a4092a38da71c883" },
          { label: "Accede a tu plataforma de performance y familiarizate", level: "Start Here", outcome: "Plataforma", link: "https://smartscale.space/" },
          { label: "La Trampa del apalancamiento", level: "Nivel 1 — Visión", outcome: "Mentalidad", link: "https://www.skool.com/strategy-consulting/classroom/fa0f6055?md=6a92a4c76ae54f3b8ea194c6b629d509" },
        ],
      },
      {
        title: "Semana 3 - Metodo Matadolor",
        tasks: [
          { label: "Investigacion de Mercado para definir a tu Cliente Ideal", level: "Nivel 1 — Visión", outcome: "Oferta", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=5517d71b489548e6aa1ed63890d0a600" },
          { label: "Tu Avatar Worksheet", level: "Nivel 1 — Visión", outcome: "Oferta", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=57892d6c6c7040c6a6fd4e3f27ab38c4" },
          { label: "Programa Matadolor", level: "Nivel 1 — Visión", outcome: "Oferta", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=3114f6cc62a846a7a4f996697d45e075" },
        ],
      },
      {
        title: "Semana 4 - Transformacion & Diseño de Delivery",
        tasks: [
          { label: "Tu Roadmap", level: "Nivel 1 — Visión", outcome: "Estrategia", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=3038e1c85d064ea3af2e30952a1c71b6" },
          { label: "Tus Cinco P's", level: "Nivel 1 — Visión", outcome: "Oferta", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=52831138818048658b4fc9495ade5f61" },
          { label: "Tu Simple Oferta", level: "Nivel 1 — Visión", outcome: "Oferta", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=8ab64a0d4cf34a979f914fc2fd8eac62" },
          { label: "Constructor de tu Simple Oferta", level: "Nivel 1 — Visión", outcome: "Oferta", link: "https://chatgpt.com/g/g-695470be71ec8191b89266dbd1948663-simple-offer-builder" },
          { label: "CRM Airtable", level: "Nivel 1 — Visión", outcome: "Sistemas", link: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=a1738fc7ca8d49a7b4ecffb313fcac3d" },
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
          { label: "El Diamante de Autoridad & Optimizacion de BIO", level: "Nivel 2 — Fascinación", outcome: "Marca", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=5a91a467141640bf89bd4b13141181c6" },
          { label: "Tu creador inteligente y banco de ideas", level: "Nivel 2 — Fascinación", outcome: "Contenido", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=b75b68859e534048bf6fcdec697b0457" },
          { label: "Tus Historias de Conversion", level: "Nivel 2 — Fascinación", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=50f9815603874c5b859b0f70aac2d15a" },
          { label: "Crea tu calendario de contenido", level: "Nivel 2 — Fascinación", outcome: "Contenido", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=dde2660eda3e48b09383936180dd1e1b" },
          { label: "Amplifica con follow me AD el contenido que ya te trae min 30% de leads calificados organicamente", level: "Nivel 2 — Fascinación", outcome: "Contenido", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=2a5b1b985dc645078b8f3e23097090ed" },
        ],
      },
      {
        title: "Semana 2 - Invitacion y Educacion",
        tasks: [
          { label: "Tu Simple Video (VSL)", level: "Nivel 2 — Fascinación", outcome: "Contenido", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=0bbae3a1de594f5b958e7affe859a652" },
          { label: "Quick Cash Menu (Elige el que mejor se adapte a tu instancia)", level: "Nivel 2 — Fascinación", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/c886e8bf?md=0eebb30149694e84990fd7c3268544f8" },
          { label: "Lanza tu Cash Sprint", level: "Nivel 2 — Fascinación", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/c886e8bf?md=0eebb30149694e84990fd7c3268544f8" },
          { label: "Tu Offer Doc creacion", level: "Nivel 2 — Fascinación", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=9bfa0b4c8323478ca0436e75aa3ad902" },
          { label: "Tu Storytelling pineado en tu IG", level: "Nivel 2 — Fascinación", outcome: "Marca", link: "https://www.instagram.com/p/DRSpznpEaD-/?img_index=1" },
          { label: "Tu Mecanismo Unico pineado en tu IG", level: "Nivel 2 — Fascinación", outcome: "Marca", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=5517d71b489548e6aa1ed63890d0a600" },
          { label: "Prueba social pineada en tu IG", level: "Nivel 2 — Fascinación", outcome: "Prueba Social", link: "https://www.instagram.com/p/DHbiubtR6TT/?img_index=1" },
          { label: "Optimiza tu calendario", level: "Nivel 2 — Fascinación", outcome: "Hábito", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=dde2660eda3e48b09383936180dd1e1b" },
          { label: "Crea 1 post al dia (reel o carrousel)", level: "Nivel 2 — Fascinación", outcome: "Contenido", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=2c6a3a66e89642188d34e5210dee125b" },
          { label: "Valores principales / aspiraciones (historia de conversion)", level: "Nivel 2 — Fascinación", outcome: "Marca", link: "https://www.instagram.com/p/DUYksVlEW2e/?img_index=1" },
          { label: "Testimonios (screenshots o videos)", level: "Nivel 2 — Fascinación", outcome: "Prueba Social", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=6b66e086de2f44feb598e4d7e8c9e0b9" },
        ],
      },
      {
        title: "Semana 3 - DM Closing y Prospeccion",
        tasks: [
          { label: "DM closing to chat flow", level: "Nivel 2 — Fascinación", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=a9d8934b41fd4138ab26c9fabc44322f" },
          { label: "Crea tu flow", level: "Nivel 2 — Fascinación", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=5a5803ca0e294156913c67c5a2d221ad" },
          { label: "Crea tu pitch de venta si todavia tomas llamadas", level: "Nivel 2 — Fascinación", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=7dd701d43d7a48209b5f061aa832abf8" },
          { label: "Revisa todo el modulo y arma tu pitch", level: "Nivel 2 — Fascinación", outcome: "Ventas", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=a9d8934b41fd4138ab26c9fabc44322f" },
          { label: "Crea tu Hot List y empieza a hablar con min 5 leads 5 estrellas al dia", level: "Nivel 2 — Fascinación", outcome: "Prospección", link: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=a1738fc7ca8d49a7b4ecffb313fcac3d" },
        ],
      },
      {
        title: "Semana 4 - Comunidad, Email y Marca",
        tasks: [
          { label: "Conecta tu dominio a KIT (o la plataforma que uses)", level: "Nivel 2 — Fascinación", outcome: "Email", link: "https://www.skool.com/strategy-consulting/classroom/b70c523e?md=e1e76ebea4364969bf2eaa75a0552461" },
          { label: "Usa Google Workspace + tu email profesional", level: "Nivel 2 — Fascinación", outcome: "Email", link: "https://www.skool.com/strategy-consulting/classroom/fa0f6055?md=8267f9e439f34297861b488bf7e79a7c" },
          { label: "Emails semanales", level: "Nivel 2 — Fascinación", outcome: "Email", link: "https://www.skool.com/strategy-consulting/classroom/b70c523e?md=e56ae4e1d4194784a40ae599215b24a8" },
          { label: "Crea tu mini-curso magnet en Youtube", level: "Nivel 2 — Fascinación", outcome: "YouTube", link: "https://www.skool.com/strategy-consulting/classroom/3b5a1f75?md=5edbbfa66f1047a0a814f29e6dd236a0" },
          { label: "Lanza tu automatizacion de bienvenida + secuencia de email a la mini serie", level: "Nivel 2 — Fascinación", outcome: "Email", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=87b3a0099ece4a03948b4dbdb3a77588" },
          { label: "Mapea tu Blueprint de Marca con Identidad", level: "Nivel 2 — Fascinación", outcome: "Marca", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=cfd8870603c54aff944465e90f275111" },
        ],
      },
    ],
  },

  // ── MES 3 ──────────────────────────────────────────────────────────────────
  {
    month: "Mes 3 - Youtube y No Negociables",
    weeks: [
      {
        title: "Semana 1 - YouTube Mastery",
        tasks: [
          { label: "Youtube Mastery (1 video por semana)", level: "Nivel 3 — YouTube", outcome: "YouTube", link: "https://www.skool.com/strategy-consulting/classroom/3b5a1f75?md=42479de7dc754395b7ae750d6ab6f974" },
          { label: "Elige el estilo de formato largo", level: "Nivel 3 — YouTube", outcome: "YouTube", link: "https://www.skool.com/strategy-consulting/classroom/3b5a1f75?md=3adb1d05bc754fb9b0b32ec8f508bee5" },
          { label: "Elige el estilo de las miniaturas", level: "Nivel 3 — YouTube", outcome: "YouTube", link: "https://www.skool.com/strategy-consulting/classroom/3b5a1f75?md=3c9f1620033e4fd78a72fddadb466b6f" },
          { label: "Lanza min 1 video de youtube a la semana", level: "Nivel 3 — YouTube", outcome: "YouTube", link: "https://www.skool.com/strategy-consulting/classroom/3b5a1f75?md=3adb1d05bc754fb9b0b32ec8f508bee5" },
          { label: "Lanza 1 testimonio grabado con Riverside.io o zoom al mes", level: "Nivel 3 — YouTube", outcome: "Prueba Social", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=40551f5eef354be0b3d39e19fcca079b" },
          { label: "Lanza como retargeting todos los testimonios", level: "Nivel 3 — YouTube", outcome: "Prueba Social", link: "https://www.skool.com/strategy-consulting/classroom/6de08095?md=e498e27a718a4fffbc45cf7e4dddcf0b" },
        ],
      },
      {
        title: "Semana 2 - No Negociables",
        tasks: [
          { label: "Estructura tus No Negociables diarios y semanales (trata de completarlos antes del medio dia)", level: "Nivel 3 — YouTube", outcome: "Hábito", link: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=c5c75f6311a645a5867f213dde41731b" },
          { label: "Auditoria en la plataforma de performance", level: "Nivel 3 — YouTube", outcome: "Auditoría", link: "/audit" },
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
          { label: "Elige una fecha para tu workshop", level: "Nivel 4 — Lanzamiento", outcome: "Workshop", link: "https://www.skool.com/strategy-consulting/classroom/c886e8bf?md=0eebb30149694e84990fd7c3268544f8" },
          { label: "Estructura titulo y tema principal del workshop", level: "Nivel 4 — Lanzamiento", outcome: "Workshop", link: "https://www.skool.com/strategy-consulting/classroom/c886e8bf?md=0eebb30149694e84990fd7c3268544f8" },
          { label: "Crea la landing page del Workshop con el copy", level: "Nivel 4 — Lanzamiento", outcome: "Workshop", link: "https://www.skool.com/strategy-consulting/classroom/b70c523e?md=cfee5091576e4defb0465db9a37ac366" },
          { label: "Crea la secuencia de 5 dias de emails para el workshop", level: "Nivel 4 — Lanzamiento", outcome: "Email", link: "https://www.skool.com/strategy-consulting/classroom/b70c523e?md=7f86085e7e60436d806e9ee499de05ee" },
          { label: "Lanza la campaña en Ig, email y Youtube", level: "Nivel 4 — Lanzamiento", outcome: "Lanzamiento", link: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=cb32e2ecee074f60bb7be5211efd60ef" },
          { label: "Lanza tu primer Workshop y toma data", level: "Nivel 4 — Lanzamiento", outcome: "Lanzamiento", link: "pending" },
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
          { label: "Airtable + CRM", level: "Nivel 5 — Sistemas", outcome: "Sistemas", link: "https://www.skool.com/strategy-consulting/classroom/552a38a7?md=e40e73a9017a4d21a222c23cf1f15c16" },
          { label: "Crea tu propio Coach AI para ganar tiempo", level: "Nivel 5 — Sistemas", outcome: "AI", link: "https://www.skool.com/strategy-consulting/classroom/70b44121?md=7921fc8744fe4ef08f93a16766fa2ed6" },
          { label: "Automatizando lo necesario", level: "Nivel 5 — Sistemas", outcome: "AI", link: "https://www.skool.com/strategy-consulting/classroom/70b44121?md=4633193f06c64e6eb95614d4d9b511b4" },
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
          { label: "Crear el Roadmap de tu Cliente", level: "Nivel 6 — Escala", outcome: "Entrega", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=3038e1c85d064ea3af2e30952a1c71b6" },
          { label: "Revisar tu proceso de Onboarding", level: "Nivel 6 — Escala", outcome: "Entrega", link: "https://www.skool.com/strategy-consulting/classroom/fb42ffd4?md=6ab1072e74324d14b2b666f30f5a7092" },
          { label: "Priorizando tu pipeline de leads 5 estrellas", level: "Nivel 6 — Escala", outcome: "Prospección", link: "https://www.skool.com/strategy-consulting/classroom/cd022ec1?md=ad1eff5e3bc148dfb1fbaa577adad68c" },
          { label: "Auditoria de tu Ecosistema Circular", level: "Nivel 6 — Escala", outcome: "Auditoría", link: "https://smartscale.space/audit" },
          { label: "Enmarca tu Siguiente Paso para enfocarte", level: "Nivel 6 — Escala", outcome: "Estrategia", link: "" },
        ],
      },
    ],
  },
]

// ─── Color maps ───────────────────────────────────────────────────────────────

const levelColors: Record<string, string> = {
  "Start Here":           "bg-[#1e3a5f] text-[#60a5fa] border-[#2563ab]/40",
  "Nivel 1 — Visión":     "bg-[#1a3a4a] text-[#38bdf8] border-[#0ea5e9]/40",
  "Nivel 2 — Fascinación":"bg-[#2a1f4a] text-[#a78bfa] border-[#7c3aed]/40",
  "Nivel 3 — YouTube":    "bg-[#3a1a1a] text-[#f87171] border-[#dc2626]/40",
  "Nivel 4 — Lanzamiento":"bg-[#3a2a10] text-[#fbbf24] border-[#d97706]/40",
  "Nivel 5 — Sistemas":   "bg-[#1a3a2a] text-[#34d399] border-[#059669]/40",
  "Nivel 6 — Escala":     "bg-[#2a3a1a] text-[#a3e635] border-[#65a30d]/40",
}

const outcomeColors: Record<string, { bg: string; text: string; border: string; emoji: string }> = {
  "Orientación":   { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "✅" },
  "Visión Clara":  { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "🎯" },
  "Hábito":        { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "🔁" },
  "Mentalidad":    { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "🧠" },
  "Oferta":        { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "💼" },
  "Estrategia":    { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "♟️" },
  "Ventas":        { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "💰" },
  "Contenido":     { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "🎬" },
  "Email":         { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "📧" },
  "Marca":         { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "✨" },
  "Prueba Social": { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "⭐" },
  "Prospección":   { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "🎯" },
  "YouTube":       { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "▶️" },
  "Auditoría":     { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "🔍" },
  "Workshop":      { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "🎤" },
  "Lanzamiento":   { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "🚀" },
  "Sistemas":      { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "⚙️" },
  "AI":            { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "🤖" },
  "Entrega":       { bg: "bg-emerald-900/40", text: "text-emerald-300", border: "border-emerald-600/30", emoji: "📦" },
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ProgramChecklistView() {
  const [openMonths, setOpenMonths] = useState<Record<string, boolean>>({})
  const [openWeeks, setOpenWeeks] = useState<Record<string, boolean>>({})
  const [completed, setCompleted] = useState<Record<string, boolean>>({})

  useEffect(() => {
    const savedCompleted = localStorage.getItem("program-checklist-completed")
    const savedOpenMonths = localStorage.getItem("program-checklist-openMonths")
    const savedOpenWeeks = localStorage.getItem("program-checklist-openWeeks")
    if (savedCompleted) setCompleted(JSON.parse(savedCompleted))
    if (savedOpenMonths) {
      setOpenMonths(JSON.parse(savedOpenMonths))
    } else {
      setOpenMonths({ [programData[0].month]: true })
      setOpenWeeks({ [programData[0].month + programData[0].weeks[0].title]: true })
    }
    if (savedOpenWeeks) setOpenWeeks(JSON.parse(savedOpenWeeks))
  }, [])

  useEffect(() => { localStorage.setItem("program-checklist-completed", JSON.stringify(completed)) }, [completed])
  useEffect(() => { localStorage.setItem("program-checklist-openMonths", JSON.stringify(openMonths)) }, [openMonths])
  useEffect(() => { localStorage.setItem("program-checklist-openWeeks", JSON.stringify(openWeeks)) }, [openWeeks])

  const toggleMonth = (key: string) => setOpenMonths((p) => ({ ...p, [key]: !p[key] }))
  const toggleWeek  = (key: string) => setOpenWeeks((p) => ({ ...p, [key]: !p[key] }))
  const toggleTask  = (key: string) => setCompleted((p) => ({ ...p, [key]: !p[key] }))

  const totalTasks = programData.flatMap((m) => m.weeks.flatMap((w) => w.tasks)).length
  const completedCount = Object.values(completed).filter(Boolean).length

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5 mb-1">
          <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
          <h1 className="text-sm font-semibold uppercase tracking-widest text-white/70">Program Journey Checklist</h1>
        </div>
        <p className="text-xs text-white/30 ml-[18px]">Ecosistema circular mínimo viable · {completedCount}/{totalTasks} tareas completadas</p>
      </div>

      {/* Table */}
      <div className="rounded-2xl border border-white/[0.08] bg-[#0f1011] overflow-hidden">

        {/* Column headers */}
        <div className="grid grid-cols-[140px_1fr_180px_185px_110px_200px] border-b border-white/[0.07] bg-[#141416]">
          {["STATUS","IMPLEMENTATION MILESTONE","LEVEL","OUTCOME","ROADMAP","URL"].map((col) => (
            <div key={col} className="px-4 py-3 text-[10px] font-semibold uppercase tracking-widest text-white/25">
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
            <div key={month.month} className="border-t border-white/[0.07] first:border-t-0">

              {/* Month row */}
              <div
                onClick={() => toggleMonth(month.month)}
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-white/[0.02] transition-colors select-none"
              >
                <ChevronDown
                  className={`h-4 w-4 flex-shrink-0 text-white/40 transition-transform duration-200 ${isMonthOpen ? "rotate-0" : "-rotate-90"}`}
                />
                <span className="flex-1 text-[14px] font-bold text-white">{month.month}</span>
                {/* Progress right */}
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[12px] text-white/40 tabular-nums">{monthDone}/{monthTotal}</span>
                  <div className="w-32 h-1.5 bg-white/[0.08] rounded-full overflow-hidden">
                    <div
                      className="h-1.5 rounded-full transition-all duration-500"
                      style={{
                        width: `${monthPct}%`,
                        backgroundColor: monthPct === 100 ? "#34d399" : "#ffde21",
                      }}
                    />
                  </div>
                  <span className="text-[12px] text-white/40 tabular-nums w-8 text-right">{monthPct}%</span>
                </div>
              </div>

              {/* Weeks */}
              {isMonthOpen && month.weeks.map((week) => {
                const weekKey   = month.month + week.title
                const weekDone  = week.tasks.filter((t) => completed[month.month + t.label]).length
                const isWeekOpen = openWeeks[weekKey]

                return (
                  <div key={week.title} className="border-t border-white/[0.05]">

                    {/* Week row */}
                    <div
                      onClick={() => toggleWeek(weekKey)}
                      className="flex items-center gap-3 pl-10 pr-4 py-2.5 cursor-pointer hover:bg-white/[0.02] transition-colors select-none bg-white/[0.01]"
                    >
                      <ChevronDown
                        className={`h-3.5 w-3.5 flex-shrink-0 text-white/30 transition-transform duration-200 ${isWeekOpen ? "rotate-0" : "-rotate-90"}`}
                      />
                      <span className="h-4 w-[3px] rounded-full bg-[#ffde21]/60 flex-shrink-0" />
                      <span className="flex-1 text-[13px] font-semibold text-white/70">{week.title}</span>
                      <span className="text-[11px] text-white/30 tabular-nums flex-shrink-0">
                        {weekDone}/{week.tasks.length}
                      </span>
                    </div>

                    {/* Note banner */}
                    {isWeekOpen && week.note && (
                      <div className="mx-4 mt-2 mb-1 flex items-start gap-2.5 rounded-lg border border-amber-400/20 bg-amber-500/[0.07] px-4 py-2.5">
                        <span className="text-amber-400 text-[11px] flex-shrink-0 mt-0.5">⚡</span>
                        <p className="text-[11px] text-amber-300/80 leading-snug">{week.note}</p>
                      </div>
                    )}

                    {/* Task rows */}
                    {isWeekOpen && week.tasks.map((task) => {
                      const taskKey = month.month + task.label
                      const isDone  = completed[taskKey]
                      const lc      = levelColors[task.level] ?? "bg-white/[0.04] text-white/40 border-white/10"
                      const oc      = outcomeColors[task.outcome]

                      return (
                        <div
                          key={task.label}
                          className={`grid grid-cols-[140px_1fr_180px_185px_110px_200px] border-t border-white/[0.04] transition-colors duration-150 ${
                            isDone ? "bg-[#ffde21]/[0.02]" : "hover:bg-white/[0.015]"
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
                                  : "border-white/20 bg-transparent"
                              }`}
                            >
                              {isDone && (
                                <svg className="h-2.5 w-2.5 text-white" viewBox="0 0 10 10" fill="none">
                                  <path d="M2 5l2.5 2.5L8 3" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                                </svg>
                              )}
                            </div>
                            <span className={`text-[11px] ${isDone ? "text-emerald-400" : "text-white/35"}`}>
                              {isDone ? "Completado" : "No iniciado"}
                            </span>
                          </div>

                          {/* MILESTONE */}
                          <div className="flex items-center px-4 py-3 min-w-0">
                            <span className={`text-[13px] leading-snug ${isDone ? "line-through text-white/25" : "text-white/75"}`}>
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
                              <span className="text-[11px] text-white/20">—</span>
                            )}
                          </div>

                          {/* ROADMAP */}
                          <div className="flex items-center px-4 py-3">
                            <span className="text-[11px] text-white/25 truncate">{week.title.split(" - ")[0]}</span>
                          </div>

                          {/* URL */}
                          <div className="flex items-center px-4 py-3">
                            {task.link === "pending" ? (
                              <span className="inline-flex items-center rounded-md border border-amber-500/20 bg-amber-500/[0.07] px-2 py-0.5 text-[10px] font-medium text-amber-400/70">
                                Módulo en creación
                              </span>
                            ) : task.link ? (
                              <a
                                href={task.link}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center gap-1.5 text-[11px] text-white/35 hover:text-[#ffde21] transition-colors truncate max-w-full"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <ExternalLink className="h-3 w-3 flex-shrink-0" />
                                <span className="truncate">
                                  {task.link.replace(/^https?:\/\//, "").replace(/\?.*$/, "")}
                                </span>
                              </a>
                            ) : (
                              <span className="text-[11px] text-white/15">—</span>
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
