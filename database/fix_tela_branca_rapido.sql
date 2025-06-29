-- FIX RÁPIDO: RECRIAR PERFIL DO USUÁRIO

-- 1. Garantir que tabela existe
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  full_name VARCHAR(255),
  avatar_url TEXT,
  hospital_access TEXT[] DEFAULT '{}',
  permissions TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 2. Desabilitar RLS
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- 3. Permissões
GRANT ALL ON TABLE user_profiles TO anon;
GRANT ALL ON TABLE user_profiles TO authenticated;

-- 4. Recriar perfil do usuário atual
INSERT INTO user_profiles (id, email, role, full_name, permissions, hospital_access) 
VALUES ('32568fe0-b744-4a15-97a4-b54ed0b0610e', 'admin@sigtap.com', 'developer', 'Admin Principal', '{all}', '{}')
ON CONFLICT (id) DO UPDATE SET
    email = 'admin@sigtap.com',
    role = 'developer',
    permissions = '{all}';

-- 5. Verificar
SELECT 'PERFIL CRIADO!' as status, email, role, full_name 
FROM user_profiles 
WHERE id = '32568fe0-b744-4a15-97a4-b54ed0b0610e'; 