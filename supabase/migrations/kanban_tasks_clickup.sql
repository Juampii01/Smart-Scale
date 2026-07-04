-- Rediseño Kanban estilo ClickUp — Fase 1
-- Subtareas (checklist), estado bloqueada, múltiples asignados.

ALTER TABLE kanban_tasks ADD COLUMN IF NOT EXISTS subtasks  jsonb   NOT NULL DEFAULT '[]'::jsonb;  -- [{ text, done }]
ALTER TABLE kanban_tasks ADD COLUMN IF NOT EXISTS blocked   boolean NOT NULL DEFAULT false;
ALTER TABLE kanban_tasks ADD COLUMN IF NOT EXISTS assignees text[]  NOT NULL DEFAULT '{}';

-- Migrar el asignado único existente al array de asignados
UPDATE kanban_tasks
SET assignees = ARRAY[assigned_to]
WHERE assigned_to IS NOT NULL AND assigned_to <> '' AND (assignees = '{}' OR assignees IS NULL);
