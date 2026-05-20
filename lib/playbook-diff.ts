/**
 * Diff helper para Playbook Main: ¿el único cambio entre prev y next es
 * tildar/destildar checkboxes existentes?
 *
 * Lo usan dos lugares con la misma lógica:
 *   - server: app/api/client-playbook-main/route.ts (validación de seguridad)
 *   - client: components/views/client-playbook-main-view.tsx (revert UI
 *             instantáneo cuando el cliente intenta editar texto)
 *
 * Reglas:
 *  - prev y next son arrays de blocks BlockNote
 *  - mismo length, mismo orden, mismos block ids
 *  - cada block: mismo type, mismo content (texto inline), mismos children
 *    (recursivo)
 *  - props: solo `checked` puede diferir, y solo en blocks de type
 *    "checkListItem", y solo entre booleans
 */

export function isOnlyCheckboxToggleChange(prev: unknown, next: unknown): boolean {
  if (!Array.isArray(prev) || !Array.isArray(next)) return false
  if (prev.length !== next.length) return false
  for (let i = 0; i < prev.length; i++) {
    if (!isBlockOnlyCheckboxToggleDiff(prev[i], next[i])) return false
  }
  return true
}

function isBlockOnlyCheckboxToggleDiff(a: any, b: any): boolean {
  if (a == null || b == null) return false
  if (a.id   !== b.id)   return false
  if (a.type !== b.type) return false

  if (!deepEqual(a.content, b.content)) return false

  const ach = Array.isArray(a.children) ? a.children : []
  const bch = Array.isArray(b.children) ? b.children : []
  if (ach.length !== bch.length) return false
  for (let i = 0; i < ach.length; i++) {
    if (!isBlockOnlyCheckboxToggleDiff(ach[i], bch[i])) return false
  }

  const ap = (a.props ?? {}) as Record<string, any>
  const bp = (b.props ?? {}) as Record<string, any>
  const allKeys = new Set([...Object.keys(ap), ...Object.keys(bp)])
  for (const k of allKeys) {
    if (deepEqual(ap[k], bp[k])) continue
    // Checkbox toggle (tildar/destildar)
    if (k === "checked" && a.type === "checkListItem"
        && typeof ap[k] === "boolean" && typeof bp[k] === "boolean") continue
    // Toggle/collapse de bloques (flechita en Notion-style)
    if ((k === "isCollapsed" || k === "collapsed" || k === "isOpen")
        && typeof ap[k] === "boolean" && typeof bp[k] === "boolean") continue
    return false
  }
  return true
}

function deepEqual(a: any, b: any): boolean {
  if (a === b) return true
  if (typeof a !== typeof b) return false
  if (a === null || b === null) return a === b
  if (Array.isArray(a) !== Array.isArray(b)) return false
  if (Array.isArray(a)) {
    if (a.length !== b.length) return false
    for (let i = 0; i < a.length; i++) if (!deepEqual(a[i], b[i])) return false
    return true
  }
  if (typeof a === "object") {
    const ak = Object.keys(a), bk = Object.keys(b)
    if (ak.length !== bk.length) return false
    for (const k of ak) if (!deepEqual(a[k], b[k])) return false
    return true
  }
  return false
}
