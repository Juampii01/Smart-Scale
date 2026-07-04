// Omni es un piloto interno — solo lo ve/opera el dueño del proyecto, ni el
// resto de los admins (Ann incluida). Fuente única de verdad para el check,
// usada tanto en frontend (sidebar, vista) como en los guards de API.
export const OMNI_OWNER_EMAIL = "juampiacosta158@gmail.com"

export function isOmniOwnerEmail(email?: string | null): boolean {
  return (email ?? "").trim().toLowerCase() === OMNI_OWNER_EMAIL
}
