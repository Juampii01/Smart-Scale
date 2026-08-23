-- Vuelve a sacar el constraint UNIQUE (client_id, level_id) de
-- client_posi_submissions, agregado por 20260821000001_posi_submissions_unique.sql.
--
-- Contexto: esa migración vino de una rama paralela que hacía
-- .upsert({...}, {onConflict: "client_id,level_id"}) — un solo intento por
-- nivel, se pisaba el anterior. Decisión final del negocio (explícita):
-- "reintentar sin límite, haya aprobado o no" — cada envío de un nivel POSI
-- tiene que quedar como fila propia en el historial (insert, no upsert),
-- sin tope de intentos. Con el constraint puesto, el segundo intento real
-- de cualquier cliente tira 500 ("duplicate key value violates unique
-- constraint") — riesgo activo en producción hasta aplicar esto.
--
-- No hace falta deduplicar de nuevo (la migración anterior ya lo hizo antes
-- de agregar el constraint) ni tocar la tabla de respaldo
-- client_posi_submissions_backup_20260821 — se deja como está.

alter table public.client_posi_submissions
  drop constraint if exists client_posi_submissions_client_id_level_id_key;

notify pgrst, 'reload schema';
