-- Perfil del negocio de cada cliente para personalizar Ann AI.
-- Campo de texto libre que admin completa: nicho, qué vende, avatar, contexto clave.
ALTER TABLE clients ADD COLUMN IF NOT EXISTS business_profile text;
