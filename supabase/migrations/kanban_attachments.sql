-- Adjuntos de las tareas del Kanban (Fase 3)
CREATE TABLE IF NOT EXISTS kanban_attachments (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id     uuid NOT NULL REFERENCES kanban_tasks(id) ON DELETE CASCADE,
  file_name   text NOT NULL,
  file_path   text NOT NULL,            -- ruta dentro del bucket
  size_bytes  integer,
  uploaded_by text,
  created_at  timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kanban_attachments_task ON kanban_attachments (task_id, created_at);

ALTER TABLE kanban_attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "kanban_attachments_block_direct" ON kanban_attachments FOR SELECT USING (false);

ALTER PUBLICATION supabase_realtime ADD TABLE kanban_attachments;

-- Bucket privado para los archivos (se acceden vía signed URLs)
INSERT INTO storage.buckets (id, name, public)
VALUES ('kanban-attachments', 'kanban-attachments', false)
ON CONFLICT (id) DO NOTHING;
