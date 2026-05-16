# Arquitectura de Usuarios — Smart Scale

Guía para replicar el sistema de autenticación, roles y permisos en otro dashboard Next.js + Supabase.

---

## Stack requerido

- **Next.js** (App Router)
- **Supabase** (`@supabase/supabase-js` + `@supabase/ssr`)
- **TypeScript**

Variables de entorno necesarias:
```env
NEXT_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...   # solo en servidor, NUNCA en cliente
```

---

## 1. Base de datos

### Tablas mínimas

#### `clients` — entidades del portal
```sql
create table if not exists clients (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);
alter table clients enable row level security;
-- Solo el service_role escribe; las políticas de lectura se definen por caso
create policy "service_role_all" on clients
  for all to service_role using (true) with check (true);
```

#### `profiles` — extensión de auth.users
```sql
create table if not exists profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  role       text not null default 'client',  -- admin | team | setter | client
  name       text,
  email      text,
  client_id  uuid references clients(id) on delete set null,
  created_at timestamptz not null default now()
);
alter table profiles enable row level security;

-- Cada usuario lee su propio perfil
create policy "profiles_self_read" on profiles
  for select using (auth.uid() = id);

-- Solo service_role escribe (creación/edición desde API admin)
create policy "profiles_service_write" on profiles
  for all to service_role using (true) with check (true);
```

> **Importante**: `profiles.client_id` apunta a `clients`, no a ninguna tabla externa de CRM.
> Si tenés un CRM separado, hay que hacer un bridge antes de crear el usuario (ver sección 5).

#### Trigger para crear profile automáticamente
```sql
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, role)
  values (
    new.id,
    new.email,
    coalesce(new.raw_app_meta_data->>'role', 'client')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
```

---

## 2. Roles y permisos (`lib/auth/permissions.ts`)

```ts
export type UserRole = "admin" | "team" | "setter" | "client" | string | null | undefined

// Rutas /admin permitidas por rol
export const TEAM_ALLOWED_ADMIN_PATHS = [
  "/admin/data",
  "/admin/leads",
  "/admin/setting",
  "/admin/applications",
  "/admin/centro-operativo",
] as const

export const SETTER_ALLOWED_ADMIN_PATHS = [
  "/admin/leads",
  "/admin/setting",
  "/admin/applications",
  "/admin/centro-operativo",
] as const

// Landing default por rol después del login
export const ADMIN_DEFAULT_LANDING  = "/admin/leads"
export const TEAM_DEFAULT_LANDING   = "/admin/leads"
export const SETTER_DEFAULT_LANDING = "/admin/setting"

export function normalizeRole(role: UserRole): "admin" | "team" | "setter" | "client" {
  const r = String(role ?? "").toLowerCase()
  if (r === "admin")  return "admin"
  if (r === "team")   return "team"
  if (r === "setter") return "setter"
  return "client"
}

export function isAdmin(role: UserRole):    boolean { return normalizeRole(role) === "admin" }
export function isTeam(role: UserRole):     boolean { return normalizeRole(role) === "team" }
export function isSetter(role: UserRole):   boolean { return normalizeRole(role) === "setter" }
export function isInternal(role: UserRole): boolean {
  const r = normalizeRole(role)
  return r === "admin" || r === "team" || r === "setter"
}

export function canAccessAdminPath(role: UserRole, path: string): boolean {
  if (isAdmin(role)) return true
  if (isTeam(role))
    return TEAM_ALLOWED_ADMIN_PATHS.some(a => path === a || path.startsWith(a + "/"))
  if (isSetter(role))
    return SETTER_ALLOWED_ADMIN_PATHS.some(a => path === a || path.startsWith(a + "/"))
  return false
}

export function getDefaultLandingForRole(role: UserRole): string {
  const r = normalizeRole(role)
  if (r === "admin")  return ADMIN_DEFAULT_LANDING
  if (r === "team")   return TEAM_DEFAULT_LANDING
  if (r === "setter") return SETTER_DEFAULT_LANDING
  return "/dashboard"   // cliente va al portal
}
```

**Adaptar** los paths y roles según las secciones de tu nuevo dashboard.

---

## 3. Clientes Supabase (`lib/supabase.ts` y `lib/supabase-service.ts`)

