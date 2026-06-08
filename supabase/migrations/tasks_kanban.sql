-- Tablero Kanban del equipo interno. Tabla separada de la legacy `tasks`.
CREATE TABLE IF NOT EXISTS kanban_tasks (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  title       text NOT NULL,
  description text NOT NULL DEFAULT '',
  due_date    date,
  label_text  text NOT NULL DEFAULT '',
  label_color text NOT NULL DEFAULT '',
  column_id   text NOT NULL DEFAULT 'por-hacer',
  assigned_to text,
  created_by  text,
  "order"     int NOT NULL DEFAULT 0,
  created_at  timestamptz DEFAULT now() NOT NULL,
  updated_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kanban_tasks_column_order ON kanban_tasks (column_id, "order");
ALTER TABLE kanban_tasks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kanban_tasks_internal_select" ON kanban_tasks FOR SELECT USING (false);
