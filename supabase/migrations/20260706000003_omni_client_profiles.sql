-- Perfil de contexto por negocio para el motor de feedback de Omni — las 3
-- capas (principios, vocabulario, casos de referencia) que definen el
-- criterio con el que Omni genera feedback, aisladas por client_id.
--
-- Hoy hay un solo negocio real (Ann) — client_id es text, no uuid, porque
-- todavía no existe una tabla de "tenants" y no queremos inventar una FK a
-- algo que no está. Si en el futuro esto sirve a más de un negocio, se
-- puede migrar a uuid + FK real sin cambiar la forma de esta tabla.
create table if not exists public.omni_client_profiles (
  client_id         text primary key,
  business_name     text not null,
  mentor_name       text not null,
  -- array de strings, cada uno una regla concreta ("no dar precio sin las 3
  -- preguntas de diagnóstico")
  principios        jsonb not null default '[]'::jsonb,
  -- objeto libre: glosario / guía de estilo / marcos conceptuales propios
  vocabulario       jsonb not null default '{}'::jsonb,
  -- array de objetos {situacion, resultado, leccion} — precedentes reales
  casos_referencia  jsonb not null default '[]'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

drop trigger if exists omni_client_profiles_set_updated_at on public.omni_client_profiles;
create trigger omni_client_profiles_set_updated_at
  before update on public.omni_client_profiles
  for each row execute function public.set_updated_at();

-- RLS: mismo patrón que el resto de las tablas de Omni — solo service_role
-- (todas las rutas de Omni pasan por requireOmniOwner + createServiceClient,
-- nunca por el cliente browser).
alter table public.omni_client_profiles enable row level security;

drop policy if exists "service_role_all" on public.omni_client_profiles;
create policy "service_role_all" on public.omni_client_profiles
  for all to service_role using (true) with check (true);

notify pgrst, 'reload schema';
