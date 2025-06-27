-- ================================================
-- VERIFICAÇÃO DA ESTRUTURA OFICIAL SIGTAP
-- Script para verificar se todas as tabelas e funções necessárias existem
-- ================================================

-- Header informativo
SELECT '🔍 VERIFICANDO ESTRUTURA OFICIAL SIGTAP' as info;

-- ================================================
-- 1. VERIFICAR TABELAS AUXILIARES
-- ================================================
SELECT '📋 VERIFICANDO TABELAS AUXILIARES...' as info;

DO $$
DECLARE
    tables_to_check text[] := ARRAY[
        'sigtap_financiamento',
        'sigtap_modalidade',
        'sigtap_grupos',
        'sigtap_subgrupos', 
        'sigtap_cids',
        'sigtap_ocupacoes',
        'sigtap_procedimentos_oficial',
        'sigtap_procedimento_cid',
        'sigtap_procedimento_ocupacao',
        'sigtap_procedimento_modalidade'
    ];
    current_table text;
    table_exists boolean;
    tables_found integer := 0;
    total_tables integer := array_length(tables_to_check, 1);
BEGIN
    FOREACH current_table IN ARRAY tables_to_check
    LOOP
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND information_schema.tables.table_name = current_table
        ) INTO table_exists;
        
        IF table_exists THEN
            RAISE NOTICE '✅ Tabela encontrada: %', current_table;
            tables_found := tables_found + 1;
        ELSE
            RAISE NOTICE '❌ Tabela FALTANDO: %', current_table;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 RESULTADO: % de % tabelas encontradas', tables_found, total_tables;
    
    IF tables_found = total_tables THEN
        RAISE NOTICE '🎉 TODAS as tabelas auxiliares estão presentes!';
    ELSE
        RAISE NOTICE '⚠️  Execute: database/sigtap_official_schema.sql';
    END IF;
END
$$;

-- ================================================
-- 2. VERIFICAR FUNÇÕES DE SINCRONIZAÇÃO
-- ================================================
SELECT '⚙️ VERIFICANDO FUNÇÕES DE SINCRONIZAÇÃO...' as info;

DO $$
DECLARE
    functions_to_check text[] := ARRAY[
        'sync_official_to_main_table',
        'cleanup_old_official_data',
        'get_import_statistics'
    ];
    current_function text;
    function_exists boolean;
    functions_found integer := 0;
    total_functions integer := array_length(functions_to_check, 1);
BEGIN
    FOREACH current_function IN ARRAY functions_to_check
    LOOP
        SELECT EXISTS (
            SELECT FROM information_schema.routines 
            WHERE routine_schema = 'public' 
            AND information_schema.routines.routine_name = current_function
        ) INTO function_exists;
        
        IF function_exists THEN
            RAISE NOTICE '✅ Função encontrada: %', current_function;
            functions_found := functions_found + 1;
        ELSE
            RAISE NOTICE '❌ Função FALTANDO: %', current_function;
        END IF;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 RESULTADO: % de % funções encontradas', functions_found, total_functions;
    
    IF functions_found = total_functions THEN
        RAISE NOTICE '🎉 TODAS as funções estão presentes!';
    ELSE
        RAISE NOTICE '⚠️  Execute: database/sync_functions.sql';
    END IF;
END
$$;

-- ================================================
-- 3. VERIFICAR CONSTRAINTS
-- ================================================
SELECT '🔒 VERIFICANDO CONSTRAINTS...' as info;

DO $$
DECLARE
    extraction_method_ok boolean := false;
    file_type_ok boolean := false;
BEGIN
    -- Método correto para PostgreSQL - verificar constraint extraction_method
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
        WHERE tc.table_name = 'sigtap_versions'
        AND tc.constraint_type = 'CHECK'
        AND cc.constraint_name LIKE '%extraction_method%'
        AND cc.check_clause LIKE '%official%'
    ) INTO extraction_method_ok;
    
    -- Verificar constraint file_type
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
        WHERE tc.table_name = 'sigtap_versions'
        AND tc.constraint_type = 'CHECK'
        AND cc.constraint_name LIKE '%file_type%'
        AND cc.check_clause LIKE '%zip%'
    ) INTO file_type_ok;
    
    IF extraction_method_ok THEN
        RAISE NOTICE '✅ Constraint extraction_method: OK (inclui ''official'')';
    ELSE
        RAISE NOTICE '❌ Constraint extraction_method: FALTANDO ou INCOMPLETO';
    END IF;
    
    IF file_type_ok THEN
        RAISE NOTICE '✅ Constraint file_type: OK (inclui ''zip'')';
    ELSE
        RAISE NOTICE '❌ Constraint file_type: FALTANDO ou INCOMPLETO';
    END IF;
    
    IF extraction_method_ok AND file_type_ok THEN
        RAISE NOTICE '🎉 TODOS os constraints estão corretos!';
    ELSE
        RAISE NOTICE '⚠️  Execute: database/update_extraction_method_constraint.sql';
    END IF;
