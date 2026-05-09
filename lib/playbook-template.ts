/**
 * Playbook seed — los 4 documentos que se autocrean en la tab "Documentos"
 * cuando admin/team entra al portal de un cliente que aún no tiene páginas.
 *
 * Sin AI prompts. Annie (la coach) llena el contenido en vivo durante las
 * sesiones de onboarding. El template solo da la estructura inicial: 4 docs
 * vacíos con título + ícono + un párrafo placeholder.
 */

export interface SeedPage {
  title:    string
  icon:     string
  /** BlockNote document — array de blocks. Vacío = un párrafo en blanco. */
  content:  any[]
}

export const PLAYBOOK_SEED: SeedPage[] = [
  {
    title:   "Investigación",
    icon:    "🔍",
    content: [],
  },
  {
    title:   "Avatar",
    icon:    "👤",
    content: [],
  },
  {
    title:   "Oferta",
    icon:    "💎",
    content: [],
  },
  {
    title:   "IP",
    icon:    "🧠",
    content: [],
  },
]
