# Auditoría de Seguridad y Calidad — Smart Scale Portal
**Fecha:** 2026-05-31  
**Alcance:** Código fuente completo + esquema Supabase (read-only)  
**Marco:** OWASP Top 10 + análisis de calidad

---

## Resumen Ejecutivo

El portal tiene una base de autenticación razonablemente sólida para los endpoints internos (`/api/admin/*`), pero presenta **dos vulnerabilidades críticas explotables sin conocimiento previo**: una que permite a cualquier cliente autenticado escalar sus propios privilegios a administrador vía la API pública de Supabase, y otra que expone tres webhooks de ingesta sin autenticación obligatoria. A esto se suman **cuatro URLs de Zapier hardcodeadas** en el código fuente que pueden ser triggeadas directamente por cualquiera que acceda al repo. El stack de Next.js 16.0.10 acumula **16 CVEs de severidad alta** que requieren actualización inmediata. En el frente de calidad, la ausencia total de tests, la falta de headers HTTP de seguridad y una quincena de foreign keys sin índice son las deudas más urgentes. La buena noticia: RLS está habilitado en las 45 tablas, los endpoints `/api/admin/*` están correctamente guardados, y los datos de salud/PII de los clientes en `monthly_reports` no se loguean ni exponen en respuestas de API.

---

## Hallazgos por Severidad

### 🔴 CRÍTICO

---

#### C-01 — Privilege Escalation: cualquier cliente puede auto-promoverse a `admin`

**Descripción**  
La RLS policy `profiles_update_own` sobre la tabla `profiles` permite que un usuario autenticado actualice cualquier campo de su propia fila, incluyendo `role`.

```sql
-- Policy actual (pg_policies):
cmd        = UPDATE
qual       = (id = auth.uid())
with_check = NULL   ← hereda el USING, que siempre es TRUE para el propio row
```

Dado que `with_check` es `null`, PostgreSQL usa el USING clause como check de escritura. Como `id` es PK y no cambia, el check es trivialmente verdadero para cualquier valor de `role`.

**Vector de explotación**  
El anon key de Supabase es público (`NEXT_PUBLIC_SUPABASE_ANON_KEY`, expuesto al browser). El JWT de sesión está en localStorage.

```bash
# 1. El cliente abre DevTools y obtiene su JWT de localStorage / network tab
# 2. Hace un PATCH directo a PostgREST:

curl -X PATCH \
  "https://[project-ref].supabase.co/rest/v1/profiles?id=eq.[my-uuid]" \
  -H "Authorization: Bearer [mi-jwt]" \
  -H "apikey: [anon-key-publico]" \
  -H "Content-Type: application/json" \
  -d '{"role": "admin"}'
```

A partir de ese momento, `requireAdmin(jwt)` en todos los `/api/admin/*` retorna el usuario como válido. El cliente tiene acceso total: ve datos de todos los demás clientes, CRM, pagos, magic links, puede crear usuarios, etc.

**Ubicación**  
- Policy en Supabase: `public.profiles`, policy `profiles_update_own`  
- Columna afectada: `profiles.role` (text, NOT NULL, default `'client'`)

**Impacto**  
Escalamiento de privilegios completo. Un cliente puede leer datos financieros de todos los demás clientes, generar magic links para cualquier cuenta, crear usuarios admin, y acceder al Centro Operativo con SOPs y claves internas.

**Recomendación**  
Agregar `WITH CHECK` que restrinja los campos modificables, o usar column-level security:

```sql
-- Opción 1: WITH CHECK explícito (solo permite cambiar name)
CREATE OR REPLACE POLICY "profiles_update_own"
  ON profiles FOR UPDATE TO authenticated
  USING (id = auth.uid())
  WITH CHECK (
    id = auth.uid()
    AND role = (SELECT role FROM profiles WHERE id = auth.uid())
    AND client_id IS NOT DISTINCT FROM (SELECT client_id FROM profiles WHERE id = auth.uid())
  );

-- Opción 2 (más limpio): revocar UPDATE de authenticated y manejarlo
-- solo con service_role desde los API routes
REVOKE UPDATE ON profiles FROM authenticated;
```