END
$$;

-- ================================================
-- 4. TESTE DE CONECTIVIDADE
-- ================================================
SELECT '🔌 TESTANDO CONECTIVIDADE DAS TABELAS...' as info;

DO $$
DECLARE
    test_passed boolean := true;
    error_message text;
BEGIN
    -- Teste 1: Selecionar de financiamento
    BEGIN
        PERFORM * FROM sigtap_financiamento LIMIT 1;
        RAISE NOTICE '✅ Acesso a sigtap_financiamento: OK';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro ao acessar sigtap_financiamento: %', SQLERRM;
        test_passed := false;
    END;
    
    -- Teste 2: Selecionar de modalidade
    BEGIN
        PERFORM * FROM sigtap_modalidade LIMIT 1;
        RAISE NOTICE '✅ Acesso a sigtap_modalidade: OK';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro ao acessar sigtap_modalidade: %', SQLERRM;
        test_passed := false;
    END;
    
    -- Teste 3: Selecionar de procedimentos oficiais
    BEGIN
        PERFORM * FROM sigtap_procedimentos_oficial LIMIT 1;
        RAISE NOTICE '✅ Acesso a sigtap_procedimentos_oficial: OK';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro ao acessar sigtap_procedimentos_oficial: %', SQLERRM;
        test_passed := false;
    END;
    
    -- Teste 4: Executar função de estatísticas
    BEGIN
        PERFORM * FROM get_import_statistics();
        RAISE NOTICE '✅ Função get_import_statistics: OK';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro na função get_import_statistics: %', SQLERRM;
        test_passed := false;
    END;
    
    RAISE NOTICE '';
    IF test_passed THEN
        RAISE NOTICE '🎉 TODOS os testes de conectividade passaram!';
        RAISE NOTICE '✅ Sistema pronto para importação oficial!';
    ELSE
        RAISE NOTICE '⚠️  Alguns testes falharam - verifique os erros acima';
    END IF;
END
$$;

-- ================================================
-- 5. ESTATÍSTICAS ATUAIS
-- ================================================
SELECT '📊 ESTATÍSTICAS ATUAIS...' as info;

DO $$
DECLARE
    stats_available boolean := false;
    result_count integer := 0;
BEGIN
    -- Verificar se a função existe e tentar executar
    SELECT EXISTS (
        SELECT 1 FROM information_schema.routines 
        WHERE routine_schema = 'public' 
        AND routine_name = 'get_import_statistics'
    ) INTO stats_available;
    
    IF stats_available THEN
        BEGIN
            -- Tentar contar registros nas tabelas principais
            SELECT COUNT(*) FROM sigtap_procedimentos_oficial INTO result_count;
            RAISE NOTICE '📈 Procedimentos oficiais importados: %', result_count;
            
            SELECT COUNT(*) FROM sigtap_financiamento INTO result_count;
            RAISE NOTICE '💰 Tipos de financiamento: %', result_count;
            
            SELECT COUNT(*) FROM sigtap_modalidade INTO result_count;
            RAISE NOTICE '🏥 Modalidades: %', result_count;
            
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'ℹ️  Tabelas ainda vazias ou erro: %', SQLERRM;
        END;
    ELSE
        RAISE NOTICE 'ℹ️  Função get_import_statistics não disponível';
    END IF;
END
$$;

-- ================================================
-- RESUMO FINAL
-- ================================================
SELECT '🏁 VERIFICAÇÃO CONCLUÍDA!' as info;

SELECT 
    'Para usar o Importador Oficial SIGTAP, certifique-se de que:' as instrucoes
UNION ALL
SELECT '1. ✅ Todas as tabelas auxiliares existem'
UNION ALL  
SELECT '2. ✅ Todas as funções de sincronização existem'
UNION ALL
SELECT '3. ✅ Os constraints permitem ''official'' e ''zip'''
UNION ALL
SELECT '4. ✅ Todos os testes de conectividade passam'
UNION ALL
SELECT ''
UNION ALL
SELECT 'Se algum item falhou, execute os scripts na ordem:'
UNION ALL
SELECT '📋 database/sigtap_official_schema.sql'
UNION ALL
SELECT '⚙️ database/sync_functions.sql' 
UNION ALL
SELECT '🔒 database/update_extraction_method_constraint.sql'; 