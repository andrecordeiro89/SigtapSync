-- ================================================
-- DIAGNÓSTICO: AUTENTICAÇÃO BLOQUEANDO SIGTAP UPLOAD
-- ================================================

-- ETAPA 1: Verificar políticas RLS ativas
SELECT 
    'POLÍTICAS RLS ATIVAS' as categoria,
    schemaname as schema,
    tablename as tabela,
    policyname as politica,
    cmd as comando,
    CASE 
        WHEN qual IS NOT NULL THEN 'COM RESTRIÇÕES' 
        ELSE 'SEM RESTRIÇÕES' 
    END as restricoes
FROM pg_policies 
WHERE tablename IN ('sigtap_versions', 'sigtap_procedures')
ORDER BY tablename, policyname;

-- ETAPA 2: Verificar se RLS está habilitado
SELECT 
    'STATUS RLS' as categoria,
    schemaname as schema,
    tablename as tabela,
    CASE 
        WHEN rowsecurity THEN '🔒 RLS HABILITADO' 
        ELSE '🔓 RLS DESABILITADO' 
    END as status_rls
FROM pg_tables 
WHERE tablename IN ('sigtap_versions', 'sigtap_procedures');

-- ETAPA 3: Verificar usuário atual e roles
SELECT 
    'USUÁRIO ATUAL' as categoria,
    current_user as usuario,
    current_setting('request.jwt.claims', true)::json as jwt_claims;

-- ETAPA 4: Testar inserção com usuário service_role
DO $$
DECLARE
    test_version_id UUID;
    current_role TEXT;
BEGIN
    -- Verificar role atual
    SELECT current_user INTO current_role;
    RAISE NOTICE 'Role atual: %', current_role;
    
    -- Tentar inserir versão de teste
    BEGIN
        INSERT INTO sigtap_versions (
            version_name, 
            file_type, 
            total_procedures, 
            extraction_method,
            import_status
        ) VALUES (
            'TESTE_AUTH_' || TO_CHAR(NOW(), 'HH24:MI:SS'),
            'pdf',
            2,
            'pdf',
            'completed'
        ) RETURNING id INTO test_version_id;
        
        RAISE NOTICE '✅ Versão criada com sucesso: %', test_version_id;
        
        -- Tentar inserir procedimento
        INSERT INTO sigtap_procedures (
            version_id,
            code,
            description,
            complexity
        ) VALUES (
            test_version_id,
            '99999999',
            'Teste Autenticação',
            'BAIXA'
        );
        
        RAISE NOTICE '✅ Procedimento criado com sucesso';
        
        -- Limpar teste
        DELETE FROM sigtap_procedures WHERE version_id = test_version_id;
        DELETE FROM sigtap_versions WHERE id = test_version_id;
        
        RAISE NOTICE '✅ AUTENTICAÇÃO OK - Sistema funcionando';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ERRO DE AUTENTICAÇÃO: %', SQLERRM;
        RAISE NOTICE '❌ Código: %', SQLSTATE;
        RAISE NOTICE '❌ Detalhe: %', SQLERRM;
        
        -- Tentar limpar se algo foi criado
        IF test_version_id IS NOT NULL THEN
            DELETE FROM sigtap_procedures WHERE version_id = test_version_id;
            DELETE FROM sigtap_versions WHERE id = test_version_id;
        END IF;
    END;
END $$;

-- ETAPA 5: Verificar permissões específicas do usuário anon
DO $$
DECLARE
    can_insert_versions BOOLEAN;
    can_insert_procedures BOOLEAN;
BEGIN
    -- Verificar permissão na tabela sigtap_versions
    SELECT EXISTS(
        SELECT 1 FROM information_schema.table_privileges 
        WHERE table_name = 'sigtap_versions' 
        AND privilege_type = 'INSERT'
        AND grantee IN ('anon', 'authenticated', 'public')
    ) INTO can_insert_versions;
    
    -- Verificar permissão na tabela sigtap_procedures  
    SELECT EXISTS(
        SELECT 1 FROM information_schema.table_privileges 
        WHERE table_name = 'sigtap_procedures' 
        AND privilege_type = 'INSERT'
        AND grantee IN ('anon', 'authenticated', 'public')
    ) INTO can_insert_procedures;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔐 PERMISSÕES DE INSERÇÃO:';
    RAISE NOTICE 'sigtap_versions: %', CASE WHEN can_insert_versions THEN '✅ PERMITIDA' ELSE '❌ NEGADA' END;
    RAISE NOTICE 'sigtap_procedures: %', CASE WHEN can_insert_procedures THEN '✅ PERMITIDA' ELSE '❌ NEGADA' END;
END $$;

-- ETAPA 6: Verificar configuração de RLS específica
SELECT 
    'CONFIGURAÇÃO RLS' as categoria,
    c.relname as tabela,
    c.relrowsecurity as rls_habilitado,
    c.relforcerowsecurity as rls_forcado
FROM pg_class c
WHERE c.relname IN ('sigtap_versions', 'sigtap_procedures');

-- ETAPA 7: Diagnóstico final com recomendações
DO $$
DECLARE
    rls_versions BOOLEAN;
    rls_procedures BOOLEAN;
    policies_count INTEGER;
BEGIN
    -- Verificar RLS
    SELECT relrowsecurity INTO rls_versions
    FROM pg_class WHERE relname = 'sigtap_versions';
    
    SELECT relrowsecurity INTO rls_procedures  
    FROM pg_class WHERE relname = 'sigtap_procedures';
    
    -- Contar políticas
    SELECT COUNT(*) INTO policies_count
    FROM pg_policies 
    WHERE tablename IN ('sigtap_versions', 'sigtap_procedures');
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 DIAGNÓSTICO FINAL:';
    RAISE NOTICE '================================';
    RAISE NOTICE 'RLS sigtap_versions: %', COALESCE(rls_versions, false);
    RAISE NOTICE 'RLS sigtap_procedures: %', COALESCE(rls_procedures, false);
    RAISE NOTICE 'Políticas ativas: %', policies_count;
    
    IF rls_versions OR rls_procedures THEN
        RAISE NOTICE '';
        RAISE NOTICE '🔒 PROBLEMA IDENTIFICADO:';
        RAISE NOTICE 'RLS está bloqueando inserções do frontend';
        RAISE NOTICE '';
        RAISE NOTICE '✅ SOLUÇÃO:';
        RAISE NOTICE 'Desabilitar RLS temporariamente ou';
        RAISE NOTICE 'Ajustar políticas para permitir uploads';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '🤔 RLS não é o problema - investigar constraints';
    END IF;
    
    RAISE NOTICE '================================';
END $$; 