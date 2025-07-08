-- ============================================================================
-- SCRIPT DE TESTES COMPLETOS - SISTEMA DE PERMISSÕES RLS
-- Sistema: SIGTAP Billing Wizard v3.0
-- ============================================================================

-- NOTA: Execute este script após aplicar fix_user_profiles_permissions.sql

SET search_path TO public, auth;

-- 1. VERIFICAR ESTRUTURA DA TABELA USER_PROFILES
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 TESTE 1: VERIFICANDO ESTRUTURA DA TABELA USER_PROFILES';
    RAISE NOTICE '================================================================';
END $$;

-- Verificar colunas existentes
SELECT 
    'Coluna: ' || column_name || ' | Tipo: ' || data_type || 
    CASE 
        WHEN is_nullable = 'YES' THEN ' | Aceita NULL'
        ELSE ' | NOT NULL'
    END as estrutura
FROM information_schema.columns 
WHERE table_name = 'user_profiles' 
ORDER BY ordinal_position;

-- Verificar constraint de roles
SELECT 
    'Constraint: ' || conname || ' | Definição: ' || pg_get_constraintdef(oid) as constraints
FROM pg_constraint 
WHERE conrelid = 'user_profiles'::regclass 
AND contype = 'c';

-- 2. VERIFICAR FUNÇÕES RLS CRIADAS
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔧 TESTE 2: VERIFICANDO FUNÇÕES RLS';
    RAISE NOTICE '================================';
END $$;

-- Verificar se funções existem
SELECT 
    'Função: ' || proname || ' | Retorna: ' || pg_get_function_result(oid) as funcoes
FROM pg_proc 
WHERE proname IN ('has_full_access_role', 'is_basic_user')
ORDER BY proname;

-- 3. VERIFICAR POLÍTICAS RLS CRIADAS
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔒 TESTE 3: VERIFICANDO POLÍTICAS RLS';
    RAISE NOTICE '===================================';
END $$;

-- Listar todas as políticas por tabela
SELECT 
    tablename,
    policyname,
    cmd,
    CASE 
        WHEN qual IS NOT NULL THEN 'COM FILTRO'
        ELSE 'SEM FILTRO'
    END as tem_filtro
FROM pg_policies 
WHERE tablename IN ('user_profiles', 'hospitals', 'patients', 'aihs', 'procedure_records', 'aih_matches', 'audit_logs')
ORDER BY tablename, policyname;

-- 4. VERIFICAR USUÁRIOS DEMO CRIADOS
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '👥 TESTE 4: VERIFICANDO USUÁRIOS DEMO';
    RAISE NOTICE '==================================';
END $$;

-- Listar usuários por role
SELECT 
    role,
    COUNT(*) as quantidade,
    string_agg(email, ', ') as emails
FROM user_profiles 
WHERE email LIKE '%@sigtap.com' OR email LIKE '%@hospital%.com'
GROUP BY role
ORDER BY role;

-- Verificar configuração de hospital_access
SELECT 
    email,
    role,
    hospital_access,
    permissions,
    is_active
FROM user_profiles 
WHERE email LIKE '%@sigtap.com' OR email LIKE '%@hospital%.com'
ORDER BY role, email;

-- 5. TESTE DE FUNÇÕES RLS COM DADOS REAIS
DO $$
DECLARE
    dev_user_id UUID;
    admin_user_id UUID;
    user_user_id UUID;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTE 5: TESTANDO FUNÇÕES RLS COM DADOS REAIS';
    RAISE NOTICE '===============================================';
    
    -- Buscar IDs dos usuários demo
    SELECT id INTO dev_user_id FROM user_profiles WHERE email = 'developer@sigtap.com' LIMIT 1;
    SELECT id INTO admin_user_id FROM user_profiles WHERE email = 'admin@sigtap.com' LIMIT 1;
    SELECT id INTO user_user_id FROM user_profiles WHERE email = 'user@hospital1.com' LIMIT 1;
    
    -- Testar função has_full_access_role
    IF dev_user_id IS NOT NULL THEN
        RAISE NOTICE '✅ Developer tem acesso total: %', has_full_access_role(dev_user_id);
    ELSE
        RAISE NOTICE '⚠️ Developer não encontrado';
    END IF;
    
    IF admin_user_id IS NOT NULL THEN
        RAISE NOTICE '✅ Admin tem acesso total: %', has_full_access_role(admin_user_id);
    ELSE
        RAISE NOTICE '⚠️ Admin não encontrado';
    END IF;
    
    IF user_user_id IS NOT NULL THEN
        RAISE NOTICE '✅ User básico tem acesso total: %', has_full_access_role(user_user_id);
        RAISE NOTICE '✅ User básico é user básico: %', is_basic_user(user_user_id);
    ELSE
        RAISE NOTICE '⚠️ User básico não encontrado';
    END IF;
END $$;

-- 6. VERIFICAR RLS ATIVADO NAS TABELAS
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🛡️ TESTE 6: VERIFICANDO RLS ATIVADO NAS TABELAS';
    RAISE NOTICE '==============================================';
END $$;

SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_ativado,
    CASE 
        WHEN rowsecurity THEN '✅ RLS ATIVO'
        ELSE '❌ RLS INATIVO'
    END as status
FROM pg_tables 
WHERE tablename IN ('user_profiles', 'hospitals', 'patients', 'aihs', 'procedure_records', 'aih_matches', 'audit_logs')
AND schemaname = 'public'
ORDER BY tablename;

