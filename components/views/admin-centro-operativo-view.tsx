"use client"

import { useEffect, useState, useRef } from "react"
import {
  Cog, BookMarked, FolderKanban, KeyRound,
  Plus, ExternalLink, Trash2, Loader2, FolderOpen,
  Search, AlertTriangle, Link2, FileText, Video, File, X,
  ChevronRight, ArrowRight, Check, Copy, Pencil, Save,
  UserPlus, ListChecks, Target,
} from "lucide-react"
import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase"
import { isAdmin, isSetter, isTeam } from "@/lib/auth/permissions"
import { NewUserDialog } from "@/components/admin/new-user-dialog"
import { AdminSOPsView } from "@/components/views/admin-sops-view"
import { AdminProspeccionView } from "@/components/views/admin-prospeccion-view"

// ─── Types ────────────────────────────────────────────────────────────────────

type ResourceType = "link" | "doc" | "video" | "file"

interface Item {
  id: string
  title: string
  url: string
  description: string | null
  content: string | null
  category: string
  type: ResourceType
  created_at: string
}

// ─── Config ───────────────────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: "sop-sistemas",
    label: "SOPs de Sistemas",
    icon: Cog,
    color: "text-blue-700 dark:text-blue-400",
    accent: "border-blue-300 bg-blue-50 dark:border-blue-400/20 dark:bg-blue-400/5",
    desc: "Automatizaciones, integraciones y documentación técnica de herramientas.",
  },
  {
    id: "sop-operativos",
    label: "SOPs Operativos",
    icon: BookMarked,
    color: "text-green-700 dark:text-green-400",
    accent: "border-green-300 bg-green-50 dark:border-green-400/20 dark:bg-green-400/5",
    desc: "Procesos internos paso a paso: onboarding, seguimiento, cierre.",
  },
  {
    id: "recursos-internos",
    label: "Recursos Internos",
    icon: FolderKanban,
    color: "text-purple-700 dark:text-purple-400",
    accent: "border-purple-300 bg-purple-50 dark:border-purple-400/20 dark:bg-purple-400/5",
    desc: "Links, plantillas, documentos y materiales del equipo.",
  },
  {
    id: "accesos",
    label: "Accesos y Herramientas",
    icon: KeyRound,
    color: "text-amber-700 dark:text-amber-400",
    accent: "border-amber-300 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-400/5",
    desc: "Referencia de herramientas del stack. No guardar contraseñas en texto plano.",
  },
  {
    id: "sops",
    label: "SOPs",
    icon: ListChecks,
    color: "text-pink-700 dark:text-pink-400",
    accent: "border-pink-300 bg-pink-50 dark:border-pink-400/20 dark:bg-pink-400/5",
    desc: "Playbooks operativos con pasos numerados y templates copiables (Skool, Slack, etc.).",
  },
  {
    id: "prospeccion",
    label: "Prospección",
    icon: Target,
    color: "text-cyan-700 dark:text-cyan-400",
    accent: "border-cyan-300 bg-cyan-50 dark:border-cyan-400/20 dark:bg-cyan-400/5",
    desc: "Workspace privado del setter: listas, scripts, notas y follow-ups. Cada setter ve solo lo suyo.",
  },
] as const

type SectionId = (typeof SECTIONS)[number]["id"]

const TYPE_CONFIG: Record<ResourceType, { label: string; icon: React.ElementType; color: string }> = {
  link:  { label: "Link",    icon: Link2,    color: "text-blue-400"   },
  doc:   { label: "Doc",     icon: FileText,  color: "text-green-400"  },
  video: { label: "Video",   icon: Video,     color: "text-purple-400" },
  file:  { label: "Archivo", icon: File,      color: "text-amber-400"  },
}

// ─── Templates ────────────────────────────────────────────────────────────────

