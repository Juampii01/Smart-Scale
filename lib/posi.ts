/** Único lugar donde vive el número de intentos fallidos que auto-aprueba
 *  un nivel de POSI — no hardcodear el 3 en ningún otro archivo. */
export const POSI_MAX_FAILED_ATTEMPTS = 3

/** "Aprobado" para efectos de destrabar el siguiente nivel: nota real
 *  (passed === true) o auto-aprobado por reintentos (auto_approved). No
 *  confundir con `passed`, que sigue siendo la verdad de qué contestó. */
export function isLevelApproved(sub: { passed: boolean | null; auto_approved?: boolean | null }) {
  return sub.passed === true || sub.auto_approved === true
}

/** Email con el que Skool identifica al miembro. Vive únicamente en
 *  `clients.skool_email` — se precarga al crear la cuenta de portal (ver
 *  app/api/admin/users/create/route.ts) y Ann lo pisa a mano si el de Skool
 *  es distinto. Sin fallback en tiempo real: ni `clients` ni `profiles`
 *  tienen otra columna de email (solo vive en auth.users), así que no hay
 *  nada más a lo que recurrir acá — si esto da null, el destrabe queda
 *  failed/sin_email y Ann lo ve en la alerta de configuración incompleta. */
export function resolveSkoolEmail(client: { skool_email?: string | null }): string | null {
  return client.skool_email?.trim() || null
}
