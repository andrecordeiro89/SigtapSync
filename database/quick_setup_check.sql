-- ================================================
-- VERIFICAÇÃO RÁPIDA - SETUP OFICIAL SIGTAP
-- Execute este script no SQL Editor do Supabase
-- ================================================

SELECT '🔍 VERIFICAÇÃO RÁPIDA - SIGTAP OFICIAL' as status;

-- ================================================
-- 1. TESTAR TABELAS ESSENCIAIS
-- ================================================
SELECT '📋 Testando tabelas essenciais...' as status;

-- Teste 1: sigtap_financiamento
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sigtap_financiamento') 
        THEN '✅ sigtap_financiamento: OK'
        ELSE '❌ sigtap_financiamento: FALTANDO'
    END as tabela_financiamento;

-- Teste 2: sigtap_modalidade  
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sigtap_modalidade') 
        THEN '✅ sigtap_modalidade: OK'
        ELSE '❌ sigtap_modalidade: FALTANDO'
    END as tabela_modalidade;

-- Teste 3: sigtap_procedimentos_oficial
SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sigtap_procedimentos_oficial') 
        THEN '✅ sigtap_procedimentos_oficial: OK'
        ELSE '❌ sigtap_procedimentos_oficial: FALTANDO'
    END as tabela_procedimentos;

-- ================================================
-- 2. TESTAR FUNÇÕES ESSENCIAIS  
-- ================================================  
SELECT '⚙️ Testando funções...' as status;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'sync_official_to_main_table') 
        THEN '✅ sync_official_to_main_table: OK'
        ELSE '❌ sync_official_to_main_table: FALTANDO'
    END as funcao_sync;

SELECT 
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'get_import_statistics') 
        THEN '✅ get_import_statistics: OK'
        ELSE '❌ get_import_statistics: FALTANDO'
    END as funcao_stats;

-- ================================================
-- 3. TESTAR CONSTRAINTS
-- ================================================
SELECT '🔒 Testando constraints...' as status;

-- Teste extraction_method constraint
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints tc
            JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
            WHERE tc.table_name = 'sigtap_versions'
            AND cc.check_clause LIKE '%official%'
        ) 
        THEN '✅ extraction_method permite ''official'': OK'
        ELSE '❌ extraction_method constraint: FALTANDO'
    END as constraint_extraction;

-- Teste file_type constraint  
SELECT 
    CASE 
        WHEN EXISTS (
            SELECT 1 
            FROM information_schema.table_constraints tc
            JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
            WHERE tc.table_name = 'sigtap_versions'
            AND cc.check_clause LIKE '%zip%'
        ) 
        THEN '✅ file_type permite ''zip'': OK'
        ELSE '❌ file_type constraint: FALTANDO'
    END as constraint_file_type;

-- ================================================
-- 4. TESTE DE CONECTIVIDADE
-- ================================================
SELECT '🔌 Teste de conectividade...' as status;

-- Teste básico de acesso às tabelas
DO $$
BEGIN
    -- Teste 1: Acessar sigtap_financiamento
    BEGIN
        PERFORM 1 FROM sigtap_financiamento LIMIT 1;
        RAISE NOTICE '✅ Acesso sigtap_financiamento: OK';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro sigtap_financiamento: %', SQLERRM;
    END;
    
    -- Teste 2: Acessar sigtap_modalidade
    BEGIN
        PERFORM 1 FROM sigtap_modalidade LIMIT 1;
        RAISE NOTICE '✅ Acesso sigtap_modalidade: OK';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro sigtap_modalidade: %', SQLERRM;
    END;
    
    -- Teste 3: Acessar sigtap_procedimentos_oficial
    BEGIN
        PERFORM 1 FROM sigtap_procedimentos_oficial LIMIT 1;
        RAISE NOTICE '✅ Acesso sigtap_procedimentos_oficial: OK';
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro sigtap_procedimentos_oficial: %', SQLERRM;
    END;
END
$$;

-- ================================================
-- 5. RESUMO FINAL
-- ================================================
SELECT '🏁 RESUMO FINAL' as status;

SELECT 
    CASE 
        WHEN (
            EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sigtap_financiamento') AND
            EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sigtap_modalidade') AND
            EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sigtap_procedimentos_oficial') AND
            EXISTS (SELECT 1 FROM information_schema.routines WHERE routine_name = 'sync_official_to_main_table')
        )
        THEN '🎉 SETUP COMPLETO! Pronto para importação oficial!'
        ELSE '⚠️ SETUP INCOMPLETO - Execute os scripts na ordem:'
    END as resultado_final;

-- Instruções se incompleto
SELECT '1. database/sigtap_official_schema.sql' as instrucao_1;
SELECT '2. database/sync_functions.sql' as instrucao_2;  
SELECT '3. database/update_extraction_method_constraint.sql' as instrucao_3;
SELECT '4. Depois teste novamente com este script' as instrucao_4; 