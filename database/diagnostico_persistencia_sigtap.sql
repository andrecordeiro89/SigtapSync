-- =====================================================
-- DIAGNÓSTICO COMPLETO - PERSISTÊNCIA SIGTAP DADOS
-- =====================================================

-- 1. VERIFICAR VERSÕES ATIVAS
SELECT '=== VERSÕES SIGTAP ===' as diagnostico;
SELECT 
    id,
    version_name,
    file_type,
    total_procedures,
    extraction_method,
    import_status,
    is_active,
    import_date
FROM sigtap_versions 
ORDER BY created_at DESC
LIMIT 5;

-- 2. CONTAR DADOS NA TABELA DE UPLOAD (onde seus dados estão)
SELECT '=== DADOS NA TABELA SIGTAP_PROCEDURES ===' as diagnostico;
SELECT 
    COUNT(*) as total_procedures_upload,
    COUNT(DISTINCT version_id) as versions_count,
    MIN(created_at) as primeiro_upload,
    MAX(created_at) as ultimo_upload
FROM sigtap_procedures;

-- 3. CONTAR DADOS NA TABELA OFICIAL (onde sistema tenta carregar)
SELECT '=== DADOS NA TABELA OFICIAL ===' as diagnostico;
SELECT 
    COUNT(*) as total_procedures_oficial,
    COUNT(DISTINCT competencia) as competencias_count
FROM sigtap_procedimentos_oficial;

-- 4. VERIFICAR VERSÃO ATIVA ESPECÍFICA
SELECT '=== DETALHES DA VERSÃO ATIVA ===' as diagnostico;
SELECT 
    v.id,
    v.version_name,
    v.is_active,
    v.total_procedures as declared_total,
    COUNT(p.id) as actual_procedures
FROM sigtap_versions v
LEFT JOIN sigtap_procedures p ON v.id = p.version_id
WHERE v.is_active = true
GROUP BY v.id, v.version_name, v.is_active, v.total_procedures;

-- 5. VERIFICAR SE HÁ DADOS SEM VERSÃO ATIVA
SELECT '=== PROCEDIMENTOS SEM VERSÃO ATIVA ===' as diagnostico;
SELECT 
    COUNT(*) as procedures_sem_versao_ativa
FROM sigtap_procedures p
WHERE p.version_id NOT IN (
    SELECT id FROM sigtap_versions WHERE is_active = true
);

-- 6. SAMPLE DOS PRIMEIROS PROCEDIMENTOS (para debug)
SELECT '=== SAMPLE DE DADOS UPLOAD ===' as diagnostico;
SELECT 
    code,
    description,
    value_hosp,
    value_prof,
    value_amb,
    version_id
FROM sigtap_procedures 
ORDER BY code
LIMIT 5;

-- 7. VERIFICAR PERMISSÕES RLS
SELECT '=== TESTE RLS ===' as diagnostico;
SELECT 
    current_user as usuario_atual,
    session_user as usuario_sessao;

-- 8. RESUMO FINAL
SELECT '=== RESUMO DIAGNÓSTICO ===' as diagnostico;
SELECT 
    (SELECT COUNT(*) FROM sigtap_procedures) as dados_upload,
    (SELECT COUNT(*) FROM sigtap_procedimentos_oficial) as dados_oficial,
    (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) as versoes_ativas,
    CASE 
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) > 0 
             AND (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) = 0
        THEN 'PROBLEMA: Dados existem mas sem versão ativa'
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) = 0
        THEN 'PROBLEMA: Nenhum dado na tabela de upload'
        WHEN (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) > 1
        THEN 'PROBLEMA: Múltiplas versões ativas'
        ELSE 'CONFIGURAÇÃO OK'
    END as status_diagnostico; 