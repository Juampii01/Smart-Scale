# Auditoría integral Smart Scale — 2026-08-20

> Relevamiento de solo lectura sobre `main`-worktree `claude/omni-feedback-engine`, último commit `25b8d9c` (2026-08-19).
> No se modificó ningún archivo del repo, no se corrió ninguna migración, no se deployó nada.
> Alcance: 512 archivos fuente (373 `.ts/.tsx`), 74 rutas de página, 113 route handlers de API, 130 migraciones SQL.

---

## Resumen ejecutivo

**1. El dinero que entra y el dinero que el sistema cree que entró son dos sistemas separados, unidos por una persona que tilda checkboxes.** Cuando Stripe cobra, el webhook escribe una fila en la tabla `payments` con nombre, mail y monto — y nada más. Las cuotas reales del cliente viven en otra tabla (`crm_installments`) que ese webhook nunca toca. La única forma de que una cuota figure como pagada es que alguien entre a `/admin/clients` y la marque a mano. El Dashboard Ejecutivo y las alertas de cobranza leen esa segunda tabla. Resultado: si nadie tilda, un cliente que pagó aparece como moroso, le llega un mail de reclamo, y la facturación del mes queda mal. Además, `payments` no tiene ninguna columna que apunte al cliente: no hay forma automática de saber qué pago corresponde a quién.

**2. El mismo cobro puede quedar registrado dos veces.** El webhook de pagos no tiene ninguna marca de "este evento ya lo procesé". Zapier reintenta cuando algo tarda o falla; cada reintento inserta un pago nuevo. No hay forma de distinguirlos después salvo mirándolos a ojo.

**3. Cualquier setter puede ver la facturación completa de todos los clientes.** El rol "setter" es el de menor confianza del equipo (carga leads y su reporte diario). Pero el sistema trata a admin, team y setter como un mismo bloque llamado "staff interno": tanto el endpoint que devuelve los reportes mensuales como las reglas de seguridad de la base de datos les dan acceso a todos los reportes de todos los clientes — revenue, cash collected, MRR. No hace falta ningún truco: alcanza con abrir la URL.

**4. Hay trece pantallas terminadas que ningún botón del producto abre.** Channels, Sales, Biblioteca de recursos, Historial de reportes, Content Research, Video Feed, Pipeline, Renovación, el panel de importación del admin y varias más existen, funcionan y tienen cientos de líneas de código cada una — pero no hay un solo link que lleve ahí. Solo se llega tipeando la URL. Es trabajo pago que no está rindiendo, y para el usuario es funcionalidad invisible.

**5. Cada vez que alguien navega de una pantalla a otra, la app se reautentica desde cero.** El layout con el menú lateral no está montado como layout compartido de Next: se monta de nuevo dentro de cada página. Eso dispara, en cada click del menú, cinco llamadas de red repetidas (sesión, usuario, perfil, avatar, lista de clientes) antes de que se vea nada. Y como no hay ninguna pantalla de carga configurada, el usuario ve la pantalla congelada mientras tanto. Es la fricción más transversal del producto: la sufre cada rol, en cada sesión, en cada click.

---

## Tabla priorizada

Ordenada por relación impacto/esfuerzo.