const TEMPLATES: Partial<Record<SectionId, { label: string; content: string }[]>> = {
  "sop-sistemas": [
    {
      label: "SOP de herramienta",
      content: `## ¿Qué hace esta herramienta?
[Describir en 1-2 líneas para qué sirve]

## Automatizaciones existentes
- Automatización 1: [qué hace, qué dispara, qué produce]
- Automatización 2: [qué hace, qué dispara, qué produce]

## Herramientas que conecta
→ [Herramienta A] → [Herramienta B] → [Resultado]

## Cómo acceder
- URL:
- Usuario: [ver gestor de claves]
- Documentación:

## Qué hacer si hay un error
1. Verificar [paso 1]
2. Revisar [paso 2]
3. Si persiste: contactar a [responsable]

## Dónde revisar cada automatización
- [Link al panel]`,
    },
  ],
  "sop-operativos": [
    {
      label: "SOP de proceso",
      content: `## Objetivo del proceso
[Qué logra este proceso y cuándo se activa]

## Paso a paso

→ Paso 1: [Acción]
   - Qué hacer:
   - Link:
   - Herramienta:

→ Paso 2: [Acción]
   - Qué hacer:
   - Link:
   - Herramienta:

→ Paso 3: [Acción]
   - Qué hacer:
   - Link:
   - Herramienta:

## Herramientas involucradas
- [Herramienta 1]
- [Herramienta 2]

## Qué revisar si algo falla
1. [Check 1]
2. [Check 2]
3. Escalar a: [responsable]

## Links útiles
- [Link 1]:
- [Link 2]: `,
    },
    {
      label: "SOP de onboarding",
      content: `## Objetivo
Dar de alta a un nuevo cliente en todos los sistemas de SmartScale.

## Paso a paso

→ Paso 1: Crear perfil en el CRM
   - Ir a: smartscale.space/admin/clients
   - Completar: nombre, email, canal, programa, cuotas

→ Paso 2: Enviar accesos al cliente
   - Herramienta: [email / Slack]
   - Template: [link al template]

→ Paso 3: Configurar en Zapier
   - Automatización: [nombre de la zap]
   - Verificar que se dispare correctamente

→ Paso 4: Agendar primera llamada
   - Herramienta: Calendly / Google Calendar
   - Link:

→ Paso 5: Confirmar onboarding completo
   - Marcar como "activo" en el CRM

## Qué revisar si algo falla
1. Verificar que el email no fue a spam
2. Revisar logs de Zapier
3. Contactar a: [responsable]`,
    },
  ],
  "recursos-internos": [
    {
      label: "Recurso interno",
      content: `## Descripción
[Para qué sirve este recurso y cuándo usarlo]

## Links
- Principal:
- Backup / alternativo:

## Notas de uso
[Instrucciones o contexto importante]

## Última revisión
[Fecha y por quién]`,
    },
  ],
  "accesos": [
    {
      label: "Acceso a herramienta",
      content: `## Herramienta
[Nombre de la herramienta]

## URL de acceso
[URL]

## Credenciales
- Email/usuario: [especificar]
- Contraseña: Ver gestor de claves del equipo (NO guardar aquí)

## Permisos / plan
[Qué plan tenemos, qué features incluye]

## Quién tiene acceso
- [Persona 1]
- [Persona 2]

## Notas
[Contexto adicional, renovación, fecha de vencimiento, etc.]`,
    },
  ],
}

