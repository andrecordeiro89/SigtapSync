-- ================================================
-- DIAGNÓSTICO: SIGTAP UPLOAD NÃO SALVANDO NO BANCO
-- ================================================

-- ETAPA 1: Verificar se tabelas existem
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 DIAGNÓSTICO COMPLETO DO SIGTAP UPLOAD';
    RAISE NOTICE '';
    
    -- Verificar se tabelas existem
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sigtap_versions') THEN
        RAISE NOTICE '✅ Tabela sigtap_versions existe';
    ELSE
        RAISE NOTICE '❌ Tabela sigtap_versions NÃO EXISTE';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sigtap_procedures') THEN
        RAISE NOTICE '✅ Tabela sigtap_procedures existe';
    ELSE
        RAISE NOTICE '❌ Tabela sigtap_procedures NÃO EXISTE';
    END IF;
END $$;

-- ETAPA 2: Verificar constraints da tabela sigtap_versions
SELECT 
    'CONSTRAINT CHECK' as tipo,
    constraint_name as nome,
    check_clause as detalhes
FROM information_schema.check_constraints 
WHERE table_name = 'sigtap_versions';

-- ETAPA 3: Verificar dados atuais
DO $$
DECLARE
    versoes INTEGER;
    procedimentos INTEGER;
    ultima_versao RECORD;
BEGIN
    -- Contar versões
    SELECT COUNT(*) INTO versoes FROM sigtap_versions;
    RAISE NOTICE '';
    RAISE NOTICE '📊 DADOS ATUAIS:';
    RAISE NOTICE 'Versões SIGTAP: %', versoes;
    
    -- Contar procedimentos
    SELECT COUNT(*) INTO procedimentos FROM sigtap_procedures;
    RAISE NOTICE 'Procedimentos SIGTAP: %', procedimentos;
    
    -- Última versão
    IF versoes > 0 THEN
        SELECT version_name, total_procedures, import_status, is_active 
        INTO ultima_versao
        FROM sigtap_versions 
        ORDER BY created_at DESC 
        LIMIT 1;
        
        RAISE NOTICE '';
        RAISE NOTICE '📋 ÚLTIMA VERSÃO:';
        RAISE NOTICE 'Nome: %', ultima_versao.version_name;
        RAISE NOTICE 'Total Procedures: %', ultima_versao.total_procedures;
        RAISE NOTICE 'Status: %', ultima_versao.import_status;
        RAISE NOTICE 'Ativa: %', ultima_versao.is_active;
    END IF;
END $$;

-- ETAPA 4: Verificar últimas 5 versões criadas
SELECT 
    version_name as "Versão",
    total_procedures as "Total_Proc",
    import_status as "Status",
    is_active as "Ativa",
    created_at as "Criado_em"
FROM sigtap_versions 
ORDER BY created_at DESC 
LIMIT 5;

-- ETAPA 5: Verificar procedimentos da última versão
DO $$
DECLARE
    ultima_versao_id UUID;
    proc_count INTEGER;
BEGIN
    -- Buscar ID da última versão
    SELECT id INTO ultima_versao_id 
    FROM sigtap_versions 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF ultima_versao_id IS NOT NULL THEN
        -- Contar procedimentos desta versão
        SELECT COUNT(*) INTO proc_count 
        FROM sigtap_procedures 
        WHERE version_id = ultima_versao_id;
        
        RAISE NOTICE '';
        RAISE NOTICE '🔍 PROCEDIMENTOS DA ÚLTIMA VERSÃO:';
        RAISE NOTICE 'ID da versão: %', ultima_versao_id;
        RAISE NOTICE 'Procedimentos encontrados: %', proc_count;
        
        -- Mostrar alguns exemplos se existirem
        IF proc_count > 0 THEN
            RAISE NOTICE '';
            RAISE NOTICE '📋 PRIMEIROS 3 PROCEDIMENTOS:';
        END IF;
    ELSE
        RAISE NOTICE '⚠️ Nenhuma versão encontrada';
    END IF;
END $$;

