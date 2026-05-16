# Roadmap — Próximas Integraciones

Documento de planificación técnica. Para cada objetivo: qué ya existe, qué hay que construir, y el orden sugerido.

---

## 1. Onboarding Automático End-to-End

### Flujo objetivo
```
Cliente paga (Stripe link)
    │
    ▼
Llena formulario en el dashboard
    │
    ├──► GoHighLevel → genera contrato
    │
    ├──► /api/admin/users/create → crea cuenta del dashboard
    │         con email, nombre, cliente ID
    │
    └──► Zapier webhook → invita a Slack + Skool
              │
              ▼
         Admin crea canal privado en Slack (actualmente manual)
              │
              ▼
         Mensaje de bienvenida (actualmente manual)
              │
              ▼
         Cliente ingresa al dashboard
```

### Estado actual

| Pieza | Estado | Dónde |
|---|---|---|
| Formulario de aplicación cliente | ✅ Existe | `/apply`, `/aplicar-equipo/[rol]` |
| Creación de cuenta dashboard | ✅ Existe | `POST /api/admin/users/create` |
| Zapier webhooks | ✅ Existe (parcial) | `lib/zapier.ts` — solo para reports/ventas |
| Slack notifications (Block Kit) | ✅ Existe | `lib/slack.ts` |
| Stripe | ❌ No existe | — |
| GoHighLevel integration | ❌ No existe | — |
| Zapier → Skool invite | ❌ No existe | — |
| Zapier → Slack invite automático | ❌ No existe | — |
| Canal privado Slack automático | ❌ No existe | — |

### Qué hay que construir

#### A. Webhook receptor de Stripe (`/api/webhooks/stripe`)
```
POST /api/webhooks/stripe
  - Verificar firma Stripe (stripe.webhooks.constructEvent)
  - Evento: checkout.session.completed
  - Extraer: customer_email, metadata.client_name, metadata.plan
  - Disparar el resto del flujo
```

#### B. Formulario de onboarding en el dashboard
- Página nueva: `/admin/onboarding/new` (solo admin/team)
- Campos: nombre, email, Instagram, teléfono, plan, fecha de inicio
- Al submit → llama a GoHighLevel API (crear contacto + enviar contrato)

#### C. GoHighLevel API (`lib/go-high-level.ts`)
```ts
// Crear contacto + disparar workflow de contrato
export async function ghlCreateContact(data: {
  email: string
  name: string
  phone?: string
  tags?: string[]
}) { ... }

export async function ghlTriggerWorkflow(contactId: string, workflowId: string) { ... }
```
Requiere: `GHL_API_KEY` y `GHL_LOCATION_ID` en `.env.local`.

#### D. Zapier webhook para onboarding (`lib/zapier.ts` — extender)
```ts
export async function zapierOnboardingCompleted(payload: {
  client_email: string
  client_name: string
  slack_email: string   // para la invitación
  skool_email: string
}) { ... }
```
Zap configurado con dos acciones:
1. Invitación a workspace de Slack
2. Invitación a comunidad de Skool

#### E. Canal privado Slack (fase 2 — automatizado)
Requiere Slack OAuth con scopes `channels:manage` + `im:write`.
Hoy: manual. Automatizar cuando el volumen lo justifique.

### Orden de implementación sugerido
1. Formulario de onboarding en dashboard (B) — no tiene dependencias
2. GoHighLevel integration (C) — depende de B
3. Webhook Stripe (A) — dispara el flujo completo
4. Zapier → Slack + Skool (D) — se conecta al webhook de Stripe
5. Canal Slack automático (E) — phase 2

---

## 2. CRM de Datos + Métricas de Setter

### 2a. Inbound / Outbound en EOD del Setter

#### Estado actual
El formulario `EodFormDialog` tiene estos campos:
- `new_conversations`, `conversations_replied`, `qualified_leads`
- `offer_docs_sent`, `offer_doc_responses`, `calls_done`

**Falta**: distinción inbound vs outbound en las conversaciones.

#### Cambios a hacer

**SQL** — agregar columnas a la tabla `setter_eod_logs` (o como se llame):
```sql
alter table setter_eod_logs
  add column if not exists new_conversations_inbound  int not null default 0,
  add column if not exists new_conversations_outbound int not null default 0;
  
-- Deprecar new_conversations (o mantener como suma para backward compat)
```

**`eod-form-dialog.tsx`** — reemplazar `new_conversations` por dos campos:
```
Conversaciones nuevas INBOUND  → leads que te escribieron primero
Conversaciones nuevas OUTBOUND → leads que vos iniciaste
```

**Dashboard de setter** — mostrar ratio inbound/outbound como métrica de calidad de prospección.

### 2b. MRR y Porcentaje del Setter en Onboarding

#### Estado actual
- `crm_clients` tiene `installment_amount` y `num_installments`
- No hay cálculo de MRR total ni comisión del setter

