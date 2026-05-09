# Smart Scale Dashboard

Portal de analytics + CRM operativo. Dos audiencias en el mismo deploy:
- **Portal cliente** (`/dashboard`, `/channels`, `/sales`, `/audit`, etc.) — los clientes ven sus métricas mensuales.
- **Admin internal** (`/admin/*`) — admin / team / setter gestionan clientes, leads, pagos, applications.

## Stack

- **Next.js 16.0.10** (App Router + Turbopack)
- **React 19**
- TypeScript estricto (`"strict": true` en tsconfig). **Pero ojo:** `next.config.mjs` tiene `typescript.ignoreBuildErrors: true` — el build NO falla con errores de TS. Hay que correr type check a mano.
- **Tailwind v4** (PostCSS, sin `tailwind.config.*` — reemplazado por config CSS-first)
- **shadcn/ui** + Radix primitives (Dialog, Popover, Select, etc.)
- **Supabase** (`@supabase/ssr` + `@supabase/supabase-js`) — auth + Postgres + RLS
- **BlockNote** v0.50 (editor Notion-style en Centro Operativo + Playbook)
- **Anthropic SDK** (asistente AI + diagnósticos del audit)
- **Recharts** para gráficos
- Deploy: **Vercel** (con cron `0 12 * * *` para `/api/cron/billing-alerts`)

## Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Dev server (default port 3000 — Next decide) |
| `pnpm build` | Build de producción |
| `pnpm lint` | ESLint (sin config explícita en el repo — usa defaults de Next) |
| `pnpm start` | Sirve el build local |

**No hay script `typecheck`.** Para verificar tipos: `npx tsc --noEmit`. Para detectar imports/locales sin uso: `npx tsc --noEmit --noUnusedLocals --noUnusedParameters`.

## Estructura

```
app/
├── (públicas)         /, /login, /signup, /apply, /aplicar-equipo/[rol]
├── /admin/*           applications, centro-operativo, clients, data, leads,
│                      payments, prospeccion, setting, team-applications
├── (portal cliente)   /dashboard, /channels, /sales, /reflection, /metrics,
│                      /audit, /program-checklist, /calendar, /monday-win,
│                      /report-input, /report-history, /chi-chang, /recursos,
│                      /tools, /transcript, /video-feed, /content-research,
│                      /competitor-research, /market-intelligence
└── api/               35 routes — admin/*, webhooks/*, cron/*, etc.

components/
├── views/             30 vistas grandes (admin-clients-view, audit-view, etc.)
├── ui/                shadcn primitives + skeleton.tsx
├── layout/            dashboard-layout, sidebar, admin-sidebar, month-selector
├── sections/          business-kpis, trend-charts, mom-panel, metrics-section
├── admin/             new-user-dialog, eod-form-dialog
└── theme/             theme-provider (next-themes), theme-toggle

lib/
├── auth/              api-guards, permissions, view-as
├── supabase.ts        client browser
├── supabase-service.ts client server (service role)
├── playbook-diff.ts   validación checkbox-only del Playbook único
├── playbook-template.ts seed de 4 docs (Investigación / Avatar / Oferta / IP)
└── ...                ai-diagnosis, events, instagram-transcript, slack, zapier

supabase/migrations/   20 .sql (algunas con prefix de timestamp, otras sin —
                       las sin prefix son las más viejas)
```

## Roles y permisos

4 roles en `profiles.role`:
- **admin** — acceso total
- **team** — admin sin gestión de usuarios; ve CRM, leads, applications
- **setter** — solo Setting CRM + Prospección + Leads (vista propia)
- **client** — portal cliente (su propio `client_id` solamente)

`lib/auth/permissions.ts` tiene helpers (`isAdmin`, `isTeam`, `isSetter`) y los `*_DEFAULT_LANDING`.

`lib/auth/view-as.ts` permite que **admin impersone** setter o cliente sin log out (`useViewAsRole` + `useEffectiveRole`). Persistencia en localStorage. Solo afecta UI; las queries siguen yendo con el JWT del admin.

## Convenciones

- **Server vs Client Components**: la mayoría de las vistas son `"use client"` por interactividad (forms, charts, BlockNote). Las páginas en `app/*/page.tsx` que solo hacen `<DashboardLayout><FooView /></DashboardLayout>` también son client (no había razón para SSR de cosas autenticadas).
- **Imágenes**: `next.config.mjs` tiene `images.unoptimized: true` por la integración v0. No hay restricción a `<img>` raw — pero preferí `next/image` cuando sea fácil.
- **Colores**: usar tokens del theme (`text-foreground`, `bg-card`, `bg-background`). El brand es `#ffde21` (amarillo) y `#ffe84d` (hover). **Nunca** `text-red-300/400` o `bg-emerald-900/40` solos — rompen light/dark. Patrón correcto: `text-red-700 dark:text-red-400` o `bg-emerald-100 dark:bg-emerald-500/10`.
- **Commits**: formato `tipo(scope): qué cambia` (`feat`, `fix`, `chore`, `refactor`, `style`, `perf`, `a11y`). Mensajes en castellano OK, body con detalles cuando ayuda.
- **Branches**: el flujo actual usa `claude/<random-name>` (worktrees) → PR a `main`. No hay `feature/*` ni `fix/*` convencionales.

## Gotchas (cosas que ya rompieron y hay que recordar)

### 1. Dos tablas de cliente, NO sincronizadas

