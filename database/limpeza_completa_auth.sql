-- ================================================
-- LIMPEZA COMPLETA: AUTH + USER_PROFILES
-- ================================================
-- ⚠️ ATENÇÃO: Este script remove TODOS os usuários
-- Tanto da tabela user_profiles quanto do sistema de autenticação
-- Use apenas se necessário uma limpeza total

-- PASSO 1: Mostrar usuários antes da limpeza
SELECT 
    'ANTES DA LIMPEZA' as status,
    'auth.users' as tabela,
    COUNT(*) as total
FROM auth.users

UNION ALL

SELECT 
    'ANTES DA LIMPEZA' as status,
    'user_profiles' as tabela,
    COUNT(*) as total
FROM user_profiles;

-- PASSO 2: Limpar user_profiles primeiro
DELETE FROM user_profiles;

-- PASSO 3: Limpar auth.users (sistema de autenticação)
-- ⚠️ CUIDADO: Isso remove todos os usuários do Auth
DELETE FROM auth.users;

-- PASSO 4: Verificar limpeza
SELECT 
    'APÓS LIMPEZA' as status,
    'auth.users' as tabela,
    COUNT(*) as total
FROM auth.users

UNION ALL

SELECT 
    'APÓS LIMPEZA' as status,
    'user_profiles' as tabela,
    COUNT(*) as total
FROM user_profiles;

-- RESULTADO
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧹 LIMPEZA COMPLETA REALIZADA!';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'TODOS os usuários foram removidos de:';
    RAISE NOTICE '- auth.users (sistema de autenticação)';
    RAISE NOTICE '- user_profiles (perfis de usuário)';
    RAISE NOTICE '';
    RAISE NOTICE 'PRÓXIMOS PASSOS:';
    RAISE NOTICE '1. Execute o script: setup_usuario_unico_developer.sql';
    RAISE NOTICE '2. Cadastre o usuário developer@sigtap.com no sistema';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '';
END $$; 