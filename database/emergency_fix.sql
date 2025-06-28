-- ================================================
-- CORREÇÃO EMERGENCIAL - SIGTAP OFICIAL
-- Execute este script no SQL Editor do Supabase AGORA
-- ================================================

SELECT '🚨 DIAGNÓSTICO EMERGENCIAL - SIGTAP OFICIAL' as status;

-- ================================================
-- 1. VERIFICAR TABELAS AUXILIARES CRÍTICAS
-- ================================================
SELECT '📋 Verificando tabelas auxiliares...' as status;

-- Verificar sigtap_procedimentos_oficial
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sigtap_procedimentos_oficial') 
        THEN '✅ sigtap_procedimentos_oficial: EXISTE'
        ELSE '❌ sigtap_procedimentos_oficial: FALTANDO - CRÍTICO!'
    END as tabela_procedimentos_oficial;

-- Verificar sigtap_financiamento
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sigtap_financiamento') 
        THEN '✅ sigtap_financiamento: EXISTE'
        ELSE '❌ sigtap_financiamento: FALTANDO'
    END as tabela_financiamento;

-- Verificar função get_import_statistics
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_import_statistics') 
        THEN '✅ get_import_statistics: EXISTE'
        ELSE '❌ get_import_statistics: FALTANDO - CRÍTICO!'
    END as funcao_estatisticas;

-- ================================================
-- 2. CRIAR FUNÇÃO get_import_statistics SE NÃO EXISTIR
-- ================================================

-- Verificar e criar se necessário
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_import_statistics') THEN
        -- Criar função básica temporária
        EXECUTE '
        CREATE OR REPLACE FUNCTION get_import_statistics()
        RETURNS TABLE(
          total_financiamentos INTEGER,
          total_modalidades INTEGER,
          total_procedimentos INTEGER,
          total_relacionamentos_cid INTEGER,
          total_relacionamentos_ocupacao INTEGER,
          total_relacionamentos_modalidade INTEGER,
          competencia_mais_recente VARCHAR(6)
        ) AS $func$
        BEGIN
          RETURN QUERY
          SELECT 
            COALESCE((SELECT COUNT(*)::INTEGER FROM sigtap_financiamento), 0) as total_financiamentos,
            COALESCE((SELECT COUNT(*)::INTEGER FROM sigtap_modalidade), 0) as total_modalidades,
            COALESCE((SELECT COUNT(*)::INTEGER FROM sigtap_procedimentos_oficial), 0) as total_procedimentos,
            0::INTEGER as total_relacionamentos_cid,
            0::INTEGER as total_relacionamentos_ocupacao,
            0::INTEGER as total_relacionamentos_modalidade,
            COALESCE((SELECT competencia FROM sigtap_procedimentos_oficial ORDER BY competencia DESC LIMIT 1), ''202504'') as competencia_mais_recente;
        EXCEPTION
          WHEN OTHERS THEN
            RETURN QUERY SELECT 0, 0, 0, 0, 0, 0, ''202504'';
        END;
        $func$ LANGUAGE plpgsql;';
        
        RAISE NOTICE '✅ Função get_import_statistics criada temporariamente';
    ELSE
        RAISE NOTICE '✅ Função get_import_statistics já existe';
    END IF;
END $$;

-- ================================================
-- 3. VERIFICAR DADOS IMPORTADOS
-- ================================================
SELECT '📊 Verificando dados importados...' as status;

-- Contar procedimentos oficiais
DO $$
DECLARE
    count_proc INTEGER := 0;
    count_fin INTEGER := 0;
BEGIN
    BEGIN
        SELECT COUNT(*) FROM sigtap_procedimentos_oficial INTO count_proc;
        RAISE NOTICE '📈 Procedimentos oficiais: %', count_proc;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro ao contar procedimentos: %', SQLERRM;
    END;
    
    BEGIN
        SELECT COUNT(*) FROM sigtap_financiamento INTO count_fin;
        RAISE NOTICE '💰 Financiamentos: %', count_fin;
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro ao contar financiamentos: %', SQLERRM;
    END;
END $$;

-- ================================================
-- 4. TESTAR FUNÇÃO get_import_statistics
-- ================================================
SELECT '🧪 Testando função get_import_statistics...' as status;

DO $$
BEGIN
    BEGIN
        PERFORM * FROM get_import_statistics();
        RAISE NOTICE '✅ Função get_import_statistics: FUNCIONANDO';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro na função get_import_statistics: %', SQLERRM;
    END;
END $$;

-- ================================================
-- 5. RESULTADO FINAL
-- ================================================
SELECT '🏁 DIAGNÓSTICO CONCLUÍDO' as status;

SELECT 
    'Execute os seguintes scripts se algum item falhou:' as instrucoes
UNION ALL
SELECT '1. database/sigtap_official_schema.sql'
UNION ALL  
SELECT '2. database/sync_functions.sql'
UNION ALL
SELECT '3. Recarregue a página do frontend'
UNION ALL
SELECT ''
UNION ALL
SELECT '💡 Se os procedimentos existem (2866+), o problema é só de função!'; 