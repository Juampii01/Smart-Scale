-- Comentarios de las tareas del Kanban (Fase 2)
CREATE TABLE IF NOT EXISTS kanban_comments (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  task_id    uuid NOT NULL REFERENCES kanban_tasks(id) ON DELETE CASCADE,
  author     text NOT NULL,                 -- nombre del autor (Juampi/Fabri/Ann)
  author_id  text,                          -- email/uuid de quien comentó
  body       text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_kanban_comments_task ON kanban_comments (task_id, created_at);

ALTER TABLE kanban_comments ENABLE ROW LEVEL SECURITY;
-- Lectura/escritura va por el service client (API con requireInternal).
CREATE POLICY "kanban_comments_block_direct" ON kanban_comments FOR SELECT USING (false);

-- Realtime para ver comentarios nuevos en vivo dentro del drawer
ALTER PUBLICATION supabase_realtime ADD TABLE kanban_comments;
