-- Habilitar Realtime para kanban_tasks: el tablero se sincroniza en vivo
-- entre los miembros del equipo (Juampi, Fabri, Ann) sin recargar.
ALTER PUBLICATION supabase_realtime ADD TABLE kanban_tasks;
