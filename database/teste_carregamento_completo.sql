-- =====================================================
-- TESTE: CARREGAMENTO COMPLETO DOS 4886 PROCEDIMENTOS
-- Verifica se o frontend vai carregar todos os dados
-- =====================================================

SELECT '🎯 TESTE DE CARREGAMENTO COMPLETO' as titulo;

-- 1. VERIFICAR TOTAL DE PROCEDIMENTOS NO BANCO
SELECT 
    '📊 DADOS NO BANCO' as secao,
    COUNT(*) as total_procedimentos_banco
FROM sigtap_procedures;

-- 2. VERIFICAR VERSÃO ATIVA E SEUS PROCEDIMENTOS
SELECT 
    '✅ VERSÃO ATIVA' as secao,
    sv.version_name,
    sv.total_procedures as declarado,
    COUNT(sp.id) as realmente_salvos,
    CASE 
        WHEN COUNT(sp.id) = sv.total_procedures THEN '✅ CORRETO'
        ELSE '⚠️ DIVERGÊNCIA'
    END as status
FROM sigtap_versions sv
LEFT JOIN sigtap_procedures sp ON sv.id = sp.version_id
WHERE sv.is_active = true
GROUP BY sv.id, sv.version_name, sv.total_procedures;

-- 3. SIMULAR CARREGAMENTO DO FRONTEND (com paginação)
-- Página 1 (1-1000)
SELECT 
    '📄 PÁGINA 1 (1-1000)' as teste,
    COUNT(*) as registros_pagina_1
FROM sigtap_procedures sp
JOIN sigtap_versions sv ON sp.version_id = sv.id
WHERE sv.is_active = true
ORDER BY sp.code
LIMIT 1000 OFFSET 0;

-- Página 2 (1001-2000)
SELECT 
    '📄 PÁGINA 2 (1001-2000)' as teste,
    COUNT(*) as registros_pagina_2
FROM sigtap_procedures sp
JOIN sigtap_versions sv ON sp.version_id = sv.id
WHERE sv.is_active = true
ORDER BY sp.code
LIMIT 1000 OFFSET 1000;

-- Página 3 (2001-3000)
SELECT 
    '📄 PÁGINA 3 (2001-3000)' as teste,
    COUNT(*) as registros_pagina_3
FROM sigtap_procedures sp
JOIN sigtap_versions sv ON sp.version_id = sv.id
WHERE sv.is_active = true
ORDER BY sp.code
LIMIT 1000 OFFSET 2000;

-- Página 4 (3001-4000)
SELECT 
    '📄 PÁGINA 4 (3001-4000)' as teste,
    COUNT(*) as registros_pagina_4
FROM sigtap_procedures sp
JOIN sigtap_versions sv ON sp.version_id = sv.id
WHERE sv.is_active = true
ORDER BY sp.code
LIMIT 1000 OFFSET 3000;

-- Página 5 (4001-5000)
SELECT 
    '📄 PÁGINA 5 (4001-5000)' as teste,
    COUNT(*) as registros_pagina_5
FROM sigtap_procedures sp
JOIN sigtap_versions sv ON sp.version_id = sv.id
WHERE sv.is_active = true
ORDER BY sp.code
LIMIT 1000 OFFSET 4000;

-- 4. RESULTADO FINAL
SELECT 
    '🎉 RESULTADO FINAL' as resultado,
    (SELECT COUNT(*) FROM sigtap_procedures sp
     JOIN sigtap_versions sv ON sp.version_id = sv.id
     WHERE sv.is_active = true) as total_disponivel_frontend,
    CASE 
        WHEN (SELECT COUNT(*) FROM sigtap_procedures sp
              JOIN sigtap_versions sv ON sp.version_id = sv.id
              WHERE sv.is_active = true) >= 4800 THEN '✅ EXCELENTE - Todos os procedimentos disponíveis'
        WHEN (SELECT COUNT(*) FROM sigtap_procedures sp
              JOIN sigtap_versions sv ON sp.version_id = sv.id
              WHERE sv.is_active = true) >= 4000 THEN '⚠️ BOM - Maioria dos procedimentos disponível'
        ELSE '❌ PROBLEMA - Poucos procedimentos disponíveis'
    END as status_final; 