const MOCK_SEED: Omit<Item, "id" | "created_at">[] = [
  {
    title: "SOP Zapier — Automatizaciones internas",
    url: "#",
    description: "Qué automatizaciones existen, cómo funcionan y qué hacer si hay un error.",
    content: `## ¿Qué hace esta herramienta?
Zapier conecta automáticamente las herramientas del equipo de SmartScale y ejecuta tareas sin intervención manual.

## Automatizaciones existentes
- Zap 1: Nuevo lead en formulario → CRM (SmartScale)
- Zap 2: Pago confirmado → Email de bienvenida al cliente
- Zap 3: Reporte mensual enviado → Notificación en Slack

## Herramientas que conecta
→ Typeform → SmartScale CRM → Slack
→ Stripe → Email (Gmail) → CRM

## Cómo acceder
- URL: https://zapier.com
- Usuario: Ver gestor de claves del equipo
- Documentación: https://zapier.com/help

## Qué hacer si hay un error
1. Ir a Zapier → Task History y ver el error exacto
2. Verificar que los campos mapeados siguen existiendo en la fuente
3. Revisar si el token de conexión expiró (reconectar la app)
4. Si persiste: escalar a [responsable técnico]

## Dónde revisar cada automatización
- Panel de Zaps: https://zapier.com/app/zaps
- Task History: https://zapier.com/app/history`,
    category: "sop-sistemas",
    type: "doc",
  },
  {
    title: "SOP Onboarding — Alta de clientes",
    url: "#",
    description: "Proceso paso a paso para dar de alta un nuevo cliente.",
    content: `## Objetivo
Dar de alta a un nuevo cliente en todos los sistemas de SmartScale correctamente.

## Paso a paso

→ Paso 1: Crear perfil en el CRM
   - Ir a: smartscale.space/admin/clients
   - Completar: nombre, email, canal, programa, cuotas
   - Estado inicial: "activo"

→ Paso 2: Enviar accesos al cliente
   - Herramienta: Gmail
   - Template: [link al template de bienvenida]
   - Asegurarse de incluir: usuario, contraseña temporal, link al portal

→ Paso 3: Configurar automatizaciones en Zapier
   - Verificar que se dispare la Zap de nuevo cliente
   - Confirmar que el cliente aparece en el CRM

→ Paso 4: Agendar primera llamada de kickoff
   - Herramienta: Calendly
   - Enviar link de agendamiento al cliente

→ Paso 5: Confirmar onboarding completo
   - Checklist: perfil en CRM ✓, accesos enviados ✓, llamada agendada ✓

## Qué revisar si algo falla
1. Si el email no llegó: verificar spam o error en dirección
2. Si Zapier no se disparó: revisar Task History en Zapier
3. Escalar a: [responsable]`,
    category: "sop-operativos",
    type: "doc",
  },
  {
    title: "Plantillas internas de seguimiento",
    url: "#",
    description: "Plantillas del equipo para seguimiento semanal y reportes.",
    content: `## Descripción
Colección de plantillas que usa el equipo de SmartScale para el seguimiento interno de clientes y métricas.

## Links
- Plantilla semanal: [agregar link]
- Plantilla de reporte mensual: [agregar link]
- Plantilla de onboarding checklist: [agregar link]

## Notas de uso
Copiar la plantilla antes de usar. No editar el original.

## Última revisión
[Agregar fecha]`,
    category: "recursos-internos",
    type: "file",
  },
  {
    title: "Links importantes del equipo",
    url: "#",
    description: "Links frecuentes del equipo: Drive, Notion, herramientas.",
    content: `## Descripción
Colección de links que el equipo usa frecuentemente.

## Links
- Drive del equipo: [agregar link]
- Notion / base de conocimiento: [agregar link]
- Portal SmartScale: https://smartscale.space
- CRM interno: https://smartscale.space/admin/clients
- Zapier: https://zapier.com
- Panel de pagos: [agregar link]

## Notas de uso
Actualizar cuando se agreguen nuevas herramientas al stack.

## Última revisión
[Agregar fecha]`,
    category: "recursos-internos",
    type: "link",
  },
  {
    title: "Acceso Zapier",
    url: "https://zapier.com",
    description: "Acceso a la cuenta de Zapier del equipo SmartScale.",
    content: `## Herramienta
Zapier — plataforma de automatizaciones

## URL de acceso
https://zapier.com

## Credenciales
- Email/usuario: Ver gestor de claves del equipo
- Contraseña: Ver gestor de claves del equipo (NO guardar aquí)

## Permisos / plan
Plan Profesional — incluye Zaps ilimitadas y acceso multi-usuario

## Quién tiene acceso
- [Agregar personas con acceso]

## Notas
Renovación anual. Verificar fecha de vencimiento en la cuenta.`,
    category: "accesos",
    type: "link",
  },
]

// ─── Content Renderer ─────────────────────────────────────────────────────────

