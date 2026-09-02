-- Auto-aprobado al 3er intento fallido: si un cliente reprueba el mismo
-- nivel de POSI 3 veces (passed = false — los intentos con passed = null,
-- niveles sin preguntas calificables, no cuentan), el portal lo da por
-- aprobado igual y le muestra en pantalla qué preguntas erró. Pedido
-- explícito de Ann: después del 3er fallo, el cliente no debe quedar
-- trabado esperando una respuesta perfecta.
--
-- `passed` NO se toca acá ni en el código: sigue siendo la nota real (en
-- el 3er intento fallido queda en false). El "aprobado" lo da
-- `auto_approved = true` — son cosas distintas a propósito: el historial
-- de /admin/posi tiene que seguir mostrando la verdad de qué contestó el
-- cliente, y Ann necesita poder distinguir "aprobó de verdad" de "se lo
-- dimos por regla". Ver POSI_MAX_FAILED_ATTEMPTS en lib/posi.ts — única
-- fuente del número 3, no hardcodear en ningún otro lado.

alter table public.client_posi_submissions
  add column if not exists attempt_number integer,
  add column if not exists auto_approved  boolean not null default false;

notify pgrst, 'reload schema';
