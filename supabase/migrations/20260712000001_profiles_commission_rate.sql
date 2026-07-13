-- Tasa de comisión configurable por setter. Antes era un 5% fijo hardcodeado
-- para todos en app/api/admin/setting/commissions/route.ts — ningún setter
-- podía tener una tasa distinta (ej: Steffano Leiva, que cobra 10%).
-- NULL = usa el default de 5% en código (no forzamos un default acá para no
-- tener que migrar de nuevo si el default global cambia).
alter table public.profiles
  add column if not exists commission_rate numeric(5,2);

comment on column public.profiles.commission_rate is
  'Porcentaje de comisión de este setter (ej: 5.00 = 5%). NULL = usar el default de la app.';
