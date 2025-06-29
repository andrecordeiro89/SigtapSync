-- ================================================
-- FIX URGENTE: PERFIL PERDIDO - TELA BRANCA
-- ================================================

-- ETAPA 1: Verificar se tabela user_profiles ainda existe
SELECT 
    'TABELA USER_PROFILES' as categoria,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') 
        THEN '✅ EXISTE' 
        ELSE '❌ NÃO EXISTE' 
    END as status;

-- ETAPA 2: Verificar se o perfil do usuário atual existe
SELECT 
    'PERFIL DO USUÁRIO' as categoria,
    CASE 
        WHEN EXISTS (SELECT 1 FROM user_profiles WHERE id = '32568fe0-b744-4a15-97a4-b54ed0b0610e') 
        THEN '✅ EXISTE' 
        ELSE '❌ PERDIDO' 
    END as status;

-- ETAPA 3: Mostrar TODOS os perfis existentes
SELECT 
    'PERFIS EXISTENTES' as categoria,
    id,
    email,
    role,
    full_name
FROM user_profiles
ORDER BY created_at DESC;

-- ETAPA 4: Recriar tabela user_profiles se não existir
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

-- ETAPA 5: Garantir que RLS está desabilitado
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- ETAPA 6: Garantir permissões
GRANT ALL ON TABLE user_profiles TO anon;
GRANT ALL ON TABLE user_profiles TO authenticated;

-- ETAPA 7: Recriar perfil do usuário atual
INSERT INTO user_profiles (
    id, 
    email, 
    role, 
    full_name, 
    permissions, 
    hospital_access
) VALUES (
    '32568fe0-b744-4a15-97a4-b54ed0b0610e',
    'admin@sigtap.com',
    'developer',
    'Admin Principal',
    '{all}',
    '{}'
)
ON CONFLICT (id) DO UPDATE SET
    email = 'admin@sigtap.com',
    role = 'developer',
    full_name = 'Admin Principal',
    permissions = '{all}',
    hospital_access = '{}',
    updated_at = NOW();

-- ETAPA 8: Verificar se perfil foi criado/corrigido
SELECT 
    'PERFIL CORRIGIDO' as categoria,
    id,
    email,
    role,
    full_name,
    permissions
FROM user_profiles 
WHERE id = '32568fe0-b744-4a15-97a4-b54ed0b0610e';

-- ETAPA 9: Teste de busca (simulando o frontend)
DO $$
DECLARE
    profile_found RECORD;
BEGIN
    SELECT * INTO profile_found
    FROM user_profiles 
    WHERE id = '32568fe0-b744-4a15-97a4-b54ed0b0610e';
    
    IF FOUND THEN
        RAISE NOTICE '';
        RAISE NOTICE '✅ PERFIL ENCONTRADO E FUNCIONAL!';
        RAISE NOTICE 'Email: %', profile_found.email;
        RAISE NOTICE 'Role: %', profile_found.role;
        RAISE NOTICE 'Nome: %', profile_found.full_name;
        RAISE NOTICE '';
        RAISE NOTICE '🎉 SISTEMA DEVE CARREGAR NORMALMENTE AGORA!';
    ELSE
        RAISE NOTICE '❌ PERFIL AINDA NÃO FOI ENCONTRADO!';
    END IF;
    RAISE NOTICE '';
END $$; 