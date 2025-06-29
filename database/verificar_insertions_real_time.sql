-- ================================================
-- MONITORAMENTO REAL-TIME: INSERÇÕES SIGTAP
-- ================================================
-- Use este script durante um upload para ver o que está acontecendo

-- ETAPA 1: Status atual das tabelas
SELECT 
    'STATUS ATUAL' as categoria,
    (SELECT COUNT(*) FROM sigtap_versions) as total_versoes,
    (SELECT COUNT(*) FROM sigtap_procedures) as total_procedimentos,
    (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) as versoes_ativas;

-- ETAPA 2: Verificar RLS Status
SELECT 
    'RLS STATUS' as categoria,
    c.relname as tabela,
    c.relrowsecurity as rls_habilitado,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = c.relname) as politicas_ativas
FROM pg_class c
WHERE c.relname IN ('sigtap_versions', 'sigtap_procedures');

-- ETAPA 3: Verificar últimas inserções (para monitorar durante upload)
SELECT 
    'ÚLTIMAS VERSÕES' as categoria,
    id,
    version_name,
    total_procedures,
    import_status,
    created_at
FROM sigtap_versions
ORDER BY created_at DESC
LIMIT 5;

-- ETAPA 4: Teste de inserção em tempo real
DO $$
DECLARE
    test_version_id UUID;
    insert_success BOOLEAN := true;
    current_role TEXT;
BEGIN
    -- Verificar role do usuário
    SELECT current_user INTO current_role;
    RAISE NOTICE 'Usuário: % | Timestamp: %', current_role, NOW();
    
    -- Teste de inserção na sigtap_versions
    BEGIN
        INSERT INTO sigtap_versions (
            version_name, 
            file_type, 
            total_procedures, 
            extraction_method,
            import_status
        ) VALUES (
            'REALTIME_TEST_' || EXTRACT(EPOCH FROM NOW()),
            'pdf',
            1,
            'pdf',
            'testing'
        ) RETURNING id INTO test_version_id;
        
        RAISE NOTICE '✅ VERSÃO INSERIDA: %', test_version_id;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ FALHA NA VERSÃO: % | Código: %', SQLERRM, SQLSTATE;
        insert_success := false;
    END;
    
    -- Se versão foi criada, testar procedimento
    IF test_version_id IS NOT NULL AND insert_success THEN
        BEGIN
            INSERT INTO sigtap_procedures (
                version_id,
                code,
                description,
                complexity
            ) VALUES (
                test_version_id,
                'TEST_' || EXTRACT(EPOCH FROM NOW()),
                'Teste Tempo Real',
                'BAIXA'
            );
            
            RAISE NOTICE '✅ PROCEDIMENTO INSERIDO';
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ FALHA NO PROCEDIMENTO: % | Código: %', SQLERRM, SQLSTATE;
            insert_success := false;
        END;
    END IF;
    
    -- Limpeza
    IF test_version_id IS NOT NULL THEN
        DELETE FROM sigtap_procedures WHERE version_id = test_version_id;
        DELETE FROM sigtap_versions WHERE id = test_version_id;
        RAISE NOTICE '🧹 Limpeza concluída';
    END IF;
    
    -- Resultado
    IF insert_success THEN
        RAISE NOTICE '🎉 SISTEMA FUNCIONANDO - Upload deve funcionar';
    ELSE
        RAISE NOTICE '🚨 PROBLEMA DETECTADO - Aplicar fix urgente';
    END IF;
END $$;

-- ETAPA 5: Contar inserções dos últimos 5 minutos (útil durante upload)
SELECT 
    'ATIVIDADE RECENTE' as categoria,
    COUNT(*) as versoes_ultimos_5min
FROM sigtap_versions 
WHERE created_at > NOW() - INTERVAL '5 minutes'

UNION ALL

SELECT 
    'ATIVIDADE RECENTE' as categoria,
    COUNT(*) as procedimentos_ultimos_5min
FROM sigtap_procedures 
WHERE created_at > NOW() - INTERVAL '5 minutes';

-- ETAPA 6: Monitoramento de políticas específicas
SELECT 
    'POLÍTICAS BLOQUEADORAS' as categoria,
    policyname as politica,
    tablename as tabela,
    cmd as comando,
    CASE 
        WHEN permissive = 'PERMISSIVE' THEN '✅ PERMISSIVA'
        ELSE '🚫 RESTRITIVA'
    END as tipo
FROM pg_policies 
WHERE tablename IN ('sigtap_versions', 'sigtap_procedures')
ORDER BY tablename, policyname; 