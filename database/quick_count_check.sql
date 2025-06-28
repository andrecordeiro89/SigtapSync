-- ================================================
-- VERIFICAÇÃO RÁPIDA DE CONTAGEM
-- Execute para confirmar quantos registros temos
-- ================================================

-- Contagem rápida
SELECT 
    'CONTAGEM RÁPIDA' as tipo,
    (SELECT COUNT(*) FROM sigtap_procedimentos_oficial) as auxiliar,
    (SELECT COUNT(*) FROM sigtap_procedures) as principal;

-- Verificar versão ativa  
SELECT 
    'VERSÃO ATIVA' as info,
    version_name,
    total_procedures,
    is_active
FROM sigtap_versions 
WHERE is_active = true; 