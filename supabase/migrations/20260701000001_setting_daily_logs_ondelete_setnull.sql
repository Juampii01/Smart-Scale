-- Fix: borrar un setter ya NO borra sus registros de CRM diario.
--
-- Problema: setting_daily_logs.setter_id referenciaba auth.users(id) con
-- ON DELETE CASCADE. Al borrar el usuario de un setter, Postgres borraba en
-- cascada TODOS sus registros diarios (así se perdió la data de Steffano).
--
-- Solución: ON DELETE SET NULL. Al borrar el usuario, los registros sobreviven
-- (los números diarios quedan), solo se desvincula el setter_id. La atribución
-- por nombre se puede reforzar después con una columna denormalizada si hace falta.

-- 1) setter_id debe poder ser NULL para que SET NULL funcione.
alter table public.setting_daily_logs
  alter column setter_id drop not null;

-- 2) Reemplazar la FK: CASCADE -> SET NULL.
alter table public.setting_daily_logs
  drop constraint if exists setting_daily_logs_setter_id_fkey;

alter table public.setting_daily_logs
  add constraint setting_daily_logs_setter_id_fkey
  foreign key (setter_id) references auth.users(id) on delete set null;
