-- Reemplaza "Scale20" (nombre del programa de referencia, Tom Youngs) por
-- "Smart Scale" en el contenido de los formularios POSI — pedido explícito
-- del usuario, segunda pasada de la Fase 1 (traducción fiel primero,
-- adaptación de marca después, tal como se planteó desde el arranque).

update posi_levels
set intro = replace(intro, 'Scale20', 'Smart Scale')
where intro like '%Scale20%';

update posi_levels
set questions = replace(questions::text, 'Scale20™️', 'Smart Scale')::jsonb
where questions::text like '%Scale20%';

update posi_levels
set questions = replace(questions::text, 'Scale20', 'Smart Scale')::jsonb
where questions::text like '%Scale20%';

notify pgrst, 'reload schema';
