/**
 * Configuración de formularios de contratación por rol.
 *
 * Para agregar un puesto nuevo (closer, account manager, etc.):
 *   1. Agregar un objeto al array `TEAM_APPLICATION_FORMS`.
 *   2. Definir sus campos en `sections`.
 *   3. (Opcional) si querés que un campo del candidato sea descalificante,
 *      usá el block `gate` con la respuesta y mensaje.
 *
 * No se requiere migración de DB — los campos específicos del rol se guardan
 * en la columna JSON `answers` de la tabla `team_applications`.
 */

export type FieldType = "text" | "email" | "tel" | "textarea" | "radio"

export type FieldGate = {
  /** Si la respuesta del candidato matchea este valor → form termina con el mensaje. */
  value: string
  message: string
}

export type FormField = {
  id: string
  label: string
  /** Help text mostrado debajo del label. */
  help?: string
  type: FieldType
  /** Solo para type="radio". */
  options?: string[]
  required?: boolean
  /** Solo para type="text" / "email" / "tel". Placeholder. */
  placeholder?: string
  gate?: FieldGate
}

/** Bloque informativo entre secciones (no es un campo, es solo copy). */
export type InfoBlock = {
  type: "info"
  title?: string
  content: string
}

export type FormSection = {
  title: string
  /** Si está presente, esta sección es solo informativa. */
  info?: string
  fields?: FormField[]
}

export type RoleForm = {
  /** Identificador interno usado en la columna `role` de la DB. */
  role: string
  /** Título visible al candidato. */
  title: string
  /** Subtítulo / lead. */
  subtitle: string
  /** Texto del header del select de rol cuando hay más de uno disponible. */
  shortLabel: string
  sections: FormSection[]
}

// ─── Sección común a todos los roles ─────────────────────────────────────────

const CONTACT_SECTION: FormSection = {
  title: "Datos de contacto",
  fields: [
    { id: "first_name",       label: "Nombre",                                     type: "text",  required: true,  placeholder: "Tu nombre" },
    { id: "last_name",        label: "Apellido",                                   type: "text",  required: true,  placeholder: "Tu apellido" },
    { id: "email",            label: "Email",                                      type: "email", required: true,  placeholder: "ejemplo@email.com" },
    { id: "whatsapp",         label: "WhatsApp",                                   help: "Incluí código de país (ej: +54 9 11...)", type: "tel", required: true, placeholder: "+54 9 ..." },
    { id: "instagram_handle", label: "Instagram",                                  type: "text",  placeholder: "@usuario", required: false },
  ],
}

// ─── Form: DM Closer / VA de Ventas (rol interno: setter) ────────────────────