---

#### C-02 — Webhook `/api/webhooks/client` sin ninguna autenticación

**Descripción**  
El endpoint acepta cualquier POST sin verificar origen ni secreto. No hay ninguna condición de autenticación.

```typescript
// app/api/webhooks/client/route.ts — línea 56
export async function POST(req: NextRequest) {
  // No hay verificación de secreto, IP, ni token
  // ...
  await supabase.from("crm_clients").insert({ name, ... })
  await supabase.from("crm_installments").insert(installments)
}
```

**Vector de explotación**

```bash
# Crear cientos de clientes falsos con importes arbitrarios:
for i in $(seq 1 500); do
  curl -s -X POST https://smartscale.space/api/webhooks/client \
    -H "Content-Type: application/json" \
    -d "{\"nombre\": \"Spam $i\", \"pago_total\": 999999, \"cantidad_meses\": 24}"
done
```

Cada request crea un registro en `crm_clients` + hasta 6 en `crm_installments`. Con 500 requests se generan ~3.500 filas.

**Impacto**  
- Pollution masiva del CRM: los KPIs del executive dashboard (MRR, cash collected, nuevos clientes) quedan distorsionados.  
- El cron diario `billing-alerts` itera sobre todos los clientes activos y generaría alertas de Slack falsas.  
- DoS suave sobre la base de datos (tabla crm_installments puede crecer ilimitadamente).

**Recomendación**  
Agregar `CLIENT_WEBHOOK_SECRET` obligatorio (sin fallback vacío):

```typescript
const secret = process.env.CLIENT_WEBHOOK_SECRET
if (!secret) {
  console.error("CLIENT_WEBHOOK_SECRET not configured — rejecting all requests")
  return NextResponse.json({ error: "Service unavailable" }, { status: 503 })
}
const incoming = req.headers.get("x-webhook-secret") ?? req.headers.get("authorization")?.replace("Bearer ", "")
if (incoming !== secret) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
```

---

#### C-03 — Webhooks con autenticación condicional (`/api/webhooks/lead` y `/api/webhooks/payment`)

**Descripción**  
Ambos endpoints tienen la misma estructura:

```typescript
// webhooks/lead/route.ts:24-35
const webhookSecret = process.env.WEBHOOK_SECRET
if (webhookSecret) {          // ← si la var no está definida, el bloque se saltea
  if (incoming !== webhookSecret) return 401
}
// Si WEBHOOK_SECRET está vacío → todo el mundo pasa
```

Si las variables de entorno `WEBHOOK_SECRET` y `PAYMENT_WEBHOOK_SECRET` no están configuradas en Vercel, cualquier actor puede inyectar leads y pagos.

**Vector de explotación**  
Primero, verificar si están configuradas (desde afuera no se puede saber con certeza — requiere revisar el dashboard de Vercel). Si no lo están:

```bash
# Inyectar pago falso de $50.000
curl -X POST https://smartscale.space/api/webhooks/payment \
  -H "Content-Type: application/json" \
  -d '{"name": "Cliente Falso", "email": "test@test.com", "amount": 50000, "status": "aceptado"}'

# Inyectar 1000 leads basura
for i in $(seq 1 1000); do
  curl -s -X POST https://smartscale.space/api/webhooks/lead \
    -d "{\"email\": \"spam$i@spam.com\", \"name\": \"Bot $i\", \"tag\": \"spam\"}" \
    -H "Content-Type: application/json"
done
```

**Impacto**  
- Pagos falsos en el log financiero visible al admin.  
- Contaminación del CRM de leads con registros irreales.  
- Los webhooks **no tienen rate limiting**, lo que permite DoS a nivel de DB y Slack.

