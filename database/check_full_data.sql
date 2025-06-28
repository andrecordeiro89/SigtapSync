-- ================================================
-- VERIFICAÇÃO COMPLETA DE DADOS SIGTAP
-- Execute este script no SQL Editor do Supabase
-- ================================================

SELECT '🔍 VERIFICAÇÃO COMPLETA DE DADOS SIGTAP' as status;

-- ================================================
-- 1. VERIFICAR DADOS AUXILIARES (ORIGINAIS)
-- ================================================

SELECT 
    '📋 DADOS AUXILIARES - Procedimentos Oficiais' as tabela,
    COUNT(*) as total_registros,
    MIN(codigo) as primeiro_codigo,
    MAX(codigo) as ultimo_codigo,
    COUNT(DISTINCT competencia) as diferentes_competencias
FROM sigtap_procedimentos_oficial;

SELECT 
    '💰 DADOS AUXILIARES - Financiamentos' as tabela,
    COUNT(*) as total_registros
FROM sigtap_financiamento;

SELECT 
    '🏥 DADOS AUXILIARES - Modalidades' as tabela,
    COUNT(*) as total_registros
FROM sigtap_modalidade;

-- ================================================
-- 2. VERIFICAR DADOS PRINCIPAIS (SINCRONIZADOS)
-- ================================================

SELECT 
    '🎯 DADOS PRINCIPAIS - Procedimentos' as tabela,
    COUNT(*) as total_registros,
    MIN(code) as primeiro_codigo,
    MAX(code) as ultimo_codigo
FROM sigtap_procedures;

-- Verificar distribuição por versão
SELECT 
    '📊 DISTRIBUIÇÃO POR VERSÃO' as info,
    v.version_name,
    v.is_active,
    COUNT(p.id) as total_procedimentos
FROM sigtap_versions v
LEFT JOIN sigtap_procedures p ON p.version_id = v.id
GROUP BY v.id, v.version_name, v.is_active
ORDER BY v.created_at DESC;

-- ================================================
-- 3. VERIFICAR DIFERENÇAS
-- ================================================

SELECT 
    '⚖️ COMPARAÇÃO AUXILIAR vs PRINCIPAL' as comparacao,
    (SELECT COUNT(*) FROM sigtap_procedimentos_oficial) as total_auxiliar,
    (SELECT COUNT(*) FROM sigtap_procedures) as total_principal,
    (SELECT COUNT(*) FROM sigtap_procedimentos_oficial) - (SELECT COUNT(*) FROM sigtap_procedures) as diferenca;

-- ================================================
-- 4. VERIFICAR REGISTROS FALTANTES (se houver)
-- ================================================

-- Códigos que estão no auxiliar mas não no principal
SELECT 
    '❌ CÓDIGOS FALTANTES NO PRINCIPAL' as status,
    COUNT(*) as total_faltantes
FROM sigtap_procedimentos_oficial o
WHERE NOT EXISTS (
    SELECT 1 FROM sigtap_procedures p 
    WHERE p.code = o.codigo
);

-- Mostrar alguns exemplos dos códigos faltantes (primeiros 10)
SELECT 
    '📝 EXEMPLOS DE CÓDIGOS FALTANTES' as status,
    o.codigo,
    o.nome
FROM sigtap_procedimentos_oficial o
WHERE NOT EXISTS (
    SELECT 1 FROM sigtap_procedures p 
    WHERE p.code = o.codigo
)
ORDER BY o.codigo
LIMIT 10;

-- ================================================
-- 5. VERIFICAR VERSÃO ATIVA
-- ================================================

SELECT 
    '✅ VERSÃO ATIVA ATUAL' as status,
    version_name,
    total_procedures,
    import_status,
    import_date,
    is_active
FROM sigtap_versions
WHERE is_active = true;

-- ================================================
-- 6. SUGESTÃO DE AÇÃO
-- ================================================

SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) < (SELECT COUNT(*) FROM sigtap_procedimentos_oficial)
        THEN '🚨 AÇÃO NECESSÁRIA: Execute novamente o script sync_ultra_safe.sql para sincronizar todos os dados'
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) = (SELECT COUNT(*) FROM sigtap_procedimentos_oficial)
        THEN '✅ TUDO OK: Todos os dados estão sincronizados. O problema pode ser no limite do frontend.'
        ELSE '⚠️ VERIFICAÇÃO: Tabela principal tem mais registros que auxiliar - situação inesperada'
    END as recomendacao; 