-- Omni pasó de ser un chat reactivo a un dashboard proactivo de prospección
-- (métricas + riesgos por prospecto, ver lib/omni/prospecting-risk-analysis.ts).
-- Ya no hay chat conversacional, así que se elimina su tabla de memoria.
drop table if exists public.omni_chat_conversations;
