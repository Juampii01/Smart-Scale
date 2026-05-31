# Smart Scale — Documentación Completa del Dashboard
**Fecha:** 2026-05-31 | Generada desde lectura exhaustiva del código fuente

---

## ÍNDICE
1. [Mapa del sistema](#1-mapa-del-sistema)
2. [Portal Cliente — Vista por vista](#2-portal-cliente--vista-por-vista)
3. [Panel Interno — Vista por vista](#3-panel-interno--vista-por-vista)
4. [Arquitectura de datos](#4-arquitectura-de-datos)
5. [Código muerto y features incompletas](#5-código-muerto-y-features-incompletas)
6. [Oportunidades de mejora — Clientes](#6-oportunidades-de-mejora--clientes)
7. [Oportunidades de mejora — Equipo interno](#7-oportunidades-de-mejora--equipo-interno)
8. [Quick wins técnicos](#8-quick-wins-técnicos)

---

## 1. Mapa del sistema

### Audiencias y roles

| Rol | Acceso | Landing default |
|---|---|---|
| **client** | Portal cliente únicamente (`/dashboard`, `/channels`, etc.) | `/dashboard` |
| **setter** | Panel interno (`/admin/setting`, `/admin/prospeccion`, `/admin/leads`) | `/admin/setting` |
| **team** | Panel interno sin gestión de usuarios | `/admin/clients` |
| **admin** | Todo — también puede impersonar setter y cliente (view-as) | `/admin/clients` |

### Árbol de navegación completo

```
PORTAL CLIENTE (sidebar izquierda)
├── PERFORMANCE
│   ├── /dashboard          → KPIs + sparklines + tendencias + MoM
│   ├── /channels           → Instagram · YouTube · Email (métricas por canal)
│   ├── /sales              → Embudo de ventas + Offer Docs
│   ├── /reflection         → Mayor logro · foco · soporte · NPS
│   └── /metrics            → Tabla completa de métricas + radar de salud
│
├── PROGRAMA
│   ├── /audit              → Ecosistema Circular (12 items → diagnóstico IA)
│   ├── /program-checklist  → Checklist 6 meses (tabs: Lista / Docs / Playbook)
│   ├── /tools              → GPTs de Ann + formularios internos
│   ├── /calendar           → Llamadas semanales con Ann (Zoom links + timezone)
│   ├── /monday-win         → Reporte semanal de logros
│   ├── /report-input       → Carga de métricas mensuales (tabs: Form / Historial)
│   └── /chi-chang          → Registro de ventas cerradas
│
└── CONTENIDO (con IA)
    ├── /video-feed         → Análisis de posts propios de Instagram
    ├── /competitor-research→ Top videos de YouTube/Instagram de competidores
    ├── /transcript         → Transcripción + resumen IA de YouTube/Reels
    └── /content-research   → Investigación de contenido con IA
    (/market-intelligence   → en menú, fuera de sidebar)
    (/recursos              → biblioteca de links/docs/videos)

PANEL INTERNO /admin/* (sidebar separada)
├── Executive Dashboard     → Caja nueva/recurrente + performance setters
├── Leads                   → CRM de leads (4-5⭐ default)
├── Pagos                   → Log de pagos manuales (Stripe vía Zapier)
├── Clientes                → CRM completo (cuotas · followups · credenciales)
├── Agenda                  → Gestión de eventos del programa (Zoom etc.)
├── Onboarding              → Crear clientes nuevos + magic link
├── Aplicaciones            → Pipeline de aplicaciones al programa
├── Contratación            → Aplicaciones a roles del equipo
├── Setting                 → CRM diario de setters + commissions
├── Centro Operativo        → Wiki interno (SOPs, recursos, claves)
├── Importar                → Carga histórica desde Google Sheets
└── Data                    → Tabla editable de métricas por cliente
```

---

## 2. Portal Cliente — Vista por vista

### `/dashboard` — Performance Center

**Qué muestra:** KPIs principales del mes seleccionado.

| Sección | Contenido | Datos |
|---|---|---|
| Business KPIs | 6 tarjetas: Cash, Revenue, MRR, Ad Spend, IG Followers, Nuevos clientes | `monthly_reports` → mes actual + 8 meses hist. |
| Trend Charts | 4 gráficos: Cash (bar), MRR (area), Nuevos clientes (bar), IG Followers (area) | `monthly_reports` → todo el historial |
| MoM Panel | Tabla con 6 métricas ponderadas, score general "Mes positivo/a revisar" | `monthly_reports` → mes actual vs anterior |
| Reflection inline | Si existe reflexión del mes, muestra biggest_win + next_focus | `monthly_reports.biggest_win / next_focus` |

**Comportamientos especiales:**
- Skeleton mínimo 2 segundos aunque la data cargue antes (evita flash)
- Si `activeClientId !== ownClientId` (admin viendo otro), muestra banner amarillo
- Sparklines en cada KPI card coloreadas verde/rojo según tendencia
- Badge global "N subiendo, M bajando" en header de KPIs

---

### `/channels` — Métricas por canal

**Qué muestra:** Rendimiento detallado de los 3 canales de adquisición.

| Canal | Métricas mostradas | Gráficos |
|---|---|---|
| Instagram (Short-form) | Seguidores, Alcance, Posts | Sparkline 8m, Growth Index base-100, Correlación Posts vs Audiencia |
| YouTube | Suscriptores, Audiencia mensual, Views, Videos | Sparkline 8m, Growth Index, Correlación Views vs Suscriptores |
| Email | Suscriptores totales, Nuevos | Sparkline 8m, Growth Index |

**Comportamientos especiales:**
- Growth Index normalizado a 100 desde primer mes con datos (compara progreso relativo, no absoluto)
- Si un canal no tiene datos: muestra "Sin datos" en gris (no rompe el resto)
- Correlación solo aparece si ≥2 meses con datos en el canal

---

### `/sales` — Embudo de ventas

**Qué muestra:** Pipeline completo de conversión + Offer Docs.

**Embudo principal (barras proporcionales con colores dinámicos):**
- Llamadas agendadas → Atendidas → Nuevos clientes cerrados
- Color: verde ≥60%, naranja ≥30%, rojo <30% de conversión
- Tasa de cierre general: verde ≥20%, naranja ≥10%, rojo <10%

**Offer Docs pipeline:**
- 4 stats: Aplicaciones inbound, ODs enviados, ODs respondidos, Cierres por OD
- Embudo de ODs (solo si se enviaron)
- Historial gráfico de 12 meses de ambos funnels

---

### `/reflection` — Reflexión mensual

**Qué muestra:** Los campos cualitativos del reporte mensual en formato readable.

- Bigger Win, Próximo foco, Soporte necesido, Mejoras sugeridas, NPS
- NPS: verde ≥50, naranja ≥0, rojo <0
- Si no hay reporte: empty state con link a `/report-input`

---

### `/metrics` — Tabla completa

**Qué muestra:** Los 50+ campos de `monthly_reports` organizados en categorías con búsqueda en vivo.

Categorías: Business · Sales · Short-form · YouTube · Email · Reflection · Other

- Health Score Radar (6 dimensiones normalizadas al máximo histórico)
- Rolling 12m: suma o snapshot según tipo de métrica
- Selector de mes poblado solo con meses que tienen datos reales

---

### `/audit` — Ecosistema Circular

**Qué hace:** Diagnóstico estratégico trimestral con 12 preguntas y análisis IA.

**Flujo completo:**
1. Se detecta automáticamente si el cliente genera >$20k/mes o <$20k (basado en `monthly_reports.total_revenue`) → carga el set de preguntas correspondiente
2. El cliente marca cada ítem: Rojo (crítico), Naranja (débil), Verde (fortaleza)
3. Genera diagnóstico IA via `/api/ai-diagnosis` (async, polling cada 3s, timeout 1 min)
4. Resultado: 4 scores por pilar (Fascinate · Educate · Transform · Invite) + 2 módulos prioritarios de Skool
5. Historial de diagnósticos anteriores con timestamps

**4 pilares:**
- **F — FASCINATE:** Atracción de leads, contenido corto, audiencia
- **E — EDUCATE:** Demanda orgánica, email, contenido largo
- **T — TRANSFORM:** Oferta, casos de éxito, comunidad
- **I — INVITE:** Prospección, onboarding, delivery escalable

---

### `/program-checklist` — Programa (3 tabs)

**Tab "Programa" — Checklist de implementación:**
- 6 meses × 4 semanas × ~120 tareas totales
- Cada tarea: label · Nivel (0-8 con colores) · Outcome · Link (Skool/GPT/form)
- Toggle completar/descompletar con persistencia en Supabase
- Progreso % por mes con barra visual
- UI prefs (qué mes/semana está abierto) en localStorage

**Tab "Documentos" — Multi-page Notion:**
- Árbol de páginas anidables sin límite
- Se auto-siembra con 4 docs template: Investigación de Mercado, Avatar, Oferta, IP
- Editor BlockNote por página
- Auto-save 600ms (meta) / 800ms (contenido)
- Drag-and-drop para reordenar (solo dentro del mismo padre)
- Búsqueda que expande automáticamente ancestros del resultado

**Tab "Playbook" — Documento único de Ann:**
- Un solo documento por cliente, creado y editado por admin/team
- El cliente solo puede tildar/destildar checkboxes (validación en 2 capas: frontend + backend 403)
- Flag `visible_to_client`: admin lo revela cuando está listo

---

### `/tools` — Herramientas con IA

7 GPTs de Ann (links externos a ChatGPT):
1. Ann IA — Asistente general
2. Coach de Contenido
3. Email Engine
4. Offer Builder
5. DM Coach
6. Offer Doc Builder
7. Copywriter

2 formularios internos (links internos):
- Monday Win (`/monday-win`)
- Reporte Mensual (`/report-input`)

---

### `/calendar` — Agenda de llamadas

- Llamadas grupales semanales con Ann (Q&A, Hot Seat, etc.)
- Convierte automáticamente hora Miami → hora local del usuario
- Link directo a Zoom + código de acceso copiable
- Link a Calendly para agendar llamada privada mensual
- Tipos de recurrencia: semanal, quincenal, mensual, último viernes del mes, única vez

---

### `/monday-win` — Reporte semanal

Formulario simple de 5 campos:
- **Principal logro** (obligatorio) + Segundo y tercer logros (opcionales)
- **Una sola cosa** para esta semana (el foco prioritario — metodología "The ONE Thing")
- **Bloqueo / pregunta** para el equipo
- POST a `/api/monday-win` → notifica vía Zapier + guarda en Supabase

---

### `/report-input` — Carga de métricas mensuales

**Tab "Reporte":** Formulario con 6 grupos (Business · Sales · Short-form · YouTube · Email · Reflexión)
- Pre-carga automáticamente si ya existe reporte para el mes seleccionado
- Confirmación antes de sobrescribir reporte existente
- NPS: 10 botones (1-10) con colores, limpiable
- Al guardar: dispara eventos (Slack + Zapier) notificando al equipo

**Tab "Historial":** Cards expandibles con métricas + eliminación (solo admin)

---

### `/chi-chang` — Registro de ventas

Formulario mínimo para capturar:
- Fecha · Valor total del trato · Cash collected hoy
- Próximo nivel a conquistar (5 opciones: $5K → $100K)
- Se guarda SIEMPRE en la cuenta del usuario logueado (no del cliente visto)
- Notifica al equipo

---

### Herramientas de contenido con IA

#### `/transcript` — Transcripción + análisis
- YouTube (cualquier video público) + Instagram Reels públicos
- Output configurable: transcript / resumen / ambos
- Resumen IA estructurado en secciones (RESUMEN · PUNTOS CLAVE · CONCLUSIÓN)
- Historial de transcripciones con estado Pendiente/Completado
- Modal full-screen para ver transcript completo

#### `/competitor-research` — Análisis de competidores
- Top 5 videos de cualquier canal YouTube o perfil Instagram
- Análisis IA por video
- Caché semanal (no vuelve a procesar si ya está en caché)
- Límite de 5 nuevos análisis por mes por cliente

#### `/video-feed` — Análisis de cuenta propia de Instagram
- Conecta cuenta de Instagram del cliente
- Trae posts de los últimos 30 días
- Rankea por engagement
- Insights con IA

#### `/content-research` — Investigación de contenido
- Herramienta de investigación de mercado con IA
- Genera ideas de contenido basadas en el nicho

---

## 3. Panel Interno — Vista por vista

### Executive Dashboard `/admin/executive-dashboard`

**Filtro de rango:** 7d / 14d / 30d (param URL)

| Bloque | Contenido |
|---|---|
| **New Cash** | Clientes nuevos del período: total contratado, cobrado, pendiente por cobrar. Tabla detalle por cliente |
| **Caja Recurrente** | Cuotas de clientes existentes pagadas/pendientes en el período. Total cobrado real |
| **Setting** | Por setter: conversaciones inbound/outbound, leads calificados, ODs, calls, cierres, revenue generado |
| **Cuotas próximas** | Vencidas (rojo) + próximas 7 días (ámbar). Tabla con cliente, monto, días |

---

### Leads `/admin/leads`

CRM de leads con calificación por estrellas.

- **Filtro default:** Solo 4-5⭐ (leads calificados). Botón "Todas" muestra pipeline completo
- **Edición inline:** Rating (stars), status, source, tipo, nicho, notas
- **Búsqueda:** Nombre, tag, nicho, Instagram
- **Webhook URL copiable** para integrar ManyChat/GHL
- **Export CSV** con todos los campos

---

### Pagos `/admin/payments`

Log de pagos externos (Stripe vía Zapier).

- **Dos vistas:** Por mes (agrupado) o tabla plana
- **Status:** aceptado / rechazado / pendiente — editable inline
- **Summary:** Total cobrado, aceptados, rechazados
- **Payment Link Dialog:** Genera links de pago configurables
- **Export CSV**

---

### Clientes `/admin/clients`

CRM completo de clientes del programa.

| Funcionalidad | Detalle |
|---|---|
| **Cuotas** | 1-6 cuotas por cliente, monto editable inline, marcar como pagadas con fecha |
| **Plan mensual** | Toggle "Plan mensual auto-renovable" → genera cuota siguiente cuando se marca la actual |
| **Seguimientos** | Historial de follow-ups (WhatsApp, llamada, email, otro) con timestamps |
| **Credenciales** | Email + contraseña del portal del cliente (visible solo al admin) |
| **Offboarding** | Marca inactivo + elimina cuotas pendientes |
| **Status cuota** | Pagado / Pendiente / Vencido (auto-calculado por fecha) |
| **Alertas** | Vencidas (rojo), próximas 7 días (amarillo) |
| **Export CSV** | Todos los clientes con datos clave |

---

### Onboarding `/admin/onboarding`

Creación de nuevos clientes completo en un formulario:
- Nombre, email, teléfono, programa, setter asignado
- Total USD + distribución en 1-6 cuotas
- Fechas de vencimiento por cuota
- **Output:** Crea user en auth + row en `clients` + cuotas → devuelve magic link (24h) O contraseña temporal

> **Bug conocido:** Auto-selecciona setter "Fabri" si existe en la lista (hardcodeado en el código)

---

### Aplicaciones `/admin/applications`

Pipeline de aplicaciones al programa Smart Scale.

- **Estados:** nueva → revisada → aceptada / rechazada
- Drawer con todos los campos del formulario `/apply` + notas internas editables
- Búsqueda por nombre, email, Instagram, canal
- Filtros por estado
- Export CSV

---

### Setting `/admin/setting`

CRM diario de actividad de setters.

| Sección | Contenido |
|---|---|
| **Log diario** | Tabla editable: fecha, setter, conv inbound/outbound, outbound replies, leads, ODs, calls. Click para editar celda |
| **KPIs del mes** | Outbound response rate, qualification rate, doc response rate, call rate |
| **Summary cards** | Inbound, Outbound, Total conversaciones, Leads, ODs, Calls |
| **EOD Form** | Setter carga su reporte del día (inbound/outbound/leads/ODs/calls) |
| **Commission Panel** | Resumen de comisiones del setter por mes |
| **Month picker** | Navegar mes anterior/siguiente |

---

### Centro Operativo `/admin/centro-operativo`

Wiki interna tipo Notion con scope control:

- **Scope "Global":** Admin + Team
- **Scope "Prospeccion":** Admin + Setter (también)
- Cambiar scope en una página raíz → cascada a todas las subpáginas (con confirmación)
- Editor BlockNote, árbol de páginas, drag-and-drop
- Auto-save 600ms (meta) / 800ms (contenido)
- Botón "Nuevo usuario" (admin) para crear cuentas internas

---

### SOPs `/admin/centro-operativo` (dentro del Centro Op)

Playbooks operativos con steps numerados y templates copiables.

- **Crear con IA:** Describe el proceso → Claude genera steps + templates estructurados
- **Crear manual:** Formulario completo (título, descripción, frecuencia, tags, steps, templates por canal)
- **Templates por canal:** Skool, Slack, Email, WhatsApp, Otro — con botón copy
- **Badge "IA"** si fue generado con IA
- **Búsqueda + filtro por tag**

---

### Data `/admin/data`

Tabla editable de métricas mensuales (admin como Google Sheets).

- Grid: meses = filas, campos = columnas (agrupados por sección)
- Click en celda → input editable → Enter guarda, Esc cancela
- Sticky: primera columna (mes) + primera fila (headers)
- Acepta cliente activo del header → muestra sus datos
- Export CSV

---

### Importar `/admin/import`

Carga histórica de datos desde Google Sheets.

- Grid 12 meses × campos editables
- Selector de año (2024, 2023)
- Ignora filas vacías automáticamente
- Feedback por mes: verde (guardado), rojo (error)
- Reference card con mapeo de nombres de columnas Sheets → Dashboard

---

## 4. Arquitectura de datos

### Tablas principales y quién las consume

| Tabla | Quién escribe | Quién lee | Notas |
|---|---|---|---|
| `monthly_reports` | API `/report-input`, admin `/data`, import | Dashboard, channels, sales, reflection, metrics, admin-data | Core del sistema. Tiene upsert por (client_id, month) |
| `clients` | Onboarding, webhook `/client` bridge | Dashboard layout, todos los que filtran por cliente | FK de `profiles.client_id` |
| `crm_clients` | Webhook `/client` (Airtable), admin-clients | admin-clients, billing-alerts cron | Tabla CRM separada del portal |
| `profiles` | API create-user, trigger `handle_new_user` | Todos los API routes (auth guard), dashboard-layout | `role` determina todo el acceso |
| `ai_diagnosis_requests/results` | API `/ai-diagnosis` | audit-view | Async: request → polling → result |
| `client_playbook_main` | API `/client-playbook-main` | client-playbook-main-view | Un doc por cliente, edición restringida |
| `client_playbook_pages` | API `/client-playbook` | client-playbook-view | Multi-page, auto-seed 4 docs template |
| `centro_op_pages` | API `/admin/centro-op-pages` | centro-op-pages-view | scope: global/prospeccion |
| `leads` | Webhook `/lead`, admin-leads | admin-leads-view | rating, tags, raw_payload |
| `crm_installments` | Webhook `/client`, onboarding, billing cron | admin-clients | Cuotas con due_date, paid_at, alert_sent_at |
| `applications` | Public `/apply` | admin-applications | Sin auth para escritura |
| `team_applications` | Public `/team-apply` | admin-team-applications | Validación gates server-side |
| `transcript_history` | API `/transcript` | transcript-view | Por user_id |
| `content_research_history` | API `/content-research` | content-research-view | Por user_id, caché |
| `setting_daily_logs` | API `/admin/setting/log` | admin-setting-view | Por setter_id, fecha |
| `resources` | API `/resources` | resources-view | Sin scope de cliente (global) |
| `client_checklist_progress` | API `/checklist-progress` | program-checklist-view | Por client_id + task_key |
| `payments` | Webhook `/payment` | admin-payments-view | Sin scope de cliente |

### Hook de datos central

```
useMonthlyReports()
  → carga todos los monthly_reports del activeClient
  → normaliza nulls → 0
  → ordena por mes ASC
  → usado por: business-kpis, mom-panel, channels-view, sales-view
```

### Contexto global de datos

```
DashboardLayout
  ├── activeClientId  (localStorage, cambio manual admin)
  ├── ownClientId     (profiles.client_id del usuario logueado)
  ├── selectedMonth   (estado React, no persiste)
  ├── userRole        (profiles.role)
  └── availableMonths (meses de monthly_reports del activeClient)

AnnualMetricsContext
  └── annualMetrics   (suma/snapshot rolling 12m del activeClient)
```

---

## 5. Código muerto y features incompletas

### Código muerto confirmado

| Ítem | Ubicación | Descripción |
|---|---|---|
| `admin_uncomplete_day()` DB function | Supabase (policy audit) | Función SECURITY DEFINER que referencia tablas inexistentes (`day_progress`, `video_capsule_completions`, `user_events`) → nunca puede ejecutarse con éxito. Dead code completo |
| `eod-form-dialog.tsx` | `components/admin/` | Hay `eod-form-dialog.tsx` Y `eod-form-dialog-v2.tsx`. La v1 fue reemplazada por la v2 pero aún existe en el repositorio |
| `netlify.toml` | Raíz del proyecto | La app deployea en Vercel (`vercel.json` activo). El `netlify.toml` existe pero no está en uso |
| `discovery_forms` / `discovery_responses` tables | Supabase | Tablas con RLS (responses con INSERT abierto), pero ninguna vista en el código la consume. Sin frontend correspondiente |
| `admins` table | Supabase | Tabla `admins` con policy `admins_select_own`, pero el control de acceso se hace via `profiles.role`. Tabla aparentemente sin uso activo |
| `kpis` table | Supabase | RLS habilitado, policy de lectura para autenticados, pero ningún view/route la consume actualmente |
| `ToolItem` type | `types/index.ts` | Tipo definido pero no usado en ningún componente actual |
| `DiagnosisHistoryItem` type | `types/index.ts` | Definido pero el historial de diagnósticos usa el tipo inline en audit-view |
| `channels` / `channel_members` / `messages` tables | Supabase | Tablas de mensajería interna con policies complejas, pero no hay ninguna vista de mensajería en el portal actual |
| `tasks` table | Supabase | Tabla con policies de lectura/escritura pero sin UI correspondiente visible |
| Setter "Fabri" hardcodeado | `admin-onboarding-view.tsx` línea ~205 | Auto-selecciona un setter específico por nombre. Dead hardcode |

### Features incompletas o medio implementadas

| Feature | Estado actual | Qué falta |
|---|---|---|
| **Módulos Skool desde Audit** | La IA retorna `skool_modulo` + `skool_nivel` en el JSON. La UI tiene código para mostrar un botón que navegue al módulo | El link real al módulo en Skool no está integrado (hardcode de URL faltante o lógica de mapping) |
| **Generación IA en Prospección** | El modal de Prospección tiene un tab "Con IA" que manda a `/api/admin/prospeccion/generate` | No se encontró el endpoint `generate` en los API routes de prospección — posible que no exista aún |
| **Import histórico** | Solo soporta años 2024 y 2023 hardcodeados | Dinamizar para aceptar cualquier año |
| **Video Feed** | Vista de análisis de cuenta propia de Instagram | Requiere cuenta de Instagram conectada (integración pendiente de setup por cliente) |
| **market-intelligence** | Vista existe en `/market-intelligence` con API routes | Sin sidebar link → página huérfana (no aparece en navegación del cliente) |
| **mi-dashboard** | Página `/mi-dashboard` existe | Sin contenido visible, probablemente en construcción |
| **NPS en Reflection** | Se intenta leer `nps_score` de `monthly_reports` | El campo NPS se guarda desde `/report-input` pero no aparece en el schema migrado oficialmente |
| **Setter auto-assign en Onboarding** | Hay lógica de auto-selección | Hardcoded al nombre "Fabri" — debería ser configurable |
| **Offer Doc funnel** | En sales-view, el funnel de OD solo aparece si `odSent > 0` | Ninguna manera de saber desde el cliente si envió ODs sin ir al reporte |

### Variables de entorno con referencias client-side (antes de PR2)

Tras aplicar PR2 esto ya está corregido, pero el dueño necesita crear:
- `ZAPIER_WEBHOOK_MONDAY_WIN` (era `NEXT_PUBLIC_ZAPIER_WEBHOOK_MONDAY_WIN`)
- `ZAPIER_WEBHOOK_CHI_CHANG` (era `NEXT_PUBLIC_ZAPIER_WEBHOOK_CHI_CHANG`)

---

## 6. Oportunidades de mejora — Clientes

### UX / Experiencia

#### OPP-C01 — Progreso visible en la homepage
**Problema:** El dashboard principal (`/dashboard`) muestra KPIs pero el cliente no tiene una vista inmediata de "dónde estoy en el programa".
**Oportunidad:** Agregar al `/dashboard` una sección de bienvenida con:
- % de avance del checklist (ya se calcula en `program-checklist-view`)
- Próximo hito del mes (siguiente semana del checklist)
- Último diagnóstico del Ecosistema (fecha + 2 módulos prioritarios)
**Impacto:** Alto — reduce el tiempo para saber "qué tengo que hacer hoy"

#### OPP-C02 — Monday Win con historial visible
**Problema:** El formulario de Monday Win no muestra los wins anteriores. El cliente envía "al vacío" y no puede ver su evolución.
**Oportunidad:** Agregar debajo del formulario una lista de los últimos 4-8 Monday Wins con fecha y preview del logro principal.
**Datos disponibles:** Hay una tabla de registros en Supabase (ya se guarda), solo falta el GET del historial.
**Impacto:** Medio — aumenta la motivación y la percepción de progreso

#### OPP-C03 — Chi-Chang con historial y total acumulado
**Problema:** El Cha-Ching es un formulario de una sola dirección, sin feedback de cuánto lleva cerrado en el mes/año.
**Oportunidad:** Mostrar debajo del form:
- Total cerrado en el mes actual
- Total acumulado en el año
- Historial de los últimos 5 deals
**Impacto:** Medio — gamificación simple que refuerza el avance

#### OPP-C04 — Notificación de próxima llamada en el dashboard
**Problema:** El cliente tiene que ir a `/calendar` para saber cuándo es la próxima llamada. No hay recordatorio en el dashboard.
**Oportunidad:** Widget en el dashboard principal con "Próxima llamada: [nombre] — [día y hora local]" con botón directo al Zoom.
**Datos disponibles:** `calendar_events` con `next_date` y `time`. Ya hay lógica de timezone en `calendar-view.tsx`.
**Impacto:** Alto — reduce el esfuerzo para asistir a las llamadas

#### OPP-C05 — Diagnóstico de Audit más accionable
**Problema:** El diagnóstico IA retorna los 2 módulos prioritarios, pero el cliente tiene que ir a `/program-checklist` a buscar manualmente las tareas de ese módulo.
**Oportunidad:** En la card del diagnóstico, mostrar directamente las tareas del checklist del módulo recomendado con links directos.
**Datos disponibles:** El JSON de diagnóstico tiene `skool_modulo` (ej: "F2") — el checklist tiene el campo `level` mapeado a esos módulos.
**Impacto:** Alto — cierra el gap entre "qué hacer" y "hacerlo"

#### OPP-C06 — Onboarding guiado para usuarios nuevos
**Problema:** Un cliente que acaba de recibir acceso no sabe por dónde empezar. La sidebar muestra todo al mismo tiempo.
**Oportunidad:** Primera vez → mostrar un modal de bienvenida o un tour guiado de 3-4 pasos: (1) Completa tu primer reporte mensual → (2) Hacé el Audit → (3) Revisá el Checklist → (4) Anotá tu primer Monday Win.
**Implementación:** Detectar con localStorage si es la primera visita. Sin backend.
**Impacto:** Alto — reduce la fricción de inicio y aumenta la activación

#### OPP-C07 — Vista de Reflection con comparativa
**Problema:** Reflection muestra solo el mes seleccionado. El cliente no puede ver su evolución de NPS o de foco semestre a semestre.
**Oportunidad:** Agregar mini-gráfico de NPS histórico (ya hay datos en `monthly_reports`) y comparativa del "biggest win" del mismo mes hace un año.
**Impacto:** Medio

#### OPP-C08 — Transcript: guardar favoritos y búsqueda
**Problema:** El historial de transcripts crece sin orden. Para buscar un insight específico el usuario debe abrir cada item.
**Oportunidad:** (1) Búsqueda full-text en historial de transcripts. (2) Opción de "destacar" secciones del resumen. Los datos ya están en Supabase en `transcript_history`.
**Impacto:** Bajo-Medio

#### OPP-C09 — Modo oscuro como default
**Problema:** El sistema soporta dark/light mode via `next-themes`, pero no hay evidencia de que el default sea dark.
**Oportunidad:** Verificar y establecer dark como default para coincidir con la estética del dashboard (amarillo sobre oscuro).
**Implementación:** 1 línea en ThemeProvider (`defaultTheme="dark"`).
**Impacto:** Bajo — consistencia visual

#### OPP-C10 — Mobile: sidebar y navegación
**Problema:** La sidebar tiene comportamiento mobile (cierra al clickear) pero varias tablas y gráficos tienen `min-w-[1120px]` que fuerzan scroll horizontal.
**Oportunidad:** Auditoria de todas las tablas para hacer versiones mobile-first (stackear columnas, priorizar métricas clave).
**Impacto:** Medio si los clientes acceden desde mobile

### Features nuevas de alto valor para clientes

#### OPP-C11 — Dashboard de comparativa entre clientes (opt-in)
**Idea:** Mostrar dónde está el cliente en relación al promedio del programa (benchmarks anónimos).
**Ejemplo:** "Tu tasa de cierre es 18%. El promedio del programa es 22%. Los top 20% cierran al 31%."
**Datos:** Ya existen en `monthly_reports` de todos los clientes → calcular percentiles.
**Impacto:** Alto — genera motivación y muestra claramente el gap

#### OPP-C12 — Goal setting mensual
**Idea:** Antes de cargar el reporte, el cliente puede establecer metas para el mes siguiente. Al cargar el reporte, ve si las alcanzó.
**Implementación:** Nueva columna `goals` (jsonb) en `monthly_reports` o tabla `monthly_goals` separada.
**Impacto:** Alto — contexto de progreso más rico

#### OPP-C13 — Integración nativa con Instagram para Video Feed
**Problema actual:** El Video Feed requiere que el cliente conecte manualmente su cuenta de Instagram.
**Oportunidad:** Simplificar el setup con un flujo guiado de conexión OAuth.
**Impacto:** Alto si muchos clientes usan Instagram

---

## 7. Oportunidades de mejora — Equipo interno

### UX / Experiencia del equipo

#### OPP-I01 — CRM de leads con vista Kanban
**Problema:** Los leads se muestran en tabla. Para mover un lead de etapa hay que editar inline el campo status.
**Oportunidad:** Agregar vista Kanban alternativa (columnas: nuevo → contactado → calificado → propuesta → cerrado).
**Datos disponibles:** Los campos ya existen en `leads`.
**Impacto:** Alto para el workflow diario del setter

#### OPP-I02 — Notificaciones en el panel interno
**Problema:** No hay sistema de notificaciones in-app. El equipo depende de Slack para saber si se cargó un reporte, se cerró una venta, etc.
**Oportunidad:** Badge de notificaciones en el panel interno vinculado a la tabla `outbound_events` (ya existe).
**Implementación:** Polling cada 30s o realtime con Supabase subscriptions.
**Impacto:** Alto — reduce dependencia de Slack para estado del sistema

#### OPP-I03 — Executive Dashboard con alertas accionables
**Problema:** El dashboard ejecutivo muestra cuotas vencidas en una tabla pasiva.
**Oportunidad:** Agregar botones de acción directa: "Enviar recordatorio por WhatsApp", "Marcar como pendiente de contactar". Con historial de contactos integrado.
**Impacto:** Alto — reduce el tiempo de respuesta ante cuotas vencidas

#### OPP-I04 — Onboarding: eliminar hardcode de setter "Fabri"
**Problema:** El código auto-selecciona el setter llamado "Fabri" si existe.
**Fix:** Leer el primer setter disponible o dejar el campo vacío por default.
**Implementación:** 5 minutos.
**Impacto:** Medio — evita confusión cuando hay múltiples setters

#### OPP-I05 — Setter: ver pipeline de sus clientes asignados
**Problema:** El setter solo ve su log diario y prospección. No tiene una vista de sus clientes en el programa.
**Oportunidad:** En la vista de Setting, agregar una tab "Mis clientes" que muestre los clientes que el setter trajo, su estado de cuotas y su progreso en el programa.
**Datos disponibles:** `crm_clients.setter_id`, `crm_installments`, `client_checklist_progress`.
**Impacto:** Alto — da ownership al setter sobre sus resultados

#### OPP-I06 — Admin: vista de salud de todos los clientes
**Problema:** Para ver cómo está cada cliente hay que entrar al portal de cada uno individualmente.
**Oportunidad:** En `/admin/clients`, agregar mini-indicadores: último reporte (cuántos días hace), progreso en checklist, última vez que hizo audit, NPS promedio.
**Impacto:** Alto — permite detectar clientes que necesitan atención proactiva

#### OPP-I07 — Completar el endpoint de generación IA para Prospección
**Problema:** El modal de Prospección tiene un tab "Con IA" que llama a `/api/admin/prospeccion/generate`, pero este endpoint no fue encontrado en el código.
**Fix:** Implementar el route `app/api/admin/prospeccion/generate/route.ts` similar al de SOPs (`/api/admin/sops/generate`).
**Impacto:** Medio — feature que el setter espera y no funciona

#### OPP-I08 — Magic link: búsqueda eficiente de usuario
**Problema:** El endpoint de magic link llama a `listUsers()` y hace búsqueda lineal O(n) sobre todos los usuarios.
**Fix:** Usar `supabase.auth.admin.getUserByEmail(email)` directamente, o buscar en `profiles` por email (si se agrega ese campo).
**Impacto:** Bajo ahora, Alto si la base de usuarios crece significativamente

#### OPP-I09 — Discovery Forms (tablas huérfanas)
**Problema:** Las tablas `discovery_forms` y `discovery_responses` existen en Supabase con policies, pero no hay UI.
**Oportunidad:** Construir el frontend correspondiente, O borrar las tablas si la feature fue descartada.
**Impacto:** Medio — reducción de deuda técnica o feature nueva

#### OPP-I10 — Tabla de mensajería / channels (huérfana)
**Problema:** Las tablas `channels`, `channel_members`, `messages` tienen policies complejas y bien definidas, pero no hay ninguna interfaz de mensajería en el portal.
**Oportunidad:** Construir un canal de comunicación directo cliente-equipo usando estas tablas como base, O descartarlas formalmente si no es parte del roadmap.
**Impacto:** Alto si se construye (valor de retención para clientes) / Medio si se limpia

#### OPP-I11 — Market Intelligence visible en navegación
**Problema:** La página `/market-intelligence` existe con API routes completos, pero no tiene link en la sidebar del cliente.
**Fix:** Agregar ítem a la sidebar bajo "CONTENIDO".
**Implementación:** 3 líneas en `sidebar.tsx`.
**Impacto:** Bajo (si la feature está completa) — feature escondida

#### OPP-I12 — Import: dinamizar años soportados
**Problema:** El import histórico tiene 2024 y 2023 hardcodeados.
**Fix:** Generar el array de años dinámicamente (ej: últimos 5 años desde `new Date().getFullYear()`).
**Implementación:** 5 minutos.
**Impacto:** Bajo pero necesario cuando llegue 2027

---

## 8. Quick wins técnicos

### Limpiar código muerto (impacto inmediato)

| Ítem | Acción | Tiempo |
|---|---|---|
| `components/admin/eod-form-dialog.tsx` | Borrar (reemplazado por v2) | 2 min |
| `netlify.toml` | Borrar si Vercel es el deploy definitivo | 2 min |
| Setter "Fabri" en onboarding | Reemplazar hardcode por lógica dinámica | 15 min |
| Import años hardcodeados | Dinamizar con `new Date().getFullYear()` | 5 min |
| `admin_uncomplete_day()` DB function | DROP FUNCTION (dead code confirmado) | 5 min + migración |
| Policy duplicada en `research_requests` | DROP la policy redundante | 5 min + migración |

### Agregar links faltantes

| Ítem | Acción | Tiempo |
|---|---|---|
| `/market-intelligence` sin link en sidebar | Agregar ítem en `sidebar.tsx` | 5 min |
| Módulos Skool desde Audit | Completar mapping de `skool_modulo` → URL de Skool | 30 min |

### Mejoras de performance

| Ítem | Acción | Tiempo |
|---|---|---|
| `monthly_reports(client_id)` sin índice | `CREATE INDEX CONCURRENTLY` (migración ya preparada en PR1) | Aplica la migración |
| Magic link usa `listUsers()` O(n) | Cambiar a búsqueda directa por email | 20 min |
| `useMonthlyReports()` hace fetch completo en cada vista | El hook cancela correctamente con `mounted`. No hay N+1 aparente. OK | — |

### Agregar funcionalidad mínima con datos existentes

| Oportunidad | Datos ya disponibles | Implementación estimada |
|---|---|---|
| Widget "Próxima llamada" en `/dashboard` | `calendar_events` | 2-3h |
| Historial de Monday Wins | `monday_wins` o similar en Supabase | 2h (requiere verificar tabla) |
| Historial de Cha-Ching | Tabla en Supabase (ya se guarda) | 2h |
| NPS histórico en Reflection | `monthly_reports.nps_score` | 3h |
| % checklist en dashboard | API `/checklist-progress` ya existe | 2h |

---

## Resumen ejecutivo de oportunidades

### Para clientes (top 5 por impacto)

1. **OPP-C06** — Onboarding guiado para usuarios nuevos (activación)
2. **OPP-C01** — Progreso visible en el dashboard principal (retención)
3. **OPP-C05** — Audit conectado directamente al checklist (acción)
4. **OPP-C04** — Widget de próxima llamada en dashboard (asistencia)
5. **OPP-C11** — Benchmarks anónimos vs el grupo (motivación)

### Para el equipo interno (top 5 por impacto)

1. **OPP-I06** — Vista de salud de todos los clientes en una pantalla
2. **OPP-I01** — Vista Kanban para leads (workflow de setter)
3. **OPP-I05** — Setter ve el pipeline de sus propios clientes
4. **OPP-I02** — Notificaciones in-app (reduce dependencia de Slack)
5. **OPP-I03** — Executive Dashboard con acciones directas en cuotas

### Código muerto a limpiar esta semana (< 1h total)

- `eod-form-dialog.tsx` (v1 obsoleta)
- Setter "Fabri" hardcodeado
- Import años hardcodeados
- Link faltante a `/market-intelligence` en sidebar
- `netlify.toml` si Vercel es el deploy definitivo