### Cliente browser (con sesión, respeta RLS)
```ts
// lib/supabase.ts
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export function createClient() {
  const url     = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  return createSupabaseClient(url, anonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storageKey: "sb-session",
    },
  })
}
```

### Cliente servidor (service role, bypasea RLS — solo en API routes)
```ts
// lib/supabase-service.ts
import { createClient } from "@supabase/supabase-js"

export function createServiceClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,  // NUNCA en el cliente
    { auth: { persistSession: false, autoRefreshToken: false } }
  )
}
```

> **Regla crítica**: `createServiceClient()` solo se llama en `app/api/` (Server Components o Route Handlers). Jamás en `"use client"`.

---

## 4. Guards de API (`lib/auth/api-guards.ts`)

Cada endpoint admin extrae el JWT del header y verifica el rol antes de operar:

```ts
// lib/auth/api-guards.ts
import { createServiceClient } from "@/lib/supabase-service"
import { isAdmin, isInternal } from "@/lib/auth/permissions"

async function getProfile(jwt: string | null) {
  if (!jwt) return null
  const supabase = createServiceClient()
  const { data: { user }, error } = await supabase.auth.getUser(jwt)
  if (error || !user) return null
  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle()
  return { user, role: (profile as any)?.role ?? null }
}

// Solo admin (datos sensibles)
export async function requireAdmin(jwt: string | null) {
  const ctx = await getProfile(jwt)
  if (!ctx || !isAdmin(ctx.role)) return null
  return ctx.user
}

// Admin OR team OR setter (datos internos no sensibles)
export async function requireInternal(jwt: string | null) {
  const ctx = await getProfile(jwt)
  if (!ctx || !isInternal(ctx.role)) return null
  return ctx.user
}
```

Uso en un Route Handler:
```ts
// app/api/admin/algo/route.ts
export async function GET(req: NextRequest) {
  const jwt = req.headers.get("authorization")?.replace("Bearer ", "") ?? ""
  const user = await requireAdmin(jwt)
  if (!user) return NextResponse.json({ error: "Forbidden" }, { status: 403 })
  // ... lógica segura
}
```

---

## 5. Creación de usuarios (`app/api/admin/users/create/route.ts`)

Flujo completo:

```
1. requireAdmin(jwt)         → solo admin puede crear usuarios
2. Validar email + rol
3. [Si role=client y client_id] → verificar que client_id exista en `clients`
   [Si solo existe en tabla externa (CRM)] → copiar el row a `clients` (bridge)
4. supabase.auth.admin.createUser({ email, password, email_confirm: true })
5. supabase.from("profiles").upsert({ id, role, name, client_id })
   [Si falla el profile] → deleteUser(id) para no dejar orfandad en auth
6. Devolver { user, tempPassword? }
```

Puntos clave:
- `email_confirm: true` para que el usuario pueda loguear sin verificar email
- Si no se provee password, se genera una temporal y se devuelve en la respuesta
- El bridge (paso 3) se corre **antes** de crear el auth user — si falla, no queda basura en `auth.users`
- Si `profiles` falla después de crear el user → rollback explícito con `deleteUser`

---

## 6. Login (`app/login/page.tsx`)

```ts
// Flujo básico
const { error } = await supabase.auth.signInWithPassword({ email, password })
if (error) { /* mostrar error */ return }

const { data } = await supabase.auth.getSession()
const { data: profile } = await supabase
  .from("profiles")
  .select("role")
  .eq("id", data.session.user.id)
  .maybeSingle()

router.replace(getDefaultLandingForRole(profile?.role))
```

---

## 7. View-As — impersonación UI (`lib/auth/view-as.ts`)

Permite que **admin** simule ver el dashboard como otro rol, **sin cambiar el JWT**.