function ContentRenderer({ content }: { content: string }) {
  const lines = content.split("\n")

  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (line.startsWith("## ")) {
          return (
            <h3 key={i} className="text-sm font-semibold text-foreground mt-5 mb-2 first:mt-0">
              {line.replace("## ", "")}
            </h3>
          )
        }
        if (line.startsWith("→ ")) {
          return (
            <div key={i} className="flex items-start gap-2 py-1">
              <ArrowRight className="h-3.5 w-3.5 text-[#ffde21] flex-shrink-0 mt-0.5" />
              <span className="text-sm text-foreground/80 font-medium">{line.replace("→ ", "")}</span>
            </div>
          )
        }
        if (line.match(/^- /)) {
          return (
            <div key={i} className="flex items-start gap-2 pl-2 py-0.5">
              <span className="h-1.5 w-1.5 rounded-full bg-foreground/20 flex-shrink-0 mt-2" />
              <span className="text-xs text-foreground/50 leading-relaxed">{line.replace(/^- /, "")}</span>
            </div>
          )
        }
        if (line.match(/^\d+\. /)) {
          const num = line.match(/^(\d+)\. /)?.[1]
          return (
            <div key={i} className="flex items-start gap-2.5 pl-2 py-0.5">
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#ffde21]/15 text-[10px] font-bold text-[#ffde21] flex-shrink-0 mt-0.5">
                {num}
              </span>
              <span className="text-xs text-foreground/50 leading-relaxed">{line.replace(/^\d+\. /, "")}</span>
            </div>
          )
        }
        if (line.trim() === "") return <div key={i} className="h-1" />
        return (
          <p key={i} className="text-xs text-foreground/50 leading-relaxed pl-2">{line}</p>
        )
      })}
    </div>
  )
}

// ─── SOP Modal ────────────────────────────────────────────────────────────────