- `crm_clients` — la del CRM de ventas. Se popula automáticamente vía `/api/webhooks/client` (Airtable). Tiene installments, followups, etc.
- `clients` — la del **portal**. Tiene `id` (uuid), `name` (NOT NULL), `nombre` (legacy nullable), `created_at`. **El FK `profiles.client_id` apunta acá**, NO a `crm_clients`.

Si creás un user con role=client y le pasás un `client_id` que solo existe en `crm_clients`, el FK `profiles_client_id_fkey` explota. El bridge ya está en `app/api/admin/users/create/route.ts` (copia el row al portal automáticamente). No tocar sin entender.

### 2. Light/dark mode breaks silenciosos

Patrones que rompen light mode (texto invisible sobre fondo blanco):
- `text-{red,emerald,amber,blue,green,purple}-{300,400}` sin `dark:` variant
- Hex oscuros hardcoded fuera del brand: `bg-[#0f1011]`, `bg-[#17171a]`, etc.
- Pills de status tipo `bg-emerald-500/10 text-emerald-300` sin variant para light

Antes de cerrar un feature, correr:

```bash
# Texto color-X-300/400 sin dark variant
grep -rn "text-\(red\|emerald\|amber\|blue\|green\|purple\)-\(300\|400\)" components/ app/ --include="*.tsx" | grep -v "dark:"

# Hex oscuros hardcoded (excluyendo brand #ffde21)
grep -rn "bg-\[#0\|bg-\[#1[0-9]\|bg-\[#2[0-3]" components/ app/ --include="*.tsx" | grep -v "ffde21\|ffe84d"
```

Cero líneas en ambos = light mode OK.

### 3. Playbook único: validación checkbox-only

`/api/client-playbook-main` permite que el cliente edite su playbook PERO solo puede tildar/destildar checkboxes. El diff real se hace en `lib/playbook-diff.ts` (`isOnlyCheckboxToggleChange`). Validación en dos capas:
- Cliente: revierte el editor in-place si detecta cambio fuera del whitelist.
- Servidor: rechaza con 403.

No remover ninguna de las dos. RLS no puede introspectar diffs de jsonb.

### 4. `target="_blank"` siempre con `rel`

Convención del repo: `rel="noopener noreferrer"` o al menos `rel="noreferrer"`. Si tu grep no captura un caso, mirá multilínea — `target` y `rel` suelen ir en líneas separadas.

### 5. View-as no impersona en backend

`useViewAsRole()` es solo UI. Los `fetch` siguen yendo con el JWT real del admin. Si necesitás "ver como cliente" con datos filtrados, tenés que pasar `?client_id=...` explícitamente al endpoint o el API no filtra.

### 6. `next.config.mjs`: `typescript.ignoreBuildErrors: true`

El build NO falla con errores de TS. Esto desde la integración v0. Correr `npx tsc --noEmit` manualmente antes de mergear cosas grandes. Hay errores preexistentes en `supabase/functions/*`, `app/api/cron/billing-alerts`, `components/views/admin-import-view.tsx` (Lucide `title` prop), `report-input-view.tsx` — son legacy, no introducir nuevos.

### 7. Worktree workflow

Trabajamos en `.claude/worktrees/<random>/` con su propio branch `claude/<random>`. Las env vars (`.env.local`, `.env`) están solo en el repo principal — para que el worktree pueda hacer auth contra Supabase, hay que symlinkear:

```bash
cd .claude/worktrees/<your-worktree>
ln -s /path/to/main-repo/.env.local .env.local
ln -s /path/to/main-repo/.env .env
```

`.env*` ya está gitignored así que el symlink no contamina el diff.

## Workflow recomendado

1. **Antes de cambios grandes**: leer los archivos involucrados (no asumir su contenido).
2. **Cambios chicos, commits frecuentes**: `git log` debe poder revertir cualquier paso.
3. **Después de cada batch**: `npx tsc --noEmit | grep -v "supabase/functions\|cron/billing-alerts\|admin-import-view\|report-input-view"`. Cero líneas = OK.
4. **Antes de cerrar un feature visual**: correr los greps de la gotcha #2 (light/dark).
5. **Verificar lo que decís que hacés**: si decís "TS check pasó", el comando tiene que aparecer en el log. Si decís "lo arreglé", el `git diff` lo tiene que mostrar.
6. **Push a `main` solo vía PR**. El branch local termina en `main` cuando el PR mergea.

## Tareas comunes que ya están resueltas

| Necesidad | Dónde |
|---|---|
| Banner amarillo "viendo otro cliente" | `dashboard-layout.tsx` (renderiza el banner cuando `activeClient !== ownClient`) |
| Detectar si el viewer es el dueño del cliente | `useActiveClient()` + `useOwnClient()` (de `dashboard-layout.tsx`). Igualdad → es own. |
| Cargar la sesión + JWT en frontend | `createClient()` de `@/lib/supabase` + `await supabase.auth.getSession()` |
| Endpoint admin protegido | `requireAdmin(jwt)` o `requireInternal(jwt)` de `lib/auth/api-guards.ts` |
| Skeleton de loading | `components/ui/skeleton.tsx` (`<Sk>`, `KpiCardSkeleton`, `StatCardSkeleton`, etc.) |
| Toast | `sonner` (no usado mucho aún — preferimos indicadores inline tipo "✓ Guardado") |
