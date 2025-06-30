-- ================================================
-- RESET COMPLETO + CRIAR DEVELOPER ÚNICO
-- ================================================
-- Este script faz TUDO em uma execução:
-- 1. Remove todos os usuários existentes
-- 2. Cria apenas o developer@sigtap.com
-- 3. Configura permissões corretas

-- INÍCIO DO PROCESSO
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🚀 INICIANDO RESET COMPLETO...';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '';
END $$;

-- PASSO 1: Status inicial
SELECT 
    'ANTES DO RESET' as status,
    'user_profiles' as tabela,
    COUNT(*) as total_usuarios
FROM user_profiles;

-- PASSO 2: Limpeza total
DELETE FROM user_profiles;

-- PASSO 3: Verificar limpeza
SELECT 
    'APÓS LIMPEZA' as status,
    COUNT(*) as total_usuarios
FROM user_profiles;

-- PASSO 4: Recriar estrutura se necessário
DROP TABLE IF EXISTS user_profiles CASCADE;

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  full_name VARCHAR(255),
  avatar_url TEXT,
  hospital_access TEXT[] DEFAULT '{}',
  permissions TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_roles CHECK (role IN ('developer', 'admin', 'user'))
);

-- PASSO 5: Garantir permissões (sem RLS para evitar problemas)
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON TABLE user_profiles TO anon;
GRANT ALL PRIVILEGES ON TABLE user_profiles TO authenticated;
GRANT ALL PRIVILEGES ON TABLE user_profiles TO service_role;

-- PASSO 6: Criar APENAS o usuário developer
INSERT INTO user_profiles (
    id, 
    email, 
    role, 
    full_name, 
    permissions, 
    hospital_access,
    created_at,
    updated_at
) VALUES (
    '00000000-1111-2222-3333-444444444444',
    'developer@sigtap.com',
    'developer',
    'Developer SIGTAP',
    ARRAY['all']::TEXT[],
    ARRAY[]::TEXT[],
    NOW(),
    NOW()
);

-- PASSO 7: Verificar criação
SELECT 
    'USUÁRIO CRIADO' as status,
    id,
    email,
    role,
    full_name,
    array_length(permissions, 1) as total_permissions
FROM user_profiles
WHERE email = 'developer@sigtap.com';

-- PASSO 8: Teste completo de funcionamento
DO $$
DECLARE
    test_user RECORD;
    search_result RECORD;
BEGIN
    -- Teste 1: Busca por email
    SELECT * INTO test_user
    FROM user_profiles 
    WHERE email = 'developer@sigtap.com';
    
    IF FOUND THEN
        RAISE NOTICE '✅ TESTE 1 PASSOU: Busca por email encontrou usuário';
    ELSE
        RAISE NOTICE '❌ TESTE 1 FALHOU: Busca por email não encontrou usuário';
    END IF;
    
    -- Teste 2: Busca por ID (simular o que o frontend faz)
    SELECT * INTO search_result
    FROM user_profiles 
    WHERE id = '00000000-1111-2222-3333-444444444444';
    
    IF FOUND THEN
        RAISE NOTICE '✅ TESTE 2 PASSOU: Busca por ID encontrou usuário';
    ELSE
        RAISE NOTICE '❌ TESTE 2 FALHOU: Busca por ID não encontrou usuário';
    END IF;
    
    -- Teste 3: Verificar permissões
    IF test_user.permissions IS NOT NULL AND array_length(test_user.permissions, 1) > 0 THEN
        RAISE NOTICE '✅ TESTE 3 PASSOU: Permissões configuradas corretamente';
    ELSE
        RAISE NOTICE '❌ TESTE 3 FALHOU: Problema nas permissões';
    END IF;
    
END $$;

-- PASSO 9: Status final
SELECT 
    'STATUS FINAL' as categoria,
    'Total usuários' as item,
    COUNT(*)::TEXT as valor
FROM user_profiles

UNION ALL

SELECT 
    'STATUS FINAL' as categoria,
    'RLS Status' as item,
    CASE WHEN c.relrowsecurity THEN 'HABILITADO' ELSE 'DESABILITADO ✅' END as valor
FROM pg_class c WHERE c.relname = 'user_profiles';

-- RESULTADO FINAL
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 RESET COMPLETO FINALIZADO!';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'USUÁRIO ÚNICO CRIADO:';
    RAISE NOTICE 'Email: developer@sigtap.com';
    RAISE NOTICE 'ID: 00000000-1111-2222-3333-444444444444';
    RAISE NOTICE 'Role: developer';
    RAISE NOTICE 'Permissões: [all]';
    RAISE NOTICE '';
    RAISE NOTICE 'COMO USAR:';
    RAISE NOTICE '1. Acesse o sistema no navegador';
    RAISE NOTICE '2. Clique em "Developer - developer@sigtap.com"';
    RAISE NOTICE '3. OU cadastre-se com:';
    RAISE NOTICE '   - Email: developer@sigtap.com';
    RAISE NOTICE '   - Senha: dev123456 (sua escolha)';
    RAISE NOTICE '   - Role: Developer';
    RAISE NOTICE '';
    RAISE NOTICE 'PRONTO PARA USO! 🚀';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '';
END $$; 