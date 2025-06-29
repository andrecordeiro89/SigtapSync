-- ================================================
-- FIX TELA BRANCA: CRIAR TABELA USER_PROFILES
-- ================================================

-- 1. Criar tabela user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  full_name VARCHAR(255),
  avatar_url TEXT,
  hospital_access TEXT[] DEFAULT '{}',
  permissions TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_roles CHECK (role IN ('developer', 'admin', 'user'))
);

-- 2. Desabilitar RLS (temporário)
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- 3. Dar permissões
GRANT ALL ON TABLE user_profiles TO anon;
GRANT ALL ON TABLE user_profiles TO authenticated;

-- 4. Criar perfil para seu usuário atual
INSERT INTO user_profiles (
    id, 
    email, 
    role, 
    full_name, 
    permissions
) VALUES (
    '32568fe0-b744-4a15-97a4-b54ed0b0610e',
    'usuario@demo.com',
    'developer',
    'Usuário Principal',
    ARRAY['all']
)
ON CONFLICT (id) DO UPDATE SET
    role = 'developer',
    permissions = ARRAY['all'];

-- 5. Verificar
SELECT 'SUCESSO' as status, COUNT(*) as perfis FROM user_profiles; 