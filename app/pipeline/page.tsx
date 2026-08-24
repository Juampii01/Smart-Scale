import { redirect } from "next/navigation"

// /pipeline nunca se lanzó a clientes reales (nav siempre oculto). El
// CRM interno (prompt-crm.md) pasa a ser la ubicación real, con su propio
// shell y el gate de crm_enabled. Redirect, no 404 — el cron de
// seguimiento (client-prospect-follow-up) mandó notificaciones push con
// esta URL en el pasado.
export default function PipelinePage() {
  redirect("/crm/pipeline")
}
