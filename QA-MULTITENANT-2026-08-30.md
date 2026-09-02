# QA Multi-tenant — 2026-08-30/31

Registro de todos los UUID creados durante la verificación cruzada del panel
interno multi-tenant (branch `crm/multitenant-kit`), contra el proyecto de
Supabase de producción (`vpjoamvzfdfbprtpwllz`). Backup confirmado antes de
empezar: 31 Aug 2026 10:06:34 UTC.

**Estado (31 ago 2026, tarde): ya se limpió todo.** La regla original era
"nada de esto se borra — queda inerte y etiquetado" mientras durara la
verificación. Una vez confirmado B.2/B.3 y neutralizado el hallazgo de
`is_internal_staff()`, la card de `crm_clients` "ZZ QA Onboarding Client"
apareció en la vista real de Onboarding (`/admin/onboarding`) — visible para
cualquiera con acceso, no solo para QA. Juampi pidió limpiar todo el
dataset. Se borraron, en este orden (por las FK a `clients.id`): los 8
registros de prueba (`leads`/`applications`/`sops`/`crm_clients` listados
abajo), los 2 usuarios QA vía `auth.admin.deleteUser` (cascadeó `profiles`
sin dejar huérfanos, verificado), y por último el tenant `d7daf41f-…` ("ZZ
QA — NO TOCAR"). El tenant Smart Scale real (`c3ea3403-…`) no se tocó —
solo sus 4 filas de prueba dependientes. Verificado con un `select` sobre
los 14 IDs de abajo: cero filas restantes.

Esta tabla queda como registro histórico de lo que se creó y probó, no como
inventario de datos vivos.

## Tenants

| Rol en la prueba | `clients.id` | `name` | `is_internal_workspace` |
|---|---|---|---|
| Tenant QA aislado (creado para la prueba) | `d7daf41f-afa9-4459-8fba-4c2b557e97f3` | ZZ QA — NO TOCAR (multi-tenant 2026-08-30) | `false` |
| Tenant Smart Scale (preexistente, usado como control) | `c3ea3403-0b25-4770-81e9-fcd80f620095` | Smart Scale (Internal) | `true` |

## Usuarios QA (`profiles` / `auth.users`)

| Alias | `id` | email | `internal_tenant_id` | `role` actual |
|---|---|---|---|---|
| qa-a — admin del tenant QA aislado | `4710359c-060c-4ae2-aa3a-ffe3b8b43b2f` | `qa-a@qa.invalid` | `d7daf41f-afa9-4459-8fba-4c2b557e97f3` | `client` |
| qa-b — admin del tenant Smart Scale | `9a15345e-8d08-4f05-9914-79d45bd78fa9` | `qa-b@qa.invalid` | `c3ea3403-0b25-4770-81e9-fcd80f620095` | `client` |

**Nota:** ambos perfiles se crearon como `role='admin'` para la prueba. El
31 ago, durante la verificación manual, se detectó que `qa-a` (admin de un
tenant que NO es Smart Scale) podía leer datos de clientes reales vía las
funciones RLS `is_internal_staff()`/`is_financial_staff()`/`is_admin()`, que
no son tenant-aware. Como remediación de emergencia se bajaron ambos
perfiles a `role='client'` (neutralizados, no borrados). El fix de fondo a
esas tres funciones queda pendiente y fuera del alcance de este documento.

## Registros de prueba (8 en total — 4 por tenant)

### Tenant QA aislado (`d7daf41f-afa9-4459-8fba-4c2b557e97f3`)

| Tabla | `id` | Detalle |
|---|---|---|
| `leads` | `eefbb652-b2b5-4f8b-b70b-5d1d87bca527` | ZZ QA lead — `zz-qa-a-lead@qa.invalid` |
| `applications` | `6947e80c-3d15-4540-8098-9a0ac17b4810` | ZZ QA Application — `zz-qa-a-app@qa.invalid` |
| `sops` | `fe1214cb-036b-43b6-919d-c9f21b448e77` | ZZ QA sop (creado por `4710359c-…`) |
| `crm_clients` | `70ab52df-9f55-408f-88fa-be438315ea6f` | ZZ QA Onboarding Client — `zz-qa-a-onboard@qa.invalid` — `status: offboarding` |

### Tenant Smart Scale — control (`c3ea3403-0b25-4770-81e9-fcd80f620095`)

| Tabla | `id` | Detalle |
|---|---|---|
| `leads` | `fd9c5516-33be-4486-b366-73f8b49665e9` | ZZ QA lead — `zz-qa-b-lead@qa.invalid` |
| `applications` | `270a8fb2-961b-48ce-8aa8-c7a209a9a869` | ZZ QA Application — `zz-qa-b-app@qa.invalid` |
| `sops` | `2cb9b6c7-8b5f-4c14-aa8d-0cdfdc2259c0` | ZZ QA sop |
| `crm_clients` | `92ade864-0b13-417b-9378-a48fc4f97fc8` | ZZ QA Onboarding Client — `zz-qa-b-onboard@qa.invalid` — `status: offboarding` |

## Resultado de la verificación cruzada

Con el par de tenants de arriba se confirmó B.2/B.3: cada admin veía solo su
propio tenant en `applications`/`sops` después de la migración CONTRACT —
hasta el hallazgo de `is_internal_staff()` (ver nota de arriba), que afectaba
tablas fuera del scope de esta migración (`clients`, `monthly_reports`,
`profiles`, `monday_wins`, `cha_ching`, entre otras) y ya fue neutralizado
demoviendo ambos perfiles QA.
