-- Nivel de urgencia de cada tarea del Kanban.
-- urgente | importante | con-tiempo (default)
ALTER TABLE kanban_tasks ADD COLUMN IF NOT EXISTS priority text NOT NULL DEFAULT 'con-tiempo';
