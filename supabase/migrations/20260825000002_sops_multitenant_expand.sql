-- Sector interno multi-tenant — Fase 0.5: sops.
-- EXPAND (paso 1 de 2, expand/contract). Seguro con `main` corriendo sin
-- cambios: solo agrega columna + backfill + índice. NO toca las policies
-- existentes (internal_read_sops / admin_insert_sops / admin_update_sops /
-- admin_delete_sops) — esas se reemplazan recién en el CONTRACT
-- (20260825000004), después del deploy del código de esta rama. Tocarlas
-- ahora rompería la escritura de SOPs para el código de `main`, que no
-- setea client_id en el insert.
--
-- `sops` es un tab DENTRO de Centro Operativo, que se asumía ya aislado
-- (comparte pantalla con centro_op_pages, que sí lo está). No lo estaba:
-- cero columna de tenant. Mismo patrón que leads_multitenant.sql /
-- applications_multitenant_expand.sql.

alter table public.sops add column if not exists client_id uuid references public.clients(id);

update public.sops
set client_id = (select id from public.clients where is_internal_workspace = true)
where client_id is null;

create index if not exists sops_client_id_idx on public.sops (client_id);