-- ETAPA 6: Amostra dos primeiros procedimentos (se existirem)
SELECT 
    code as "Código",
    description as "Descrição", 
    complexity as "Complexidade",
    value_amb as "Valor_Amb",
    value_hosp as "Valor_Hosp"
FROM sigtap_procedures 
WHERE version_id = (
    SELECT id FROM sigtap_versions 
    ORDER BY created_at DESC 
    LIMIT 1
)
ORDER BY code 
LIMIT 3;

-- ETAPA 7: Verificar permissões RLS
SELECT 
    tablename as "Tabela",
    policyname as "Política",
    cmd as "Comando",
    qual as "Condição"
FROM pg_policies 
WHERE tablename IN ('sigtap_versions', 'sigtap_procedures');

-- ETAPA 8: Verificar se RLS está habilitado
SELECT 
    schemaname as "Schema",
    tablename as "Tabela",
    rowsecurity as "RLS_Habilitado"
FROM pg_tables 
WHERE tablename IN ('sigtap_versions', 'sigtap_procedures');

-- ETAPA 9: Testar inserção manual simples
DO $$
DECLARE
    test_version_id UUID;
    test_procedure_count INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTE DE INSERÇÃO MANUAL:';
    
    -- Tentar inserir uma versão de teste
    BEGIN
        INSERT INTO sigtap_versions (
            version_name, 
            file_type, 
            total_procedures, 
            import_status,
            extraction_method
        ) VALUES (
            'TESTE_MANUAL_' || TO_CHAR(NOW(), 'YYYY-MM-DD_HH24:MI'),
            'manual',
            1,
            'completed',
            'manual'
        ) RETURNING id INTO test_version_id;
        
        RAISE NOTICE '✅ Versão teste criada: %', test_version_id;
        
        -- Tentar inserir um procedimento de teste
        INSERT INTO sigtap_procedures (
            version_id,
            code,
            description,
            complexity
        ) VALUES (
            test_version_id,
            '99999999',
            'Procedimento Teste Manual',
            'BAIXA'
        );
        
        RAISE NOTICE '✅ Procedimento teste criado';
        
        -- Verificar se foi salvo
        SELECT COUNT(*) INTO test_procedure_count
        FROM sigtap_procedures 
        WHERE version_id = test_version_id;
        
        RAISE NOTICE '✅ Procedimentos encontrados na versão teste: %', test_procedure_count;
        
        -- Limpar teste
        DELETE FROM sigtap_procedures WHERE version_id = test_version_id;
        DELETE FROM sigtap_versions WHERE id = test_version_id;
        
        RAISE NOTICE '✅ Dados de teste removidos';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ ERRO NO TESTE: %', SQLERRM;
        RAISE NOTICE '❌ CÓDIGO DO ERRO: %', SQLSTATE;
    END;
END $$;

-- ETAPA 10: Resumo final
DO $$
DECLARE
    total_versoes INTEGER;
    total_procedimentos INTEGER;
    versao_ativa BOOLEAN;
BEGIN
    SELECT COUNT(*) INTO total_versoes FROM sigtap_versions;
    SELECT COUNT(*) INTO total_procedimentos FROM sigtap_procedures;
    SELECT EXISTS(SELECT 1 FROM sigtap_versions WHERE is_active = true) INTO versao_ativa;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 RESUMO DIAGNÓSTICO:';
    RAISE NOTICE '================================';
    RAISE NOTICE 'Total de versões: %', total_versoes;
    RAISE NOTICE 'Total de procedimentos: %', total_procedimentos;
    RAISE NOTICE 'Há versão ativa: %', versao_ativa;
    
    IF total_versoes = 0 THEN
        RAISE NOTICE '❌ PROBLEMA: Nenhuma versão criada - erro na criação de versões';
    ELSIF total_procedimentos = 0 THEN
        RAISE NOTICE '❌ PROBLEMA: Versões criadas mas procedimentos não salvos';
    ELSIF NOT versao_ativa THEN
        RAISE NOTICE '⚠️ AVISO: Dados salvos mas nenhuma versão ativa';
    ELSE
        RAISE NOTICE '✅ SISTEMA OK: Dados salvos e versão ativa';
    END IF;
    
    RAISE NOTICE '================================';
END $$; 