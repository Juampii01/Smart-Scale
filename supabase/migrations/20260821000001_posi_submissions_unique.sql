-- Restaura el constraint UNIQUE (client_id, level_id) de client_posi_submissions.
--
-- Síntoma: al enviar un formulario POSI el cliente recibe
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- Causa: app/api/posi/submissions/route.ts hace
--   .upsert({...}, { onConflict: "client_id,level_id" })
-- que Postgres traduce a INSERT ... ON CONFLICT (client_id, level_id) DO UPDATE.
-- Eso exige un UNIQUE sobre esas dos columnas. Las dos migraciones que crearon
-- la tabla (20260803000004 y 20260812000001) lo declaran, pero en la base real
-- la tabla quedó SOLO con la PK y las dos FKs — la migración de agosto se
-- aplicó parcial (los posi_levels sí se recrearon, la tabla de submissions no).
--
-- Confirmado el 2026-08-21 con:
--   select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conrelid = 'public.client_posi_submissions'::regclass;
--   -> solo _pkey, _client_id_fkey, _level_id_fkey.

-- ── 1. Deduplicar ────────────────────────────────────────────────────────────
-- Sin el UNIQUE, cada reenvío insertó una fila nueva en vez de pisar la
-- anterior, así que puede haber repetidos. Se conserva la submission MÁS
-- RECIENTE de cada (client_id, level_id) y se descartan las viejas — que es el
-- estado que habría dejado el upsert si el constraint hubiera existido.
-- Si no hay duplicados, este delete no toca ninguna fila.
delete from public.client_posi_submissions a
using public.client_posi_submissions b
where a.client_id = b.client_id
  and a.level_id  = b.level_id
  and (a.submitted_at < b.submitted_at
       or (a.submitted_at = b.submitted_at and a.id < b.id));

-- ── 2. Agregar el constraint si falta ────────────────────────────────────────
-- Idempotente: busca cualquier UNIQUE que cubra exactamente esas dos columnas,
-- sin depender del nombre ni del orden en que fueron declaradas.
do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conrelid = 'public.client_posi_submissions'::regclass
      and contype  = 'u'
      and array_length(conkey, 1) = 2
      and conkey @> array[
        (select attnum from pg_attribute
          where attrelid = 'public.client_posi_submissions'::regclass and attname = 'client_id'),
        (select attnum from pg_attribute
          where attrelid = 'public.client_posi_submissions'::regclass and attname = 'level_id')
      ]::smallint[]
  ) then
    alter table public.client_posi_submissions
      add constraint client_posi_submissions_client_id_level_id_key
      unique (client_id, level_id);
  end if;
end $$;

-- El índice de la migración original también puede haberse perdido.
create index if not exists client_posi_submissions_client_id_idx
  on public.client_posi_submissions(client_id);

notify pgrst, 'reload schema';
