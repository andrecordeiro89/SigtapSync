-- ================================================
-- VERIFICAÇÃO FINAL - SUCESSO DA SINCRONIZAÇÃO
-- Execute para confirmar que tudo está funcionando
-- ================================================

SELECT '🎯 VERIFICAÇÃO FINAL DO RESULTADO' as status;

-- ================================================
-- 1. CONTAGEM FINAL
-- ================================================

SELECT 
    '📊 CONTAGEM FINAL' as verificacao,
    (SELECT COUNT(*) FROM sigtap_procedimentos_oficial) as registros_oficiais,
    (SELECT COUNT(*) FROM sigtap_procedures) as registros_principais,
    CASE 
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) = (SELECT COUNT(*) FROM sigtap_procedimentos_oficial)
        THEN '✅ PERFEITO: Quantidades iguais!'
        ELSE '❌ PROBLEMA: Quantidades diferentes'
    END as status_sincronizacao;

-- ================================================
-- 2. VERIFICAR UNICIDADE
-- ================================================

SELECT 
    '🔍 VERIFICAÇÃO DE UNICIDADE' as teste,
    COUNT(*) as total_registros,
    COUNT(DISTINCT code) as codigos_unicos,
    CASE 
        WHEN COUNT(*) = COUNT(DISTINCT code)
        THEN '✅ SEM DUPLICATAS'
        ELSE '❌ HÁ DUPLICATAS'
    END as status_duplicatas
FROM sigtap_procedures;

-- ================================================
-- 3. AMOSTRA DOS DADOS
-- ================================================

SELECT 
    '📋 AMOSTRA DOS DADOS (primeiros 5)' as info,
    code,
    LEFT(description, 50) || '...' as procedimento_resumo,
    complexity,
    financing
FROM sigtap_procedures
ORDER BY code
LIMIT 5;

-- ================================================
-- 4. VERIFICAR VERSÃO ATIVA
-- ================================================

SELECT 
    '🎯 VERSÃO ATIVA' as info,
    version_name,
    is_active,
    total_procedures,
    import_date
FROM sigtap_versions
WHERE is_active = true;

-- ================================================
-- 5. ESTATÍSTICAS GERAIS
-- ================================================

SELECT 
    '📈 ESTATÍSTICAS GERAIS' as info,
    MIN(code) as primeiro_codigo,
    MAX(code) as ultimo_codigo,
    COUNT(DISTINCT complexity) as tipos_complexidade,
    COUNT(DISTINCT financing) as tipos_financiamento
FROM sigtap_procedures;

-- ================================================
-- 6. RESULTADO FINAL
-- ================================================

SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) = (SELECT COUNT(*) FROM sigtap_procedimentos_oficial)
        AND (SELECT COUNT(*) FROM sigtap_procedures) = (SELECT COUNT(DISTINCT code) FROM sigtap_procedures)
        AND (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) = 1
        THEN '🎉 SUCESSO TOTAL! Frontend deve mostrar ' || (SELECT COUNT(*) FROM sigtap_procedures) || ' procedimentos'
        ELSE '⚠️ Verificar problemas acima'
    END as resultado_final; 