#### Qué hay que construir

**SQL** — tabla de asignación setter → cliente:
```sql
alter table crm_clients
  add column if not exists setter_id   uuid references profiles(id) on delete set null,
  add column if not exists commission_pct numeric(5,2) not null default 0;
  -- % de comisión del setter sobre este cliente
```

**Vista calculada** (o query):
```sql
-- MRR por setter
select
  p.name as setter_name,
  count(c.id) as active_clients,
  sum(c.installment_amount) as mrr_generated,
  sum(c.installment_amount * c.commission_pct / 100) as commission_due
from crm_clients c
join profiles p on p.id = c.setter_id
where c.status = 'activo'
group by p.id, p.name;
```

**Panel nuevo** en `/admin/data` o `/admin/setting`:
- MRR total generado por setter
- Comisión pendiente / pagada
- Ratio conversiones / conversaciones (EOD data)

---

## 3. Playbook Template General — Visibilidad por Admin

### Estado actual
- `client_playbook_main` → un documento único por cliente (BlockNote)
- El cliente puede verlo y solo tildar checkboxes (validación server-side)
- `client_playbook_pages` → páginas tipo Notion, el admin edita y el cliente también
- **No hay control de cuándo el cliente puede verlo** — el playbook aparece apenas existe el row en DB

### Objetivo
- Alberto tiene un template base → se copia para cada cliente nuevo
- Admin "aprieta un botón" para revelarle el playbook al cliente
- Hasta que no se revele, el cliente no lo ve (aunque esté cargado en DB)

### Cambios a hacer

#### A. Campo `visible_to_client` en `client_playbook_main`
```sql
alter table client_playbook_main
  add column if not exists visible_to_client boolean not null default false,
  add column if not exists revealed_at       timestamptz;
```

**RLS actualizada**:
```sql
-- Cliente solo puede SELECT si visible_to_client = true
drop policy if exists "playbook_main_client_select" on client_playbook_main;
create policy "playbook_main_client_select" on client_playbook_main
  for select using (
    exists (
      select 1 from profiles p where p.id = auth.uid() and (
        lower(p.role) in ('admin','team')
        or (lower(p.role) = 'client' and p.client_id = client_playbook_main.client_id
            and client_playbook_main.visible_to_client = true)
      )
    )
  );
```

#### B. Botón "Revelar Playbook" en la vista admin del cliente
```tsx
// En el panel admin del cliente
<Button onClick={revealPlaybook}>
  Revelar playbook al cliente
</Button>
// PATCH /api/client-playbook-main → { visible_to_client: true }
```

#### C. Template base de Alberto
- Opción A: guardarlo como `is_template = true` en `client_playbook_main`
  ```sql
  alter table client_playbook_main
    add column if not exists is_template boolean not null default false;
  ```
  Al crear un cliente nuevo → copiar el contenido del template.
  
- Opción B: hardcodearlo en `lib/playbook-template.ts` (más simple, menos flexible)

**Recomendación**: Opción A — Alberto puede editar el template desde el propio editor sin tocar código.

#### D. Vista del cliente cuando no está revelado
```tsx
// client-playbook-view.tsx
if (!playbook) return (
  <div>
    <LockIcon />
    <p>Tu playbook se activará pronto.</p>
  </div>
)
```

---

## 4. (Pendiente)

*Punto 4 quedó incompleto en la descripción original. Completar cuando esté definido.*

---

## Priorización sugerida

| Prioridad | Objetivo | Complejidad | Impacto |
|---|---|---|---|
| 🔴 Alta | **3** — Playbook con visibilidad | Baja-Media | Alto — todos los clientes actuales |
| 🔴 Alta | **2a** — EOD inbound/outbound | Baja | Medio — data real del setter |
| 🟡 Media | **2b** — MRR + comisión setter | Media | Alto — control financiero |
| 🟡 Media | **1B+C** — Form onboarding + GHL | Media | Alto — onboarding más rápido |
| 🟢 Baja | **1A** — Stripe webhook | Alta | Alto — requiere Stripe setup |
| 🟢 Baja | **1D+E** — Zapier Slack/Skool auto | Media | Medio — ya funciona manual |

### Por dónde empezar

1. **Playbook visible_to_client** → dos líneas de SQL + un botón → máximo impacto con mínimo esfuerzo
2. **EOD inbound/outbound** → SQL migration + cambiar el form → mejora la data existente
3. **Onboarding form + GHL** → el bloque más grande, dividirlo en PRs chicos

---

## Env vars necesarias (a agregar)

```env
# GoHighLevel
GHL_API_KEY=
GHL_LOCATION_ID=
GHL_ONBOARDING_WORKFLOW_ID=

# Stripe
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=

# Zapier (ya existen dos, agregar para onboarding)
ZAPIER_WEBHOOK_ONBOARDING=
```
