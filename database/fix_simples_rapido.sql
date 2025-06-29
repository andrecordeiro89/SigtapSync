-- ================================================
-- FIX SIMPLES E RÁPIDO: TELA BRANCA
-- ================================================

-- 1. Recriar tabela
DROP TABLE IF EXISTS user_profiles CASCADE;

CREATE TABLE user_profiles (
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

-- 4. Criar seu usuário (SEM arrays problemáticos)
INSERT INTO user_profiles (id, email, role, full_name) VALUES 
('32568fe0-b744-4a15-97a4-b54ed0b0610e', 'usuario.principal@sistema.com', 'developer', 'Usuário Principal');

-- 5. Atualizar permissões separadamente
UPDATE user_profiles 
SET permissions = '{all}', hospital_access = '{}'
WHERE id = '32568fe0-b744-4a15-97a4-b54ed0b0610e';

-- 6. Verificar
SELECT 'USUÁRIO CRIADO!' as status, id, email, role, full_name, permissions 
FROM user_profiles 
WHERE id = '32568fe0-b744-4a15-97a4-b54ed0b0610e'; 