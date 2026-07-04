-- Foto de perfil del usuario
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS avatar_url text;

-- Bucket privado para avatares (se sirven vía signed URL)
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', false)
ON CONFLICT (id) DO NOTHING;
