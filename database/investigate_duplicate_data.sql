-- ================================================
-- INVESTIGAÇÃO: DADOS DUPLICADOS OU MÚLTIPLAS VERSÕES
-- Execute este script no SQL Editor do Supabase
-- ================================================

SELECT '🔍 INVESTIGANDO SITUAÇÃO INESPERADA...' as status;

-- ================================================
-- 1. CONTAGEM EXATA DAS TABELAS
-- ================================================

SELECT 
    '📊 CONTAGEM EXATA' as tipo,
    'sigtap_procedimentos_oficial' as tabela,
    COUNT(*) as total
FROM sigtap_procedimentos_oficial

UNION ALL

SELECT 
    '📊 CONTAGEM EXATA' as tipo,
    'sigtap_procedures' as tabela,
    COUNT(*) as total
FROM sigtap_procedures;

-- ================================================
-- 2. VERIFICAR VERSÕES MÚLTIPLAS
-- ================================================

SELECT 
    '📋 TODAS AS VERSÕES' as info,
    id,
    version_name,
    is_active,
    total_procedures,
    created_at
FROM sigtap_versions
ORDER BY created_at DESC;

-- Contar procedimentos por versão
SELECT 
    '🔢 PROCEDIMENTOS POR VERSÃO' as info,
    v.version_name,
    v.is_active,
    COUNT(p.id) as total_nesta_versao
FROM sigtap_versions v
LEFT JOIN sigtap_procedures p ON p.version_id = v.id
GROUP BY v.id, v.version_name, v.is_active
ORDER BY v.created_at DESC;

-- ================================================
-- 3. VERIFICAR DUPLICATAS NA TABELA PRINCIPAL
-- ================================================

-- Códigos duplicados na tabela principal
SELECT 
    '🚨 CÓDIGOS DUPLICADOS' as problema,
    code,
    COUNT(*) as vezes_duplicado
FROM sigtap_procedures
GROUP BY code
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 10;

-- Contar total de duplicatas
SELECT 
    '📈 TOTAL DE DUPLICATAS' as info,
    COUNT(*) as codigos_com_duplicata,
    SUM(cnt - 1) as registros_extras
FROM (
    SELECT code, COUNT(*) as cnt
    FROM sigtap_procedures
    GROUP BY code
    HAVING COUNT(*) > 1
) duplicates;

-- ================================================
-- 4. VERIFICAR SE HÁ MÚLTIPLAS VERSÕES ATIVAS
-- ================================================

SELECT 
    '⚠️ VERSÕES ATIVAS' as alerta,
    COUNT(*) as total_versoes_ativas
FROM sigtap_versions
WHERE is_active = true;

-- ================================================
-- 5. VERIFICAR REGISTROS ÚNICOS vs DUPLICADOS
-- ================================================

SELECT 
    '📊 ANÁLISE DE UNICIDADE' as analise,
    COUNT(*) as total_registros,
    COUNT(DISTINCT code) as codigos_unicos,
    COUNT(*) - COUNT(DISTINCT code) as registros_duplicados
FROM sigtap_procedures;

-- ================================================
-- 6. IDENTIFICAR CAUSA RAIZ
-- ================================================

SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) > 1
        THEN '🚨 PROBLEMA: Múltiplas versões ativas encontradas!'
        
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) > (SELECT COUNT(DISTINCT code) FROM sigtap_procedures)
        THEN '🚨 PROBLEMA: Códigos duplicados na tabela principal!'
        
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) > (SELECT COUNT(*) FROM sigtap_procedimentos_oficial)
        AND (SELECT COUNT(DISTINCT code) FROM sigtap_procedures) = (SELECT COUNT(*) FROM sigtap_procedimentos_oficial)
        THEN '🤔 SITUAÇÃO: Dados extras na principal, mas sem duplicatas de código'
        
        ELSE '✅ SITUAÇÃO: Dados parecem corretos, investigar mais'
    END as diagnostico;

-- ================================================
-- 7. RECOMENDAÇÃO DE AÇÃO
-- ================================================

SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) > 1
        THEN '🔧 AÇÃO: Desative versões antigas e mantenha apenas uma ativa'
        
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) > (SELECT COUNT(DISTINCT code) FROM sigtap_procedures)
        THEN '🧹 AÇÃO: Limpe dados duplicados da tabela principal'
        
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) > (SELECT COUNT(*) FROM sigtap_procedimentos_oficial) * 1.5
        THEN '🗑️ AÇÃO: Limpe completamente a tabela principal e re-sincronize'
        
        ELSE '🔍 AÇÃO: Investigação manual necessária'
    END as recomendacao_acao; 