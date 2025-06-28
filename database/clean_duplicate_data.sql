-- ================================================
-- LIMPEZA DE DADOS DUPLICADOS E VERSÕES MÚLTIPLAS
-- ⚠️ Execute APENAS após rodar investigate_duplicate_data.sql
-- ================================================

SELECT '🧹 INICIANDO LIMPEZA DE DADOS...' as status;

-- ================================================
-- 1. CORRIGIR MÚLTIPLAS VERSÕES ATIVAS
-- ================================================

-- Desativar todas as versões antigas, mantendo apenas a mais recente
UPDATE sigtap_versions 
SET is_active = false 
WHERE id NOT IN (
    SELECT id FROM (
        SELECT id 
        FROM sigtap_versions 
        WHERE extraction_method = 'official'
        ORDER BY created_at DESC 
        LIMIT 1
    ) as latest_version
);

-- Ativar apenas a versão mais recente
UPDATE sigtap_versions 
SET is_active = true 
WHERE id = (
    SELECT id 
    FROM sigtap_versions 
    WHERE extraction_method = 'official'
    ORDER BY created_at DESC 
    LIMIT 1
);

SELECT '✅ Versões corrigidas - apenas a mais recente está ativa' as resultado;

-- ================================================
-- 2. REMOVER DADOS DUPLICADOS (MANTER MAIS RECENTE)
-- ================================================

-- Criar tabela temporária com dados únicos (mais recentes por código)
CREATE TEMP TABLE IF NOT EXISTS temp_unique_procedures AS
SELECT DISTINCT ON (code) *
FROM sigtap_procedures
ORDER BY code, created_at DESC;

SELECT '📋 Dados únicos identificados: ' || COUNT(*) || ' registros' as info
FROM temp_unique_procedures;

-- Verificar quantos registros serão removidos
SELECT 
    '🗑️ REGISTROS A SEREM REMOVIDOS' as acao,
    (SELECT COUNT(*) FROM sigtap_procedures) - (SELECT COUNT(*) FROM temp_unique_procedures) as total_duplicatas;

-- ================================================
-- 3. LIMPEZA SEGURA (BACKUP + REPLACE)
-- ================================================

-- Backup da tabela original (caso precise reverter)
DROP TABLE IF EXISTS sigtap_procedures_backup;
CREATE TABLE sigtap_procedures_backup AS 
SELECT * FROM sigtap_procedures;

SELECT '💾 Backup criado com ' || (SELECT COUNT(*) FROM sigtap_procedures_backup) || ' registros' as backup_info;

-- Limpar tabela principal
DELETE FROM sigtap_procedures;

-- Inserir apenas dados únicos
INSERT INTO sigtap_procedures 
SELECT * FROM temp_unique_procedures;

-- Verificar resultado
SELECT 
    '✅ LIMPEZA CONCLUÍDA' as resultado,
    (SELECT COUNT(*) FROM sigtap_procedures_backup) as registros_antes,
    (SELECT COUNT(*) FROM sigtap_procedures) as registros_depois,
    (SELECT COUNT(*) FROM sigtap_procedures_backup) - (SELECT COUNT(*) FROM sigtap_procedures) as removidos;

-- ================================================
-- 4. ATUALIZAR ESTATÍSTICAS DA VERSÃO
-- ================================================

UPDATE sigtap_versions 
SET total_procedures = (SELECT COUNT(*) FROM sigtap_procedures WHERE version_id = sigtap_versions.id)
WHERE is_active = true;

-- ================================================
-- 5. VERIFICAÇÃO FINAL
-- ================================================

SELECT 
    '🎯 VERIFICAÇÃO FINAL' as titulo,
    'sigtap_procedimentos_oficial' as tabela_origem,
    (SELECT COUNT(*) FROM sigtap_procedimentos_oficial) as registros_origem;

SELECT 
    '🎯 VERIFICAÇÃO FINAL' as titulo,
    'sigtap_procedures' as tabela_principal,
    (SELECT COUNT(*) FROM sigtap_procedures) as registros_principais;

SELECT 
    '📊 COMPARAÇÃO FINAL' as resultado,
    (SELECT COUNT(*) FROM sigtap_procedimentos_oficial) as origem,
    (SELECT COUNT(*) FROM sigtap_procedures) as principal,
    CASE 
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) = (SELECT COUNT(*) FROM sigtap_procedimentos_oficial)
        THEN '✅ PERFEITO: Quantidades iguais'
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) < (SELECT COUNT(*) FROM sigtap_procedimentos_oficial)
        THEN '⚠️ PRINCIPAL MENOR: Alguns dados podem não ter sido sincronizados'
        ELSE '🚨 PRINCIPAL MAIOR: Ainda há problema (investigar mais)'
    END as status_final;

-- Limpar tabela temporária
DROP TABLE IF EXISTS temp_unique_procedures;

SELECT '🧹 Limpeza concluída! Tabelas temporárias removidas.' as final_status;

-- ================================================
-- 6. RECOMENDAÇÃO PRÓXIMOS PASSOS
-- ================================================

SELECT 
    CASE 
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) = (SELECT COUNT(*) FROM sigtap_procedimentos_oficial)
        THEN '✅ SUCESSO! Recarregue a página do frontend e teste'
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) < (SELECT COUNT(*) FROM sigtap_procedimentos_oficial)
        THEN '🔄 Execute novamente sync_ultra_safe.sql para completar sincronização'
        ELSE '🔍 Execute investigate_duplicate_data.sql novamente para mais detalhes'
    END as proximos_passos; 