function SOPModal({
  item,
  sectionId,
  onClose,
  onUpdate,
  onDelete,
}: {
  item: Item
  sectionId: SectionId
  onClose: () => void
  onUpdate: (updated: Item) => void
  onDelete: (id: string) => void
}) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.link
  const Icon = cfg.icon
  const [editing, setEditing] = useState(false)
  const [content, setContent] = useState(item.content ?? "")
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [copied, setCopied] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const isAccesos = sectionId === "accesos"
  const templates = TEMPLATES[sectionId] ?? []

  const date = new Date(item.created_at).toLocaleDateString("es-AR", {
    day: "2-digit", month: "long", year: "numeric",
  })

  const handleSave = async () => {
    setSaving(true)
    try {
      const res = await fetch("/api/resources", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: item.id, content }),
      })
      const data = await res.json()
      if (res.ok) {
        onUpdate({ ...item, content })
        setEditing(false)
      } else {
        alert(data.error || "Error al guardar")
      }
    } finally { setSaving(false) }
  }

  const handleDelete = async () => {
    if (!confirm(`¿Eliminar "${item.title}"?`)) return
    setDeleting(true)
    try {
      await fetch(`/api/resources?id=${item.id}`, { method: "DELETE" })
      onDelete(item.id)
      onClose()
    } finally { setDeleting(false) }
  }

  const applyTemplate = (tmpl: { content: string }) => {
    setContent(tmpl.content)
    setEditing(true)
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="relative z-10 flex flex-col w-full max-w-2xl max-h-[90vh] rounded-2xl border border-foreground/[0.1] bg-card shadow-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-start gap-3 p-5 border-b border-foreground/[0.07] flex-shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.05] flex-shrink-0">
            <Icon className={`h-5 w-5 ${cfg.color}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-foreground leading-snug">{item.title}</h2>
            {item.description && (
              <p className="text-xs text-foreground/40 mt-0.5">{item.description}</p>
            )}
            <div className="flex items-center gap-3 mt-1.5">
              <span className={`text-[10px] font-semibold uppercase tracking-widest ${cfg.color}`}>
                {cfg.label}
              </span>
              <span className="text-[10px] text-foreground/20">{date}</span>
              {item.url && item.url !== "#" && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 text-[10px] font-medium text-[#ffde21]/60 hover:text-[#ffde21] transition-colors"
                >
                  <ExternalLink className="h-3 w-3" />
                  Abrir link
                </a>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex-shrink-0 text-foreground/30 hover:text-foreground/60 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Security warning for accesos */}
        {isAccesos && (
          <div className="flex items-start gap-2.5 mx-5 mt-4 rounded-xl border border-amber-400 bg-amber-100 dark:border-amber-400/20 dark:bg-amber-400/5 px-4 py-3 flex-shrink-0">
            <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-900 dark:text-amber-300/70 leading-relaxed">
              <span className="font-bold text-amber-950 dark:font-semibold dark:text-amber-300">No guardes contraseñas aquí.</span>{" "}
              Solo referencias (email, usuario). Las credenciales deben estar en el gestor de claves del equipo.
            </p>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Templates — only when no content */}
          {!content && !editing && templates.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-foreground/30 mb-2">
                Comenzar con un template
              </p>
              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => applyTemplate(t)}
                    className="flex items-center gap-1.5 rounded-lg border border-foreground/[0.08] bg-foreground/[0.03] px-3 py-1.5 text-xs text-foreground/50 hover:text-foreground hover:bg-foreground/[0.07] transition-all"
                  >
                    <Copy className="h-3 w-3" />
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Content area */}
          {editing ? (
            <textarea
              ref={textareaRef}
              value={content}
              onChange={e => setContent(e.target.value)}
              autoFocus
              rows={20}
              placeholder={`Escribí el contenido del SOP...\n\nUsá:\n## Título de sección\n→ Paso con flecha\n- Ítem de lista\n1. Paso numerado`}
              className="w-full rounded-xl bg-foreground/[0.04] border border-[#ffde21]/20 px-4 py-3 text-sm text-foreground/80 placeholder-white/20 focus:outline-none focus:border-[#ffde21]/40 resize-none leading-relaxed font-mono"
            />
          ) : content ? (
            <ContentRenderer content={content} />
          ) : (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <FileText className="h-8 w-8 text-foreground/10" />
              <p className="text-xs text-foreground/20 text-center">
                Este SOP todavía no tiene contenido.<br />
                Usá un template o escribí desde cero.
              </p>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between gap-3 p-4 border-t border-foreground/[0.07] flex-shrink-0">
          <div className="flex items-center gap-2">
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-foreground/30 hover:text-red-400 hover:bg-red-400/5 border border-transparent hover:border-red-400/10 transition-all"
            >
              {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
              Eliminar
            </button>
            {content && !editing && (
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs text-foreground/30 hover:text-foreground/60 border border-transparent hover:border-foreground/[0.08] transition-all"
              >
                {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? "Copiado" : "Copiar"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => { setContent(item.content ?? ""); setEditing(false) }}
                  className="rounded-lg px-3 py-1.5 text-xs text-foreground/40 hover:text-foreground/60 transition-colors"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-xl bg-[#ffde21] px-4 py-1.5 text-xs font-semibold text-black hover:bg-[#ffde21]/90 transition-colors disabled:opacity-50"
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
                  Guardar
                </button>
              </>
            ) : (
              <button
                onClick={() => setEditing(true)}
                className="flex items-center gap-1.5 rounded-xl bg-foreground/[0.07] px-4 py-1.5 text-xs font-semibold text-foreground hover:bg-foreground/[0.12] transition-colors border border-foreground/[0.08]"
              >
                <Pencil className="h-3.5 w-3.5" />
                Editar
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Add Item Form ─────────────────────────────────────────────────────────────

function AddItemForm({
  sectionId,
  onAdd,
  onClose,
}: {
  sectionId: SectionId
  onAdd: (item: Item) => void
  onClose: () => void
}) {
  const [form, setForm] = useState({
    title: "",
    url: "",
    description: "",
    type: "link" as ResourceType,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const isAccesos = sectionId === "accesos"

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.title.trim()) { setError("El título es requerido"); return }
    setLoading(true); setError("")
    try {
      const res = await fetch("/api/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...form, category: sectionId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || "Error al guardar"); return }
      onAdd(data.resource)
      onClose()
    } catch { setError("Error de conexión") }
    finally { setLoading(false) }
  }

  return (
    <div className="rounded-2xl border border-[#ffde21]/20 bg-card p-5 mb-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">Nuevo ítem</h3>
        <button onClick={onClose} className="text-foreground/30 hover:text-foreground/60 transition-colors">
          <X className="h-4 w-4" />
        </button>
      </div>

      {isAccesos && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400 bg-amber-100 dark:border-amber-400/20 dark:bg-amber-400/5 px-4 py-3 mb-4">
          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 dark:text-amber-300/80 leading-relaxed">
            <span className="font-bold text-amber-950 dark:font-semibold dark:text-amber-300">No guardes contraseñas en texto plano.</span>{" "}
            Solo referencias (email, usuario, dónde encontrar las credenciales).
          </p>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <input
          type="text"
          placeholder="Título *"
          value={form.title}
          onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
          className="w-full rounded-xl bg-foreground/[0.05] border border-foreground/[0.08] px-3 py-2.5 text-sm text-foreground placeholder-white/30 focus:outline-none focus:border-[#ffde21]/40"
        />
        <input
          type="text"
          placeholder={isAccesos ? "URL de la herramienta (opcional)" : "URL (opcional)"}
          value={form.url}
          onChange={e => setForm(f => ({ ...f, url: e.target.value }))}
          className="w-full rounded-xl bg-foreground/[0.05] border border-foreground/[0.08] px-3 py-2.5 text-sm text-foreground placeholder-white/30 focus:outline-none focus:border-[#ffde21]/40"
        />
        <textarea
          placeholder="Descripción breve (opcional)"
          value={form.description}
          rows={2}
          onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
          className="w-full rounded-xl bg-foreground/[0.05] border border-foreground/[0.08] px-3 py-2.5 text-sm text-foreground placeholder-white/30 focus:outline-none focus:border-[#ffde21]/40 resize-none"
        />
        <div className="flex gap-2 flex-wrap">
          {(Object.keys(TYPE_CONFIG) as ResourceType[]).map(t => {
            const cfg = TYPE_CONFIG[t]
            return (
              <button
                key={t}
                type="button"
                onClick={() => setForm(f => ({ ...f, type: t }))}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium border transition-all ${
                  form.type === t
                    ? "border-[#ffde21]/40 bg-[#ffde21]/10 text-[#ffde21]"
                    : "border-foreground/[0.08] bg-foreground/[0.03] text-foreground/40 hover:text-foreground/70"
                }`}
              >
                <cfg.icon className="h-3 w-3" />
                {cfg.label}
              </button>
            )
          })}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2 text-sm font-semibold text-black hover:bg-[#ffde21]/90 transition-colors disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
            Crear
          </button>
        </div>
      </form>
    </div>
  )
}

// ─── Item Row ──────────────────────────────────────────────────────────────────

function ItemRow({
  item,
  onClick,
}: {
  item: Item
  onClick: () => void
}) {
  const cfg = TYPE_CONFIG[item.type] ?? TYPE_CONFIG.link
  const Icon = cfg.icon
  const hasContent = !!item.content

  return (
    <button
      onClick={onClick}
      className="w-full group flex items-center gap-3 rounded-2xl border border-foreground/[0.07] bg-card px-4 py-3.5 hover:border-foreground/[0.15] hover:bg-foreground/[0.03] transition-all text-left"
    >
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground/[0.05] flex-shrink-0">
        <Icon className={`h-4 w-4 ${cfg.color}`} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground truncate">{item.title}</p>
        {item.description && (
          <p className="text-xs text-foreground/35 truncate mt-0.5">{item.description}</p>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {hasContent && (
          <span className="text-[10px] font-semibold text-green-800 bg-green-100 dark:text-green-400/60 dark:bg-green-400/10 rounded-full px-2 py-0.5">
            Documentado
          </span>
        )}
        <ChevronRight className="h-4 w-4 text-foreground/20 group-hover:text-foreground/50 transition-colors" />
      </div>
    </button>
  )
}

// ─── Section Panel ─────────────────────────────────────────────────────────────

function SectionPanel({
  section,
  items,
  onAdd,
  onUpdate,
  onDelete,
}: {
  section: (typeof SECTIONS)[number]
  items: Item[]
  onAdd: (item: Item) => void
  onUpdate: (item: Item) => void
  onDelete: (id: string) => void
}) {
  const [showForm, setShowForm] = useState(false)
  const [search, setSearch] = useState("")
  const [activeItem, setActiveItem] = useState<Item | null>(null)
  const Icon = section.icon
  const isAccesos = section.id === "accesos"

  const filtered = items.filter(
    i =>
      search === "" ||
      i.title.toLowerCase().includes(search.toLowerCase()) ||
      i.description?.toLowerCase().includes(search.toLowerCase()),
  )

  return (
    <div className="space-y-4">
      {/* Section header */}
      <div className={`flex items-start gap-3 rounded-2xl border p-4 ${section.accent}`}>
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-foreground/[0.05] flex-shrink-0">
          <Icon className={`h-5 w-5 ${section.color}`} />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold text-foreground">{section.label}</h2>
          <p className="text-xs text-foreground/40 mt-0.5">{section.desc}</p>
        </div>
        <span className="text-[10px] font-semibold text-foreground/20 bg-foreground/[0.05] rounded-full px-2.5 py-1 flex-shrink-0">
          {items.length}
        </span>
      </div>

      {isAccesos && (
        <div className="flex items-start gap-2.5 rounded-xl border border-amber-400 bg-amber-100 dark:border-amber-400/20 dark:bg-amber-400/5 px-4 py-3">
          <AlertTriangle className="h-4 w-4 text-amber-700 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-900 dark:text-amber-300/70 leading-relaxed">
            <span className="font-bold text-amber-950 dark:font-semibold dark:text-amber-300">Aviso de seguridad:</span>{" "}
            Guardá solo referencias (email, usuario, dónde están las credenciales). Las contraseñas deben
            vivir en el gestor de claves del equipo.
          </p>
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-foreground/30" />
          <input
            type="text"
            placeholder="Buscar…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full rounded-xl bg-foreground/[0.05] border border-foreground/[0.08] pl-9 pr-4 py-2 text-sm text-foreground placeholder-white/30 focus:outline-none focus:border-[#ffde21]/40"
          />
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 rounded-xl bg-[#ffde21] px-3.5 py-2 text-sm font-semibold text-black hover:bg-[#ffde21]/90 transition-colors whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          Agregar
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <AddItemForm
          sectionId={section.id}
          onAdd={item => { onAdd(item); setShowForm(false) }}
          onClose={() => setShowForm(false)}
        />
      )}

      {/* Items list */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-14 gap-3">
          <FolderOpen className="h-8 w-8 text-foreground/10" />
          <p className="text-xs text-foreground/20">
            {search ? "Sin resultados" : "Todavía no hay ítems en esta sección"}
          </p>
          {!showForm && !search && (
            <button
              onClick={() => setShowForm(true)}
              className="text-xs text-[#ffde21]/40 hover:text-[#ffde21] transition-colors"
            >
              + Agregar el primero
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(item => (
            <ItemRow
              key={item.id}
              item={item}
              onClick={() => setActiveItem(item)}
            />
          ))}
        </div>
      )}

      {/* Modal */}
      {activeItem && (
        <SOPModal
          item={activeItem}
          sectionId={section.id}
          onClose={() => setActiveItem(null)}
          onUpdate={updated => {
            onUpdate(updated)
            setActiveItem(updated)
          }}
          onDelete={id => {
            onDelete(id)
            setActiveItem(null)
          }}
        />
      )}
    </div>
  )
}

// ─── Main View ─────────────────────────────────────────────────────────────────

export function AdminCentroOperativoView() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [activeSection, setActiveSection] = useState<SectionId>("sop-sistemas")
  const [userRole, setUserRole] = useState<string | null>(null)
  const [newUserOpen, setNewUserOpen] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) return
      supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle()
        .then(({ data: prof }) => {
          const role = (prof as any)?.role ?? null
          setUserRole(role)
          // Setter solo ve "Prospección" — auto-seleccionarla al entrar.
          if (isSetter(role)) setActiveSection("prospeccion")
        })
    })
  }, [])

  // Filtro de secciones por rol:
  //  - admin: todas (incluido Prospección, para audit)
  //  - team:  todas EXCEPTO Prospección (es privada del setter)
  //  - setter: SOLO Prospección (no ve SOPs, Recursos, Accesos — info sensible)
  const visibleSections = SECTIONS.filter(s => {
    if (isSetter(userRole)) return s.id === "prospeccion"
    if (isTeam(userRole))   return s.id !== "prospeccion"
    return true  // admin ve todo
  })

  useEffect(() => {
    fetch("/api/resources")
      .then(r => r.json())
      .then(d => {
        const fetched: Item[] = d.resources ?? []
        const opCats: string[] = SECTIONS.map(s => s.id)
        const existing = fetched.filter(i => opCats.includes(i.category))
        if (existing.length === 0) {
          const seeded = MOCK_SEED.map((s, idx) => ({
            ...s,
            id: `mock-${idx}`,
            created_at: new Date().toISOString(),
          }))
          setItems([...fetched.filter(i => !opCats.includes(i.category)), ...seeded])
        } else {
          setItems(fetched)
        }
      })
      .finally(() => setLoading(false))
  }, [])

  const section = SECTIONS.find(s => s.id === activeSection)!
  const sectionItems = items.filter(i => i.category === activeSection)

  const handleAdd    = (item: Item)   => setItems(prev => [item, ...prev])
  const handleUpdate = (item: Item)   => setItems(prev => prev.map(i => i.id === item.id ? item : i))
  const handleDelete = (id: string)   => setItems(prev => prev.filter(i => i.id !== id))

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5 mb-1">
            <span className="h-4 w-[3px] rounded-full bg-[#ffde21]" />
            <h1 className="text-sm font-semibold uppercase tracking-widest text-foreground/70">Centro Operativo</h1>
          </div>
          <p className="text-xs text-foreground/30 ml-[18px]">
            Base interna de SOPs, recursos, accesos y procesos del equipo SmartScale.
          </p>
        </div>

        {isAdmin(userRole) && (
          <button
            onClick={() => setNewUserOpen(true)}
            className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#ffde21] px-4 py-2 text-sm font-bold text-black hover:bg-[#ffe84d] transition-colors"
            title="Crear cuenta de usuario interna"
          >
            <UserPlus className="h-4 w-4" />
            Nuevo usuario
          </button>
        )}
      </div>

      <NewUserDialog open={newUserOpen} onClose={() => setNewUserOpen(false)} />

      {/* Section tabs — filtradas por rol */}
      <div className="flex gap-2 flex-wrap">
        {visibleSections.map(s => {
          const Icon = s.icon
          const count = items.filter(i => i.category === s.id).length
          const isActive = activeSection === s.id
          // Las secciones "sops" y "prospeccion" usan otra tabla (no centro_operativo_items)
          // por lo que el count de items no aplica.
          const hideCount = s.id === "sops" || s.id === "prospeccion"
          return (
            <button
              key={s.id}
              onClick={() => setActiveSection(s.id)}
              className={cn(
                "flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-medium border transition-all",
                isActive
                  ? "border-[#ffde21]/30 bg-[#ffde21]/10 text-[#ffde21]"
                  : "border-foreground/[0.08] bg-foreground/[0.03] text-foreground/50 hover:text-foreground/80 hover:bg-foreground/[0.06]",
              )}
            >
              <Icon className={`h-3.5 w-3.5 ${isActive ? "text-[#ffde21]" : s.color}`} />
              {s.label}
              {!hideCount && (
                <span className={cn(
                  "text-[10px] rounded-full px-1.5 py-0.5",
                  isActive ? "bg-[#ffde21]/20 text-[#ffde21]" : "bg-foreground/[0.07] text-foreground/30",
                )}>
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Active section */}
      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-foreground/20" />
        </div>
      ) : activeSection === "sops" ? (
        <AdminSOPsView userRole={userRole} />
      ) : activeSection === "prospeccion" ? (
        <AdminProspeccionView />
      ) : (
        <SectionPanel
          section={section as Exclude<typeof section, { id: "sops" | "prospeccion" }>}
          items={sectionItems}
          onAdd={handleAdd}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
        />
      )}
    </div>
  )
}
