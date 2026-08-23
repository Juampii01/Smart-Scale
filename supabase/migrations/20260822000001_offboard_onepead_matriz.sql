-- OnePead y Matriz Inner Dos no son clientes reales (confirmado por Juampi) —
-- se marcan inactivos. Mismo criterio que Rodri (20260813000001): no se
-- borra nada, solo se ajusta profiles.active para que dejen de aparecer
-- como clientes activos en el resto de la app.

update public.profiles
set active = false
where id in (
  '2ec724c2-7d1b-4e5f-a913-4daac86cafdd', -- Matriz Inner Dos
  '1ff79c1c-343b-474e-8b7d-d03c1d845b4d'  -- OnePead
);
