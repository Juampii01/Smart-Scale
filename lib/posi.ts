/** Único lugar donde vive el número de intentos fallidos que auto-aprueba
 *  un nivel de POSI — no hardcodear el 3 en ningún otro archivo. */
export const POSI_MAX_FAILED_ATTEMPTS = 3

/** "Aprobado" para efectos de destrabar el siguiente nivel: nota real
 *  (passed === true) o auto-aprobado por reintentos (auto_approved). No
 *  confundir con `passed`, que sigue siendo la verdad de qué contestó. */
export function isLevelApproved(sub: { passed: boolean | null; auto_approved?: boolean | null }) {
  return sub.passed === true || sub.auto_approved === true
}
