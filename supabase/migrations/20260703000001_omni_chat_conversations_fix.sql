-- Fix: la migración anterior (20260702000001) intentaba crear una tabla
-- `omni_conversations` para el chat, pero ese nombre ya estaba tomado por la
-- tabla de conversaciones de Instagram (creada en 20260701000003). Como el
-- CREATE TABLE usaba IF NOT EXISTS, no hizo nada — la tabla de Instagram
-- quedó intacta pero el chat nunca tuvo su tabla real.
--
-- Se crea con nombre propio, sin colisión. La tabla omni_conversations
-- (Instagram) no se toca.
create table if not exists public.omni_chat_conversations (
  id          uuid primary key default gen_random_uuid(),
  messages    jsonb not null default '[]'::jsonb,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.omni_chat_conversations enable row level security;