**Recomendación**  
Igual que C-02: hacer el secreto **obligatorio**, no opcional. Verificar en el dashboard de Vercel que `WEBHOOK_SECRET` y `PAYMENT_WEBHOOK_SECRET` estén configurados hoy mismo.

---

### 🟠 ALTO

---

#### A-01 — URLs de Zapier hardcodeadas como fallback en código fuente

**Descripción**  
Dos rutas tienen las URLs de Zapier como fallback hardcoded:

```typescript
// app/api/apply/route.ts:59
const webhookUrl = process.env.APPLY_WEBHOOK_URL
  ?? "https://hooks.zapier.com/hooks/catch/17540789/uj9kbbl/"

// app/api/team-apply/route.ts:76
process.env.TEAM_APPLY_WEBHOOK_URL
  ?? "https://hooks.zapier.com/hooks/catch/17540789/uvp3wxx/"
```

**Vector de explotación**  
Cualquier persona que tenga acceso al código fuente (colaboradores, ex-empleados, si el repo es o fue público) puede triggear los Zaps directamente, saltando todas las validaciones del formulario:

```bash
# Triggear el Zap de apply con datos arbitrarios, sin pasar por /apply
curl -X POST "https://hooks.zapier.com/hooks/catch/17540789/uj9kbbl/" \
  -d "nombre=Fake&apellido=User&email=fake@fake.com&whatsapp=123&instagram=@fake"
```

**Impacto**  
- Inyección de aplicaciones falsas en el pipeline de ventas de Zapier/CRM.  
- Los Zaps pueden triggerear automatizaciones costosas (emails, SMS, notificaciones).  
- Las URLs hardcodeadas pueden estar en el historial de git para siempre incluso si se eliminan del código.

**Recomendación**  
1. **Regenerar** ambas URLs de Zapier inmediatamente (el formato `/catch/<account>/<hook>` es irrevocable una vez expuesto).  
2. Configurar `APPLY_WEBHOOK_URL` y `TEAM_APPLY_WEBHOOK_URL` como variables de entorno en Vercel.  
3. Eliminar el fallback hardcoded del código.

---

#### A-02 — IDOR en `/api/monthly-reports/save`: cualquier usuario autenticado escribe el reporte de cualquier cliente

**Descripción**  
El endpoint autentica el JWT pero no valida que el `client_id` del body pertenezca al usuario autenticado:

```typescript
// app/api/monthly-reports/save/route.ts:48-51
const clientId = typeof body.client_id === "string" ? body.client_id : null
// ...no hay verificación de que clientId sea el propio client del usuario
const { data: saved } = await supabase
  .from("monthly_reports")
  .upsert(reportRow, { onConflict: "client_id,month" })  // escribe para cualquier clientId
```

**Vector de explotación**  
Un cliente A (con JWT válido) necesita conocer el UUID del cliente B. Este UUID es obtenible vía `profiles_select` (ver A-03): cualquier cliente autenticado puede enumerar todos los `client_id` del sistema.

```bash
# Paso 1: enumerar todos los client_ids
curl "https://[project].supabase.co/rest/v1/profiles?select=client_id,name" \
  -H "Authorization: Bearer [jwt-cliente-A]" -H "apikey: [anon-key]"
# → devuelve todos los perfiles incluyendo client_ids

# Paso 2: sobrescribir el reporte mensual del cliente B
curl -X POST https://smartscale.space/api/monthly-reports/save \
  -H "Authorization: Bearer [jwt-cliente-A]" \
  -H "Content-Type: application/json" \
  -d '{"client_id": "[uuid-cliente-B]", "month": "2026-05", "total_revenue": 0}'
```

**Impacto**  
Un cliente puede poner a cero (o con datos falsos) los reportes mensuales de otros clientes. También triggera eventos de Zapier y Slack con los datos modificados.

**Recomendación**  
Agregar verificación de ownership después del auth:

```typescript
if (userId) {
  const { data: prof } = await supabase
    .from("profiles").select("role, client_id").eq("id", userId).single()
  const role = prof?.role?.toLowerCase()
  // Solo admin/team pueden especificar cualquier clientId
  if (role !== "admin" && role !== "team") {
    if (prof?.client_id !== clientId) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 })
    }
  }
}
```

