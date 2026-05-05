# Resumen de la sesión — 4–5 mayo 2026

Documento del trabajo de hoy en el dashboard de Smart Scale. Pensado para releer dentro de un mes y entender qué se cambió, por qué, y qué hace falta para activar cada cosa.

---

## Índice

1. [Form de Contratación de equipo](#1-form-de-contratación-de-equipo)
2. [Audit con IA real](#2-audit-con-ia-real)
3. [Implementación checklist por cliente](#3-implementación-checklist-por-cliente)
4. [Auditoría completa del checklist](#4-auditoría-completa-del-checklist)
5. [Smart Scale Internal — área separada](#5-smart-scale-internal--área-separada)
6. [Adquisition Stats reorganizado](#6-adquisition-stats-reorganizado)
7. [Sidebar colapsable](#7-sidebar-colapsable)
8. [CRM con plan mensual auto-renovable](#8-crm-con-plan-mensual-auto-renovable)
9. [Forms personales siempre van a tu cuenta](#9-forms-personales-siempre-van-a-tu-cuenta)
10. [Research/Transcript/Video Feed por cliente](#10-researchtranscriptvideo-feed-por-cliente)
11. [Asistente IA del dashboard](#11-asistente-ia-del-dashboard)
12. [Auditoría UX y mejoras de intuitividad](#12-auditoría-ux-y-mejoras-de-intuitividad)
13. [Eliminación de Airtable](#13-eliminación-de-airtable)
14. [Cosas pendientes (manuales) para activar todo](#14-cosas-pendientes-manuales-para-activar-todo)

---

## 1) Form de Contratación de equipo

**Por qué**: Ann quería un formulario para que candidatas/os al equipo (DM Closer, Setter, etc.) se postularan, y poder revisarlos desde el admin.

**Qué se armó**:

- **Form público** en `https://smartscale.space/aplicar-equipo/setter` (URL dinámica por rol — para agregar otro puesto solo hay que editar `lib/team-application-forms.ts`).
- **Misma estética** que el form de `/apply` (consistencia con la marca).
- **Gates** — si la candidata responde "No tengo experiencia cerrando", el form bloquea con mensaje amable y no permite enviar.
- **Sección admin** en `/admin/team-applications`:
  - Filtros por rol y por estado (nueva, revisando, descartada, aprobada, contratada).
  - Drawer de detalle con todas las respuestas.
  - Edición de status y notas internas.
  - Export CSV.
  - Búsqueda.
- **Notificación a Slack** vía Zapier con un Zap dedicado (webhook `uvp3wxx`). Mensaje con nombre, rol al que aplicó, email/whatsapp/IG, disponibilidad, situación laboral, etc.
- **Tabla nueva** `team_applications` en Supabase con JSON column `answers` (extensible — nuevo rol = nuevos campos sin migración de DB).

**Estado**: deployado y funcionando.

---

## 2) Audit con IA real

**Por qué**: el audit anterior generaba un diagnóstico determinístico tipo plantilla. Querías que la IA escribiera el copy real de los focos.

**Qué se armó**:

- **Cards de "Resultado por módulo"** — 4 cards (Fascinate, Educate, Transform, Invite) cada una con score X/6, barra de progreso coloreada según estado (Sólido / En construcción / Cuello de botella) y 3 dots por ítem.
- **Cards de "Tu foco este trimestre"** — 2 cards con badges de prioridad (rojo "Ataca esto primero" y amber "Una vez estabilices X").
- **Diagnóstico generado por Claude Haiku** — texto en segunda persona, específico, sin lenguaje motivacional vacío. La IA solo escribe el título y las 2-3 oraciones del diagnóstico; el scoring, tie-break y selección de módulo siguen determinísticos para máxima confiabilidad.
- **Botón "Dirigite al módulo X en Nivel Y — te va a ayudar a resolver esto"** — copy claro y útil, no genérico.
- **9 mapeos de módulos Skool actualizados** (F2, F3, E1, I3, F4, F5, E4, T5, T6, E6) para que cada ítem del audit apunte al módulo correcto.
- **Backwards compat**: diagnósticos viejos en el historial siguen renderizando con el formato markdown viejo.

**Estado**: deployado y funcionando.

---

## 3) Implementación checklist por cliente

**Por qué**: Ann descubrió que cuando cambiaba al perfil de Alberto y le mostraba el checklist, **veía sus propios checks** — porque el progreso estaba guardado en `localStorage` del navegador, no por cliente.

**Qué se armó**:

- **Tabla nueva** `client_checklist_progress` en Supabase indexada por `(client_id, task_key)`.
- **Endpoint `/api/checklist-progress`** (GET/POST) con auth: cliente solo lee/escribe el suyo, admin puede cualquier.
- **View modificada** para usar `useActiveClient()` — cuando admin cambia el dropdown del header, recarga el progreso del cliente activo.
- **Banner amarillo "Viendo otro cliente: Alberto"** cuando admin está viendo a otro perfil.
- **Optimistic update** + rollback si falla la API (UX rápida).
- Las preferencias de UI (qué mes/semana está abierto) siguen en `localStorage` porque son preferencia personal, no data del cliente.

**Estado**: deployado y funcionando.

---

## 4) Auditoría completa del checklist

**Por qué**: Ann revisó el checklist con Juampi y notó múltiples problemas — items duplicados, mal ubicados en el flujo, niveles Skool incorrectos, links rotos, labels confusos.

**Qué se hizo** (en varios pases):

### a) Eliminaciones / movimientos

- "Quick Cash Menu" duplicado en Mes 2/Sem 2 → eliminado.
- "Lanza tu Cash Sprint" mal ubicado → eliminado.
- "Crea tu pitch / Revisa el módulo" duplicado en DM Closing → unificado.
- **Youtube Mastery completo** (6 sub-items) movido de Mes 3 → Mes 2/Sem 2 (Educación). Mes 3 ahora se llama "Mes 3 - No Negociables".
- Marketing 1 hora reposicionado arriba de "Tu creador inteligente".

### b) Renames clarificadores

- "Valores principales / aspiraciones (historia de conversion)" → **"Pinear valores, principales y aspiraciones en tu Instagram"**.
- "Testimonios (screenshots o videos)" → **"Pinear testimonios (screenshots o videos) en tu perfil de Instagram o highlights"**.
- "Usa Google Workspace + email profesional" → **"↳ Usá Google Workspace para tu email profesional (complementa el paso anterior)"** (con flecha para mostrar la jerarquía).

### c) Re-clasificación de niveles Skool (~50 tareas afectadas)

El campo `level` de cada tarea ahora coincide con el **nivel canónico de Skool** (0-8) en lugar de inventos viejos (Nivel 1 Visión, Nivel 2 Fascinación, etc.). Ejemplos:

- "Tu Simple Video (VSL)" Nivel 2 → **Nivel 6 — Invitación & Conversión**.
- Youtube Mastery × 6 Nivel 3 → **Nivel 7 — Educando**.
- "Tu Roadmap", "Matadolor", "Cinco P's" Nivel 1 → **Nivel 3 — Transformación & Fundamentos**.
- "Quick Cash" Nivel 1 → **Nivel 5 — Conexión & Fascinación**.
- "Conecta dominio KIT", emails semanales Nivel 2 → **Nivel 4 — Comunidad Email**.
- "DM closing", pitch, Hot List Nivel 2 → **Nivel 6 — Invitación & Conversión**.
- "Coach AI", Automatización Nivel 5 → **Nivel 8 — IA & Sistemas**.
- "CRM Airtable" del Mes 1 (explicación del CRM como herramienta) → **Nivel 0 — Onboarding**.

Cada nivel ahora tiene su color distintivo (🔴🟠🟡🟢🔵🟤🟣⚫🤖) y la columna LEVEL de la tabla se ensanchó a 280px para que los nombres largos no se solapen con la columna de outcome.

### d) Links actualizados

- "Tu Mecanismo Único pineado en tu IG" → link a IG `DHbiubtR6TT`.
- "Pinear testimonios" → mismo link IG.
- "Marketing de 1 hora" → link al módulo Skool `522e3128`.
- Mes 4 last 2 tasks (campaña + workshop) → sin link.

**Estado**: deployado y funcionando.

---

## 5) Smart Scale Internal — área separada

**Por qué**: el dashboard mezclaba el portal del coach (Performance, Programa, Contenido) con el CRM admin (Leads, Pagos, Clientes, etc.) en el mismo sidebar. Ann quería que el área admin se sintiera como **un dashboard propio**, separado.

**Qué se armó**:

- **Sidebar principal limpia** — 3 grupos: Performance, Programa, Contenido. **Sin** los 8 items del CRM.
- **Botón "Smart Scale Internal"** amarillo al pie del sidebar (solo visible para admins). Click → entra al área internal.
- **AdminSidebar dedicada** ([components/layout/admin-sidebar.tsx](components/layout/admin-sidebar.tsx)) cuando estás en `/admin/*`:
  - Logo Smart Scale + badge "INTERNAL" amarillo.
  - Botón "← Volver al portal" arriba.
  - 7 items del CRM: Adquisition Stats, Leads, Pagos, Clientes, Aplicaciones, Contratación, Centro Operativo (sacamos "Importar Datos").
- **DashboardLayout detecta** `/admin/*` y renderiza la sidebar correspondiente. En modo internal:
  - Oculta los CTAs amarillos (Monday Win, Reporte Mensual, Cha-Ching).
  - Oculta el MonthSelector.
  - Agrega badge "INTERNAL" amarillo al lado del page title.

**Arquitectura preparada para el futuro**: cuando los coaches tengan su propio "dashboard interno con su CRM", se replica el mismo patrón con otra sidebar dedicada.

**Estado**: deployado y funcionando.

---

## 6) Adquisition Stats reorganizado

**Por qué**: la antigua "Tabla de Datos" tenía las métricas como filas y los meses como columnas. Ann pidió flippearla.

**Qué se hizo**:

- **Renombrado** "Tabla de Datos" → **"Adquisition Stats"** en sidebar, page title y H1.
- **Tabla flippeada**: meses como filas (uno por mes) a la izquierda, métricas como columnas agrupadas por sección.
- **Header en 2 niveles**: arriba los emojis de sección con `colspan` (💰 Revenue / 📞 Ventas / 📸 Instagram / ▶️ YouTube / 📧 Email), abajo los nombres individuales de cada métrica.
- **Columna MES destacada** con accent amarillo, borde derecho amarillo y bold para que se identifique como el eje principal de cada fila.
- **Subtítulo aclaratorio**: "Datos de Ann Sahakyan · X meses · click para editar".
- **Borde sutil** entre secciones para que el ojo identifique los grupos de columnas.
- **Export CSV** se invierte: primera columna ahora es "Mes" y siguientes son las métricas en orden.

**Estado**: deployado y funcionando.

---

## 7) Sidebar colapsable

**Por qué**: el sidebar ocupaba 220px siempre. Ann quería poder colapsarlo para tener más espacio para la tabla/contenido.

**Qué se armó**:

- **Estado** `sidebarCollapsed` persistido en `localStorage` (la próxima vez que entrás queda como lo dejaste).
- **Botón chevron** en el header del sidebar (visible solo en desktop). Click → colapsa a **64px** (solo iconos, con tooltips al hover).
- **Posición consistente** del botón: siempre dentro del header, en la misma esquina superior derecha — no más flotando al medio cuando colapsado.
- **Shortcut keyboard**: **Cmd+\\** (Mac) o **Ctrl+\\** (Windows) toggle desde cualquier página, sin importar el foco (a menos que estés tipeando en un input).
- **Aplica a ambas sidebars**: portal del coach y Smart Scale Internal.
- **Mobile sigue funcionando como overlay** (sin colapso), con backdrop al abrir.
- **Margin-left del contenido** ajusta automáticamente con transición suave.

**Estado**: deployado y funcionando.

---

## 8) CRM con plan mensual auto-renovable

**Por qué**: hay clientes con plan mensual de USD $497/mes (Benjamín, Pablo Munizaga, etc.). Ann quería marcarlos como "mensuales" para que:

1. Cuando se marca su cuota como pagada, el sistema cree automáticamente la próxima.
2. Llegue una **alerta a Slack 5 días antes** de cada cobro.
3. Apagar el toggle finaliza la suscripción.

**Qué se armó**:

- **Tabla `crm_clients`**: columna nueva `is_monthly_subscription` (boolean).
- **Tabla `crm_installments`**: columna nueva `alert_sent_at` (timestamptz) para no spamear Slack con la misma cuota.
- **Endpoint `/api/cron/billing-alerts`** (POST/GET con auth `Bearer CRON_SECRET`):
  - Para cada cliente con `is_monthly_subscription=true` y `status=activo`:
    - Si la última cuota está paga → genera la siguiente con due_date = +1 mes.
    - Si no tiene cuotas → genera la primera con due_date = `program_start` o hoy.
  - Para cada cuota pendiente que vence en 0-5 días y sin `alert_sent_at`:
    - Manda Slack con block kit (nombre, monto, fecha, días restantes).
    - Marca `alert_sent_at = now()`.
- **Vercel Cron** configurado en `vercel.json` para correr diario a las 12 UTC (9 AM ARG).
- **UI en `/admin/clients`**:
  - Toggle "Plan mensual auto-renovable" en el drawer del cliente con descripción de qué hace.
  - Badge **MENSUAL** amarillo al lado del nombre en la lista y en el header del drawer.
- **API `/api/admin/clients`** acepta `is_monthly_subscription` en POST y PATCH.

**Estado**: código deployado. Falta:
- Correr la SQL migration `subscription_billing.sql` en Supabase.
- Setear `CRON_SECRET` en Vercel (un string random).
- Marcar a Benjamín, Pablo, etc. como "Plan mensual" desde el admin.

---

## 9) Forms personales siempre van a tu cuenta

**Por qué**: cuando Ann navegaba como otro cliente y abría Monday Win / Reporte Mensual / Cha-Ching, el form se guardaba en la cuenta del cliente activo, no en la suya. Confuso y peligroso.

**Qué se cambió**:

- **Monday Win, Cha-Ching y Reporte Mensual** ahora **siempre** se guardan en la cuenta del usuario logueado (Ann), independientemente del `activeClient` que tenga seleccionado.
- Usan `useOwnClient()` en vez de `useActiveClient()`.
- **Banner amarillo de aviso** cuando admin está navegando como otro cliente: "Aviso · este Monday Win es tuyo. Estás navegando como Alberto, pero este formulario siempre se guarda en tu propia cuenta."

**Resultado**: imposible confundirse. Los forms personales siempre van al user logueado.

**Estado**: deployado y funcionando.

---

## 10) Research/Transcript/Video Feed por cliente

**Por qué**: las features de IA (transcripts, content research, video feed) estaban scopeadas por `user_id` — pero la lógica correcta es por **cliente activo**. Si Ann está navegando como Alberto y hace una research, debe quedar en la cuenta de Alberto.

**Qué se cambió**:

- **3 tablas modificadas** (`transcript_history`, `content_research_history`, `video_feed_accounts`):
  - Agregada columna `client_id`.
  - Backfill desde `profiles.client_id`.
  - `video_feed_accounts`: UNIQUE cambia de `user_id` a `client_id` (una cuenta IG por cliente).
- **3 endpoints actualizados** (`/api/transcript`, `/api/content-research`, `/api/video-feed`):
  - Reciben `client_id` como query/body.
  - Helper `resolveClientScope` valida: admin puede consultar/escribir en cualquier cliente, regular solo su propio `client_id`.
- **4 views actualizadas** (transcript-view, content-research, competitor-research, video-feed):
  - Pasan `activeClientId` a la API.
  - Banner amarillo "Viendo otro cliente" cuando admin navega como otro.

**Estado**: código deployado. Falta correr la SQL `scope_research_to_client.sql` en Supabase.

---

## 11) Asistente IA del dashboard

**Por qué**: querías que los coaches puedan preguntarle a una IA cómo usar el dashboard, qué hace cada cosa, dónde encontrar tal función, etc.

**Qué se armó**:

- **Botón flotante amarillo** abajo a la derecha (visible en todas las páginas auth-gated) con ícono Sparkles ✨ + label "Asistente".
- **Slide-over panel** desde la derecha al hacer click:
  - Header con avatar, título "Asistente del dashboard · IA · te ayuda a usar Smart Scale", botón reset + cerrar (Esc también cierra).
  - Welcome message automático.
  - **4 starter questions** clickeables: "¿Cómo cargo mi reporte mensual?", "¿Qué hace el Audit?", "¿Cómo veo mi avance del programa?", "¿Diferencia entre valor del trato y cash collected?".
  - Bubbles user (amarillo) / assistant (gris).
  - **Markdown render mínimo** sin librerías externas (listas con bullets, **negrita**, `inline code`).
  - Loading "Pensando…" con spinner.
  - Input multilínea con auto-resize. Enter envía, Shift+Enter nueva línea.
- **Backend `/api/help-chat`** con auth JWT, multi-turn (hasta 20 turnos para controlar costo), Claude Haiku 4.5.
- **System prompt exhaustivo** (~150 líneas) que conoce:
  - Las 22 secciones del dashboard (portal coach + admin internal).
  - Los 9 niveles Skool con sus emojis y descripciones.
  - 7 workflows comunes (cargar reporte, audit, switch profile, plan mensual, "¿qué es Una sola cosa?", "¿diferencia valor vs cash collected?", "¿por qué solo veo 1 lead?").
  - Atajos de teclado (Cmd+\\, Esc, Enter).
  - **Reglas de tono**: directo, sin lenguaje motivacional vacío. Si la pregunta no es del dashboard ("cómo escalo mi negocio"), redirige a Skool/Ann. Si no sabe algo, lo dice. No inventa funcionalidades.

**Estado**: deployado y funcionando. Usa `ANTHROPIC_API_KEY` que ya estaba configurada en Vercel.

---

## 12) Auditoría UX y mejoras de intuitividad

**Por qué**: hicimos una pasada general buscando lugares donde el usuario se podía confundir o perder.

**Qué se cambió**:

### Confirmaciones antes de delete (data loss prevention)

5 vistas admin con `confirm()` que muestra el nombre del item antes de borrar:
- `/admin/clients` → "¿Eliminar a {nombre} y todas sus cuotas + follow-ups?"
- `/admin/applications` → "¿Eliminar la aplicación de {nombre}?"
- `/admin/team-applications` → "¿Eliminar la aplicación de {nombre}?"
- `/admin/payments` → "¿Eliminar el pago de {nombre} por US$ {monto}?"
- `/admin/leads` → "¿Eliminar a {nombre}?"

### Texto y claridad

- Banners "Atajo:" → "Aviso ·" en monday-win, chi-chang, report-input.
- `/admin/data`: subtítulo "Datos de Ann Sahakyan ·…".
- `/admin/leads`: cuando filtro 4-5★ está activo, banner amarillo aclarando "Tocá Todas para ver todos".
- Sortable headers en `/admin/clients`: tooltip "Click para ordenar" / "Ordenado asc · click para invertir".

### Empty states con CTA

- `/reflection`: "Cargar reporte mensual →" cuando no hay data + "Agregar →" en cards individuales sin contenido.

### Audit page limpiado

- Botones decorativos `‹` y `×` eliminados (no hacían nada).
- Reemplazados por contador "**X/12 respondidas**".
- Botón "Generar Diagnóstico" deshabilitado cuando hay 0 respuestas + hint visible.
- `request_id` técnico oculto detrás de `<details>` "Mostrar ID técnico".

### Forms con mejores hints

- **Monday Win**: placeholders concretos (ej. "Cerré 2 nuevos clientes a $3k") + hint en "Una sola cosa" explicando metodología The ONE Thing.
- **Cha-Ching**: hints "Valor del trato" vs "Cash collected" con ejemplos inline + "(opcional)" en próximo nivel.

### Calendar mejorado

- Botón **"Copiar"** para passcode con feedback visual "Copiado ✓".
- **Conversión automática** del horario Miami a la hora local del usuario via `Intl.DateTimeFormat`. Aparece debajo del horario Miami: "Tu hora local: 4:00 PM".

**Estado**: deployado y funcionando.

---

## 13) Eliminación de Airtable

**Por qué**: Smart Scale ya no usa Airtable. El asistente IA no debía mencionarlo, y el código no debía sincronizar a Airtable.

**Qué se eliminó**:

### Texto/labels visibles
- 3 menciones en system prompt del help-chat.
- "Airtable CRM y Base de Datos" → "CRM y Base de Datos" (módulo Skool E2 en `/api/ai-diagnosis` + `ai-diagnosis-worker`).
- "CRM Airtable" (Mes 1/Sem 4) → "CRM Hot List".
- "Airtable + CRM" (Mes 5) → "CRM y Base de Datos".
- "Supabase → Slack → Airtable" (footer del Reporte Mensual) → "Supabase → Slack".

### Backend
- `lib/airtable.ts` **archivo eliminado** (158 líneas).
- `supabase/functions/event-dispatcher/index.ts`: env vars `AIRTABLE_*` + función `handleAirtableSync` + `AIRTABLE_FIELD_MAP` eliminados (~70 líneas dead code). Handler de `airtable.sync` ahora **no-op** (skip + complete) para vaciar cola sin fallar.
- `app/api/events/process/route.ts`: import comentado, handler `airtable.sync` no-op.
- `app/api/monthly-reports/save/route.ts`: enqueue de `airtable.sync` removido — los reportes ya no se sincronizan a Airtable.
- `lib/events.ts`: type `airtable.sync` marcado como `@deprecated` (mantenido en union por backwards-compat con eventos viejos en cola).
- `lib/zapier.ts`: comentarios actualizados (sin Airtable).

### Lo que quedó
3 URLs apuntando a forms hospedados en `airtable.com` en `/tools` y `/program-checklist`:
- "Form Sumá tu pago"
- "Form Cancelación de membresía"
- "Form de Onboarding"

**El label visible no menciona Airtable** — solo el URL es a airtable.com (forms hosting). Si esos forms también murieron, hay que reemplazarlos por algo más (Tally, Typeform, formulario propio del dashboard, etc.).

**Estado**: deployado y funcionando.

---

## 14) Cosas pendientes (manuales) para activar todo

Cosas que **no son código** y necesitás hacer vos para que todo funcione end-to-end:

### En Supabase (SQL Editor)

Correr estas 3 migrations si no las corriste todavía:

1. **`supabase/migrations/team_applications.sql`** — para que funcione el form de Contratación.
2. **`supabase/migrations/client_checklist_progress.sql`** — para que el checklist de Implementación se guarde por cliente.
3. **`supabase/migrations/scope_research_to_client.sql`** — para que research/transcript/video-feed scopeen por cliente activo.
4. **`supabase/migrations/subscription_billing.sql`** — para que el plan mensual auto-renovable funcione.

### En Vercel (Project Settings → Environment Variables)

- **`CRON_SECRET`** — un string random largo (podés generar uno con `openssl rand -hex 32` en tu terminal). Marcalo para Production + Preview + Development. Es lo que usa Vercel Cron para autenticarse contra el endpoint `/api/cron/billing-alerts`.
- (Opcional) **`TEAM_APPLY_WEBHOOK_URL`** — solo si querés override del webhook de Contratación. Por default usa `uvp3wxx`.

Después de setear las env vars, hacé Redeploy desde Deployments.

### En Zapier

- Verificar que el Zap `uvp3wxx` (Contratación) está **publicado** y manda el mensaje de Slack a `operaciones-internas`. Si nunca lo publicaste, el código manda el webhook pero Slack no recibe nada.

### En `/admin/clients`

- Marcar a Benjamín Barrios, Pablo Munizaga y demás clientes con plan mensual de $497 → toggle "Plan mensual auto-renovable" en el drawer del cliente.

---

## Stack y tecnologías usadas hoy

- **Frontend**: Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS, lucide-react.
- **Backend**: Next.js API routes en `app/api/`, Supabase Edge Functions en Deno.
- **DB**: Supabase Postgres con RLS policies.
- **AI**: Claude Haiku 4.5 (audit + help chat), patrón con `@anthropic-ai/sdk`.
- **Integraciones externas**: Zapier (catch hooks), Slack (block kit), Anthropic.
- **Hosting**: Vercel (con Cron Jobs configurados).
- **Auth**: Supabase Auth con JWT en headers.

---

## Archivos clave para futuro debug

- **Sidebar/layout**: [components/layout/sidebar.tsx](components/layout/sidebar.tsx), [components/layout/admin-sidebar.tsx](components/layout/admin-sidebar.tsx), [components/layout/dashboard-layout.tsx](components/layout/dashboard-layout.tsx).
- **Audit IA**: [app/api/ai-diagnosis/route.ts](app/api/ai-diagnosis/route.ts), [components/views/audit-view.tsx](components/views/audit-view.tsx).
- **Asistente IA**: [app/api/help-chat/route.ts](app/api/help-chat/route.ts), [components/ui/help-chat.tsx](components/ui/help-chat.tsx).
- **Cron mensual**: [app/api/cron/billing-alerts/route.ts](app/api/cron/billing-alerts/route.ts), [vercel.json](vercel.json).
- **Forms de Contratación**: [lib/team-application-forms.ts](lib/team-application-forms.ts), [app/aplicar-equipo/[rol]/page.tsx](app/aplicar-equipo/%5Brol%5D/page.tsx).
- **Checklist por cliente**: [app/api/checklist-progress/route.ts](app/api/checklist-progress/route.ts).
- **Schema config Implementación**: [components/views/program-checklist-view.tsx](components/views/program-checklist-view.tsx).

---

_Documento generado el 5 de mayo de 2026 cubriendo el trabajo del 4 y 5 de mayo._
