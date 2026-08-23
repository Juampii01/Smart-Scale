-- Foto de perfil del lead (ManyChat manda profile_pic con la foto de
-- Instagram/Messenger del contacto vía webhooks/lead) — se muestra en el
-- panel de detalle de /admin/leads.

alter table public.leads add column if not exists avatar_url text;