const SETTER_FORM: RoleForm = {
  role: "setter",
  title: "DM Closer / VA de Ventas",
  subtitle:
    "Vas a trabajar directamente con Ann, cerrando su oferta de alto ticket en conversaciones 1 a 1 (DM y llamadas). Buscamos gente con experiencia real en ventas conversacionales. Leé todo antes de aplicar.",
  shortLabel: "DM Closer / VA de Ventas",
  sections: [
    CONTACT_SECTION,
    {
      title: "Filtro inicial",
      fields: [
        {
          id: "experiencia_cerrando",
          label: "¿Tenés experiencia cerrando ventas por DM o por llamada?",
          type: "radio",
          options: ["Sí", "No"],
          required: true,
          gate: {
            value: "No",
            message:
              "Gracias por aplicar. Este puesto requiere experiencia previa cerrando ventas por DM o por llamada. Te invitamos a aplicar de nuevo cuando tengas experiencia.",
          },
        },
        {
          id: "ticket_trabajado",
          label: "¿Con qué tipo de ticket trabajaste?",
          type: "radio",
          options: ["Menos de $500", "$500 – $2.000", "$2.000 – $5.000", "$5.000+"],
          required: true,
        },
        {
          id: "crm_herramientas",
          label: "¿Qué herramientas de CRM o seguimiento de pipeline usás o usaste?",
          type: "textarea",
          required: true,
        },
      ],
    },
    {
      title: "Situación actual",
      fields: [
        {
          id: "situacion_laboral",
          label: "¿Cuál es tu situación laboral actual?",
          type: "radio",
          options: ["Empleado en relación de dependencia", "Freelance", "Sin trabajo actualmente", "Otra"],
          required: true,
        },
        {
          id: "situacion_busqueda",
          label: "¿Cuál es tu situación actual de trabajo/vida y qué te lleva a estar buscando una nueva oferta?",
          type: "textarea",
          required: true,
        },
        {
          id: "disponibilidad",
          label: "¿Cuál es tu disponibilidad horaria?",
          type: "radio",
          options: ["Part time", "Full time", "Flexible"],
          required: true,
        },
      ],
    },
    {
      title: "Antes de continuar — leé esto",
      info:
        "Este rol no es para quien busca mandar mensajes en volumen.\n\nTrabajamos con pocos leads, bien calificados. El trabajo real es organizar bien el pipeline, hacer seguimiento inteligente y maximizar cada conversación. No cerramos por cantidad — cerramos por calidad.\n\nSi tu idea de vender es mandar 100 mensajes y esperar que alguno responda, este no es tu lugar.\n\nSi en cambio sabés leer una conversación, organizás tu CRM sin que nadie te lo pida y te importa más la tasa de cierre que el volumen de contactos — seguí.",
    },
    {
      title: "Mentalidad y fit",
      fields: [
        {
          id: "venta_no_cerrada",
          label: "Describí una conversación de venta donde no cerraste. ¿Qué pasó y qué aprendiste?",
          type: "textarea",
          required: true,
        },
        {
          id: "motivacion_crecimiento",
          label: "¿Cuál es tu mayor motivación para crecer profesionalmente?",
          type: "textarea",
          required: true,
        },
        {
          id: "manejo_pipeline",
          label: "¿Cómo manejás actualmente tu pipeline o seguimiento de leads?",
          help: "Este modelo trabaja con leads inbound calificados — no hacemos volumen. Tu trabajo es maximizar cada oportunidad con organización, seguimiento y criterio.",
          type: "textarea",
          required: true,
        },
        {
          id: "diez_leads",
          label: "Si tuvieras 10 leads esta semana, ¿cómo los organizarías y priorizarías?",
          type: "textarea",
          required: true,
        },
        {
          id: "comision_performance",
          label: "El modelo es 100% por performance con comisión del 5% sobre tickets de $3.000 a $6.000 PIF. No hay sueldo fijo. ¿Cómo te sentís con eso?",
          type: "textarea",
          required: true,
        },
        {
          id: "vender_bien",
          label: '¿Qué significa para vos "vender bien"?',
          help: "Una o dos oraciones.",
          type: "textarea",
          required: true,
        },
      ],
    },
    {
      title: "La oferta de Ann",
      fields: [
        {
          id: "entiende_oferta",
          label: "¿Sabés qué vende Ann y a quién? Contanos brevemente lo que entendés de su oferta.",
          type: "textarea",
          required: true,
        },
        {
          id: "experiencia_b2b",
          label: "¿Tenés experiencia vendiendo B2B (a empresas o negocios)?",
          type: "radio",
          options: ["Sí", "No"],
          required: true,
        },
      ],
    },
  ],
}

// ─── Catálogo de roles ────────────────────────────────────────────────────────

export const TEAM_APPLICATION_FORMS: RoleForm[] = [
  SETTER_FORM,
  // Próximos roles van acá, p.ej. CLOSER_FORM, ACCOUNT_MANAGER_FORM, …
]

export const CONTACT_FIELD_IDS = CONTACT_SECTION.fields!.map(f => f.id)

export function getFormByRole(role: string): RoleForm | undefined {
  return TEAM_APPLICATION_FORMS.find(f => f.role === role)
}