---

#### A-03 — Information disclosure: todos los perfiles visibles para cualquier usuario autenticado

**Descripción**  
La RLS policy `profiles_select` no está scopeada al propio usuario:

```sql
-- Policy actual:
cmd  = SELECT
qual = (auth.role() = 'authenticated'::text)
-- ↑ cualquier usuario logueado ve TODOS los perfiles
```

La tabla `profiles` expone: `id` (UUID del usuario), `name`, `role` ('admin'/'team'/'setter'/'client'), `client_id`.

**Vector de explotación**

```bash
curl "https://[project].supabase.co/rest/v1/profiles?select=id,name,role,client_id" \
  -H "Authorization: Bearer [jwt-de-cualquier-cliente]" \
  -H "apikey: [anon-key-publico]"
# → lista completa de todos los usuarios, sus roles y sus client_ids
```

**Impacto**  
- Un cliente puede identificar quiénes son los admins (para intentar phishing/social engineering dirigido).  
- Obtiene los `client_id` de todos los demás clientes, necesarios para el IDOR de A-02.  
- Expone la estructura interna del equipo (setters, team members).

**Nota sobre deny-by-default**  
Las tablas `centro_op_pages`, `client_playbook_main`, `client_playbook_pages`, `clients`, `competitor_posts`, `integrations` y `sops` tienen RLS habilitado **pero sin policies** — esto es **deny-by-default**: ningún usuario (anon ni authenticated) puede acceder vía PostgREST. Solo `service_role` accede, y únicamente a través de los API routes. Estas tablas **no están expuestas**; el aviso del advisor de Supabase es un INFO, no una exposición real.

**Recomendación**

```sql
-- Reemplazar la policy actual
DROP POLICY IF EXISTS "profiles_select" ON profiles;

CREATE POLICY "profiles_select_own"
  ON profiles FOR SELECT TO authenticated
  USING (id = auth.uid());

CREATE POLICY "profiles_select_internal"
  ON profiles FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles p
      WHERE p.id = auth.uid()
        AND p.role IN ('admin', 'team', 'setter')
    )
  );
```

---

#### A-04 — `audit_logs` INSERT abierto a usuarios no autenticados (anon)

**Descripción**  
La policy `Service role can insert audit logs` aplica a `roles = {public}` (que en Supabase incluye anon) con `WITH CHECK (true)`:

```sql
cmd        = INSERT
roles      = {public}   ← anon + authenticated
with_check = true       ← cualquier valor aceptado
```

**Vector de explotación**

```bash
# Sin JWT — solo con el anon key público:
curl -X POST "https://[project].supabase.co/rest/v1/audit_logs" \
  -H "apikey: [anon-key]" \
  -H "Content-Type: application/json" \
  -d '{"action": "admin.user.deleted", "user_id": "[uuid-admin]", "details": "fake"}'
```

**Impacto**  
Log poisoning: un actor puede insertar eventos de auditoría falsos (accesos, modificaciones, deleteos) mezclados con los reales, dificultando la respuesta ante incidentes reales.

**Recomendación**

```sql
DROP POLICY "Service role can insert audit logs" ON audit_logs;
CREATE POLICY "service_role_insert_audit_logs"
  ON audit_logs FOR INSERT TO service_role
  WITH CHECK (true);
```

---

#### A-05 — Next.js 16.0.10: 16 CVEs de severidad alta activos

**Descripción**  
`pnpm audit` reporta 35 vulnerabilidades (3 low, 16 moderate, 16 high) en la versión instalada `16.0.10`. Algunas críticas para este stack:

