-- ================================================
-- DIAGNÓSTICO ESPECÍFICO: USUÁRIO 32568fe0-b744-4a15-97a4-b54ed0b0610e
-- ================================================

-- ETAPA 1: Verificar se tabela user_profiles existe e tem dados
SELECT 
    'TABELA USER_PROFILES' as categoria,
    COUNT(*) as total_usuarios,
    string_agg(role, ', ') as roles_cadastradas
FROM user_profiles;

-- ETAPA 2: Verificar especificamente seu usuário
SELECT 
    'SEU USUÁRIO ESPECÍFICO' as categoria,
    id,
    email,
    role,
    full_name,
    array_length(permissions, 1) as total_permissions,
    permissions
FROM user_profiles 
WHERE id = '32568fe0-b744-4a15-97a4-b54ed0b0610e';

-- ETAPA 3: Verificar TODOS os usuários na tabela
SELECT 
    'TODOS OS USUÁRIOS' as categoria,
    id,
    email,
    role,
    full_name,
    created_at
FROM user_profiles 
ORDER BY created_at;

-- ETAPA 4: Verificar se existe na tabela auth.users (Supabase Auth)
SELECT 
    'AUTH.USERS (SUPABASE)' as categoria,
    id,
    email,
    created_at as auth_created_at,
    last_sign_in_at,
    email_confirmed_at
FROM auth.users 
WHERE id = '32568fe0-b744-4a15-97a4-b54ed0b0610e';

-- ETAPA 5: Verificar discrepâncias entre auth.users e user_profiles
SELECT 
    'DISCREPÂNCIAS' as categoria,
    'Usuários em auth.users sem perfil' as tipo,
    COUNT(*) as total
FROM auth.users a
LEFT JOIN user_profiles p ON a.id = p.id
WHERE p.id IS NULL

UNION ALL

SELECT 
    'DISCREPÂNCIAS' as categoria,
    'Perfis sem usuário em auth' as tipo,
    COUNT(*) as total
FROM user_profiles p
LEFT JOIN auth.users a ON p.id = a.id
WHERE a.id IS NULL;

-- ETAPA 6: Status RLS da tabela user_profiles
SELECT 
    'STATUS RLS' as categoria,
    c.relname as tabela,
    c.relrowsecurity as rls_habilitado,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = c.relname) as politicas_ativas
FROM pg_class c
WHERE c.relname = 'user_profiles';

-- ETAPA 7: Teste de acesso direto
DO $$
DECLARE
    test_profile RECORD;
BEGIN
    -- Tentar buscar diretamente
    SELECT * INTO test_profile 
    FROM user_profiles 
    WHERE id = '32568fe0-b744-4a15-97a4-b54ed0b0610e';
    
    IF FOUND THEN
        RAISE NOTICE '✅ USUÁRIO ENCONTRADO DIRETAMENTE: % (%)', test_profile.full_name, test_profile.role;
    ELSE
        RAISE NOTICE '❌ USUÁRIO NÃO ENCONTRADO NA BUSCA DIRETA';
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ERRO AO BUSCAR USUÁRIO: %', SQLERRM;
END $$;

-- ETAPA 8: Listar EXATAMENTE os IDs na tabela (para comparar)
SELECT 
    'IDS EXATOS NA TABELA' as categoria,
    id,
    LENGTH(id::text) as tamanho_id,
    CASE 
        WHEN id::text = '32568fe0-b744-4a15-97a4-b54ed0b0610e' THEN '✅ MATCH EXATO'
        ELSE '❌ DIFERENTE'
    END as match_status
FROM user_profiles;

-- ETAPA 9: Verificar permissões específicas
SELECT 
    has_table_privilege('anon', 'user_profiles', 'SELECT') as anon_select,
    has_table_privilege('authenticated', 'user_profiles', 'SELECT') as auth_select,
    has_table_privilege('anon', 'user_profiles', 'INSERT') as anon_insert,
    has_table_privilege('authenticated', 'user_profiles', 'INSERT') as auth_insert; 