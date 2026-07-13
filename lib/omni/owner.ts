// Ann AI (ex "Omni") es un piloto interno — solo lo ve/opera el dueño del
// proyecto, Ann (la mentora sobre la que corre el piloto), y Steffano Leiva.
// Fuente única de verdad para el check, usada tanto en frontend (sidebar,
// vista) como en los guards de API.
export const OMNI_ALLOWED_EMAILS = ["juampiacosta158@gmail.com", "ann@strategycoach.us", "steffanoleivac@gmail.com"]

export function isOmniOwnerEmail(email?: string | null): boolean {
  return OMNI_ALLOWED_EMAILS.includes((email ?? "").trim().toLowerCase())
}