| CVE/Advisory | Descripción | Versión fix |
|---|---|---|
| [GHSA-267c-6grr-h53f](https://github.com/advisories/GHSA-267c-6grr-h53f) | Middleware/Proxy bypass App Router | ≥16.2.5 |
| [GHSA-492v-c6pp-mqqv](https://github.com/advisories/GHSA-492v-c6pp-mqqv) | Middleware/Proxy bypass (otro vector) | ≥16.2.5 |
| [GHSA-36qx-fr4f-26g5](https://github.com/advisories/GHSA-36qx-fr4f-26g5) | Middleware/Proxy bypass Pages Router | ≥16.2.5 |
| [GHSA-26hh-7cqf-hhc6](https://github.com/advisories/GHSA-26hh-7cqf-hhc6) | Middleware bypass follow-up | ≥16.2.6 |
| [GHSA-c4j6-fc7j-m34r](https://github.com/advisories/GHSA-c4j6-fc7j-m34r) | SSRF via Server Actions | ≥16.2.5 |
| [GHSA-mg66-mrh9-m8jx](https://github.com/advisories/GHSA-mg66-mrh9-m8jx) | DoS via connection handling | ≥16.2.5 |
| [GHSA-h25m-26qc-wcjf](https://github.com/advisories/GHSA-h25m-26qc-wcjf) | DoS HTTP request deserialization | ≥16.0.11 |

Los bypasses de Middleware son particularmente relevantes si en el futuro se agrega un `middleware.ts` para proteger rutas. Hoy en día la app no usa middleware de auth (los checks están en cada route handler), lo que paradójicamente la hace menos vulnerable a este vector — pero el SSRF y los DoS son aplicables de todos modos.

**Recomendación**  
```bash
pnpm add next@latest   # ≥16.2.6 para cubrir todos los high CVEs
```

También hay `tar <7.5.15` con 6 CVEs high (path traversal, arbitrary file write) vía `@tailwindcss/oxide`. Actualizar Tailwind v4.

---

### 🟡 MEDIO

---

#### M-01 — Sin headers HTTP de seguridad

`next.config.mjs` no configura ningún security header. Tampoco `vercel.json`.

Vectores habilitados:
- **Clickjacking**: el portal puede embeberse en un `<iframe>` malicioso (no hay `X-Frame-Options` ni `frame-ancestors`).
- **MIME sniffing**: sin `X-Content-Type-Options: nosniff`, un archivo subido con tipo incorrecto puede ejecutarse como script.
- **Sin CSP**: si en algún punto se introduce XSS (por ejemplo via el editor BlockNote que renderiza HTML), no hay barrera de defensa en profundidad.

**Recomendación** — agregar en `next.config.mjs`:

```js
const nextConfig = {
  // ...existente
  async headers() {
    return [{
      source: "/(.*)",
      headers: [
        { key: "X-Frame-Options", value: "DENY" },
        { key: "X-Content-Type-Options", value: "nosniff" },
        { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
        { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        {
          key: "Content-Security-Policy",
          value: [
            "default-src 'self'",
            "script-src 'self' 'unsafe-inline' 'unsafe-eval'",  // ajustar según necesidad
            "style-src 'self' 'unsafe-inline'",
            "img-src 'self' data: https://cdninstagram.com https://fbcdn.net https://ytimg.com https://ggpht.com https://googleusercontent.com",
            "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
            "frame-ancestors 'none'",
          ].join("; "),
        },
      ],
    }]
  },
}
```

---

#### M-02 — Endpoints AI/research sin rate limiting

Los siguientes endpoints consumen APIs externas sin ningún throttle:

| Endpoint | API externa | Costo estimado por request |
|---|---|---|
| `/api/help-chat` | Anthropic Claude Haiku | ~$0.001 |
| `/api/ai-diagnosis` | Anthropic Claude Sonnet | ~$0.05 |
| `/api/content-research` | Anthropic + Apify | ~$0.10+ |
| `/api/transcript` | AssemblyAI + Apify | ~$0.05+ |

Un usuario autenticado con un script puede hacer 100 requests/minuto sin ser bloqueado.

**Recomendación**  
Implementar rate limiting por `userId` usando Vercel KV (Redis) o una tabla de `rate_limits` en Supabase. Mínimo: 10 requests/hora para los endpoints de IA costosos.

---

#### M-03 — `proxy-image` público sin autenticación ni rate limiting

El endpoint `GET /api/proxy-image?url=...` es completamente público (no requiere JWT). Aunque el SSRF está bien mitigado por la whitelist de dominios, el endpoint puede abusarse:

- **Proxy anónimo**: cualquier persona (sin cuenta) puede usar el servidor para fetchear imágenes de Instagram/YouTube evitando rastreo.
- **Rate exhaustion**: sin límite, puede hacer 1000 requests/segundo hacia los CDNs, generando costos de egress en Vercel.
- **Cache timing**: puede usarse para inferir si ciertas URLs de CDN existen (HTTP 200 vs 502).

**Recomendación**  
Requerir JWT válido (un usuario logueado) o al mínimo agregar rate limiting por IP.

---

#### M-04 — `listUsers()` en magic-link: O(n) sobre todos los usuarios

```typescript
// app/api/admin/magic-link/route.ts:30-31
const { data: users } = await supabase.auth.admin.listUsers()
const existing = (users?.users ?? []).find(u => u.email === email)
```

`listUsers()` retorna todos los usuarios (máx. 1.000 por página, sin paginación implementada). Con muchos usuarios dará falsos "no encontrado".

**Recomendación**

```typescript
const { data: { users }, error } = await supabase.auth.admin.listUsers({
  // No existe getUserByEmail aún en el SDK — usar filtro de page:
})
// Alternativa: buscar en auth.users via SQL con service_role
const { data } = await supabase
  .from("profiles")
  .select("id")
  .eq("...email from auth...", email)  // o usar un campo email en profiles
```

O más simple: intentar generar el magic link directamente y manejar el error de "usuario no encontrado" del SDK, que es más eficiente y no requiere cargar todos los usuarios.

---

#### M-05 — Leaked password protection deshabilitada

El advisor de Supabase reporta que la verificación contra HaveIBeenPwned está deshabilitada. Los usuarios pueden registrarse con contraseñas comprometidas conocidas.

**Recomendación**  
Activar en: Supabase Dashboard → Authentication → Password → "Enable Leaked Password Protection".

---

#### M-06 — `competitors` sin scoping por cliente: cualquier autenticado gestiona todo

Policy actual:
```sql
"Authenticated can manage competitors": cmd = ALL, qual = (auth.role() = 'authenticated')
```

Un cliente A puede ver, crear, editar y eliminar los competidores configurados por el cliente B.

**Recomendación**  
Agregar `client_id` a la tabla `competitors` y scopear las policies por `client_id = profiles.client_id`.

---

#### M-07 — Patrón inseguro: service_role key comparada como bearer token

```typescript
// app/api/monthly-reports/save/route.ts:33-35
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ""
const isServiceCaller = serviceKey && jwt === serviceKey
```

Comparar el service role key con el JWT bearer es un anti-patrón. Si el service key se filtra (via logs, error messages, variable de entorno expuesta), se convierte en un bypass de autenticación total para este endpoint.

**Recomendación**  
Eliminar este código path. Las llamadas internas/cron deben usar un `CRON_SECRET` separado o el mecanismo de Vercel Cron que ya está implementado en `billing-alerts`.

---

#### M-08 — `pg_net` instalada en schema `public`

La extensión `pg_net` (que permite hacer HTTP requests desde Postgres) está en el schema `public`, exponiéndola a través de PostgREST.

**Recomendación**  
```sql
ALTER EXTENSION pg_net SET SCHEMA extensions;
```

---

#### M-09 — Dependencias con CVEs moderados

| Paquete | CVE | Descripción |
|---|---|---|
| `lodash` (vía recharts) | [GHSA-r5fr-rjxr-66jc](https://github.com/advisories/GHSA-r5fr-rjxr-66jc) | Code injection via `_.template` (high) |
| `lodash` | [GHSA-xxjr-mmjv-4gpg](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg) | Prototype pollution |
| `ws` (vía @supabase/realtime-js) | [GHSA-...](https://github.com/advisories/GHSA-3h5q-q39x-f9mn) | Uninitialized memory disclosure |
| `@anthropic-ai/sdk` | Insecure default file permissions | Moderate |
| `postcss` (vía tailwind) | XSS via unescaped `</style>` | Moderate |

**Recomendación**  
```bash
pnpm update recharts    # si hay versión que no incluya lodash vulnerable
pnpm update @supabase/supabase-js   # para ws actualizado
pnpm update tailwindcss @tailwindcss/postcss
```

---

### 🔵 BAJO

---

#### B-01 — 15+ foreign keys sin índice covering (performance)

El advisor de performance reporta FKs sin índice en las tablas más consultadas. Las más impactantes:

| Tabla | FK sin índice |
|---|---|
| `centro_op_pages` | `created_by` |
| `channels` | `department_id` |
| `client_playbook_main` | `client_id`, `updated_by` |
| `content_research_history` | `client_id` |
| `crm_clients` | `setter_id` |
| `monthly_reports` | `client_id` (¡muy usado!) |
| `setter_commissions` | `setter_id` |

`monthly_reports.client_id` es probablemente el más doloroso — se filtra por este campo en casi todas las queries del portal cliente.

**Recomendación**

```sql
CREATE INDEX CONCURRENTLY idx_monthly_reports_client_id ON monthly_reports(client_id);
CREATE INDEX CONCURRENTLY idx_crm_clients_setter_id ON crm_clients(setter_id);
CREATE INDEX CONCURRENTLY idx_content_research_client_id ON content_research_history(client_id);
```

---

#### B-02 — `@supabase/supabase-js: "latest"` no determinista

```json
// package.json
"@supabase/supabase-js": "latest"
```

Una actualización breaking de Supabase puede romper producción silenciosamente.

**Recomendación**  
```bash
pnpm add @supabase/supabase-js@^2.49.0   # o la versión actualmente instalada
```

---

#### B-03 — 8 funciones DB con `search_path` mutable

Las funciones `set_profiles_updated_at`, `get_next_pending_request`, `is_admin`, `handle_new_user`, `set_client_playbook_main_updated_at`, etc. no tienen `SET search_path = 'public'`. Un atacante que logre crear un objeto en un schema con mayor prioridad podría hacer schema poisoning.

**Recomendación**  
Agregar a cada función: `SET search_path = 'public', 'pg_catalog'`.

---

#### B-04 — `handle_new_user` e `is_admin` SECURITY DEFINER callable por anon

Ambas funciones son de trigger/helper interno pero están expuestas via `/rest/v1/rpc/`:

- `handle_new_user()`: trigger function, requiere el objeto `NEW` que no existe fuera de un trigger → siempre falla inofensivamente cuando se llama via RPC.
- `is_admin()`: retorna `false` para anon (ya que `auth.uid()` es null). Información disclosure mínima.
- `admin_uncomplete_day(uuid, int)`: referencias a tablas que no existen en el schema actual (`day_progress`, `users`) → siempre falla con "relation does not exist". **Dead code**.

**Recomendación**

```sql
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM anon;
REVOKE EXECUTE ON FUNCTION public.admin_uncomplete_day(uuid, int) FROM anon, authenticated;
-- Considerar DROP de admin_uncomplete_day si es definitivamente dead code
```

---

#### B-05 — Cero cobertura de tests

No existe ningún archivo de test en el repositorio (ni `*.test.ts`, ni `*.spec.ts`, ni directorio `__tests__`). No hay jest, vitest, playwright, ni cypress configurado.

Las funciones críticas como `isOnlyCheckboxToggleChange` (validación del Playbook), `generateTempPassword`, y los cálculos de cuotas/MRR operan sin ninguna regresión automatizada.

**Recomendación**  
Priorizar unit tests para `lib/playbook-diff.ts`, `lib/calculations/*`, y `lib/auth/permissions.ts`. Agregar al menos un test de integración para los endpoints más críticos (create user, save report).

---

#### B-06 — `typescript.ignoreBuildErrors: true` oculta errores de tipos

El build de producción no falla ante errores de TypeScript. Hay errores preexistentes conocidos en archivos de producción. Nuevos errores pueden introducirse sin fricción.

**Recomendación**  
Correr `npx tsc --noEmit` en CI (GitHub Actions, pre-deploy hook) como requisito de merge, excluyendo explícitamente los archivos con errores legacy conocidos.

---

#### B-07 — Netlify y Vercel ambos configurados

Existen `netlify.toml` y `vercel.json` simultáneamente. Si ambas plataformas están activas con dominios diferentes, puede haber inconsistencias en variables de entorno y comportamiento del cron.

**Recomendación**  
Determinar cuál es la plataforma activa, remover la configuración de la otra, o documentar explícitamente el propósito de cada una.

---

#### B-08 — `research_requests` tiene dos policies INSERT duplicadas

```sql
"Insert own requests"                       -- roles: {public}
"Users can insert their own research requests" -- roles: {authenticated}
```

Ambas tienen `with_check = (auth.uid() = user_id)`. Dead code / confusión.

**Recomendación**  
```sql
DROP POLICY "Insert own requests" ON research_requests;
```

---

## Quick Wins (arreglos de alto impacto en < 1 hora)

| # | Acción | Impacto | Tiempo estimado |
|---|---|---|---|
| **QW-1** | Agregar `WITH CHECK` restrictivo a `profiles_update_own` para bloquear cambios de `role` y `client_id` | Cierra C-01 (privilege escalation crítico) | 15 min |
| **QW-2** | Configurar `WEBHOOK_SECRET`, `PAYMENT_WEBHOOK_SECRET` y `CLIENT_WEBHOOK_SECRET` en Vercel como **obligatorios** (sin fallback vacío) | Cierra C-02 y C-03 | 10 min |
| **QW-3** | Regenerar las URLs de Zapier y mover a variables de entorno sin fallback | Cierra A-01 | 20 min |
| **QW-4** | Fijar `profiles_select` para que los clientes solo vean su propio perfil | Cierra A-03 (prerequisito para A-02) | 10 min |
| **QW-5** | Corregir la policy de `audit_logs` INSERT para que aplique solo a `service_role` | Cierra A-04 | 5 min |
| **QW-6** | `pnpm add next@latest` (≥16.2.6) | Cierra A-05 (16 CVEs altos) | 10 min + test deploy |
| **QW-7** | Agregar `client_id` ownership check en `/api/monthly-reports/save` | Cierra A-02 | 20 min |
| **QW-8** | Activar Leaked Password Protection en Supabase Dashboard | Cierra M-05 | 2 min |
| **QW-9** | Agregar `CREATE INDEX CONCURRENTLY` en `monthly_reports(client_id)` | Mayor ganancia de performance inmediata | 5 min |

---

## Apéndice: Resumen de Estado RLS

| Estado | Tablas |
|---|---|
| **RLS ON + policies correctas** | `profiles`, `monthly_reports`, `ai_diagnosis_*`, `content_research_history`, `crm_*` (service_role only), `transcript_history`, `video_feed_accounts`, `setter_commissions`, `setter_monthly_metrics`, `resources`, `research_*` |
| **RLS ON sin policies (deny-by-default ✓)** | `centro_op_pages`, `client_playbook_main`, `client_playbook_pages`, `clients`, `competitor_posts`, `integrations`, `sops` — accesibles solo via service_role desde API routes |
| **RLS ON con policy demasiado permisiva** | `audit_logs` (INSERT abierto a anon), `profiles` (SELECT y UPDATE sin restricción de campos), `competitors` (ALL sin scope de cliente) |
| **RLS ON, policy correcta pero mejorable** | `research_requests` (duplicate INSERT policies) |