```ts
// lib/auth/view-as.ts
"use client"
import { useSyncExternalStore } from "react"

const STORAGE_KEY = "miApp.viewAsRole"
const EVENT_NAME  = "miApp.viewAsRole.change"

export type ViewAsRole = "setter" | "client" | null

function readStorage(): ViewAsRole {
  if (typeof window === "undefined") return null
  const v = window.localStorage.getItem(STORAGE_KEY)
  if (v === "setter" || v === "client") return v
  return null
}

export function setViewAsRole(role: ViewAsRole) {
  if (typeof window === "undefined") return
  role
    ? window.localStorage.setItem(STORAGE_KEY, role)
    : window.localStorage.removeItem(STORAGE_KEY)
  window.dispatchEvent(new Event(EVENT_NAME))
}

export function useViewAsRole(): ViewAsRole {
  return useSyncExternalStore(
    (cb) => {
      window.addEventListener(EVENT_NAME, cb)
      window.addEventListener("storage", cb)
      return () => {
        window.removeEventListener(EVENT_NAME, cb)
        window.removeEventListener("storage", cb)
      }
    },
    readStorage,
    () => null,
  )
}

// Devuelve el rol efectivo: view-as si está activo, real si no
export function useEffectiveRole(actualRole: string | null): string | null {
  const viewAs = useViewAsRole()
  if (!viewAs) return actualRole
  if (String(actualRole ?? "").toLowerCase() !== "admin") return actualRole
  return viewAs
}
```

> **Limitación by design**: los fetches siguen yendo con el JWT real del admin.
> View-as afecta solo la UI (sidebar, rutas visibles, tabs). Para filtrar
> datos "como cliente X", pasar `?client_id=...` explícitamente al endpoint.

---

## 8. Protección de rutas (middleware o layout)

Verificar sesión y redirigir en el layout raíz:

```ts
// app/(portal)/layout.tsx o middleware.ts
"use client"
import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase"

export default function ProtectedLayout({ children }) {
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (!data.session) router.replace("/login")
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") router.replace("/login")
    })
    return () => subscription.unsubscribe()
  }, [])

  return <>{children}</>
}
```

Para proteger rutas admin, verificar el rol después de cargar el perfil:
```ts
if (!isInternal(role)) router.replace("/dashboard")
```

---

## 9. Flujo completo resumido

```
Usuario ingresa email/password
        │
        ▼
supabase.auth.signInWithPassword()
        │ JWT generado
        ▼
profiles.role leído
        │
        ├── admin  ──► /admin/leads   (acceso total)
        ├── team   ──► /admin/leads   (sin gestión de usuarios)
        ├── setter ──► /admin/setting (solo su sección)
        └── client ──► /dashboard    (solo su portal)
                │
                ▼
     En cada request de API:
     Authorization: Bearer <JWT>
                │
                ▼
     requireAdmin() / requireInternal()
     verifica JWT → lee profiles.role → permite o 403
                │
                ▼
     Supabase RLS también filtra en DB
     (segunda capa independiente del servidor Next.js)
```

---

## 10. Checklist de replicación

- [ ] Crear tablas `clients` y `profiles` con RLS habilitado
- [ ] Agregar trigger `on_auth_user_created` para auto-crear profiles
- [ ] Copiar `lib/supabase.ts` y `lib/supabase-service.ts` con las env vars correctas
- [ ] Copiar `lib/auth/permissions.ts` y adaptar roles, paths y landings
- [ ] Copiar `lib/auth/api-guards.ts` (sin cambios si los roles son iguales)
- [ ] Crear `app/api/admin/users/create/route.ts` (adaptar bridge si tenés CRM externo)
- [ ] Copiar `lib/auth/view-as.ts` y cambiar `STORAGE_KEY` y `EVENT_NAME` al nombre de la app
- [ ] Agregar verificación de sesión en el layout raíz
- [ ] Agregar `.env.local` con las tres variables de Supabase
- [ ] Verificar que `SUPABASE_SERVICE_ROLE_KEY` **nunca** llegue al bundle del cliente

---

## Gotchas conocidos

| Problema | Causa | Solución |
|---|---|---|
| FK falla al crear usuario client | `client_id` no existe en `clients` | Bridge: copiar row desde tabla externa antes de `createUser` |
| Profile falla, user queda huérfano | Error en upsert de profiles | Rollback explícito: `supabase.auth.admin.deleteUser(userId)` |
| `client_id NOT NULL` en profiles | Constraint viejo en la tabla | `ALTER TABLE profiles ALTER COLUMN client_id DROP NOT NULL` |
| View-as no filtra datos | By design — JWT no cambia | Pasar `?client_id=...` al endpoint explícitamente |
| `SUPABASE_SERVICE_ROLE_KEY` expuesta | Usada en componente cliente | Solo usar en `app/api/` o Server Components |