-- 7. SIMULAR TESTE DE ACESSO (sem autenticação real)
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎭 TESTE 7: SIMULAÇÃO DE CENÁRIOS DE ACESSO';
    RAISE NOTICE '=========================================';
END $$;

-- Contar registros por tabela (visão completa)
SELECT 'user_profiles' as tabela, COUNT(*) as total FROM user_profiles
UNION ALL
SELECT 'hospitals' as tabela, COUNT(*) as total FROM hospitals
UNION ALL  
SELECT 'patients' as tabela, COUNT(*) as total FROM patients
UNION ALL
SELECT 'aihs' as tabela, COUNT(*) as total FROM aihs
UNION ALL
SELECT 'procedure_records' as tabela, COUNT(*) as total FROM procedure_records
UNION ALL
SELECT 'aih_matches' as tabela, COUNT(*) as total FROM aih_matches
UNION ALL
SELECT 'audit_logs' as tabela, COUNT(*) as total FROM audit_logs
ORDER BY tabela;

-- 8. TESTE DE INTEGRIDADE DOS DADOS
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 TESTE 8: INTEGRIDADE DOS DADOS';
    RAISE NOTICE '===============================';
END $$;

-- Verificar se todos os roles têm acesso ALL configurado (exceto user básico)
SELECT 
    'Roles com acesso ALL: ' || COUNT(*) as resultado
FROM user_profiles 
WHERE role IN ('developer', 'admin', 'director', 'coordinator', 'auditor', 'ti')
AND 'ALL' = ANY(hospital_access);

-- Verificar se user básico tem hospital específico
SELECT 
    'Users com hospital específico: ' || COUNT(*) as resultado
FROM user_profiles 
WHERE role = 'user' 
AND NOT ('ALL' = ANY(hospital_access))
AND array_length(hospital_access, 1) > 0;

-- 9. DIAGNÓSTICO FINAL
DO $$
DECLARE
    total_policies INTEGER;
    total_functions INTEGER;
    total_demo_users INTEGER;
    total_rls_enabled INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 TESTE 9: DIAGNÓSTICO FINAL DO SISTEMA';
    RAISE NOTICE '======================================';
    
    -- Contar políticas
    SELECT COUNT(*) INTO total_policies 
    FROM pg_policies 
    WHERE tablename IN ('user_profiles', 'hospitals', 'patients', 'aihs', 'procedure_records', 'aih_matches', 'audit_logs');
    
    -- Contar funções
    SELECT COUNT(*) INTO total_functions 
    FROM pg_proc 
    WHERE proname IN ('has_full_access_role', 'is_basic_user');
    
    -- Contar usuários demo
    SELECT COUNT(*) INTO total_demo_users 
    FROM user_profiles 
    WHERE email LIKE '%@sigtap.com' OR email LIKE '%@hospital%.com';
    
    -- Contar tabelas com RLS
    SELECT COUNT(*) INTO total_rls_enabled 
    FROM pg_tables 
    WHERE tablename IN ('user_profiles', 'hospitals', 'patients', 'aihs', 'procedure_records', 'aih_matches', 'audit_logs')
    AND schemaname = 'public' 
    AND rowsecurity = true;
    
    RAISE NOTICE '';
    RAISE NOTICE '📈 RESULTADOS FINAIS:';
    RAISE NOTICE '  🔒 Políticas RLS criadas: % (esperado: >= 15)', total_policies;
    RAISE NOTICE '  🔧 Funções RLS criadas: % (esperado: 2)', total_functions;
    RAISE NOTICE '  👥 Usuários demo criados: % (esperado: >= 7)', total_demo_users;
    RAISE NOTICE '  🛡️ Tabelas com RLS ativo: % (esperado: 7)', total_rls_enabled;
    
    -- Status geral
    IF total_policies >= 15 AND total_functions = 2 AND total_demo_users >= 7 AND total_rls_enabled = 7 THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 ✅ SISTEMA DE PERMISSÕES CONFIGURADO COM SUCESSO!';
        RAISE NOTICE '     Todos os testes passaram. O sistema está pronto para uso.';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '⚠️ ❌ ALGUMAS CONFIGURAÇÕES ESTÃO INCOMPLETAS!';
        RAISE NOTICE '     Verifique os resultados acima e execute novamente o script de configuração.';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- 10. COMANDOS ÚTEIS PARA TROUBLESHOOTING
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔧 COMANDOS ÚTEIS PARA TROUBLESHOOTING:';
    RAISE NOTICE '=====================================';
    RAISE NOTICE '1. Ver políticas de uma tabela: SELECT * FROM pg_policies WHERE tablename = ''user_profiles'';';
    RAISE NOTICE '2. Testar função manualmente: SELECT has_full_access_role(''uuid-aqui'');';
    RAISE NOTICE '3. Ver estrutura de tabela: \\d user_profiles';
    RAISE NOTICE '4. Verificar RLS: SELECT rowsecurity FROM pg_tables WHERE tablename = ''user_profiles'';';
    RAISE NOTICE '5. Logs de auditoria: SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 PRÓXIMOS PASSOS APÓS SUCESSO:';
    RAISE NOTICE '1. Teste o login no frontend com os usuários demo';
    RAISE NOTICE '2. Verifique se cada role vê apenas os dados corretos';
    RAISE NOTICE '3. Teste operações CRUD em diferentes roles';
    RAISE NOTICE '4. Monitore logs de auditoria em tempo real';
    RAISE NOTICE '';
END $$; 