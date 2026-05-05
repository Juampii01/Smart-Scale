# Smart Scale Dashboard — Informe técnico completo

**Generado**: 5 mayo 2026
**Repo**: github.com/Juampii01/Smart-Scale
**Producción**: https://smartscale.space

Este documento describe **todo el dashboard**: stack, arquitectura, cada página, cada componente, cada API, cada tabla, cada integración. Pensado como referencia técnica permanente — para entender cómo funciona algo o dónde tocar para cambiarlo, este es el primer lugar donde mirar.

---

## Tabla de contenidos

1. [Stack y arquitectura](#1-stack-y-arquitectura)
2. [Shell del dashboard (layout, header, sidebar)](#2-shell-del-dashboard)
3. [Páginas — Portal del coach](#3-páginas--portal-del-coach)
4. [Páginas — Smart Scale Internal (admin)](#4-páginas--smart-scale-internal-admin)
5. [Páginas — Públicas](#5-páginas--públicas)
6. [Endpoints API (`app/api/`)](#6-endpoints-api)
7. [Edge Functions (Supabase Deno)](#7-edge-functions)
8. [Modelo de datos (tablas Supabase)](#8-modelo-de-datos)
9. [Integraciones externas](#9-integraciones-externas)
10. [Sistema de eventos asíncronos](#10-sistema-de-eventos-asíncronos)
11. [Libs (`lib/`)](#11-libs)
12. [Configuración (env vars, Vercel cron, etc.)](#12-configuración)
13. [Flujos de negocio end-to-end](#13-flujos-de-negocio-end-to-end)
14. [Áreas con coexistencias / tech debt](#14-áreas-con-coexistencias--tech-debt)
15. [Glosario](#15-glosario)

---

## 1) Stack y arquitectura

| Capa | Tecnología |
|---|---|
| Framework | Next.js 16.0.10 (App Router, Turbopack) |
| Frontend | React 19.2, TypeScript 5, Tailwind CSS v4, Radix UI suite, lucide-react, Recharts |
| Backend | Next.js API routes en `app/api/` (Node runtime), Supabase Edge Functions (Deno) |
| DB | Supabase Postgres con RLS policies |
| Auth | Supabase Auth (JWT en `Authorization: Bearer`), `@supabase/ssr` |
| AI | Anthropic SDK v0.82 — modelos `claude-haiku-4-5`, `claude-sonnet-4-6`, `claude-opus-4-6` |
| Hosting | Vercel (con Cron Jobs) |
| Branding | Dark UI sobre `#0a0a0b` / `#111113`, accent amarillo `#ffde21`, fuente Geist |
| Domain | `smartscale.space` (canónico). `smartscalestrategy.netlify.app` aparece en redirects de password-reset (legacy). |

**Patrón de auth**: cada page que requiere sesión renderiza dentro de `<DashboardLayout>`, que verifica session vía `supabase.auth.getSession()` en mount → si no hay, `router.replace("/login")`. Las API routes piden `Authorization: Bearer ${jwt}` y validan con `supabase.auth.getUser(jwt)` (service client, bypass RLS).

**Patrón multi-tenant**: 4 contextos React expuestos por `DashboardLayout`:
- `useSelectedMonth()` — mes activo (persistido en `localStorage["selectedMonth"]`).
- `useActiveClient()` — cliente que el admin está viendo. Para admin puede diferir del propio.
- `useActiveClientName()` — nombre legible del cliente activo (para banners).
- `useOwnClient()` — `client_id` propio del user logueado. Coincide con activeClient para usuarios regulares, puede diferir para admins.

La distinción **`activeClient` vs `ownClient`** es lo que permite a un admin "ver como" otro cliente sin contaminar sus propios datos.

---

## 2) Shell del dashboard

### 2.1 `DashboardLayout` — wrapper común

Archivo: [components/layout/dashboard-layout.tsx](components/layout/dashboard-layout.tsx) (~600 líneas).

Renderiza el shell completo del app autenticado:
- **Auth gate** en `useEffect`: `getSession()` → redirect a `/login` si no hay.
- **Carga de profile** (`profiles.role`, `profiles.client_id`, `profiles.name`).
- **Detecta modo internal** vía `pathname.startsWith("/admin/")` → renderiza `<AdminSidebar>` en vez de `<Sidebar>`.
- **State persistido en localStorage**: `sidebarCollapsed`, `selectedMonth`, `activeClientId`.
- **Atajo Cmd/Ctrl + \\** toggle del sidebar collapse desde cualquier página (excepto cuando hay foco en input).
- **Componente flotante** `<HelpChat />` al final del root flex (visible en todas las páginas).
- **Debug global**: expone `window.__DEBUG_DASHBOARD_CTX` con `activeClientId`, `ownClientId`, `userRole`, `userEmail`.

### 2.2 Header (top bar)

Línea horizontal arriba con altura fija de 64px. Layout:

| Posición | Contenido (modo coach) | Contenido (modo internal) |
|---|---|---|
| Izquierda | Botón menú (mobile) + page title + sub-label "Smart Scale Portal 2.0" | Page title + badge **INTERNAL** amarillo + sub-label "Smart Scale Internal · Dashboard de Admin" |
| Centro/derecha | Botones amarillos (Monday Win, Reporte Mensual, Cha-Ching 💰) + MonthSelector | (sin botones ni MonthSelector — irrelevantes en admin) |
| Derecha extrema | **Profile dropdown** | **Profile dropdown** (mismo) |

**Profile dropdown** (esquina superior derecha): botón con avatar redondo amarillo + nombre del cliente activo + chevron. Click abre menú con:
- Línea con `clientDisplayName` (si non-admin) y `userEmail`.
- (Solo admin) sección "Cambiar perfil" con lista de todos los `profiles` para hacer override del `activeClientId` (persiste en localStorage). Permite "ver como" otro cliente.
- Botón rojo "Cerrar sesión" → `supabase.auth.signOut()` + redirect `/login`.

### 2.3 Sidebar — modo coach

Archivo: [components/layout/sidebar.tsx](components/layout/sidebar.tsx).

3 grupos colapsables:

| Grupo | Items |
|---|---|
| **Performance** | Performance Center, Channels, Sales, Reflection, All Metrics |
| **Programa** | Audit, Implementacion, Tools, Agenda, Monday Win, Reporte Mensual, Cha-Ching 💰 |
| **Contenido** | Video Feed, Competitor Research, Transcript de Videos |

Footer:
- Si `isAdmin=true` → botón amarillo **"Smart Scale Internal"** que lleva a `/admin/clients` (entrada al área admin).
- Badge "Client Analytics · Portal 2.0".

Header del sidebar: logo "Smart" + "Scale" (Scale en pill blanco) + chevron de toggle collapse. **Sin "v2.0"** en el header (eliminado por clutter visual).

Sidebar collapsable a 64px (solo iconos con tooltips). Persistido en localStorage. Atajo Cmd+\\.

### 2.4 Sidebar — modo internal (admin)

Archivo: [components/layout/admin-sidebar.tsx](components/layout/admin-sidebar.tsx).

Items:
- Adquisition Stats
- Leads
- Pagos
- Clientes
- Aplicaciones
- Contratación
- Centro Operativo

Header:
- Logo Smart Scale arriba.
- Badge **INTERNAL** amarillo abajo del logo.
- Botón chevron de collapse en la esquina superior derecha.

Top bar interno:
- Botón **"← Volver al portal"** (lleva a `/dashboard`).
- Section header "Smart Scale CRM" como divider.

Footer: card "Smart Scale Internal · Admin only".

### 2.5 Help Chat (botón flotante)

Archivo: [components/ui/help-chat.tsx](components/ui/help-chat.tsx).

- Botón flotante amarillo abajo a la derecha, visible en TODAS las páginas auth-gated.
- Click → slide-over panel desde la derecha (max-w-md).
- Chat conversacional con Claude Haiku que conoce todo el dashboard.
- Welcome message + 4 starter questions clickeables.
- Markdown render mínimo (listas, **bold**, `code`).
- Input multilínea (Enter envía, Shift+Enter nueva línea, Esc cierra).
- Botón reset para limpiar conversación.

---

## 3) Páginas — Portal del coach

Cada página renderiza un component view dentro de `<DashboardLayout>`. Auth requerida.

### 3.1 Performance

| Ruta | Component | Resumen |
|---|---|---|
| `/dashboard` | `BusinessKPIs` + `MoMPanel` + `CorrelationChart` + `TrendCharts` | **Performance Center**: 6 KPIs principales con sparklines y comparación vs mes anterior, panel "qué cambió", correlación acción↔resultado, tendencia histórica multi-charts. |
| `/channels` | `ChannelsView` | Métricas por canal (Instagram, YouTube, Email) con AreaCharts y badges de tendencia. |
| `/sales` | `SalesView` | Embudo: scheduled → attended → qualified → cierres con tasas. ComposedChart histórico. |
| `/reflection` | `ReflectionView` | Cards: biggest_win, next_focus, support_needed, improvements (texto del reporte). |
| `/metrics` | `MetricsView` | Tabla completa + Health Radar de los últimos 12 meses + MoM panel. |

Todas estas leen de la tabla `monthly_reports` filtrada por `activeClientId` y `selectedMonth`.

### 3.2 Programa

| Ruta | Component | Resumen |
|---|---|---|
| `/audit` | `AuditView` (1006 LOC) | **Audit del Ecosistema Circular** (Fascinate→Educate→Transform→Invite). 12 ítems R/Y/G; cards 4-pilares con score X/6; cards "Tu foco este trimestre" con badges. Diagnóstico generado por Claude Haiku. |
| `/program-checklist` | `ProgramChecklistView` (532 LOC) | **Implementación**: checklist de 6 meses con tareas semanales, niveles Skool 0-8, optimistic update. Persistido por cliente en `client_checklist_progress`. |
| `/tools` | `ToolsView` (189 LOC, **static**) | Cards de GPTs (Ann IA, Idea Bank, Email Engine, Simple Offer Builder, etc.) + Forms hospedados externamente. |
| `/calendar` | `CalendarView` | Llamadas grupales semanales con Ann en zona Miami con conversión automática a hora local del usuario. Botón "Copiar" passcode. |
| `/monday-win` | `MondayWinView` | Form semanal: 3 logros + 1 sola cosa + bloqueo. **Siempre guarda en `useOwnClient()`** ignorando activeClient. |
| `/report-input` | `ReportInputView` (504 LOC) | **Reporte Mensual**: form con ~30 métricas. Embebe `ReportHistoryView` debajo. Guarda en `useOwnClient()`. |
| `/report-history` | `ReportHistoryView` | Historial de reportes mensuales (NO está en sidebar). Admin puede borrar. |
| `/chi-chang` | `ChiChangView` | **Cha-Ching 💰**: registrar deal cerrado (valor trato, cash collected, próximo nivel con emoji). Guarda en `useOwnClient()`. |

### 3.3 Contenido

| Ruta | Component | Resumen |
|---|---|---|
| `/transcript` | `TranscriptView` (921 LOC) | Transcribir + resumen IA de YouTube/Instagram. Modal full-text + copy buttons. Scopeado por `activeClient`. |
| `/video-feed` | inline | **Feed analizado** de la cuenta IG del cliente. Trae últimos 30 días, rankea por engagement, análisis IA. |
| `/competitor-research` | inline | **Top videos de competidor** (YouTube o Instagram) con análisis IA. Caché semanal, límite 5/mes por cliente. |

### 3.4 Páginas que existen pero NO están en sidebar

| Ruta | Estado |
|---|---|
| `/content-research` | Mismo backend que `/competitor-research`. Alias / legacy. |
| `/market-intelligence` | Sistema de research-requests/results más antiguo. Async via edge function `research-worker`. |
| `/recursos` | Biblioteca de recursos públicos (lee `resources` table). |
| `/mi-dashboard` | Subset reducido del Performance Center (solo KPIs + Trends). |

---

## 4) Páginas — Smart Scale Internal (admin)

Todas requieren `profiles.role === "admin"`. Renderizan dentro del shell con `AdminSidebar` (modo internal).

| Ruta | Component | Resumen |
|---|---|---|
| `/admin/data` | `AdminDataView` (339 LOC) | **Adquisition Stats**: tabla pivot (filas=meses, cols=métricas agrupadas por sección). Edición inline cell-by-cell. Subtítulo aclara "Datos de Ann Sahakyan". |
| `/admin/leads` | `AdminLeadsView` (617 LOC) | CRM de leads. Filtro 4-5★ default + banner amarillo aclarando. Drawer detalle, edición inline status/source/lead_type/niche/notes/rating. |
| `/admin/payments` | `AdminPaymentsView` (310 LOC) | Pagos manuales o Stripe-via-Zapier. Status: aceptado/rechazado/pendiente. Confirmación antes de delete. |
| `/admin/clients` | `AdminClientsView` (1324 LOC) | CRM completo: cuotas auto-generadas, follow-ups (whatsapp/llamada/email), credenciales. **Toggle "Plan mensual auto-renovable"** + badge MENSUAL amarillo en lista. Sortable headers con tooltips. |
| `/admin/applications` | `AdminApplicationsView` (534 LOC) | Aplicaciones del programa (form `/apply`). Drawer detalle, status, notes, export CSV. Confirmación antes de delete. |
| `/admin/team-applications` | `AdminTeamApplicationsView` (422 LOC) | Aplicaciones de contratación (form `/aplicar-equipo/[rol]`). Filtro por rol/status. Drawer renderiza `answers` JSON dinámicamente según schema. |
| `/admin/centro-operativo` | `AdminCentroOperativoView` (1021 LOC) | **Centro operativo tipo Notion**: SOPs, templates, recursos categorizados. Editor inline con `content` text largo. |
| `/admin/import` | `AdminImportView` (346 LOC) | Importador batch de meses históricos al `monthly_reports`. (NO está en sidebar — sacado en este push.) |

---

## 5) Páginas — Públicas

| Ruta | Auth | Componente | Resumen |
|---|---|---|---|
| `/login` | público | inline | Login Supabase email+password → redirect `/reflection`. |
| `/signup` | público | inline | Sign up Supabase. Maneja "user already exists". |
| `/forgot-password` | público | inline | Reset password via email Supabase. **Redirect hardcoded a `smartscalestrategy.netlify.app`** (legacy). |
| `/reset-password` | público (con token) | inline | Captura tokens del hash, permite cambiar password. |
| `/apply` | público | inline (471 LOC) | **Form público de aplicación al programa Smart Scale**. ~18 campos. POST a `/api/apply` → Zapier. |
| `/aplicar-equipo/[rol]` | público (dinámico) | inline (~400 LOC) | **Form de contratación de equipo**. Schema definido por rol en `lib/team-application-forms.ts` (hoy solo `setter`). Soporta `gates` server-side. POST a `/api/team-apply`. |

---

## 6) Endpoints API

### 6.1 Públicos (sin auth o con secret opcional)

| Endpoint | Métodos | Auth | Tablas | Integraciones |
|---|---|---|---|---|
| `/api/apply` | POST | público | `applications` | Zapier `APPLY_WEBHOOK_URL` (default `uj9kbbl`) |
| `/api/team-apply` | POST | público (valida gates server) | `team_applications` | Zapier `TEAM_APPLY_WEBHOOK_URL` (default `uvp3wxx`) |
| `/api/webhooks/lead` | POST | opcional `WEBHOOK_SECRET` header | `leads` | (entrante de GHL/AC/HubSpot) |
| `/api/webhooks/payment` | POST | opcional `PAYMENT_WEBHOOK_SECRET` | `payments` | (entrante de Stripe via Zapier) |
| `/api/webhooks/client` | POST | (no enforced, parsea variantes) | `crm_clients`, `crm_installments` | (entrante manual o automation) |
| `/api/proxy-image` | GET | público | — | Proxy a Instagram CDN (cache 24h) |

### 6.2 Coach (JWT user)

| Endpoint | Métodos | Tablas | Integraciones |
|---|---|---|---|
| `/api/ai-diagnosis` | GET/POST/DELETE | `ai_diagnosis_requests`, `ai_diagnosis_results` | Anthropic `claude-haiku-4-5` (max 800 tok) |
| `/api/help-chat` | POST | — | Anthropic `claude-haiku-4-5` (max 600 tok) |
| `/api/checklist-progress` | GET/POST | `client_checklist_progress`, `profiles` | — |
| `/api/chi-chang` | POST | `clients` (lookup) | Zapier `ZAPIER_WEBHOOK_CHI_CHANG` |
| `/api/monday-win` | POST | `clients` (lookup) | Zapier `NEXT_PUBLIC_ZAPIER_WEBHOOK_MONDAY_WIN` |
| `/api/monthly-reports/save` | POST | `monthly_reports`, `clients`, `outbound_events` | Zapier (REPORT + SALE), encola eventos |
| `/api/monthly-reports/delete` | DELETE | `monthly_reports`, `profiles` | (admin only) |
| `/api/resources` | GET/POST/PATCH/DELETE | `resources` | (read open, write con service client) |
| `/api/transcript` | GET/POST/DELETE | `transcript_history`, `profiles` | YouTube transcript lib + Apify + AssemblyAI + Anthropic `claude-opus-4-6` |
| `/api/content-research` | GET/POST/DELETE | `content_research_history`, `profiles` | YouTube Data API + Apify + Anthropic `claude-haiku-4-5` |
| `/api/video-feed` | GET/POST | `video_feed_accounts`, `profiles` | Apify + Anthropic `claude-haiku-4-5` |
| `/api/market-intelligence/create-request` | POST | `research_requests` | YouTube API |
| `/api/market-intelligence/delete-request` | DELETE | `research_requests`, `profiles` | (owner-only o admin) |

Todos los endpoints scopeados por client_id usan helper `resolveClientScope` que valida: admin puede pasar cualquier `client_id`, regular solo el suyo.

### 6.3 Admin (JWT user + `profiles.role === "admin"`)

Todos pasan por helper `requireAdmin(jwt)`.

| Endpoint | Métodos | Tablas |
|---|---|---|
| `/api/admin/applications` | GET/POST/PATCH/DELETE | `applications`, `profiles` |
| `/api/admin/clients` | GET/POST/PATCH/DELETE | `crm_clients`, `crm_installments`, `crm_followups`, `profiles` |
| `/api/admin/leads` | GET/POST/PATCH/DELETE | `leads`, `profiles` |
| `/api/admin/payments` | GET/POST/PATCH/DELETE | `payments`, `profiles` |
| `/api/admin/reports` | PATCH | `monthly_reports`, `profiles` |
| `/api/admin/team-applications` | GET/PATCH/DELETE | `team_applications`, `profiles` |

### 6.4 Sistema (cron, dispatcher)

| Endpoint | Métodos | Auth | Notas |
|---|---|---|---|
| `/api/events/process` | POST | `SUPABASE_SERVICE_ROLE_KEY` o `EVENTS_PROCESS_SECRET` Bearer | Procesa cola `outbound_events` en batches de 10, backoff [30s, 2min, 10min]. Maneja Slack + Zapier; `airtable.sync` no-op deprecated. |
| `/api/cron/billing-alerts` | GET/POST | `CRON_SECRET` Bearer | Cron diario via Vercel (`0 12 * * *`). Genera próxima cuota cuando última está paga + alerta Slack 5 días antes. |

---

## 7) Edge Functions

Ubicadas en `supabase/functions/*/index.ts`. Corren en Deno managed por Supabase.

### `event-dispatcher` (~225 líneas)
- **Trigger**: invocado fire-and-forget desde `/api/monthly-reports/save` (POST con service-role bearer).
- **Qué hace**: polea `outbound_events` pendientes via RPC `get_pending_events` (con `FOR UPDATE SKIP LOCKED`), procesa Slack + Zapier para cada evento, marca como completed/failed con backoff.
- **Eventos soportados**: `monthly_report.completed`, `sale.registered`, `airtable.sync` (no-op, deprecated).
- **Env**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SLACK_WEBHOOK_URL`, `ZAPIER_WEBHOOK_REPORT`, `ZAPIER_WEBHOOK_SALE`.

### `research-worker` (~708 líneas)
- **Trigger**: `verify_jwt: false`, invocado externamente (cron o trigger de DB).
- **Qué hace**: pickea siguiente `research_requests` pending via RPC `get_next_pending_request`, scrapea YouTube via Data API v3, ejecuta análisis con Anthropic `claude-sonnet-4-6`. Genera summary, patterns, top_hooks, opportunities, recommended_ideas y los inserta en `research_results`.
- **Env**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `YOUTUBE_API_KEY`, `ANTHROPIC_API_KEY`.

### `ai-diagnosis-worker` (~302 líneas)
- **Trigger**: presumiblemente invocado desde el endpoint `/api/ai-diagnosis` POST (path alterno legacy).
- **Qué hace**: lee `ai_diagnosis_requests`, llama Anthropic con `claude-sonnet-4-6` (max_tokens 1400), guarda en `ai_diagnosis_results`.
- **Coexistencia**: el endpoint Next.js `/api/ai-diagnosis` actualmente usa Haiku directamente (path principal). Esta edge function existe en paralelo.
- **Env**: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`.

---

## 8) Modelo de datos

### 8.1 CRM core

| Tabla | Migration | Descripción |
|---|---|---|
| `crm_clients` | `20250420000001_crm_clients.sql` + extras | Clientes activos del programa. Campos: name, email, instagram, phone, program_start, num_installments, installment_amount, status (activo/en_pausa/inactivo/completado), notes + extras (setter, closer, programa, forma_pago, total_amount, address, dashboard_email, dashboard_password, program_duration). **`is_monthly_subscription` BOOL** (suscripción auto-renovable). |
| `crm_installments` | (mismo) | Cuotas de cada cliente. Campos: client_id (FK CASCADE), installment_number, due_date, amount, paid_at, notes. **`alert_sent_at` TIMESTAMPTZ** (para no duplicar alertas Slack). |
| `crm_followups` | (mismo) | Seguimientos por cliente. Campos: client_id (FK), scheduled_date, type (whatsapp/llamada/email/otro), notes, completed. |

### 8.2 Otras tablas

| Tabla | Descripción |
|---|---|
| `leads` | Leads inbound (vía webhook GHL + manual). Campos: name, email, phone, instagram, tag, source, lead_type, status, **rating 1-5**, niche, notes, **raw_payload jsonb**. |
| `payments` | Pagos manuales o Stripe via Zapier. name, email, **amount NUMERIC(12,2)**, status, description. |
| `applications` | Aplicaciones del programa (form `/apply`). 18+ campos descriptivos. status (nueva/revisando/...). |
| `team_applications` | Aplicaciones de contratación. Campos comunes en columnas + **`answers JSONB`** con campos rol-específicos. status (nueva/revisando/descartada/aprobada/contratada). |
| `monthly_reports` | Reportes mensuales del coach. ~30 métricas NUMERIC + ~5 campos TEXT (biggest_win, next_focus, etc.). PK upsert por (client_id, month). |
| `clients` (legacy) | Tabla más vieja. Solo campos `id`, `nombre`. Se usa para lookup en monday-win, chi-chang, monthly-reports/save. **Coexiste** con `crm_clients`. |
| `profiles` | Join entre Supabase Auth y datos. Fields: id (=auth.users.id), client_id, role, name. Es el source of truth de quién es admin. |
| `resources` | Centro Operativo: SOPs, templates, recursos. id, title, url, description, category, type (link/doc/video/file), `content` text largo. |

### 8.3 Audit / IA

| Tabla | Descripción |
|---|---|
| `ai_diagnosis_requests` | id, user_id, prompt, audit_type, annual_revenue, selected_month, client_id, status. |
| `ai_diagnosis_results` | request_id (FK), result, raw_response (jsonb). |
| `client_checklist_progress` | PK `(client_id, task_key)`, completed bool, updated_at, updated_by. Una row por tarea completada. |

### 8.4 Content / IA scopeado por cliente

| Tabla | Descripción |
|---|---|
| `transcript_history` | id, user_id, **client_id** (added en migration `scope_research_to_client.sql`), url, title, creator, duration, transcript, summary. |
| `content_research_history` | id, user_id, **client_id**, channel_url, channel_name, channel_avatar, timeframe_days, platform, **videos JSONB** (full payload). |
| `video_feed_accounts` | id, user_id, **client_id UNIQUE** (cambió de user_id UNIQUE → client_id UNIQUE), platform, channel_url, channel_name, channel_avatar, **posts JSONB**, updated_at. |

### 8.5 Market Intelligence (sistema async legacy)

| Tabla | Descripción |
|---|---|
| `research_requests` | user_id, client_id, platform (youtube/instagram/tiktok), timeframe_days (30/60/90), competitors jsonb, status (pending/processing/completed/failed), attempts. |
| `research_results` | request_id (FK), summary, patterns jsonb, top_hooks jsonb, opportunities jsonb, recommended_ideas jsonb, raw_competitor_data jsonb. |
| `competitor_posts` (legacy) | client_id (FK al `clients` legacy, NO `crm_clients`), creator, post_url, description, views/likes/comments bigint, transcript, analysis. |

### 8.6 Sistema de eventos asíncronos

| Tabla | Descripción |
|---|---|
| `outbound_events` | id, event_type (`monthly_report.completed` / `sale.registered` / `airtable.sync` deprecated), payload jsonb, status, attempts/max_attempts (3), error_message, client_id, user_id, next_retry_at, processed_at. |
| `event_logs` | event_id (FK CASCADE), level (info/warn/error), message, metadata jsonb. |

**RPC**: `get_pending_events(batch_size)` SECURITY DEFINER con `FOR UPDATE SKIP LOCKED` para evitar doble-procesamiento.

### 8.7 RLS policies (resumen)

- **CRM tables** (`crm_clients`, `crm_installments`, `crm_followups`): solo `service_role`. Todo va a través de API routes con auth.
- **`team_applications`, `client_checklist_progress`**: solo `service_role`.
- **`outbound_events`, `event_logs`**: `service_role` full + users `SELECT` own.
- **`transcript_history`, `content_research_history`, `video_feed_accounts`**: own + admin all.
- **`resources`**: `service_role` full + authenticated read.
- **`research_requests`, `research_results`**: own + admin SELECT.

---

## 9) Integraciones externas

### 9.1 Anthropic (Claude)

| Endpoint | Modelo | max_tokens | Uso |
|---|---|---|---|
| `/api/help-chat` | `claude-haiku-4-5` | 600 | Asistente conversacional del dashboard |
| `/api/ai-diagnosis` | `claude-haiku-4-5` | 800 | Genera título + diagnóstico de los 2 focos del audit |
| `/api/content-research` | `claude-haiku-4-5` | 1200 | Análisis de top videos de competidor |
| `/api/video-feed` | `claude-haiku-4-5` | 1200 | Análisis de top 15 posts del cliente |
| `/api/transcript` | `claude-opus-4-6` | 800 | Resumen del transcript de un video |
| edge fn `research-worker` | `claude-sonnet-4-6` | variable | Pipeline de market intelligence |
| edge fn `ai-diagnosis-worker` | `claude-sonnet-4-6` | 1400 | Path alterno del audit (legacy) |

### 9.2 Zapier (webhooks salientes)

| Webhook | Default URL (sample) | Trigger |
|---|---|---|
| `APPLY_WEBHOOK_URL` | `hooks.zapier.com/.../uj9kbbl/` | POST `/apply` → Slack |
| `TEAM_APPLY_WEBHOOK_URL` | `hooks.zapier.com/.../uvp3wxx/` | POST `/team-apply` → Slack |
| `ZAPIER_WEBHOOK_REPORT` | (env) | `monthly_report.completed` event → Slack |
| `ZAPIER_WEBHOOK_SALE` | (env, fallback a REPORT) | `sale.registered` (solo Ann) → Slack |
| `NEXT_PUBLIC_ZAPIER_WEBHOOK_CHI_CHANG` | (env) | POST `/api/chi-chang` → Slack 🎉 |
| `NEXT_PUBLIC_ZAPIER_WEBHOOK_MONDAY_WIN` | (env) | POST `/api/monday-win` → Slack |

### 9.3 Apify (scraping)

| Actor | Uso |
|---|---|
| `apify~instagram-scraper` | Scrape post IG con directUrls |
| `apify~instagram-reel-scraper` | Reels con username conocido (fallback) |
| `apify~instagram-api-scraper` | Posts del perfil |
| `apify~instagram-profile-scraper` | Profile + posts (fallback) |
| `automation-lab~youtube-transcript` | Transcript YT (fallback al lib `youtube-transcript`) |

### 9.4 Otros servicios

- **AssemblyAI** — transcripción audio para reels IG. Usa `lib/instagram-transcript.ts` con multiple `speech_model: nano|universal-2`. Polling cada 3s hasta 200s.
- **RapidAPI** — host `instagram-scraper-20253.p.rapidapi.com` para resolver shortcode → CDN URL de reels IG (preferred path antes de fallbacks HTML).
- **YouTube Data API v3** — channels, search, videos endpoints. Usado en content-research, transcript, market-intelligence.
- **Slack** — incoming webhook directo (`SLACK_WEBHOOK_URL`) + Zapier "Catch Hook → Slack message". Notificaciones con Block Kit.
- **Stripe** — NO directa. Stripe → Zapier → POST `/api/webhooks/payment`.
- **GHL/AC/HubSpot** — `/api/webhooks/lead` parsea cualquier shape.
- **Airtable** — **DEPRECADO**. Eliminado en este push.

---

## 10) Sistema de eventos asíncronos

### Pipeline

```
/api/monthly-reports/save (POST)
  ├─ INSERT monthly_reports
  ├─ enqueueEvents([monthly_report.completed, sale.registered?])
  │   → INSERT en outbound_events (status=pending)
  └─ fireEventDispatcher() (fire-and-forget POST a edge fn)
                  ↓
        edge fn event-dispatcher (Deno)
          ├─ SELECT outbound_events WHERE status IN (pending, failed) 
          │     AND next_retry_at <= now() AND attempts < max_attempts
          └─ Para cada evento (BATCH=10):
              ├─ UPDATE status=processing
              ├─ Procesar action (Slack + Zapier según event_type)
              ├─ UPDATE status=completed | failed (backoff [30s, 2min, 10min])
              └─ INSERT event_logs
```

### Componentes

- **Cola**: `outbound_events`.
- **Logs**: `event_logs`.
- **RPC**: `get_pending_events(batch_size)` con `FOR UPDATE SKIP LOCKED`.
- **Procesador primario**: edge function `event-dispatcher`.
- **Procesador fallback**: endpoint `/api/events/process` (mismo lógica, invocable manualmente con secret).

### Tipos de evento

| Tipo | Acción |
|---|---|
| `monthly_report.completed` | Slack `notifyMonthlyReportCompleted` con block kit |
| `sale.registered` | Slack `notifySaleRegistered` |
| `airtable.sync` | **No-op deprecated** — se completan sin acción para vaciar cola legacy |

---

## 11) Libs (`lib/`)

| Archivo | Qué hace | Quién lo usa |
|---|---|---|
| `supabase.ts` | `createClient()` browser-side con anon key, `persistSession=true`, `storageKey="sb-session"` | Todas las views client-side |
| `supabase-service.ts` | `createServiceClient()` server-side con service role key (bypass RLS) | Todos los `app/api/**/route.ts` |
| `events.ts` | `enqueueEvent`, `enqueueEvents`, `fireEventDispatcher`. Tipos `EventType`, `EventPayload` | `/api/monthly-reports/save` |
| `slack.ts` | Block-kit builders + `sendSlackMessage`. Helpers `notifyMonthlyReportCompleted`, `notifySaleRegistered` | `/api/events/process`, `/api/cron/billing-alerts` |
| `zapier.ts` | `zapierReportCompleted`, `zapierSaleRegistered` | `/api/monthly-reports/save` |
| `ai-diagnosis.ts` | Helpers para leer `ai_diagnosis_requests`/`results` | `audit-view.tsx` |
| `instagram-transcript.ts` (470 LOC) | Pipeline IG transcript: shortcode → RapidAPI → fallbacks oEmbed/HTML → AssemblyAI | `/api/transcript`, `/api/content-research` |
| `marketIntelligence.ts` | Helpers para `research_requests`/`results` | `/market-intelligence/page.tsx` |
| `team-application-forms.ts` (215 LOC) | Catálogo `TEAM_APPLICATION_FORMS` con tipos. Hoy contiene `SETTER_FORM` | `/aplicar-equipo/[rol]`, `/api/team-apply`, `admin-team-applications-view.tsx` |
| `page-ready-bus.ts` | Pub-sub minimal para markers de "page lista" | `use-mark-page-ready` hook |
| `utils.ts` | `cn(...inputs)` con `clsx` + `tailwind-merge` | Toda la UI |

---

## 12) Configuración

### 12.1 Variables de entorno

#### Server-side (process.env)
| Var | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente browser + service client |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Cliente browser |
| `SUPABASE_SERVICE_ROLE_KEY` | Service client (bypass RLS) |
| `ANTHROPIC_API_KEY` | Anthropic SDK en ai-diagnosis, help-chat, content-research, transcript, video-feed |
| `APIFY_TOKEN` | Apify scrapers |
| `RAPIDAPI_KEY` | Instagram-scraper-20253 |
| `ASSEMBLYAI_API_KEY` | Transcripción audio IG |
| `YOUTUBE_API_KEY` | YouTube Data API v3 |
| `SLACK_WEBHOOK_URL` | Incoming webhook |
| `ZAPIER_WEBHOOK_REPORT` | Reporte → Slack |
| `ZAPIER_WEBHOOK_SALE` | Venta → Slack (fallback a REPORT) |
| `NEXT_PUBLIC_ZAPIER_WEBHOOK_CHI_CHANG` | Cha-Ching webhook |
| `NEXT_PUBLIC_ZAPIER_WEBHOOK_MONDAY_WIN` | Monday Win webhook |
| `APPLY_WEBHOOK_URL` | Override del Zapier de aplicaciones |
| `TEAM_APPLY_WEBHOOK_URL` | Override del Zapier de team |
| `WEBHOOK_SECRET` | Opcional para `/api/webhooks/lead` |
| `PAYMENT_WEBHOOK_SECRET` | Opcional para `/api/webhooks/payment` |
| `CRON_SECRET` | Vercel Cron Bearer (necesario para `/api/cron/billing-alerts`) |
| `EVENTS_PROCESS_SECRET` | Auth alternativa para `/api/events/process` |

#### Edge functions Deno (Deno.env.get)
`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `YOUTUBE_API_KEY`, `SLACK_WEBHOOK_URL`, `ZAPIER_WEBHOOK_REPORT`, `ZAPIER_WEBHOOK_SALE`.

### 12.2 Vercel cron (`vercel.json`)

```json
{
  "functions": { "app/api/**": { "maxDuration": 300 } },
  "crons": [{ "path": "/api/cron/billing-alerts", "schedule": "0 12 * * *" }]
}
```

Cron diario 12:00 UTC (9 AM ARG) con header `Authorization: Bearer ${CRON_SECRET}`.

### 12.3 Otros archivos de config

- **`.gitignore`**: `node_modules`, `.next`, `.env*`, `.vercel`, `next-env.d.ts`, `.claude/` (worktrees).
- **`next.config.mjs`**: `typescript.ignoreBuildErrors: true`, `images.unoptimized: true`.
- **`package.json`**: Next 16, React 19, TypeScript 5, Anthropic SDK, Recharts, Tailwind v4, Radix UI suite.

---

## 13) Flujos de negocio end-to-end

### 13.1 Lead llega → cliente activo

```
Inbound Lead (vía GHL / form / referido)
  → POST /api/webhooks/lead
  → tabla leads (con raw_payload + parsing flexible)
  → Visible en /admin/leads (filtro 4-5★ default)

Si lead califica → Ann hace outreach manual

Lead aplica al programa → POST /apply (form público)
  → tabla applications
  → Zapier (uj9kbbl) → Slack notificación
  → Visible en /admin/applications (drawer + status)

Lead se vuelve cliente:
  Admin va a /admin/clients → "Nuevo cliente" → POST /api/admin/clients
  → tabla crm_clients (con num_installments o is_monthly_subscription)
  → Auto-genera cuotas en crm_installments

Pagos:
  Stripe → Zapier → POST /api/webhooks/payment
  → tabla payments
  → Visible en /admin/payments
```

### 13.2 Coach reporta su mes

```
Coach va a /report-input → form mensual (~30 métricas)
  → POST /api/monthly-reports/save (con useOwnClient — no activeClient)
  → upsert monthly_reports (client_id, month)
  → enqueue outbound_events:
    • monthly_report.completed (siempre)
    • sale.registered (si subió new_clients vs mes anterior)
  → Zapier directo (REPORT siempre, SALE solo si Ann es triggered_by)
  → fire-and-forget POST a edge fn event-dispatcher
                ↓
  Edge fn event-dispatcher procesa cola
    → Slack notifyMonthlyReportCompleted (block kit)
    → Slack notifySaleRegistered (si aplica)
    → Marca eventos como completed
```

### 13.3 Plan mensual auto-renovable

```
Admin marca cliente como "Plan mensual" en /admin/clients
  → toggle is_monthly_subscription = true en crm_clients

Cron diario 12 UTC: /api/cron/billing-alerts
  → SELECT crm_clients WHERE is_monthly_subscription = true AND status = 'activo'
  Para cada uno:
    → Cargar cuotas existentes ordenadas desc
    → Si última está paga y no hay futura → INSERT crm_installments con due_date = +1 mes
    → Si due_date entre 0-5 días Y alert_sent_at IS NULL:
        Slack alerta con block kit (nombre, monto, fecha, días restantes)
        UPDATE alert_sent_at = now()

Admin marca cuota como pagada manualmente en /admin/clients drawer
  → PATCH /api/admin/clients (set paid_at)
  → El próximo cron crea la siguiente automáticamente
```

### 13.4 Audit con IA

```
Coach va a /audit
  → Marca 12 ítems con pills R/Y/G
  → Click "Generar Diagnóstico Estratégico"
  → POST /api/ai-diagnosis con prompt + auditType + activeClient
  → Backend:
    1. Parse prompt → items por color
    2. Compute scores por pilar (F, E, T, I) — DETERMINÍSTICO
    3. Pick 2 focos con menor score (tie-break: E > F > T > I) — DETERMINÍSTICO
    4. Resolve módulo Skool del foco — DETERMINÍSTICO
    5. Anthropic Haiku → genera título + diagnóstico de 2-3 oraciones por foco
  → Save ai_diagnosis_requests + ai_diagnosis_results
  → Frontend renderiza:
    • Cards "Resultado por módulo" (4 pilares con score X/6 + barra)
    • Cards "Tu foco este trimestre" con badges + diagnóstico + botón al módulo Skool
```

### 13.5 Implementación checklist

```
Coach va a /program-checklist
  → useActiveClient() determina cliente
  → GET /api/checklist-progress?client_id=X → trae task_keys completados
  → Render checklist (32 tareas en 6 meses)

Coach toggle un task:
  → Optimistic update en state local
  → POST /api/checklist-progress { client_id, task_key, completed }
  → Server upsert/delete row en client_checklist_progress
  → Si falla, rollback en cliente

Admin cambia activeClient a otro cliente:
  → Banner amarillo "Viendo otro cliente: Alberto"
  → Recarga progreso del cliente nuevo
  → Si toggle un task → guarda en la cuenta de Alberto
```

### 13.6 Contratación de equipo

```
Candidata va a /aplicar-equipo/setter
  → Renderiza form data-driven desde lib/team-application-forms.ts
  → Si responde "No tengo experiencia" → gate bloquea (server también valida)
  → POST /api/team-apply
  → INSERT team_applications (campos comunes + answers JSONB)
  → Zapier (uvp3wxx) → Slack notificación

Admin va a /admin/team-applications
  → Filtro por rol y status
  → Click candidata → drawer con todas las respuestas
  → Edit status (nueva/revisando/descartada/aprobada/contratada)
  → Editar notas internas
```

---

## 14) Áreas con coexistencias / tech debt

### 14.1 Tablas legacy coexistiendo

- **`clients` vs `crm_clients`**: la primera (legacy) sigue siendo source para lookup de `nombre` en monday-win, chi-chang, monthly-reports/save. La segunda (nueva) es el CRM completo. Ambas tienen `client_id` en `profiles`.
- **`competitor_posts`** (legacy) declarado en migration pero NO usado en código activo.

### 14.2 Múltiples paths para una funcionalidad

- **Audit IA**: endpoint `/api/ai-diagnosis` (Haiku, principal) + edge fn `ai-diagnosis-worker` (Sonnet, legacy). Coexisten.
- **Research**: `/competitor-research` y `/content-research` comparten backend. Más `/market-intelligence` con sistema async separado (research_requests/results).

### 14.3 Bugs conocidos

- `/api/events/process` línea 177: filtro `lt("attempts", supabase.rpc as any)` mal — el filtro real ocurre en JS post-fetch. No-op pero raro.
- `markEvent` reusa `BATCH_SIZE` como cap de retry (debería ser `max_attempts`).
- `dashboard-layout.tsx`: mes default hardcoded `"2025-12"`. Hoy 2026-05.
- `/forgot-password` redirige a `smartscalestrategy.netlify.app` (legacy domain) en vez del canonical.

### 14.4 Hardcoded a Ann (single-tenant assumptions)

- `admin-data-view.tsx`: `ANN_CLIENT_ID = "9d2aebb4-..."` — la pivot table es exclusiva de Ann.
- `/api/monthly-reports/save`: `ANN_EMAIL = "ann@strategycoach.us"` — el webhook `sale.registered` solo se dispara si Ann es la que guarda.

### 14.5 Páginas huérfanas

Existen pero no están en sidebar:
- `/recursos`, `/mi-dashboard`, `/report-history`, `/market-intelligence`, `/content-research`.

### 14.6 Forms externos a airtable.com

3 URLs apuntando a forms hospedados en `airtable.com` (en `/tools` y `/program-checklist`):
- "Form Sumá tu pago"
- "Form Cancelación de membresía"
- "Form de Onboarding"

El label visible NO menciona Airtable — solo el URL es a airtable.com (forms hosting). Si esos forms también murieron, hay que reemplazarlos por algo más (Tally, Typeform, formulario propio del dashboard).

### 14.7 Archivos a archivar

- **`recover_applications.sql`** en root: script de recuperación manual de aplicaciones perdidas (usado una vez en este worktree). Contiene PII de clientas. Está gitignored efectivamente porque nunca fue agregado, pero debería borrarse del worktree local.

---

## 15) Glosario

| Término | Significado |
|---|---|
| **Active client** | El cliente que el admin está viendo en el dashboard. Para usuarios regulares = ownClient. |
| **Own client** | El cliente del user logueado (su perfil). |
| **Smart Scale Internal** | Modo admin del dashboard, con sidebar dedicada. |
| **Ecosistema Circular** | Marco mental de Smart Scale: Fascinate → Educate → Transform → Invite (FETI). 4 pilares. |
| **Plan mensual auto-renovable** | Cliente con suscripción de monto fijo. El cron genera la próxima cuota cuando la actual está paga. |
| **The ONE Thing** | Metodología de Gary Keller: la ÚNICA cosa que si la hacés, todo lo demás se vuelve más fácil. Usado en Monday Win. |
| **Cha-Ching 💰** | Form para registrar deals cerrados. Notifica al equipo. |
| **Monday Win** | Form semanal con 3 logros + foco + bloqueo. Notifica al coach. |
| **Audit** | Auditoría trimestral del Ecosistema Circular con diagnóstico IA. |
| **Skool** | Plataforma externa donde está el contenido del programa. El checklist linkea a sus módulos. |
| **outbound_events** | Cola de eventos asíncronos. Procesada por edge function event-dispatcher. |

---

## Cierre

Este documento cubre el estado del dashboard al **5 de mayo de 2026** después de la sesión 4-5 mayo donde se hicieron 13 cambios principales (ver [CHANGELOG-2026-05-04.md](CHANGELOG-2026-05-04.md)).

Para entender el "por qué" de un cambio reciente, consultar `git log` en main: cada commit tiene mensaje descriptivo con el motivo.

Si encontrás algo desactualizado en este documento, es porque cambiamos algo y nos olvidamos de actualizarlo — actualizarlo cuando lo notes.