| # | Hallazgo | Dim | Impacto | Esfuerzo | Archivos |
|---|---|---|---|---|---|
| 1 | Webhook de pago sin idempotencia — un reintento duplica el cobro | 3 | Crítico | Chico | `app/api/webhooks/payment/route.ts` |
| 2 | `payments` y `crm_installments` nunca se cruzan; conciliación 100% manual | 3·9 | Crítico | Mediano | `webhooks/payment`, `admin/payments`, `admin-clients-view` |
| 3 | `/api/admin/reports` devuelve la facturación de todos los clientes a cualquier setter | 2 | Alto | Chico | `app/api/admin/reports/route.ts:28` |
| 4 | `/api/admin/instagram-access` accesible a roles que el sidebar oculta | 2·5b | Alto | Chico | `app/api/admin/instagram-access/route.ts:27,51` |
| 5 | `clients.nombre` queda NULL en 2 de los 3 caminos de alta de cliente **[REINCIDENCIA gotcha #1]** | 1 | Alto | Chico | `webhooks/payfunnels:307`, `admin/onboarding:253` |
| 6 | Variables de entorno usadas en código y ausentes en Vercel → integraciones fail-closed muertas | 3·9 | Alto | Chico | `.env.local` vs `process.env.*` |
| 7 | 13 rutas huérfanas: features completas sin ningún link | 5a | Alto | Chico | ver Anexo D |
| 8 | `CLAUDE.md` desactualizado en los datos que más se usan para decidir | 6 | Alto | Chico | `CLAUDE.md` |
| 9 | El layout remonta y re-fetchea en cada navegación; sin `loading.tsx` | 5c·8 | Alto | Mediano | `components/layout/dashboard-layout.tsx` |
| 10 | PayFunnels: dedup por email bloquea renovaciones y segundas compras | 3 | Alto | Mediano | `app/api/webhooks/payfunnels/route.ts:242` |
| 11 | PayFunnels: fallo parcial deja al cliente sin cuotas, sin rollback | 3 | Alto | Mediano | `app/api/webhooks/payfunnels/route.ts:304` |
| 12 | Color de marca `#dafc69` hardcodeado 937 veces + parches CSS por selector de atributo | 4 | Alto | Grande | 104 archivos + `app/globals.css` |
| 13 | `/api/admin/calendar-events` GET sin chequeo de rol | 2 | Medio | Chico | `app/api/admin/calendar-events/route.ts:9` |
| 14 | Sin `middleware.ts` ni gating server-side de `/admin/*` | 5b | Medio | Mediano | `lib/auth/permissions.ts:77` (único uso: sidebar) |
| 15 | Cola `outbound_events` muerta + tres bugs reales en el handler | 6 | Medio | Chico | `app/api/events/process/route.ts:119,131,50` |
| 16 | 67 policies RLS con `auth.uid()` sin cachear (seq scan por fila) | 2·8 | Medio | Mediano | `supabase/migrations/*.sql` |
| 17 | Índices faltantes en columnas de filtro caliente | 8 | Medio | Chico | ver Anexo B2 |
| 18 | N+1 en el cron de cobranzas: una query por cliente | 8 | Medio | Chico | `app/api/cron/billing-alerts/route.ts:139` |
| 19 | Secreto de PayFunnels aceptado por query string (queda en logs) | 2·3 | Medio | Chico | `app/api/webhooks/payfunnels/route.ts:160` |
| 20 | Endpoints públicos sin rate limit; el rate limit existente es por instancia | 2 | Medio | Chico | `apply`, `team-apply`, `instagram-access`, `lib/rate-limit.ts` |
| 21 | `resolveSocialScope` le da a los setters más alcance del que documenta | 2 | Medio | Chico | `lib/social/scope.ts:36` |
| 22 | Nomenclatura divergente sidebar ↔ título ↔ equipo; inglés y castellano mezclados | 5g | Medio | Chico | `sidebar.tsx`, `dashboard-layout.tsx:PAGE_TITLES` |
| 23 | 9 links internos con `<a href>` = recarga completa de página | 5d | Medio | Chico | ver detalle 23 |
| 24 | Estado activo del sidebar no funciona en rutas anidadas | 5d | Medio | Chico | `sidebar.tsx:169`, `admin-sidebar.tsx:340` |
| 25 | Cero tests, cero framework de test | 7 | Medio | Mediano | `package.json` |
| 26 | UUIDs de personas hardcodeados en la lógica de negocio | 6 | Medio | Chico | `app/api/webhooks/payfunnels/route.ts:40,45` |
| 27 | Código muerto: 8 archivos duplicados " 2.", 4 módulos sin caller | 6 | Bajo | Chico | ver detalle 27 |
| 28 | Sidebar de admin resuelto client-side: la superficie interna viaja al browser del cliente | 5i | Bajo | Mediano | `components/layout/admin-sidebar.tsx:214` |
| 29 | Basura de repo versionada: `supabase/.temp`, `.git.corrupted-backup-*`, `.next 2`, `*.tsbuildinfo` | 6 | Bajo | Chico | raíz |

---

## Detalle por hallazgo

### 1 · Webhook de pago sin idempotencia — un reintento duplica el cobro
**Impacto: Crítico · Esfuerzo: Chico**

**Qué encontré.** `app/api/webhooks/payment/route.ts:95-105`:

```ts
const { data, error } = await supabase
  .from("payments")
  .insert({ name: String(name).trim(), email, amount, status, description })
```

Es un `insert` seco. No hay clave de idempotencia, no hay `upsert`, no se consulta si el evento ya se procesó. El endpoint tampoco recibe ni guarda el id del evento de Stripe (`evt_…`) o del charge (`ch_…`): el payload que llega de Zapier se mapea a mano a `name/email/amount/description/status` y todo lo demás se descarta.

Contraste: el webhook de PayFunnels **sí** guarda el payload crudo en `payfunnels_webhook_events` antes de procesar (`webhooks/payfunnels/route.ts:189`), y el de SignNow hace lo mismo en `signnow_webhook_events`. El de pagos —el único que toca plata directamente— es el que no tiene ninguna de las dos protecciones.

**Por qué importa.** Zapier reintenta un paso que devolvió error o timeout. Este handler devuelve 500 cuando el insert falla y 200 cuando anda; pero si la función de Vercel se corta por timeout después de haber insertado (el `maxDuration` es 300s pero la red de Zapier corta antes), Zapier reintenta y entra un segundo pago idéntico. Nadie se entera: en `/admin/payments` los dos se ven como dos cobros legítimos del mismo cliente el mismo día, que es exactamente lo que pasa cuando alguien paga en dos cuotas. El total de "Pagos aceptados" que muestra la vista (`admin-payments-view.tsx:227`) queda inflado.

**Cómo arreglarlo.**
1. Migración nueva: agregar `payments.external_event_id text` + `create unique index payments_external_event_id_key on public.payments (external_event_id) where external_event_id is not null;`
2. En el handler, extraer el id del evento del payload de Zapier (`body.id ?? body.event_id ?? body.charge_id ?? body["Charge ID"]`) siguiendo el mismo patrón de fallbacks que ya usa para `name`/`email`.
3. Cambiar el `insert` por `.upsert(insertRow, { onConflict: "external_event_id", ignoreDuplicates: true })` y responder `{ success: true, duplicate: true }` cuando no se insertó nada.
4. Si el payload no trae ningún id (Zapier configurado sin ese campo), caer a una clave sintética `sha256(email + amount + fecha_del_dia)` — imperfecta, pero corta el 95% de los reintentos.
5. Mientras tanto, y en el mismo PR: guardar el body crudo en una tabla `payment_webhook_events` igual que payfunnels, para poder auditar hacia atrás.

**Riesgo del fix.** Bajo. El índice único es parcial (`where … is not null`), así que las filas históricas sin `external_event_id` no chocan. Ojo con hacerlo `NOT NULL`: rompería la carga manual de pagos desde `/admin/payments` (`POST` en `app/api/admin/payments/route.ts:85`).

---

### 2 · `payments` y `crm_installments` nunca se cruzan: la conciliación es 100% manual
**Impacto: Crítico · Esfuerzo: Mediano**

**Qué encontré.** Tres piezas que no se hablan:

- `app/api/webhooks/payment/route.ts:95` inserta en `payments` los campos `name, email, amount, status, description`. **No hay `client_id`.** La tabla no tiene ninguna columna que apunte a `crm_clients` ni a `clients`.
- `app/api/admin/payments/route.ts:45` lee `id, name, email, amount, status, description, created_at`. Confirma que no existe la relación: el `select` explícito no menciona ningún cliente.
- La única escritura de `crm_installments.paid_at` desde la app está en el toggle manual de `components/views/admin-clients-view.tsx:869` (`onToggleInstallment`).

Y del otro lado, lo que consume ese dato:
- `app/api/cron/billing-alerts/route.ts` decide a quién reclamarle plata mirando `crm_installments.paid_at`.
- `components/views/admin-executive-dashboard-view.tsx:273` construye la curva de cash cobrado agrupando por `inst.paid_at`.

El único punto del código donde un cobro real marca una cuota es `webhooks/payfunnels/route.ts:302`, y solo la **primera** cuota, solo en el alta inicial: `paid_at: idx === 0 ? new Date().toISOString() : null`.

**Por qué importa.** Concretamente: un cliente del programa de 6 meses paga la cuota 3 por Stripe. Entra una fila en `payments`. `crm_installments` sigue mostrando la cuota 3 sin pagar. Al día siguiente a las 12:00 UTC corre `billing-alerts`, la ve vencida, y le manda al cliente el mail de recordatorio de cobro (y el aviso a Slack del equipo). El cliente que pagó recibe un reclamo. En paralelo, el Dashboard Ejecutivo reporta menos cash del real hasta que alguien entra a `/admin/clients`, busca al cliente, despliega sus cuotas y tilda la 3. Con ~10 clientes activos y 6 cuotas cada uno son ~60 tildes por ciclo de programa que dependen de que una persona se acuerde.

**Cómo arreglarlo.** En dos etapas, porque la segunda requiere decisión de producto.

*Etapa 1 — hacer trazable el pago (Chico):*
1. Migración: `alter table public.payments add column if not exists client_id uuid references public.crm_clients(id) on delete set null;` + `create index payments_client_id_idx on public.payments (client_id);`
2. En `webhooks/payment/route.ts`, después de resolver el `email`, buscar el cliente: `sb.from("crm_clients").select("id").eq("email", email).maybeSingle()` y guardarlo en `client_id` (null si no matchea — no bloquear el insert nunca).
3. Mostrar en `/admin/payments` una columna "Cliente" y un filtro "sin asignar", para que los no-matcheados sean visibles en vez de silenciosos.

*Etapa 2 — conciliar (Mediano):*
4. Con `client_id` resuelto y `status === "aceptado"`, buscar la cuota impaga más vieja de ese cliente (`crm_installments` where `client_id` y `paid_at is null`, `order by due_date asc, limit 1`) y marcarla `paid_at = now()` **solo si el monto coincide** con `amount` (tolerancia ±1 para redondeos). Si no coincide, dejarla sin tocar y loguear en `system_job_runs` con `logJobRun(sb, "webhook:payment", "warn", …)` — el helper ya está importado en el archivo.
5. Agregar a `/admin/payments` una acción "asignar a cuota" para los casos que el automático no resuelve, en vez de mandar a la persona a otra pantalla.

**Riesgo del fix.** Medio en la etapa 2: si el matching automático se equivoca marca una cuota como pagada que no lo está, y el cliente deja de recibir el recordatorio. Por eso la condición de monto exacto y el "solo la más vieja impaga". Recomendación fuerte: en el primer deploy, dejar el matching en modo "sugerir" (escribir la sugerencia en una columna nueva `suggested_installment_id`) y recién automatizar cuando el equipo confirme un mes de sugerencias correctas.

---

### 3 · `/api/admin/reports` le entrega la facturación de todos los clientes a cualquier setter
**Impacto: Alto · Esfuerzo: Chico**

**Qué encontré.** `app/api/admin/reports/route.ts:28-45`:

```ts
export async function GET(req: NextRequest) {
  const user = await requireInternal(jwt)          // admin OR team OR setter
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  const clientId = searchParams.get("client_id")
  let query = supabase.from("monthly_reports").select(ALL_REPORT_FIELDS)…
  if (clientId) query = query.eq("client_id", clientId)   // ← si no viene, no filtra
```

`requireInternal` usa `isInternal()` (`lib/auth/permissions.ts:71`), que devuelve true para admin, team **y setter**. Sin `client_id` en la query, devuelve `monthly_reports` completa, con `ALL_REPORT_FIELDS` — que incluye `cash_collected`, `total_revenue`, `mrr`, `ad_spend`, `nps_score`.

Y no es solo la API: la misma exposición existe a nivel base de datos. `supabase/migrations/20260602000002_monthly_reports_select_developer.sql:12`:

```sql
CREATE POLICY "monthly_reports_select" ON public.monthly_reports FOR SELECT TO authenticated
  USING ( public.is_internal_staff() OR EXISTS (…p.client_id = monthly_reports.client_id) );
```

y `is_internal_staff()` (`20260531000001:47`) es `role IN ('admin','team','setter')`. O sea: un setter logueado puede hacer `supabase.from("monthly_reports").select("*")` desde la consola del browser, con la anon key, y bajarse la facturación histórica de toda la cartera.

**Por qué importa.** El setter es el rol de menor confianza (rota más, suele ser externo, cobra comisión). Hoy puede ver cuánto factura cada cliente del portfolio. No es un ataque: es abrir devtools o pegar la URL. El daño es de confidencialidad comercial y, si el setter se va a la competencia, de información sobre la cartera entera.

**Cómo arreglarlo.**
1. `lib/auth/permissions.ts`: agregar `export function isStaffFinanciero(role: UserRole) { const r = normalizeRole(role); return r === "admin" || r === "team" }`. No tocar `isInternal` — lo usan 30 rutas y cambiarlo rompe el CRM del setter.
2. `app/api/admin/reports/route.ts`: reemplazar `requireInternal` por un guard que resuelva el rol y exija `isStaffFinanciero`. Si el producto quiere que el setter siga viendo *algún* reporte, exigir `client_id` obligatorio para no-admin y validar contra su `profiles.client_id`.
3. Migración nueva con la policy corregida:

```sql
CREATE OR REPLACE FUNCTION public.is_financial_staff() RETURNS boolean
  LANGUAGE sql SECURITY DEFINER STABLE SET search_path = 'public','pg_catalog'
AS $$ SELECT EXISTS (SELECT 1 FROM public.profiles WHERE id = (select auth.uid()) AND role IN ('admin','developer','team')) $$;
REVOKE EXECUTE ON FUNCTION public.is_financial_staff() FROM anon;
GRANT EXECUTE ON FUNCTION public.is_financial_staff() TO authenticated;

DROP POLICY IF EXISTS "monthly_reports_select" ON public.monthly_reports;
CREATE POLICY "monthly_reports_select" ON public.monthly_reports FOR SELECT TO authenticated
USING ( public.is_financial_staff()
  OR EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = (select auth.uid()) AND p.client_id = monthly_reports.client_id) );
```

(De paso, el `(select auth.uid())` corrige el problema de initplan del hallazgo 16 en esta policy.)

**Riesgo del fix.** Medio-alto si algún flujo del setter lee reportes sin darse cuenta. Antes de mergear, grepear `"/api/admin/reports"` y `from("monthly_reports")` en `components/views/admin-setting-view.tsx` y `setting-daily-crm-view.tsx`; si el setter necesita algún número agregado, exponerlo por un endpoint propio que devuelva solo el agregado, no las filas.

---

### 4 · `/api/admin/instagram-access` accesible a roles a los que el sidebar se lo oculta
**Impacto: Alto · Esfuerzo: Chico**

**Qué encontré.** `app/api/admin/instagram-access/route.ts`: `GET` (línea 27) y `PATCH` (línea 51) usan `requireInternal` — admin, team y setter. Solo `DELETE` (línea 75) exige admin.

Pero `/admin/instagram-access` no está ni en `TEAM_ALLOWED_ADMIN_PATHS` ni en `SETTER_ALLOWED_ADMIN_PATHS` (`lib/auth/permissions.ts:36,53`). O sea: el sidebar se lo esconde a team y setter, la API se lo da.

Es el caso de libro de "ocultar no es autorizar", y el problema es sistémico: `canAccessAdminPath()` aparece **una sola vez en todo el repo**, en `components/layout/admin-sidebar.tsx:214`. No hay ningún otro lugar donde esa lista de permisos se aplique.

**Por qué importa.** La tabla `instagram_access_requests` guarda nombre, email y usuario de Instagram de gente que pidió acceso — leads en frío, PII de terceros que nunca fueron clientes. Un setter que abra `/api/admin/instagram-access` con su token lista todos, y con `PATCH` puede cambiarles el estado (marcarlos "listo" sin que nadie los haya atendido, por ejemplo).

**Cómo arreglarlo.** Cambiar `requireInternal` por `requireAdmin` en `GET` y `PATCH` de ese archivo (el `requireAdmin` local ya está definido arriba, línea 12 — usar ese o el de `api-guards`). Y como fix estructural, ver hallazgo 14: un helper `requirePathAccess(jwt, "/admin/instagram-access")` que reuse `canAccessAdminPath`, para que la lista de permisos sea una sola fuente de verdad en vez de dos.

**Riesgo del fix.** Bajo. La única vista que consume el endpoint es `/admin/instagram-access`, que team y setter no ven.

---

### 5 · `clients.nombre` queda NULL en 2 de los 3 caminos de alta **[REINCIDENCIA — gotcha #1]**
**Impacto: Alto · Esfuerzo: Chico**

**Qué encontré.** Los tres lugares donde nace una fila en la tabla `clients` del portal:

| Camino | Código | `name` | `nombre` |
|---|---|---|---|
| Alta manual de usuario | `app/api/admin/users/create/route.ts:138` | `crmName` | `crmName` ✅ |
| Onboarding desde el admin | `app/api/admin/onboarding/route.ts:253` | `name` | **ausente** ❌ |
| Webhook de PayFunnels | `app/api/webhooks/payfunnels/route.ts:307` | `name` | **ausente** ❌ |

Y quien lo lee: `components/layout/dashboard-layout.tsx:409` (numeración del bloque leído: `if (clientRow?.nombre) setClientDisplayName(clientRow.nombre)`) — solo setea el nombre visible si `nombre` tiene valor. También `app/api/posi/submissions/route.ts:57`: `r.clients?.nombre || r.clients?.name || "—"`.

El gotcha #1 de `CLAUDE.md` documenta el bridge de `users/create` como "ya está resuelto, no tocar". Es cierto para ese camino. Los otros dos son instancias nuevas del mismo patrón, agregadas después.

**Por qué importa.** Todo cliente que entró por PayFunnels o por el form de onboarding del admin —o sea, el camino normal desde que existe el alta automática— tiene `clients.nombre = NULL`. En el portal, el header no muestra su nombre; en `/admin/posi` la columna cliente cae al fallback. Y el riesgo original del gotcha sigue vivo: `name` es la columna legacy donde históricamente se coló el email, y es la única que estos dos caminos llenan.

**Cómo arreglarlo.**
1. En `app/api/admin/onboarding/route.ts:253` y `app/api/webhooks/payfunnels/route.ts:307`, cambiar `insert({ id: clientId, name })` por `insert({ id: clientId, name, nombre: name })`.
2. Backfill en una migración nueva: `update public.clients set nombre = name where nombre is null and name is not null and name not like '%@%';` — la condición del `@` evita copiar emails al campo bueno.
3. Las filas donde `name` sí es un email quedan afuera del backfill a propósito: listarlas (`select id, name from clients where nombre is null`) y corregirlas a mano desde `/admin/clients`, son pocas.
4. Para que no vuelva a pasar: el gotcha #1 de `CLAUDE.md` debería decir explícitamente "toda escritura a `clients` llena `name` **y** `nombre`", y no solo hablar del bridge.

**Riesgo del fix.** Muy bajo.

---

### 6 · Variables de entorno usadas en el código y ausentes en Vercel
**Impacto: Alto · Esfuerzo: Chico (verificación) + variable (según qué falte)**

**Qué encontré.** Comparé todos los `process.env.X` del código contra las claves de `.env.local` (que el propio archivo documenta como bajado con `vercel env pull`). Ausentes por completo del archivo —no vacías, **ausentes**:

```
CLIENT_WEBHOOK_SECRET          CLIENT_CALL_WEBHOOK_SECRET     EVENTS_PROCESS_SECRET
STRIPE_SECRET_KEY              ZAPIER_WEBHOOK_POSI            ZAPIER_WEBHOOK_CLIENT_CALL
ZAPIER_WEBHOOK_LEAD_FOLLOWUP   RESEND_FROM_EMAIL              INSTAGRAM_ACCESS_WEBHOOK_URL
GOOGLE_SERVICE_ACCOUNT_JSON    GOOGLE_DRIVE_FOLDER_ID         OMNI_SLACK_REDIRECT_URI
OMNI_INSTAGRAM_REDIRECT_URI    NEXT_PUBLIC_APP_URL            NEXT_PUBLIC_BOOKING_CALENDLY_URL
NEXT_PUBLIC_BOOKING_STRIPE_URL
```

El header de `.env.local` avisa: *"las variables marcadas sensitive en Vercel vienen vacías acá aunque SÍ estén configuradas en producción"*. Es cierto, y por eso no doy por rotas las que aparecen con `=""` (SIGNNOW_*, VAPID_*, SLACK_*, etc.). Pero **una variable marcada sensitive igual aparece en el pull con valor vacío** — está la clave, sin el valor. Las de arriba no aparecen ni siquiera como clave, lo que apunta a que no existen en el proyecto de Vercel.

El caso más claro son las tres `NEXT_PUBLIC_*`: Vercel nunca las marca sensitive (por definición viajan al browser), así que su ausencia total del pull es evidencia fuerte de que no están definidas.

**Por qué importa.** Todos los webhooks de este repo son fail-closed. `app/api/webhooks/client/route.ts:58`:

```ts
const secret = process.env.CLIENT_WEBHOOK_SECRET
if (!secret) return false      // → 401 a todo el mundo
```

Si `CLIENT_WEBHOOK_SECRET` efectivamente no está, el webhook que trae clientes desde Airtable a `crm_clients` está devolviendo 401 a cada llamada, en silencio, y nadie se enteró porque del otro lado está Zapier. Lo mismo con `client-call` (llamadas de Zoom → `client_calls`). `EVENTS_PROCESS_SECRET` ausente explica por qué la cola de eventos está muerta (hallazgo 15). `ZAPIER_WEBHOOK_POSI` ausente significa que nadie recibe el aviso cuando un cliente completa un nivel de POSI (`lib/zapier.ts:459` devuelve `{ ok: false }` y el llamador lo ignora).

**Cómo arreglarlo.**
1. Correr `vercel env ls` y comparar contra la lista de arriba. Es cinco minutos y define qué es real.
2. Para cada una que falte, decidir: configurarla o borrar el código que la usa. No dejarla a medias.
3. Fix estructural, que es el que evita la próxima: agregar al arranque una validación de configuración. `instrumentation.ts` ya existe y ya corre en boot — agregar ahí un chequeo de las env vars críticas que loguee a `app_logs` con nivel `error` (el panel `/admin/dev-logs` ya las muestra) qué falta. Un webhook que rechaza todo en silencio es indistinguible de un webhook que nadie llama; un log de arranque los separa.

**Riesgo del fix.** Ninguno para la verificación. Configurar un secreto que faltaba puede "despertar" un webhook que llevaba meses rechazando: revisar antes qué hace con los eventos que le lleguen (¿va a procesar una cola vieja de Zapier?).

---

### 7 · Trece rutas huérfanas: features completas a las que no lleva ningún link
**Impacto: Alto · Esfuerzo: Chico (decidir) — Mediano (si se reincorporan)**

**Qué encontré.** Crucé las 74 rutas contra todos los `href="…"`, `href: "…"`, `router.push/replace()` y `redirect()` del repo. Rutas que existen, compilan y no reciben ningún link:

| Ruta | Vista | Líneas | Diagnóstico |
|---|---|---|---|
| `/channels` | `channels-view.tsx` | 526 | Tiene entrada en `PAGE_TITLES` → estuvo en el sidebar y se sacó |
| `/sales` | `sales-view.tsx` | 403 | Ídem |
| `/recursos` | `resources-view.tsx` | 323 | `PAGE_TITLES` lo llama "Biblioteca"; API `/api/resources` viva |
| `/report-history` | `report-history-view.tsx` | 452 | Ídem, título "Historial de Reportes" |
| `/content-research` | — | — | API `/api/content-research` viva y con rate limit |
| `/video-feed` | — | — | API `/api/video-feed` viva |
| `/mi-dashboard` | — | — | `PAGE_TITLES`: "MI Dashboard" |
| `/pipeline` | `pipeline-view` | — | Componentes `components/leads-pipeline/*` completos (board + dnd-kit) |
| `/team` | — | — | — |
| `/renovacion` | `renovacion-view` | — | — |
| `/admin/import` | `admin-import-view.tsx` | 346 | — |
| `/admin/panel-demo` | `admin-demo-panel-view.tsx` | 65 | Probable demo interna |
| `/admin/prospeccion` | redirect | 6 | OK — redirect intencional a `/admin/centro-operativo`, documentado |

Excluí de la lista las que son huérfanas *a propósito* y funcionan bien así: `/`, `/login`, `/signup`, `/reset-password` y `/forgot-password` (se llega por mail), `/privacy`, `/terms`, `/data-deletion` (requisitos de Meta), `/aplicar-equipo/[rol]` y `/apply` (campañas externas), `/booking` y `/booking/confirmed` (link externo), `/conectar-instagram` (se manda a mano), `/posi/[level]` (el link se copia desde `/admin/posi` con el botón de `admin-posi-view.tsx:136` — verificado, no es huérfana real).

**Por qué importa.** Son ~2.100 líneas solo en las vistas que pude medir, más sus endpoints, más su superficie de mantenimiento: cada refactor de auth, de theming o de layout las toca igual. Y del lado del producto, si `/pipeline` y `/renovacion` están terminadas, hay funcionalidad pagada que ningún usuario está usando porque no sabe que existe.

**Cómo arreglarlo.** No es un fix de código, es una decisión por fila. Para cada una: (a) reincorporar al sidebar con la agrupación propuesta en el Anexo D, (b) borrar ruta + vista + endpoint + tablas si aplica, o (c) marcarla explícitamente como "acceso por URL a propósito" con un comentario en el `page.tsx`, para que la próxima auditoría no la vuelva a levantar. Lo importante es que ninguna quede sin decidir: hoy el default silencioso es (c) sin haberlo elegido.

**Riesgo.** Borrar de más. Antes de eliminar cualquiera, grepear el nombre del componente y de la tabla asociada — `/pipeline` por ejemplo comparte `components/leads-pipeline/constants.ts` con `/admin/leads`.

---

### 8 · `CLAUDE.md` desactualizado justo en los datos que más se usan para decidir
**Impacto: Alto · Esfuerzo: Chico**

**Qué encontré.** Contrastando el documento contra el repo de hoy:

| `CLAUDE.md` dice | Realidad |
|---|---|
| "35 routes" en `app/api/` | **113** route handlers |
| "20 .sql" en `supabase/migrations/` | **130** archivos |
| "Next.js 16.0.10" | `package.json`: `next: 16.2.6` |
| "cron `0 12 * * *` para billing-alerts" | **8 crons** en `vercel.json` |
| "El brand es `#ffde21` (amarillo) y `#ffe84d` (hover)" | `#ffde21` aparece **1 vez**; el color real es `#dafc69`, **937 veces** |
| "4 roles en `profiles.role`" | **5**: existe `developer`, normalizado a admin (`permissions.ts:64`) |
| Endpoint admin protegido → `requireAdmin`/`requireInternal` | Falta `resolveInternalScope` (`lib/auth/internal-scope.ts`), que es el guard del sector interno multi-tenant y hoy protege 6 rutas |
| No menciona | Multi-tenancy (`internal_tenant_id`, 7 migraciones de agosto), POSI, Omni, SignNow, PayFunnels, `client_prospects` |

**Por qué importa.** Esto no es higiene documental: `CLAUDE.md` es el contexto que se le carga a Claude Code en cada sesión de trabajo sobre este repo. Un agente que lee "el brand es `#ffde21`" y escribe un componente nuevo introduce el color equivocado, que además queda fuera de los parches de light mode de `globals.css` (hallazgo 12) y por lo tanto ilegible en modo claro. Un agente que lee "4 roles" no contempla `developer`. Un agente que no sabe que existe `resolveInternalScope` escribe una ruta nueva del sector interno sin aislamiento de tenant. Cada error de este archivo se multiplica por cada sesión futura.

**Cómo arreglarlo.** Actualizar las tablas de arriba; agregar una sección de multi-tenancy (`clients.is_internal_workspace`, `profiles.internal_tenant_id`, `resolveInternalScope`, `isPlatformOwnerEmail`); reemplazar el bloque de colores por la regla real (ver hallazgo 12); y agregar los gotchas nuevos que salen de esta auditoría, sobre todo: "toda escritura a `clients` llena `name` **y** `nombre`" y "`canAccessAdminPath` solo filtra el sidebar; el permiso real va en la API".

**Riesgo del fix.** Ninguno.

---

### 9 · El layout remonta y re-fetchea en cada navegación; no hay `loading.tsx` en ningún segmento
**Impacto: Alto · Esfuerzo: Mediano**

**Qué encontré.** Hay **un solo** `layout.tsx` en todo `app/`: el raíz. El menú lateral, el header, el selector de mes y toda la lógica de sesión viven en `components/layout/dashboard-layout.tsx` (941 líneas), que cada página monta adentro de sí misma:

```tsx
// app/admin/payments/page.tsx — el patrón se repite en las 74 páginas
export default function AdminPaymentsPage() {
  return <DashboardLayout><AdminPaymentsView /></DashboardLayout>
}
```

En App Router, un componente montado dentro de la página **no** es un layout: no persiste entre navegaciones. Al pasar de `/admin/leads` a `/admin/payments`, React desmonta el `DashboardLayout` entero y monta uno nuevo, re-ejecutando todos sus `useEffect`:

- `:211` `supabase.auth.getSession()`
- `:213` `fetch("/api/profile/avatar")`
- `:271` `supabase.auth.getUser()`
- `:341` `getSession()` + `setSession()` + `getUser()` otra vez + query a `profiles`
- `:355-400` query a `clients` (fallback de nombre)
- `:442-505` lista de clientes para el selector (solo admin)
- `:261-337` query a `monthly_reports` para los meses habilitados

Y `rg --files app -g 'loading.tsx'` no devuelve nada: cero archivos. No hay Suspense boundary por segmento, así que durante todo eso la UI anterior queda congelada. Existe `components/ui/navigation-progress.tsx` y está montado (`dashboard-layout.tsx:551`), pero es una barrita de progreso: no reemplaza el contenido, así que el usuario ve la pantalla vieja quieta.

**Por qué importa.** Es la fricción más transversal del producto. Cinco a siete round-trips (varios contra Supabase Auth, que no es rápido) entre click y contenido, en cada navegación, para cada rol. En los recorridos que medí (Anexo D) el setter hace 4-6 navegaciones por sesión de trabajo y el admin más. Además de la latencia, se pierde el estado local: filtros, scroll, el mes seleccionado.

**Cómo arreglarlo.** Es refactor, conviene por etapas y con commits chicos:

1. **Route groups + layouts reales.** Crear `app/(portal)/layout.tsx` y `app/(admin)/layout.tsx`, mover ahí el `<DashboardLayout>`, y mover las páginas correspondientes dentro de cada grupo (los paths no cambian: los route groups entre paréntesis no aparecen en la URL). Cada `page.tsx` queda devolviendo solo su vista.
2. **`loading.tsx` por grupo**, reusando los skeletons que ya existen en `components/ui/skeleton.tsx` (`KpiCardSkeleton`, `StatCardSkeleton`).
3. **Sacar la resolución de sesión del cliente.** El layout de cada grupo puede ser un Server Component que resuelva sesión, rol y `client_id` con `@supabase/ssr` y los pase por contexto. Elimina de un saque las tres llamadas a `auth.getUser`/`getSession`.
4. **Cachear el avatar y la lista de clientes** en un contexto arriba del layout, no en un `useEffect` que corre por montaje.

**Riesgo del fix.** Alto — es el archivo central del producto y toca las 74 páginas. Recomendación: hacerlo primero solo para el grupo `(admin)`, verificar view-as, el banner de cliente activo y el selector de mes, y recién después mover el portal. El paso 1 y el 2 solos ya dan la mayor parte del beneficio; el 3 es el que más riesgo tiene (cambia de dónde sale el rol).

---

### 10 · PayFunnels: la deduplicación por email bloquea renovaciones y segundas compras
**Impacto: Alto · Esfuerzo: Mediano**

**Qué encontré.** `app/api/webhooks/payfunnels/route.ts:242-252`:

```ts
const { data: existing } = await sb.from("crm_clients").select("id").eq("email", email).maybeSingle()
if (existing) {
  await finish(existing.id, "Ya existía un crm_client con este email — pago duplicado o reintento, no se creó uno nuevo.")
  return NextResponse.json({ ok: true, client_id: existing.id, duplicate: true })
}
```

La única defensa contra duplicados es "¿ya existe un cliente con este mail?". No mira fecha, ni monto, ni id de transacción.

**Por qué importa.** Un cliente que terminó su programa y renueva paga de nuevo por el mismo link, con el mismo mail. El webhook ve que ya existe, responde `duplicate: true` y **no hace nada**: no crea cuotas nuevas, no marca el pago, no avisa a nadie. La plata entró y en el sistema no quedó ningún rastro salvo la fila cruda en `payfunnels_webhook_events`, que nadie mira. Igual para un cliente que compra el programa híbrido después del grupal.

El comportamiento correcto para un reintento del mismo pago y para una renovación es opuesto, y hoy los dos caen en la misma rama.

**Cómo arreglarlo.**
1. Separar los dos casos con una clave de transacción, no con el email. Guardar en `payfunnels_webhook_events` una columna `transaction_id` (extraída con el mismo helper `pick(body, "transaction_id","charge_id","id","invoice_id")`) con índice único, y dedupe contra eso.
2. Si el email ya existe **y** la transacción es nueva → es renovación o upsell: no crear un `crm_clients` nuevo, sino agregar cuotas al cliente existente (`crm_installments` con `installment_number` continuando la numeración) y disparar `zapierOnboardingStatusChanged` con `event_type: "renewal_detected"` para que el equipo lo revise.
3. Mientras eso no esté: cambiar el `return` de la rama duplicada para que **siempre** avise por Zapier, aunque sea con `event_type: "payment_duplicate_or_renewal"`. Hoy es la única rama del handler que no notifica nada — un pago no procesado es exactamente lo que hay que ver.

**Riesgo del fix.** Medio. Si el `transaction_id` no viene en el payload de la landing, el dedupe se degrada; mantener el chequeo por email como segunda condición (mismo email **y** mismo monto **y** menos de 24hs) antes de decidir que es reintento.

---

### 11 · PayFunnels: un fallo parcial deja al cliente sin cuotas y sin rollback
**Impacto: Alto · Esfuerzo: Mediano**

**Qué encontré.** El handler hace siete escrituras en secuencia (`crm_clients` → `onboarding_flow` → `crm_installments` → `clients` → `auth.admin.createUser` → `profiles` → playbook), sin transacción. Tres de ellas fallan en silencio:

```ts
:287  try { await sb.from("onboarding_flow").insert(…) } catch (err) { console.error(…) }   // no bloqueante
:305  if (instErr) console.error("[payfunnels] crm_installments insert failed (non-blocking):", instErr)
:333  if (profileErr) console.error("[payfunnels] profiles upsert failed:", profileErr)
```

Y el `catch` general (`:426-432`) devuelve **200** con `ok: false`, con el comentario "evita reintentos en cadena de PayFunnels".

Contraste: el alta manual (`app/api/admin/onboarding/route.ts:256,272`) **sí** hace rollback compensatorio — borra `crm_installments` y `clients` si algo falla más adelante. El webhook, que es el camino automático y el que corre sin nadie mirando, no.

**Por qué importa.** Si el insert de `crm_installments` falla (por ejemplo, porque una columna cambió), el cliente queda creado, con cuenta, con contrato enviado por SignNow — y sin ninguna cuota. `billing-alerts` nunca le va a reclamar nada porque no tiene cuotas que vencer, y el Dashboard Ejecutivo nunca va a contar su cash. Es un cliente que paga y que el sistema de cobranzas ignora para siempre. El error queda en un `console.error` de Vercel que nadie lee, y la respuesta HTTP fue 200.

Lo mismo con `profiles`: si falla, existe el usuario en `auth.users` pero sin perfil → al loguearse, `dashboard-layout` no le encuentra rol y lo trata como cliente sin `client_id`, o sea portal vacío.

**Cómo arreglarlo.**
1. Convertir los tres fallos "no bloqueantes" en fallos **visibles**: `await logJobRun(sb, "webhook:payfunnels", "error", …)` (el helper ya está importado) **y** `zapierOnboardingStatusChanged({ event_type: "onboarding_partial_failure", … })`. Que el equipo se entere el mismo día, aunque el handler siga adelante.
2. `crm_installments` no debería ser no bloqueante: es la pata de cobranza. Si falla, hacer el mismo rollback compensatorio que `admin/onboarding/route.ts:272` y devolver 500 para que el emisor reintente.
3. A mediano plazo, mover la secuencia completa a una función RPC de Postgres (`create_client_from_payment(...)`) que corra en una sola transacción. Las llamadas externas (SignNow, Slack, Zapier) quedan afuera, después del commit, que es donde ya están con `after()`.
4. Agregar al panel `/admin/system-status` (que ya existe y lee `system_job_runs`) un contador de altas parciales.

**Riesgo del fix.** Medio. Devolver 500 en vez de 200 va a hacer que PayFunnels/la landing reintenten — es lo deseable, pero solo si el hallazgo 10 (dedupe por transacción) ya está resuelto, si no el reintento crea un cliente duplicado. **Hacer 10 antes que 11.**

---

### 12 · El color de marca está hardcodeado 937 veces y el light mode se sostiene con parches CSS por selector de atributo
**Impacto: Alto · Esfuerzo: Grande**

**Qué encontré.** Los greps de light/dark que documenta `CLAUDE.md` dan casi limpio: 5 líneas en `app/admin/dev-logs/page.tsx` (una consola de logs deliberadamente oscura, no es bug) y 3 fondos oscuros hardcodeados, todos en ese mismo archivo. Esa parte está bien.

El problema es otro y más grande. Conteos reales:

| Color | Ocurrencias | Archivos |
|---|---|---|
| `#dafc69` (lima, el brand real) | **937** | **104** |
| `#f2ffc0` (su hover) | 103 | 57 |
| `#ffde21` (el que documenta `CLAUDE.md`) | 1 | 1 |

Y en `app/globals.css:74-160`, el light mode está resuelto así:

```css
:root:not(.dark) button[class*="bg-[#dafc69]"],
:root:not(.dark) a[class*="bg-[#dafc69]"],
:root:not(.dark) [class*="bg-[#dafc69]"][role="button"] { … }
:root:not(.dark) span[class*="bg-[#dafc69]"] { … }
:root:not(.dark) [class*="text-[#dafc69]"], :root:not(.dark) [class*="bg-[#dafc69]/["] { … }
```

Son selectores que hacen match sobre el **texto literal de la clase**. Funciona, y hay que reconocer que resolvió el problema de un modo pragmático. Pero convierte al string `bg-[#dafc69]` en API pública: cualquier componente nuevo que use el token del theme (`bg-accent`, que en `globals.css:26` es `#93bc1e`), o que escriba el hex con mayúsculas, o que lo aplique a un `<div>` en vez de a un `<button>/<a>/<span>`, queda fuera de los parches y se rompe en modo claro.

**Por qué importa.** Es deuda que crece sola: cada componente nuevo es una oportunidad de romper light mode, y el grep de `CLAUDE.md` no lo detecta porque busca otra cosa (`text-red-400` sin `dark:`). Y como `CLAUDE.md` documenta un color que no existe en el código, cualquier dev o agente que siga la guía introduce el error garantizado.

**Cómo arreglarlo.** Es Grande, pero mecánico y se puede hacer por partes:
1. Definir los tokens en `globals.css`: `--brand: #dafc69; --brand-hover: #f2ffc0;` en `.dark`, y sus equivalentes oliva (`#93bc1e` / `#a4cc3d`, que ya están como `--accent`) en `:root:not(.dark)`. Registrarlos en el `@theme` de Tailwind v4 para que existan `bg-brand`, `text-brand`, `border-brand`.
2. Reemplazo masivo, archivo por archivo: `bg-[#dafc69]` → `bg-brand`, `text-[#dafc69]` → `text-brand`, `hover:bg-[#f2ffc0]` → `hover:bg-brand-hover`. Las variantes con opacidad (`bg-[#dafc69]/10`) pasan a `bg-brand/10` sin cambios de sintaxis.
3. A medida que un archivo queda migrado, sus reglas de parche en `globals.css` dejan de hacer falta. Borrar los parches **al final**, cuando el grep de `#dafc69` dé cero — si no, se rompe el light mode de lo que falte migrar.
4. Corregir el bloque de colores de `CLAUDE.md` y agregar al checklist de cierre de feature el grep `rg '\[#[0-9a-fA-F]{6}\]' -g '*.tsx'` (debe dar cero fuera de `lib/email.ts`, que genera HTML de mail y necesita hex literales).

**Riesgo del fix.** Medio, pero muy visible: son 104 archivos y cualquier reemplazo mal hecho se ve a simple vista. Hacerlo en tandas de 10-15 archivos por commit, verificando light y dark en las pantallas tocadas.

---

### 13 · `/api/admin/calendar-events` GET no chequea rol
**Impacto: Medio · Esfuerzo: Chico**

**Qué encontré.** `app/api/admin/calendar-events/route.ts:8-25`:

```ts
// GET — cualquier usuario autenticado puede leer la agenda (clientes incluidos)
const { data: { user } } = await supabaseAuth.auth.getUser(jwt)
if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
const { data } = await supabase.from("calendar_events").select("*")   // sin filtro
```

`POST`, `PATCH` y `DELETE` sí usan `requireAdmin`. Solo la lectura está abierta, y el comentario dice que es intencional.

**Por qué importa.** Puede ser correcto —la agenda de calls grupales es contenido que los clientes deben ver— pero el `select("*")` devuelve **todas** las columnas de **todos** los eventos, incluida `zoom_url` (se ve usada en `app/api/cron/call-reminders/route.ts:67`) y `status`. Si en la tabla hay eventos internos del equipo, o links de Zoom de calls 1-a-1 de otro cliente, están expuestos a cualquier usuario logueado.

**Cómo arreglarlo.** Primero verificar en la base si `calendar_events` mezcla eventos internos y públicos (`select distinct status, count(*) from calendar_events group by 1`). Si los mezcla: agregar una columna `visibility` (`'public' | 'internal'`) con default `'public'`, filtrar `eq("visibility","public")` para el rol cliente, y reemplazar el `select("*")` por la lista explícita de campos que la UI usa. Si no los mezcla, dejarlo como está y cambiar el comentario para que diga *por qué* es seguro, no solo que lo es.

**Riesgo del fix.** Bajo.

---

### 14 · No hay `middleware.ts` ni gating server-side de `/admin/*`
**Impacto: Medio · Esfuerzo: Mediano**

**Qué encontré.** `rg --files -g 'middleware.ts'` no devuelve nada. Las 27 páginas de `/admin/*` son todas del mismo molde: `<DashboardLayout><XView /></DashboardLayout>`, sin ningún chequeo de rol. Y `canAccessAdminPath()` se usa en un solo lugar del repo: `components/layout/admin-sidebar.tsx:214`, para filtrar los items del menú.

**Por qué importa.** Un `setter` que tipea `/admin/payments` obtiene la página renderizada. Los datos no llegan —`/api/admin/payments` exige `requireAdmin`— así que lo que ve es una pantalla vacía o con error, no una fuga. Por eso esto es Medio y no Crítico: la defensa real (la API) está puesta en la enorme mayoría de las rutas.

Pero el modelo depende de que **cada ruta nueva** se acuerde de poner el guard correcto, y ya hay dos casos donde no coincidió (hallazgos 4 y 13). La lista de permisos existe, está bien escrita, y no se aplica donde importa.

**Cómo arreglarlo.**
1. Agregar `middleware.ts` en la raíz que, para `/admin/:path*`, lea la sesión con `@supabase/ssr`, resuelva el rol y aplique `canAccessAdminPath(role, pathname)`, redirigiendo a `getDefaultLandingForRole(role)` si no pasa. Es la misma función que ya usa el sidebar → una sola fuente de verdad.
2. Agregar en `lib/auth/api-guards.ts` un `requirePathAccess(jwt, path)` que también use `canAccessAdminPath`, y migrar las rutas de `/api/admin/*` que hoy usan `requireInternal` a granel.
3. Ojo con el middleware y el JWT: el rol vive en `profiles.role`, no en el token (salvo el `app_metadata.role` que setea PayFunnels en `:320`). Consultar `profiles` en middleware agrega latencia a cada request de `/admin`. Alternativa: propagar el rol al `app_metadata` del usuario en el alta y en los cambios de rol, y leerlo del JWT. Decisión de arquitectura, vale discutirla antes de implementar.

**Riesgo del fix.** Medio. Un middleware mal configurado puede dejar a todo el equipo afuera. Desplegarlo primero en modo "loguear qué habría bloqueado" (sin redirigir) durante unos días.

---

### 15 · La cola `outbound_events` está muerta y el handler tiene tres bugs
**Impacto: Medio · Esfuerzo: Chico**

**Qué encontré.** En `app/api/events/process/route.ts`:

```ts
:119  if (!processSecret || authHeader !== `Bearer ${processSecret}`) return 401
```
`EVENTS_PROCESS_SECRET` no existe en `.env.local` (hallazgo 6) → el endpoint devuelve 401 a todo.

```ts
:131  .lt("attempts", supabase.rpc as any)   // raw filter below
```
Le pasa una **referencia a función** como valor de un filtro de PostgREST. Se serializa a basura en el query string; la query devuelve error, y el handler retorna 500 (`:140`). Aunque el secreto estuviera bien, no procesaría nada.

```ts
:50   const shouldRetry = status === "failed" && nextAttempts < BATCH_SIZE
```
Compara los intentos contra `BATCH_SIZE` (10, el tamaño de lote) en vez de contra `event.max_attempts` (3). Dos constantes distintas confundidas.

Y las dos ramas que procesan eventos (`:86` y `:93`) están marcadas como deprecadas y solo marcan `completed` para vaciar la cola. `lib/events.ts` (el productor) no tiene ningún importador en todo el repo.

**Por qué importa.** Es un subsistema completo —dos tablas (`outbound_events`, `event_logs`), sus índices, un productor, un consumidor, una Edge Function que lo llama— que no hace nada. El costo no es de runtime, es de confusión: alguien va a ver `outbound_events` en el schema y va a asumir que hay una cola de eventos confiable donde apoyarse.

**Cómo arreglarlo.** Decidir y ejecutar, sin término medio:
- **Si no se va a usar**: borrar `app/api/events/process/`, `lib/events.ts`, la Edge Function que lo dispara, y las tablas en una migración (`drop table if exists public.event_logs, public.outbound_events cascade;`). Verificar antes que la migración `20260531000004_create_outbound_events.sql` y `events_system.sql` no dejen dependencias.
- **Si se va a usar** (tiene sentido: resolvería el "aviso confiable" que hoy los webhooks hacen con `after()` y `.catch(() => null)`): arreglar los tres bugs — configurar el secreto, reemplazar la línea 131 por el filtro en JS que ya está más abajo (`:136`, que hace exactamente eso), y cambiar `BATCH_SIZE` por `event.max_attempts` en `:50`.

**Riesgo del fix.** Bajo en ambas direcciones.

---

### 16 · 67 policies RLS con `auth.uid()` sin cachear
**Impacto: Medio · Esfuerzo: Mediano**

**Qué encontré.** En `supabase/migrations/*.sql`: 67 apariciones de `auth.uid()` "pelado" contra 16 envueltas en `(select auth.uid())`. Ejemplo, `20260704000005_clients_rls_policies.sql:5`:

```sql
create policy "client_read_own" on public.clients for select
  using ( id in (select p.client_id from public.profiles p where p.id = auth.uid()) );
```

Lo mismo en `20260531000001` (`profiles_select_own`, `USING (id = auth.uid())`) y en la mayoría de las policies de `content_*`, `client_playbook_*`, `ann_conversations`, `monday_wins`, `cha_ching`.

**Por qué importa.** Postgres trata `auth.uid()` como volátil dentro de una policy y la re-evalúa **por fila**. Envuelta en `(select …)` se evalúa una sola vez (InitPlan) y el planner puede usar índices. En tablas chicas no se nota; en `monthly_reports`, `app_logs`, `omni_slack_messages` o `leads`, a medida que crecen, cada `select` del browser paga el costo por fila. Hoy, con ~10 clientes, es teórico. A 100 clientes con historial, es la diferencia entre 50ms y varios segundos en el dashboard.

**Cómo arreglarlo.** Una migración nueva que redefina las policies afectadas cambiando `auth.uid()` por `(select auth.uid())`. Es mecánico y sin cambio semántico. Priorizar por tamaño de tabla: `monthly_reports`, `app_logs`, `leads`, `omni_slack_messages`, `content_vault`, `client_playbook_pages`. **No editar las migraciones viejas** — crear una nueva con los `DROP POLICY IF EXISTS` + `CREATE POLICY` corregidos, que es el patrón que ya usa el repo.

Aprovechar la misma migración para revisar las tablas con dos o más policies PERMISSIVE para el mismo comando (`content_competitors`, `content_ideas`, `content_vault`, `client_context` tienen 3 cada una; `client_playbook_main/pages` y `ann_conversations`, 4): consolidarlas en una sola con `OR` explícito evita que Postgres evalúe todas.

**Riesgo del fix.** Medio: una policy mal reescrita puede abrir o cerrar acceso de más. Verificar cada una con el patrón de testing que ya documenta `20260531000001` al final (`SET LOCAL "request.jwt.claims"`).

---

### 17 · Índices faltantes en columnas de filtro caliente
**Impacto: Medio · Esfuerzo: Chico**

**Qué encontré.** 96 `CREATE INDEX` en las migraciones. Cruzándolos contra los filtros del código, faltan:

| Tabla · columna | Dónde se filtra | Índice hoy |
|---|---|---|
| `crm_installments (client_id)` | `cron/billing-alerts:140` (una vez por cliente), `admin/clients`, dashboard ejecutivo | **no existe** |
| `crm_installments (paid_at, due_date)` | mismo cron, filtro de vencidas | no existe |
| `crm_clients (email)` | `webhooks/payfunnels:245` (dedupe de cada pago) | no existe |
| `payments (created_at)`, `payments (status)` | `admin/payments` agrupa por mes y filtra por estado | no existe |
| `monthly_reports (client_id, month)` | 8 componentes del portal + `/api/admin/reports` | **no verificable** — la tabla no se crea en ninguna migración |
| `profiles (client_id)` | subconsulta de la policy `client_read_own` de `clients` | no existe |

`crm_installments` es el caso más caro: no tiene **ningún** índice en las migraciones, y es la tabla que sostiene toda la cobranza.

**Cómo arreglarlo.** Una migración con:

```sql
create index concurrently if not exists crm_installments_client_id_idx on public.crm_installments (client_id);
create index concurrently if not exists crm_installments_pending_idx   on public.crm_installments (due_date) where paid_at is null;
create index concurrently if not exists crm_clients_email_idx          on public.crm_clients (lower(email));
create index concurrently if not exists payments_created_at_idx        on public.payments (created_at desc);
create index concurrently if not exists profiles_client_id_idx         on public.profiles (client_id);
create index concurrently if not exists monthly_reports_client_month_idx on public.monthly_reports (client_id, month);
```

Si se usa `lower(email)` en el índice, cambiar también la query de `payfunnels:245` a `.ilike("email", email)` o normalizar el email antes (ya se hace: `.toLowerCase()` en `:206`), en cuyo caso alcanza con el índice plano sobre `email`.

**Riesgo del fix.** Bajo. `concurrently` no bloquea escrituras. Ojo: `create index concurrently` no puede correr dentro de una transacción, y el CLI de Supabase envuelve las migraciones en una — puede hacer falta correrlas desde el SQL Editor, o sacar el `concurrently` dado el tamaño actual de las tablas (que es chico).

---

### 18 · N+1 en el cron de cobranzas
**Impacto: Medio · Esfuerzo: Chico**

**Qué encontré.** `app/api/cron/billing-alerts/route.ts:125-145`: carga **todos** los `crm_clients` sin filtro (el comentario explica que es a propósito), y adentro del `for (const client of clients ?? [])` hace `supabase.from("crm_installments").select(…).eq("client_id", client.id)`. Una query por cliente. Sumado al hallazgo 17 (esa columna no tiene índice), cada una es un seq scan.

**Por qué importa.** Hoy son ~10 clientes: 11 queries, irrelevante. A 100 clientes con `maxDuration: 300`, empieza a ser un cron que puede cortarse por la mitad — y si se corta después de haber creado algunas cuotas y mandado algunos mails, no hay forma de retomar desde donde quedó: la próxima corrida arranca de cero y puede repetir avisos (los mails al cliente sí están protegidos por `renewal_email_sent_at` / `alert_sent_at`, el Slack interno no).

**Cómo arreglarlo.** Traer todas las cuotas de una y agrupar en memoria:

```ts
const ids = (clients ?? []).map(c => c.id)
const { data: allInst } = await supabase.from("crm_installments")
  .select("id, client_id, due_date, amount, paid_at, alert_sent_at")
  .in("client_id", ids).order("due_date", { ascending: false })
const byClient = new Map<string, any[]>()
for (const i of allInst ?? []) { (byClient.get(i.client_id) ?? byClient.set(i.client_id, []).get(i.client_id)!).push(i) }
```

y dentro del loop usar `byClient.get(client.id) ?? []` en vez de la query. Si la lista de clientes crece mucho, chunkear el `.in()` de a 200 ids.

**Riesgo del fix.** Bajo — el orden por `due_date desc` se preserva si se ordena en la query global.

---

### 19 · El secreto de PayFunnels se acepta por query string
**Impacto: Medio · Esfuerzo: Chico**

**Qué encontré.** `app/api/webhooks/payfunnels/route.ts:156-165`:

```ts
const incoming = req.nextUrl.searchParams.get("secret") ?? req.headers.get("x-webhook-secret") ?? …
return incoming === secret
```

Lo mismo en `webhooks/recording/route.ts:16` y `webhooks/client-call/route.ts:17`. El comentario del archivo explica el porqué (PayFunnels no manda headers custom), y es una razón legítima.

Dos problemas menores pero reales: (a) un secreto en la URL queda registrado en los access logs de Vercel, en el historial del navegador si alguien lo abre a mano, y en el `Referer` si la respuesta redirige; (b) la comparación es `===`, vulnerable a timing attack — marginal sobre HTTP, pero es una línea cambiarlo.

**Cómo arreglarlo.** Mantener el query string como fallback (hace falta), pero: comparar con `crypto.timingSafeEqual` sobre buffers de igual longitud; rotar el secreto actual, ya que estuvo viajando en URLs; y agregar `logJobRun(..., "warn", "secreto por query string")` cuando llegue por ese camino, para saber si en la práctica alguien lo usa o si ya todos mandan header y se puede eliminar.

**Riesgo del fix.** Bajo. Coordinar la rotación con quien configura la landing.

---

### 20 · Endpoints públicos sin rate limit
**Impacto: Medio · Esfuerzo: Chico**

**Qué encontré.** `lib/rate-limit.ts` existe, está bien hecho y honestamente documentado ("EN MEMORIA por instancia de lambda… NO es una garantía dura"). Se usa en 6 rutas, todas de IA (`content-research`, `help-chat`, `transcript`, `ai-diagnosis`, `assistant/chat`, `social-connect`).

No se usa en los tres endpoints públicos sin autenticación: `app/api/apply/route.ts`, `app/api/team-apply/route.ts`, `app/api/instagram-access/route.ts`. Los tres insertan en la base y disparan un webhook saliente a Zapier por cada request.

**Por qué importa.** Cualquiera puede scriptear un POST y llenar `applications` / `team_applications` / `instagram_access_requests` de basura, y de paso quemar la cuota de tasks de Zapier. No es un riesgo de datos, es de operación: alguien tiene que limpiar.

**Cómo arreglarlo.** Agregar `rateLimit(req, { bucket: "apply", limit: 5, windowMs: 600_000 })` al inicio de los tres handlers (el helper ya devuelve el 429 armado, es una línea + el early return). Para el límite real, considerar Vercel Firewall / rate limiting a nivel de plataforma, que sí es global — el in-memory solo frena el script ingenuo.

**Riesgo del fix.** Bajo. Elegir límites generosos: son formularios reales de gente real.

---

### 21 · `resolveSocialScope` le da a los setters más alcance del que su propia documentación dice
**Impacto: Medio · Esfuerzo: Chico**

**Qué encontré.** `lib/social/scope.ts:6-11` documenta:

> *"Staff interno (admin/developer/team): puede pasar `?client_id`… **Cliente/setter: solo su propio `client_id`**"*

Y el código (`:36`) hace:

```ts
if (isInternal(role)) { const clientId = requestedClientId ?? ownClientId; … }
```

`isInternal()` incluye setter (`permissions.ts:71-74`). O sea, el setter cae en la primera rama y **sí** puede pasar cualquier `client_id`.

Afecta a `/api/social/[platform]/{status,metrics,connect,disconnect}` y `/api/client/prospects`. Con `disconnect`, un setter puede desconectar la cuenta de Instagram o YouTube de cualquier cliente.

**Por qué importa.** No es una fuga hacia afuera (el setter es del equipo), pero es una discrepancia entre lo que el código dice que hace y lo que hace — la clase de cosa que hace que la próxima revisión de seguridad confíe en el comentario equivocado. Y `disconnect` es destructivo.

**Cómo arreglarlo.** Decidir cuál de las dos es la verdad. Si vale la documentación: cambiar la condición a `if (isAdmin(role) || isTeam(role))`. Si vale el código: corregir el docstring y, aparte, exigir admin para `disconnect` (que es el único destructivo del grupo).

**Riesgo del fix.** Bajo — verificar antes que ninguna vista del setter llame a estos endpoints con un `client_id` ajeno.

---

### 22 · Nomenclatura divergente entre sidebar, título de página y el vocabulario del equipo
**Impacto: Medio · Esfuerzo: Chico**

**Qué encontré.** Comparando `components/layout/sidebar.tsx` (labels) con `PAGE_TITLES` de `dashboard-layout.tsx:139`:

| Ruta | Sidebar dice | Header dice |
|---|---|---|
| `/dashboard` | "Overview" | "Performance Center" |
| `/program-checklist` | "Implementation" | "Program Journey Checklist" |
| `/audit` | "Performance Audit" | "Audit" |
| `/transcript` | "Transcriptions" | "Transcript de Videos" |
| `/calendar` | "Calendar" | "Agenda" |
| `/recursos` | *(no está)* | "Biblioteca" |
| `/chi-chang` | "Cha-Ching 💰" | "Cha-Ching 💰" (ruta `chi-chang`, tabla `cha_ching`) |

Además, el sidebar del cliente mezcla dos idiomas sin criterio: "Overview / Performance / Reflection / All Metrics / My Channel / Competitors / Vault / Ideas / Calendar" conviven con "Reportes / Reporte Mensual / Cha-Ching / Implementation / Performance Audit". Y `PAGE_TITLES` cubre 28 de 74 rutas: las otras 46 muestran "Smart Scale" genérico en el header.

Aparte, tres grafías para el mismo concepto: ruta `/chi-chang`, tabla `cha_ching`, label "Cha-Ching".

**Por qué importa.** Cada divergencia es un momento de duda para el usuario ("¿'Implementation' y 'Program Journey Checklist' son lo mismo?") y una pregunta de soporte. Para el equipo interno, tres grafías de "cha-ching" significan que buscar en el código requiere probar las tres.

**Cómo arreglarlo.** Definir una tabla única `ruta → label → título`, exportada desde un solo módulo (`lib/nav.ts`), y que tanto el sidebar como `PAGE_TITLES` la consuman. Elegir un idioma para la UI del cliente y aplicarlo (el producto es para clientes hispanohablantes; el sidebar en inglés parece herencia del template de v0). El `<h1>` de cada vista debería salir de la misma fuente. Renombrar la ruta `/chi-chang` → `/cha-ching` con un redirect de compatibilidad, o dejarla y documentar el porqué.

**Riesgo del fix.** Bajo, pero es un cambio visible para todos los usuarios: conviene anunciarlo.

---

### 23 · Nueve links internos con `<a href>`: recarga completa de página
**Impacto: Medio · Esfuerzo: Chico**

**Qué encontré.**

| Archivo:línea | Destino | Contexto |
|---|---|---|
| `components/layout/sidebar.tsx:141` | `/` | logo del portal |
| `components/layout/admin-sidebar.tsx:237` | `/admin/clients` | logo del admin |
| `components/views/reflection-view.tsx:171` | `/report-input` | CTA principal de Reflection |
| `components/views/reflection-view.tsx:206` | `/report-input` | segundo CTA |
| `components/views/admin-applications-view.tsx:397` | `/apply` | link al form público |
| `components/views/team-application-form.tsx:131,225` | `/` | form público |
| `app/login/page.tsx:184` | `/forgot-password` | |
| `app/signup/page.tsx:275,279` | `/login`, `/forgot-password` | |

Cada uno dispara una navegación completa del browser: se descarga y ejecuta el bundle de nuevo, se pierde el estado de React y se repite toda la secuencia de autenticación del hallazgo 9.

**Por qué importa.** Los dos peores son los logos de los sidebars —que es el elemento que la gente clickea para "volver al inicio"— y los CTAs de Reflection, que es un recorrido cotidiano del cliente. Los de `/login` y `/signup` son inocuos (todavía no hay estado que perder).

**Cómo arreglarlo.** Reemplazar por `<Link>` de `next/link` (ya importado en `sidebar.tsx` y `admin-sidebar.tsx`; en las vistas hay que agregar el import). Los de `login`/`signup` pueden quedar como están o migrarse por consistencia; `admin-applications-view.tsx:397` apunta a un form público y puede tener sentido que abra fuera del contexto — si es a propósito, agregarle `target="_blank" rel="noopener noreferrer"` para que quede explícito.

**Riesgo del fix.** Muy bajo.

---

### 24 · El estado activo del sidebar no funciona en rutas anidadas
**Impacto: Medio · Esfuerzo: Chico**

**Qué encontré.** `components/layout/sidebar.tsx:169` y `components/layout/admin-sidebar.tsx:340`, en ambos casos:

```ts
const isActive = pathname === item.href
```

Igualdad exacta. En `/posi/3` no se marca nada; si mañana se agrega `/admin/clients/[id]`, "Clientes" se apaga justo cuando el usuario está adentro. El sidebar del cliente sí maneja hijos (`hasActiveChild` en `:170`), pero también por igualdad exacta.

**Cómo arreglarlo.** Cambiar por `pathname === item.href || pathname.startsWith(item.href + "/")`, con una excepción para hrefs de un solo segmento que sean prefijo de otros (verificar `/admin` y `/`). En este árbol de rutas no hay colisiones problemáticas hoy.

**Riesgo del fix.** Muy bajo.

---

### 25 · Cero tests, cero framework de test
**Impacto: Medio · Esfuerzo: Mediano**

**Qué encontré.** No hay ningún `*.test.*` ni `*.spec.*` en el repo. `package.json` no tiene Vitest, Jest, Playwright ni `@testing-library`, y tampoco un script `test`. Tampoco hay script `typecheck`, aunque `next.config.mjs` tiene `typescript.ignoreBuildErrors: true` — o sea, el build no falla con errores de tipo y no hay nada que los chequee automáticamente.

**Por qué importa.** No es que falte cobertura: es que no hay ningún mecanismo automático que impida que un cambio rompa el cobro, la autenticación o el aislamiento entre clientes. Con `ignoreBuildErrors: true`, ni siquiera el compilador de TypeScript está actuando como red.

**Cómo arreglarlo.** No hace falta framework nuevo para el primer paso.

*Paso 0 (Chico, hoy mismo):* agregar `"typecheck": "tsc --noEmit"` a los scripts y correrlo en CI. Con la lista de excepciones preexistentes que ya documenta `CLAUDE.md`, sirve como piso.

*Paso 1 (Mediano):* Vitest — es el que menos setup pide con Next 16 y Turbopack, y no necesita el runtime de Next para lo que importa acá, que es lógica pura. Los cinco tests de humo, en orden de daño-si-falla:

1. **Idempotencia del webhook de pago.** Dado el mismo `external_event_id` dos veces, `payments` tiene una sola fila. *(Depende del hallazgo 1.)*
2. **Conciliación de cuotas.** Un pago aceptado de $500 para un cliente con cuota impaga de $500 la marca pagada; uno de $499 no la toca. *(Depende del hallazgo 2.)*
3. **Aislamiento multi-tenant.** `resolveSocialScope` con un JWT de cliente A y `requestedClientId` de cliente B devuelve `{ ok: false, status: 403 }`. Igual para `resolveInternalScope` con un usuario interno no-platform-owner. Son funciones puras salvo por la llamada a Supabase: mockear el cliente y testear la lógica de decisión.
4. **Gating por rol.** `canAccessAdminPath("setter", "/admin/payments") === false` y `canAccessAdminPath("team", "/admin/clients") === false`, para las 27 rutas de admin × 4 roles en una tabla. Es un test de 20 líneas que cubre toda la matriz de permisos.
5. **Validación checkbox-only del playbook.** `isOnlyCheckboxToggleChange` (`lib/playbook-diff.ts`) devuelve false ante un cambio de texto y true ante un toggle. Es la única defensa contra que un cliente edite su playbook, y es lógica pura: el test más barato y más valioso del repo.

*Paso 2 (opcional):* un Playwright de un solo flujo — login como cliente → dashboard carga → el header muestra su nombre. Cubre de punta a punta lo que más se rompe.

**Riesgo.** Ninguno; es aditivo.

---

### 26 · UUIDs de personas hardcodeados en la lógica de negocio
**Impacto: Medio · Esfuerzo: Chico**

**Qué encontré.** `app/api/webhooks/payfunnels/route.ts:40,45`:

```ts
const ALBERTO_CLIENT_ID = "6d6c4dc8-e158-4f87-8612-e948c1a31cbb"
const DEFAULT_SETTER_ID = "a1eb5074-1017-476e-9b99-ee3d5e3bf062" // Steffano Leiva
```

El primero se usa para copiar el playbook template (`:352`); el segundo se asigna como `setter_id` de toda venta automática (`:273`), y su nombre aparece además como string literal en los avisos a Slack y Zapier (`:404`, `:418`).

**Por qué importa.** El día que Steffano deje el equipo, toda venta entrante por PayFunnels queda asignada a un setter inactivo, y el aviso de Slack va a seguir diciendo "Steffano Leiva" hasta que alguien lo note. Ya hay precedente en el repo: existen migraciones `20260813000001_offboard_rodri.sql` y `20260814000001_offboard_onepead_matriz.sql`, o sea que los offboardings pasan y hoy requieren tocar SQL.

**Cómo arreglarlo.** Moverlos a configuración: env vars (`PAYFUNNELS_DEFAULT_SETTER_ID`, `PLAYBOOK_TEMPLATE_CLIENT_ID`) o, mejor, una fila en una tabla de settings editable desde el admin. Y el nombre del setter en los avisos debe leerse de `profiles` a partir del id, nunca escribirse a mano. Mientras tanto: agregar un chequeo de que el setter siga `active = true` (la columna existe desde `20260716000001`) y avisar por Zapier si no lo está.

**Riesgo del fix.** Bajo.

---

### 27 · Código muerto
**Impacto: Bajo · Esfuerzo: Chico**

**Qué encontré.**

*Duplicados de sincronización (patrón "archivo 2.tsx" que deja Finder/iCloud), 8 archivos, 4 de ellos versionados en git:*

```
app/admin/conexiones/page 2.tsx          app/admin/notificaciones/page 2.tsx
app/api/calendar-recordings/route 2.ts   app/api/profile/route 2.ts
components/admin/eod-form-dialog 2.tsx   ← en git
components/views/admin-push-view 2.tsx   ← en git
components/views/admin-social-view 2.tsx ← en git
lib/marketIntelligence 2.ts              ← en git
netlify 2.toml                           ← en git
```

Ninguno es una ruta (App Router solo toma `page.tsx`/`route.ts` exactos) ni tiene un solo importador.

*Módulos sin ningún caller (verificado por grep del identificador en todo el repo):*
- `components/views/profile-view.tsx`
- `components/sections/correlation-chart.tsx`
- `lib/ai-diagnosis.ts` (el endpoint `/api/ai-diagnosis` no lo importa; las menciones que aparecen son comentarios)
- `lib/events.ts` (ver hallazgo 15)

**Cómo arreglarlo.** `git rm` de los cinco versionados + borrado de los tres no versionados; agregar `* [0-9].*` a `.gitignore` para que el patrón no vuelva a entrar. Los cuatro módulos huérfanos: borrar, salvo `lib/events.ts` si se decide revivir la cola.

**Riesgo del fix.** Bajo, pero verificar `components/views/profile-view.tsx` contra `app/perfil/page.tsx` antes de borrar: si `/perfil` usa otra vista, confirmar cuál es la buena.

---

### 28 · El sidebar de admin se resuelve en el cliente
**Impacto: Bajo · Esfuerzo: Mediano**

**Qué encontré.** `components/layout/admin-sidebar.tsx` es `"use client"`. La lista completa de secciones e items es un array estático en el módulo (`:32-62`), y el filtrado por rol ocurre en el render (`:214`, con `canAccessAdminPath(effectiveRole, item.href)`).

**Por qué importa.** El array con las 23 rutas internas viaja en el bundle de JavaScript. Cualquiera que abra devtools puede leer el mapa completo de la superficie interna: `/admin/dev-logs`, `/admin/ann-knowledge`, `/admin/executive-dashboard`, `/admin/omni`, etc. No es acceso —las APIs están protegidas— pero es información de reconocimiento gratis.

En la práctica el impacto es acotado: el `AdminSidebar` solo se monta cuando `pathname.startsWith("/admin/")` (`dashboard-layout.tsx:140,553`), así que el chunk probablemente no se cargue en el portal del cliente. Por eso Bajo y no Medio. También puede haber un flash de items de más entre el render inicial (rol `null`) y la resolución del rol, aunque `:202` maneja el `undefined` inicial.

**Cómo arreglarlo.** Se resuelve solo si se hace el hallazgo 9: con `app/(admin)/layout.tsx` como Server Component, el filtrado por rol ocurre en el servidor y al browser solo llegan los items que ese rol puede ver. No vale la pena atacarlo por separado.

---

### 29 · Basura versionada y directorios duplicados en la raíz
**Impacto: Bajo · Esfuerzo: Chico**

**Qué encontré.** `git status` muestra como modificados `supabase/.temp/cli-latest`, `gotrue-version`, `storage-migration`, `storage-version` — archivos que el CLI de Supabase regenera solo y que están **trackeados**. Ensucian cada diff.

En disco además: `.git.corrupted-backup-20260710/` (un `.git` entero de respaldo), `.next 2/`, tres `tsconfig*.tsbuildinfo` (~1.3 MB), `.gitinore` (typo de `.gitignore`, contiene 9 bytes), `netlify 2.toml` (el proyecto deploya en Vercel).

`.gitignore` figura como modificado sin commitear.

**Cómo arreglarlo.** `git rm -r --cached supabase/.temp` y agregarlo a `.gitignore` junto con `*.tsbuildinfo`, `.next*/` y `* [0-9].*`. Borrar del disco `.git.corrupted-backup-20260710/`, `.next 2/`, `.gitinore` y `netlify 2.toml`. Commitear el `.gitignore` que ya está modificado (o descartarlo, pero no dejarlo colgado).

**Riesgo del fix.** Ninguno, salvo el respaldo de `.git`: confirmar que no se necesita antes de borrarlo.

---

## Anexo A — Mapa de fuentes de verdad

### Las dos tablas de cliente

| Campo | Tabla autoridad | Quién escribe | Dónde el código usa la equivocada |
|---|---|---|---|
| Identidad del cliente (`id`) | ambas comparten el mismo uuid **por convención, sin FK** | `admin/onboarding:253`, `payfunnels:307` insertan `clients.id = crm_clients.id` | Nada lo garantiza. Si un `crm_clients` se crea sin su par en `clients` (webhook `client` de Airtable, `webhooks/client/route.ts:143`), el cliente existe en el CRM y no en el portal |
| Nombre visible | `clients.nombre` | solo `users/create:138` lo llena | `payfunnels:307` y `admin/onboarding:253` llenan solo `name` → hallazgo 5 |
| Nombre "legacy" | `clients.name` (NOT NULL) | los tres caminos | Es la columna donde históricamente se coló el email (gotcha #1) |
| Email | `crm_clients.email` | webhooks | `clients` no tiene email: para matchear un pago hay que ir a `crm_clients` |
| Estado (activo/baja) | `crm_clients.status` | admin a mano | `clients` no tiene estado. `20260807000001_client_status_binary.sql` toca `crm_clients` |
| Plan / programa | `crm_clients.programa`, `installment_amount`, `num_installments`, `program_duration` | `payfunnels:264`, `admin/onboarding` | — |
| Cuotas | `crm_installments` | `payfunnels:304` (alta), `cron/billing-alerts:139` (genera la siguiente), `admin-clients-view:869` (toggle manual) | — |
| Pagos cobrados | `payments` | `webhooks/payment:95` | **Sin `client_id`.** No hay relación con ninguna de las dos tablas → hallazgo 2 |
| Vínculo con auth | `profiles.client_id` → `clients.id` (FK real, `profiles_client_id_fkey`) | `users/create`, `payfunnels:332` | Pasar un id que solo existe en `crm_clients` rompe el FK (gotcha #1) |

### Leads → clientes

| Campo | Autoridad | Notas |
|---|---|---|
| `leads.client_id` | tenant dueño del lead (`clients.id` del sector interno) | Multi-tenant desde `20260812150007_leads_multitenant.sql` |
| `crm_clients.lead_id` | vínculo lead→cliente | Agregado en `20260705000001`, backfill "name only" en `20260705000003`, `on delete set null` desde `20260720000001` |
| Promoción lead→cliente | **no existe como operación transaccional** | `leads.purchased` (bool, `20260617000001`) es una marca manual. El alta real la hace `admin/onboarding` o el webhook de PayFunnels, sin tocar el lead. El lead queda con `purchased` posiblemente en false y sin `crm_clients.lead_id` seteado salvo carga manual |
| `client_prospects` | `client_prospects.client_id` | Pipeline propio del cliente, sin relación con `leads` |

### Tenant interno (multi-tenancy)

| Campo | Autoridad | Notas |
|---|---|---|
| `profiles.internal_tenant_id` | tenant del usuario interno | `20260812150002`; lo resuelve `resolveInternalScope` |
| `clients.is_internal_workspace` | marca el tenant "Smart Scale" | `getSmartScaleTenantId()` en `internal-scope.ts:56` |
| Platform owner | `PLATFORM_OWNER_EMAILS` (env) | `lib/auth/platform-owner.ts`. Es el único que puede pasar un tenant ajeno |
| Tablas multi-tenant | `leads`, `setting_daily_logs`, `prospeccion_items`, `lead_columns`, `lead_notes` (vía join) | Migradas en `20260812150004/6/7`. **`crm_clients`, `crm_installments`, `payments` y `applications` no tienen `internal_tenant_id`** — la multi-tenancy está a mitad de camino |

---

## Anexo B — Inventario de RLS

> **Reconstruido desde `supabase/migrations/*.sql` (130 archivos, en orden cronológico), no desde producción.** No tuve acceso a la base. Las tablas creadas fuera de migraciones (`payments`, `monthly_reports`, `profiles`, `clients`, `applications`, `audit_logs`) solo aparecen acá por las migraciones posteriores que las modifican, así que su estado real **hay que verificarlo con las queries del final de este anexo**.

**Totales reconstruidos:** 74 tablas con `ENABLE ROW LEVEL SECURITY` explícito · 119 `CREATE POLICY` · 96 `CREATE INDEX`.

### Banderas por tabla (solo las que tienen hallazgo)

| Tabla | RLS | Policies | `initplan` ⚠️ | Multiple permissive ⚠️ | Notas |
|---|---|---|---|---|---|
| `monthly_reports` | fuera de migraciones | 1 (`monthly_reports_select`) | **sí** | no | `is_internal_staff()` incluye setter → hallazgo 3 |
| `profiles` | fuera de migraciones | 2 (`_select_own`, `_select_internal`) | **sí** | **sí** (2 SELECT permissive) | UPDATE revocado a `authenticated` ✅ |
| `clients` | sí | 2 | **sí** | **sí** (2 SELECT permissive) | `20260704000005` |
| `payments` | **no verificable** | **ninguna en migraciones** | — | — | **Verificar en prod: es la tabla de dinero** |
| `applications` | **no verificable** | ninguna en migraciones | — | — | Solo tiene un índice (`applications_purchased_idx`) |
| `crm_clients` | sí | 1 | — | no | `20250420000001` |
| `crm_installments` | sí | 1 | — | no | Sin ningún índice → hallazgo 17 |
| `leads` | sí | recreada en `20260521000001` + multitenant `20260812150007` | **sí** | revisar | — |
| `content_competitors` / `content_ideas` / `content_vault` / `client_context` | sí | 3 c/u | **sí** | **sí** | Consolidables |
| `client_playbook_main` / `client_playbook_pages` | sí | 4 c/u | **sí** | **sí** | Los que más policies acumulan |
| `ann_conversations` | sí | 4 | **sí** | **sí** | — |
| `audit_logs` | fuera de migraciones | 1 (`service_role_insert`) | — | no | Corregido en `20260531000001` ✅ |
| `outbound_events` / `event_logs` | sí | — | — | — | Subsistema muerto → hallazgo 15 |

**Conteo global de initplan:** 67 usos de `auth.uid()` sin envolver contra 16 con `(select auth.uid())`.

**Funciones SECURITY DEFINER:** `is_internal_staff()`, `is_platform_owner()`, `handle_new_user()`, `last_session_activity()`, y las de `search_path_hardening`. Las migraciones `20260704000004_search_path_hardening`, `20260704000007_revoke_handle_new_user_rpc` y `20260810000001_revoke_public_execute_security_definer` cubren el hardening hasta agosto. **Verificar** que las funciones creadas después de `20260810` (`20260812150003_is_platform_owner.sql`, `20260812150005_fix_prospeccion_updated_at_search_path.sql`) tengan `SET search_path` y el `REVOKE` de `public` — la segunda por el nombre parece que sí.

### Queries de verificación — pegar en el SQL Editor de Supabase (solo lectura)

```sql
-- 1. Inventario completo de policies
select schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
from pg_policies where schemaname = 'public'
order by tablename, cmd, policyname;

-- 2. Tablas sin RLS habilitado (las de arriba en esta lista son las urgentes)
select c.relname, c.relrowsecurity, c.relforcerowsecurity
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relkind = 'r'
order by c.relrowsecurity, c.relname;

-- 3. Policies con auth.uid() sin cachear (hallazgo 16)
select tablename, policyname, cmd
from pg_policies
where schemaname='public'
  and (qual like '%auth.uid()%' or with_check like '%auth.uid()%')
  and (qual not like '%select auth.uid()%' or qual is null)
order by tablename;

-- 4. Múltiples policies permissive para el mismo cmd+rol (hallazgo 16)
select tablename, cmd, roles, count(*) as n, array_agg(policyname)
from pg_policies where schemaname='public' and permissive='PERMISSIVE'
group by 1,2,3 having count(*) > 1 order by n desc;

-- 5. Índices existentes (contrastar con el Anexo B2)
select tablename, indexname, indexdef from pg_indexes
where schemaname = 'public' order by tablename;

-- 6. Funciones SECURITY DEFINER sin search_path fijado
select p.proname, p.prosecdef, p.proconfig
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname='public' and p.prosecdef and (p.proconfig is null or not p.proconfig::text like '%search_path%');
```

---

## Anexo B2 — Índices: faltantes propuestos

| Tabla | Índices hoy (en migraciones) | Columna que el código filtra sin índice | DDL sugerido |
|---|---|---|---|
| `crm_installments` | **ninguno** | `client_id`, `due_date`, `paid_at` | `create index crm_installments_client_id_idx on public.crm_installments (client_id);` `create index crm_installments_pending_idx on public.crm_installments (due_date) where paid_at is null;` |
| `crm_clients` | `setter_id`, `monthly` | `email` (dedupe de cada pago) | `create index crm_clients_email_idx on public.crm_clients (email);` |
| `payments` | ninguno | `created_at`, `status` | `create index payments_created_at_idx on public.payments (created_at desc);` |
| `monthly_reports` | no verificable | `client_id`, `month` | `create index monthly_reports_client_month_idx on public.monthly_reports (client_id, month);` |
| `profiles` | `active`, `internal_tenant_id` | `client_id` (subconsulta de la policy de `clients`) | `create index profiles_client_id_idx on public.profiles (client_id);` |
| `applications` | `purchased` | `status`, `created_at` (según el uso en `/admin/applications`) | verificar antes en la vista |

Índices que **sí** están bien cubiertos: `leads` (client_id, created_at, status, rating, purchased), `client_prospects` (3), `prospeccion_items` (3), `centro_op_pages` (4), `client_calls` (incluye un índice parcial para no asignadas, buen patrón), `setting_daily_logs`, `content_*`, `omni_*`.

---

## Anexo C — Resultados de los greps de light/dark, agrupados por archivo

### C1 · `text-{red,emerald,amber,blue,green,purple}-{300,400}` sin variante `dark:`

**5 ocurrencias, 1 archivo.**

| Archivo | Líneas | Veredicto |
|---|---|---|
| `app/admin/dev-logs/page.tsx` | 23, 24, 25, 139, 194 | **Falso positivo aceptable.** Es una consola de logs con fondo oscuro fijo (`bg-[#0a0a0b]`), deliberadamente fuera del theme. Si se quiere higiene total, envolver el contenedor en `.dark` o extraer un theme local; no es un bug visible. |

### C2 · Hex hardcodeados fuera del brand documentado

**970 ocurrencias totales · 651 como clase arbitraria de Tailwind en `.tsx`.**

| Grupo | Ocurrencias | Archivos | Veredicto |
|---|---|---|---|
| `#dafc69` + `#f2ffc0` (brand real + hover) | 1.040 | 104 | **Hallazgo 12.** Fix mecánico (buscar y reemplazar por tokens), pero requiere decisión de diseño para los valores de light mode |
| `lib/email.ts` | 146 | 1 | **Falso positivo.** Genera HTML de mail: los clientes de correo no soportan variables CSS, los hex literales son obligatorios |
| Colores de charts (Recharts) en `metrics-view`, `trend-charts`, `performance-view`, `channels-view`, `sales-view` | ~120 | ~12 | **Fix con criterio de diseño**, no mecánico: hay que definir una paleta categórica que funcione en ambos modos, no reemplazar uno por uno |
| `#69c9d0` (TikTok), `#0f0f11`/`#0a0a0b` (consola de dev-logs) | 6 | 2 | **Falso positivo.** Colores de marca de terceros y superficie oscura intencional |
| `#ffde21` | 1 | 1 | Residuo del brand anterior, que es el que `CLAUDE.md` sigue documentando |

### C3 · Fondos oscuros hardcodeados (`bg-[#0…]`, `bg-[#1x]`, `bg-[#2x]`)

**3 ocurrencias**, las tres en `app/admin/dev-logs/page.tsx` (128, 131, 275). Mismo veredicto que C1.

**Conclusión de la dimensión 4:** los greps que documenta `CLAUDE.md` dan prácticamente limpio — el equipo viene cumpliendo la convención. El problema de theming real es otro y esos greps no lo detectan (hallazgo 12).

---

## Anexo D — Mapa de navegación

### D1 · Estructura de layouts

| Elemento | Estado |
|---|---|
| `app/layout.tsx` | Único layout del árbol. Solo providers globales |
| Layouts de route group | **ninguno** |
| `loading.tsx` | **ninguno** en 74 rutas |
| `middleware.ts` | **no existe** |
| Menú + header | `components/layout/dashboard-layout.tsx`, montado **dentro** de cada `page.tsx` → remonta en cada navegación (hallazgo 9) |
| Feedback de navegación | `components/ui/navigation-progress.tsx`, barra superior. No reemplaza contenido |

### D2 · Rutas del portal cliente

| Ruta | En sidebar | Rol que la ve | Título en header | Clicks desde `/dashboard` |
|---|---|---|---|---|
| `/dashboard` | ✅ Overview | client, admin | "Performance Center" | 0 |
| `/performance` | ✅ Performance | client, admin | *(genérico)* | 1 |
| `/reflection` | ✅ Reflection | client, admin | "Reflection" | 1 |
| `/metrics` | ✅ All Metrics | client, admin | "All Metrics" | 1 |
| `/mi-youtube` | ✅ YouTube › My Channel | client, admin | *(genérico)* | 1 |
| `/youtube/{competitors,vault,ideas}` | ✅ hijos | client, admin | *(genérico)* | 2 (expandir + click) |
| `/mi-instagram` | ✅ Instagram › My Profile | client, admin | *(genérico)* | 1 |
| `/instagram/{competitors,vault,ideas}` | ✅ hijos | client, admin | *(genérico)* | 2 |
| `/calendar` | ✅ Calendar | client, admin | "Agenda" | 1 |
| `/monday-win` | ✅ Reportes | client, admin | "Monday Win" | 1 (o 0 por Quick Action) |
| `/chi-chang` | ✅ Reportes | client, admin | "Cha-Ching 💰" | 1 (o 0 por Quick Action) |
| `/report-input` | ✅ Reportes | client, admin | "Reporte Mensual" | 1 (o 0 por Quick Action) |
| `/competitor-research` | ✅ Content Tools | client, admin | "Competitor Research" | 2 |
| `/transcript` | ✅ Content Tools › Transcriptions | client, admin | "Transcript de Videos" | 2 |
| `/program-checklist` | ✅ Implementation | client, admin | "Program Journey Checklist" | 1 |
| `/audit` | ✅ Performance Audit | client, admin | "Audit" | 1 |
| `/ann-ai` | ✅ Scalekit | client, admin | *(genérico)* | 1 |
| `/claude-skills` | ✅ Scalekit | client, admin | *(genérico)* | 1 |
| `/tools` | ✅ Scalekit › GPTs | client, admin | *(genérico)* | 1 |
| `/perfil` | ✅ pie del sidebar | todos | *(genérico)* | 1 |
| `/admin/clients` | ✅ solo si `isAdmin` | admin | "Clientes" | 1 |
| **`/channels`** | ❌ | — | "Channels" | **inalcanzable** |
| **`/sales`** | ❌ | — | "Sales" | **inalcanzable** |
| **`/recursos`** | ❌ | — | "Biblioteca" | **inalcanzable** |
| **`/report-history`** | ❌ | — | "Historial de Reportes" | **inalcanzable** |
| **`/content-research`** | ❌ | — | *(genérico)* | **inalcanzable** |
| **`/video-feed`** | ❌ | — | "Video Feed" | **inalcanzable** |
| **`/mi-dashboard`** | ❌ | — | "MI Dashboard" | **inalcanzable** |
| **`/pipeline`** | ❌ | — | *(genérico)* | **inalcanzable** |
| **`/team`** | ❌ | — | *(genérico)* | **inalcanzable** |
| **`/renovacion`** | ❌ | — | *(genérico)* | **inalcanzable** |
| `/posi/[level]` | ❌ por diseño | client | *(genérico)* | link copiado desde `/admin/posi` |
| `/conectar-instagram`, `/booking`, `/apply`, `/aplicar-equipo/[rol]` | ❌ por diseño | público | — | links externos |

### D3 · Rutas del admin

| Ruta | En sidebar | admin | team | setter | Nota |
|---|---|---|---|---|---|
| `/admin/executive-dashboard` | ✅ Dashboard | ✅ | ❌ | ❌ | |
| `/admin/data` | ✅ Adquisition Stats | ✅ | ✅ | ❌ | |
| `/admin/payments` | ✅ Pagos | ✅ | ❌ | ❌ | |
| `/admin/clients` | ✅ Clientes | ✅ | ❌ | ❌ | Único lugar donde se marcan cuotas pagadas |
| `/admin/team-applications` | ✅ Contratación | ✅ | ❌ | ❌ | |
| `/admin/notificaciones` | ✅ | ✅ | ❌ | ❌ | |
| `/admin/actualizar-sistema` | ✅ | ✅ | ❌ | ❌ | |
| `/admin/founder-checkins` | ✅ Check-in Trimestral | ✅ | ❌ | ❌ | |
| `/admin/posi` | ✅ POSI | ✅ | ❌ | ❌ | |
| `/admin/leads` | ✅ Leads | ✅ | ✅ | ✅ | |
| `/admin/setting` | ✅ Setting | ✅ | ✅ | ✅ | Landing del setter |
| `/admin/onboarding` | ✅ Onboarding | ✅ | ✅ | ✅ | |
| `/admin/applications` | ✅ Aplicaciones | ✅ | ✅ | ✅ | GET con `requireInternal` |
| `/admin/centro-operativo` | ✅ | ✅ | ✅ | ✅ | Prospección vive acá como tab |
| `/admin/tareas` | ✅ | ✅ | ✅ | ✅ | |
| `/admin/mi-context-room` | ✅ | ✅ | ✅ | ❌ | |
| `/admin/ann-knowledge` | ✅ Cerebro de Ann | ✅ | ❌ | ❌ | |
| `/admin/agenda` | ✅ | ✅ | ❌ | ❌ | GET de su API sin chequeo de rol → hallazgo 13 |
| `/admin/conexiones` | ✅ | ✅ | ❌ | ❌ | |
| `/admin/actividad-clientes` | ✅ Actividad | ✅ | ❌ | ❌ | |
| `/admin/dev-logs` | ✅ | ✅ | ❌ | ❌ | |
| `/admin/instagram-access` | ✅ Instagram | ✅ | ❌ | ❌ | API accesible a team/setter → hallazgo 4 |
| `/admin/omni` | ✅ botón aparte | solo `OMNI_ALLOWED_EMAILS` | — | — | |
| **`/admin/import`** | ❌ | — | — | — | huérfana, 346 líneas |
| **`/admin/panel-demo`** | ❌ | — | — | — | huérfana |
| `/admin/prospeccion` | ❌ | — | — | — | redirect intencional ✅ |

### D4 · Recorridos reales, paso a paso

**Setter — "ver mis leads del día, abrir uno, registrar el resultado"**

1. Login → `dashboard-layout` detecta `setter` y redirige a `/admin/setting` (`:257`). **1 navegación completa forzada** además del login.
2. Click "Leads" en el sidebar → `/admin/leads`. **Remonta el layout entero**: 5 llamadas de red antes de ver la lista.
3. Click en la fila del lead → abre modal/panel en la misma página. ✅ Bien resuelto.
4. Registrar resultado: cambiar estado + agregar nota → `PATCH /api/admin/leads` + `POST /api/admin/lead-notes`. ✅ Sin salir de la pantalla.
5. Para cargar su daily log: volver al sidebar → "Setting" → `/admin/setting`. **Otra navegación completa.**

**Total: 3 navegaciones completas por ciclo.** El paso 5 es el que duele: leads y setting son el mismo trabajo y viven en dos pantallas sin conexión entre sí. No hay ningún link de "cargar mi log" desde `/admin/leads`.

**Admin — "un cliente puntual → su cuota → cambiar estado"**

1. Login → `/admin/leads` (`ADMIN_DEFAULT_LANDING`). Nota: el admin aterriza en Leads, no en el Dashboard Ejecutivo.
2. Sidebar → "Clientes" → `/admin/clients`. Navegación completa.
3. Buscar el cliente en la lista → click para expandir. ✅ Mismo página.
4. Desplegar sus cuotas → tildar la cuota → `onToggleInstallment` (`admin-clients-view.tsx:869`). ✅ In-place.

**Total: 2 navegaciones + búsqueda visual.** El flujo en sí está bien resuelto. El problema no es la cantidad de clicks: es que **este flujo existe** (hallazgo 2). El admin está haciendo a mano la conciliación que el webhook debería hacer sola.

**Cliente — "ver mi métrica principal del mes"**

1. Login → `/dashboard` (`getDefaultLandingForRole` devuelve `/reflection` para rol client; el `/dashboard` llega por el sidebar).
2. La métrica principal está en el Overview. **0 clicks** una vez cargado. ✅
3. Cambiar de mes: selector en el header, disponible en todas las pantallas. ✅ Buen patrón.
4. Cargar su reporte mensual: Quick Action en el header (`QUICK_ACTIONS`, `dashboard-layout.tsx:638`). **0-1 clicks.** ✅ Bien pensado.

**Total: el recorrido del cliente es el mejor de los tres.** Su fricción es de carga (hallazgo 9), no de profundidad.

### D5 · Dead ends y vuelta atrás

- **Sin breadcrumbs** en ningún lado. En rutas de dos niveles (`/youtube/competitors`, `/instagram/vault`) la única vuelta es el sidebar.
- **Estado activo roto en rutas anidadas** (hallazgo 24): en `/posi/3` no se marca nada.
- **Los logos no navegan bien**: son `<a href>`, o sea recarga completa (hallazgo 23). Y el del admin apunta a `/admin/clients`, que no es la landing de ningún rol — un team o un setter que clickea el logo va a una pantalla que no puede ver.
- **46 de 74 rutas muestran "Smart Scale" genérico** en el header: el usuario no tiene confirmación de dónde está.
- **Después de crear/editar**: los flujos principales (leads, cuotas, tareas) actualizan in-place sin redirigir. ✅ Bien.
- **Sidebar colapsado**: se persiste en `localStorage` (`dashboard-layout.tsx:143-156`), sobrevive a las navegaciones. ✅
- **Mobile**: el sidebar se abre como overlay con `onClose` en cada `<Link>` (`sidebar.tsx:196,215`). ✅ Correcto.

### D6 · Propuesta de reorganización del sidebar (sin tocar código)

**Portal cliente.** Hoy: 4 grupos, 15 items de primer nivel, dos idiomas mezclados, y 10 rutas construidas que no figuran.

Propuesta — agrupar por *momento de uso*, no por tipo de objeto:

```
MI NEGOCIO            ← lo que mira todos los días
  Resumen             /dashboard        (hoy "Overview" / header "Performance Center")
  Métricas            /metrics
  Performance         /performance
  Canales             /channels         ← recuperar si se decide mantener

CARGAR                ← lo que completa, agrupado porque es la misma acción
  Reporte Mensual     /report-input
  Monday Win          /monday-win
  Cha-Ching           /chi-chang
  Reflexión           /reflection
  Historial           /report-history   ← recuperar

CONTENIDO             ← YouTube e Instagram como hoy, ya funciona bien
  YouTube ›           /mi-youtube  › Competencia · Vault · Ideas
  Instagram ›         /mi-instagram › Competencia · Vault · Ideas
  Research            /competitor-research › Transcripciones · Content Research

PROGRAMA              ← la relación con Smart Scale
  Implementación      /program-checklist
  Auditoría           /audit
  Agenda              /calendar
  Biblioteca          /recursos         ← recuperar
  Renovación          /renovacion       ← recuperar, o borrar

HERRAMIENTAS IA
  Ann AI              /ann-ai
  Claude Skills       /claude-skills
  GPTs                /tools
```

El porqué de cada grupo: **Mi Negocio** es consulta diaria (lo que el cliente viene a ver); **Cargar** junta las cuatro acciones de input, que hoy están partidas entre el grupo "Reportes" y los Quick Actions del header — si están todas juntas, los Quick Actions pueden simplificarse a uno solo ("Cargar"); **Contenido** ya funciona y no hay razón para tocarlo; **Programa** es la relación con Smart Scale (checklist, auditoría, calls, material), donde `/recursos` encaja natural; **Herramientas IA** se mantiene.

**Admin.** Hoy son cuatro secciones sin título visible. Propuesta de nombres explícitos, respetando `canAccessAdminPath`:

```
NEGOCIO      (admin)         Dashboard · Pagos · Clientes · Check-in Trimestral · Adquisition Stats
VENTAS       (admin+team+setter)  Leads · Setting · Onboarding · Aplicaciones · Contratación
OPERACIÓN    (admin+team+setter)  Centro Operativo · Tareas · Agenda · Mi Context Room
CLIENTES     (admin)         Actividad · POSI · Instagram · Conexiones
SISTEMA      (admin)         Cerebro de Ann · Notificaciones · Dev Logs · Actualizar Sistema · Ann AI (Omni)
```

Cambios de nombre que vale la pena hacer junto con esto: "Adquisition Stats" → "Adquisición" (además está mal escrito: falta la q); "Setting" → el nombre que el equipo usa hablando; y si "leads" son en realidad *conversaciones significativas*, el label debería decirlo — el término técnico puede quedar en la URL.

---

## Anexo E — Lo que no pude verificar y por qué

| Qué | Por qué | Cómo cerrarlo |
|---|---|---|
| **Estado real de RLS en producción** | Sin acceso a la base. No hay connection string de Postgres en el repo (solo la service role key, que no permite consultar catálogos vía PostgREST) y no hay `psql` disponible. El inventario del Anexo B está reconstruido desde las 130 migraciones | Correr las 6 queries del final del Anexo B en el SQL Editor de Supabase y contrastar |
| **RLS de `payments`, `monthly_reports`, `profiles`, `clients`, `applications`, `audit_logs`** | Estas tablas **no se crean en ninguna migración** — se crearon desde la UI de Supabase o por la integración v0. Solo veo las migraciones posteriores que las modifican | Query 2 del Anexo B. Prioridad: `payments` y `applications`, que no tienen ninguna policy en migraciones |
| **Índices reales** | Ídem — los 96 que listé son los de las migraciones; puede haber más creados a mano | Query 5 del Anexo B |
| **Qué env vars están realmente en Vercel** | `.env.local` es un `vercel env pull` y el propio archivo aclara que las sensitive vienen vacías. Distinguí "vacía" (existe, valor oculto) de "ausente" (no aparece la clave), pero es inferencia | `vercel env ls` — cinco minutos y cierra el hallazgo 6 |
| **Si los webhooks de Airtable y Zoom están recibiendo tráfico** | Depende de lo anterior. Si `CLIENT_WEBHOOK_SECRET` no está configurado, están devolviendo 401 en silencio | `select * from system_job_runs where job_name like 'webhook:%' order by ran_at desc limit 50;` — el helper `logJobRun` ya escribe ahí |
| **Cuántos `clients` tienen `nombre` null** | Sin acceso a datos | `select count(*) from clients where nombre is null;` y `select count(*) from clients where name like '%@%';` |
| **Cuántos pagos quedaron sin conciliar** | Sin acceso a datos. Es el número que dimensiona el hallazgo 2 | `select count(*) from payments p where p.status='aceptado' and not exists (select 1 from crm_clients c where c.email = p.email);` |
| **Comportamiento visual en light mode** | Auditoría estática, sin correr la app ni tomar capturas. Los parches de `globals.css` pueden estar cubriendo más casos de los que leí | Recorrer las pantallas de la lista C2 en modo claro |
| **`tsc --noEmit`** | No corrí el type check: requiere `node_modules` instalado y la consigna prohíbe instalar dependencias. Con `ignoreBuildErrors: true` puede haber errores de tipo acumulados más allá de los cuatro archivos que `CLAUDE.md` documenta como legacy | `npx tsc --noEmit` en local |
| **Edge Functions de Supabase** | `supabase/functions/` quedó fuera del alcance (`CLAUDE.md` las marca como legacy con errores de TS preexistentes). Una de ellas dispara `/api/events/process` | Revisar junto con la decisión del hallazgo 15 |
| **`/admin/omni`** | El módulo Omni (14 rutas de API, ~8 tablas, análisis con IA) está gateado por allowlist de emails y no toca datos de clientes del portal. Lo relevé solo a nivel de autorización | Auditoría propia si el piloto se amplía |

### Falsos positivos declarados

Cosas que parecían hallazgo y verifiqué que no lo son. Las dejo escritas para que nadie las re-investigue:

1. **`/api/admin/leads`, `lead-notes`, `lead-columns`, `prospeccion`, `setting/log`, `client/prospects` sin autenticación.** Un grep de `requireAdmin|requireInternal|auth.getUser` no las matchea, pero usan `resolveInternalScope` / `resolveSocialScope`, que resuelven sesión y tenant correctamente. **Están bien.**
2. **`/api/proxy-image` como SSRF.** Tiene allowlist de hostnames y exige `https:` (`:17-27`). Correcto. Único reparo menor: el sufijo `googleusercontent.com` es amplio.
3. **`/api/checklist-progress`, `/api/posi/submissions`, `/api/monthly-reports/save` tomando `client_id` del body.** Los tres validan contra `profiles.client_id` del usuario autenticado antes de usarlo. **Correctamente autorizados.**
4. **`/api/posi/levels` filtrando `correct_index`.** Le saca la respuesta correcta a todo el que no sea admin (`:26-34`). Bien resuelto.
5. **Cron `call-reminders` mandando avisos duplicados.** Usa insert contra una constraint UNIQUE (`claim()`, `:129`), que es la forma correcta — no un "chequear y después insertar" con race condition.
6. **Crons sin autenticación.** Los 8 validan `CRON_SECRET` fail-closed. Bien.
7. **`target="_blank"` sin `rel`.** No encontré casos.
8. **`select('*')` masivo.** Solo 25 en todo el repo, y los que están en rutas calientes (`admin/clients`, `admin/tareas`) devuelven tablas chicas. No amerita hallazgo propio.
9. **Retry alrededor de llamadas a IA.** Busqué específicamente el patrón caro (reintentar una llamada a Anthropic ya respondida, o retry anidado). **No existe.** Las 16 rutas con IA llaman una vez, y 6 tienen rate limit. Bien.
10. **`TODO`/`FIXME`/`HACK` en el código.** Cero. Los 10 matches son la palabra castellana "TODOS" en comentarios.
11. **`/posi/[level]` como ruta huérfana.** El link se copia al portapapeles desde `/admin/posi` (`admin-posi-view.tsx:136`) y se manda al cliente. Es intencional.
12. **`app/admin/prospeccion` como página muerta.** Es un redirect deliberado a `/admin/centro-operativo` para no romper bookmarks, y está documentado en el propio archivo.

---

## Cierre

**Consumo aproximado:** ~1h30 de reloj, ~120k tokens, ~35 comandos de solo lectura sobre el repo.

**Cobertura.** Las 9 dimensiones tienen hallazgos verificados abriendo el archivo, salvo las partes de base de datos que dependen de acceso a producción (Anexo E). Revisé: las 113 rutas de API una por una para el inventario de autorización, los 7 webhooks completos, los 8 crons, los dos sidebars, el `dashboard-layout` completo, los guards de auth, las 130 migraciones para RLS e índices, y los greps de theming sobre los 373 archivos fuente.

**Zonas que quedaron sin cubrir:**
- `supabase/functions/` (Edge Functions) — excluidas por consigna.
- El módulo **Omni** (`/admin/omni`, 14 rutas de API, `lib/omni/*`): relevado solo a nivel de autorización, no de lógica. Es el subsistema más grande que queda sin auditar en profundidad.
- Las **30 vistas de `components/views/`** las leí en función de hallazgos concretos, no una por una. Puede haber problemas de UX o de estado dentro de cada una que este relevamiento no toca.
- **Accesibilidad** (contraste, foco, navegación por teclado, ARIA) no estaba en las dimensiones pedidas y no la miré.
- **Performance de frontend** (tamaño de bundle, re-renders, memoización) tampoco: la dimensión 8 se enfocó en queries e índices.

**Si hubiera que hacer solo cinco cosas**, en este orden: hallazgo 1 (idempotencia del webhook de pago — es Crítico y es Chico), hallazgo 6 (verificar las env vars — cinco minutos y puede destapar integraciones muertas), hallazgo 3 (cerrar el acceso de setters a la facturación), hallazgo 5 (`clients.nombre`, dos líneas), y hallazgo 8 (actualizar `CLAUDE.md`, porque todo lo demás que se haga con Claude Code va a arrastrar sus errores).
