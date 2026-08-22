-- Las multiple_choice de POSI ya traían `correct_index` en el jsonb (seed
-- original), pero nunca se usaba para nada. Ahora se califica: al enviar,
-- se guarda si aprobó (100% de las preguntas con correct_index definido)
-- y cuáles falló — esto último solo lo ve el panel admin, nunca el cliente
-- (pedido explícito: no revelarle qué respondió mal, solo aprobó/no aprobó).

alter table public.client_posi_submissions
  add column if not exists passed boolean,
  add column if not exists wrong_question_ids jsonb not null default '[]'::jsonb;
