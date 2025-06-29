-- ================================================
-- VERIFICAR SE DADOS SIGTAP FORAM SALVOS
-- Execute após fazer upload para confirmar salvamento
-- ================================================

-- CONTAGEM GERAL
SELECT 
    'CONTAGEM GERAL' as categoria,
    'sigtap_versions' as tabela,
    COUNT(*) as total
FROM sigtap_versions
UNION ALL
SELECT 
    'CONTAGEM GERAL',
    'sigtap_procedures',
    COUNT(*)
FROM sigtap_procedures;

-- ÚLTIMAS 3 VERSÕES CRIADAS
SELECT 
    'ÚLTIMAS VERSÕES' as info,
    version_name,
    total_procedures as "Declarado",
    import_status,
    is_active,
    created_at
FROM sigtap_versions 
ORDER BY created_at DESC 
LIMIT 3;

-- VERIFICAR CORRESPONDÊNCIA: DECLARADO vs REALMENTE SALVO
SELECT 
    sv.version_name as "Versão",
    sv.total_procedures as "Declarado",
    COUNT(sp.id) as "Realmente_Salvo",
    CASE 
        WHEN sv.total_procedures = COUNT(sp.id) THEN '✅ OK'
        WHEN COUNT(sp.id) = 0 THEN '❌ NADA SALVO'
        ELSE '⚠️ PARCIAL'
    END as "Status",
    sv.created_at as "Criado_em"
FROM sigtap_versions sv
LEFT JOIN sigtap_procedures sp ON sv.id = sp.version_id
WHERE sv.created_at > NOW() - INTERVAL '2 hours'
GROUP BY sv.id, sv.version_name, sv.total_procedures, sv.created_at
ORDER BY sv.created_at DESC;

-- AMOSTRA DOS PROCEDIMENTOS SALVOS (últimos 5)
SELECT 
    'AMOSTRA SALVA' as info,
    sp.code as "Código",
    LEFT(sp.description, 50) as "Descrição",
    sp.complexity as "Complexidade",
    sp.created_at as "Salvo_em"
FROM sigtap_procedures sp
JOIN sigtap_versions sv ON sp.version_id = sv.id
ORDER BY sp.created_at DESC
LIMIT 5;

-- STATUS DA VERSÃO ATIVA
SELECT 
    'VERSÃO ATIVA' as info,
    version_name as "Nome",
    total_procedures as "Total_Proc",
    is_active as "Ativa",
    created_at as "Criada_em"
FROM sigtap_versions 
WHERE is_active = true;

-- DIAGNÓSTICO FINAL
DO $$
DECLARE
    total_versions INTEGER;
    total_procedures INTEGER;
    ultima_versao RECORD;
    procedures_ultima INTEGER;
BEGIN
    -- Contar totais
    SELECT COUNT(*) INTO total_versions FROM sigtap_versions;
    SELECT COUNT(*) INTO total_procedures FROM sigtap_procedures;
    
    -- Última versão
    SELECT version_name, total_procedures, import_status 
    INTO ultima_versao
    FROM sigtap_versions 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- Procedimentos da última versão
    SELECT COUNT(*) INTO procedures_ultima
    FROM sigtap_procedures
    WHERE version_id = (
        SELECT id FROM sigtap_versions 
        ORDER BY created_at DESC 
        LIMIT 1
    );
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 DIAGNÓSTICO FINAL:';
    RAISE NOTICE '================================';
    RAISE NOTICE 'Total de versões: %', total_versions;
    RAISE NOTICE 'Total de procedimentos: %', total_procedures;
    
    IF ultima_versao IS NOT NULL THEN
        RAISE NOTICE '';
        RAISE NOTICE 'Última versão: %', ultima_versao.version_name;
        RAISE NOTICE 'Declarado: % procedimentos', ultima_versao.total_procedures;
        RAISE NOTICE 'Realmente salvo: % procedimentos', procedures_ultima;
        RAISE NOTICE 'Status: %', ultima_versao.import_status;
        
        IF ultima_versao.total_procedures = procedures_ultima AND procedures_ultima > 0 THEN
            RAISE NOTICE '';
            RAISE NOTICE '✅ SUCESSO: Todos os dados foram salvos corretamente!';
        ELSIF procedures_ultima = 0 THEN
            RAISE NOTICE '';
            RAISE NOTICE '❌ PROBLEMA: Versão criada mas nenhum procedimento salvo';
            RAISE NOTICE 'Verificar logs do console do navegador';
        ELSE
            RAISE NOTICE '';
            RAISE NOTICE '⚠️ PARCIAL: Alguns procedimentos não foram salvos';
        END IF;
    ELSE
        RAISE NOTICE '❌ Nenhuma versão encontrada';
    END IF;
    
    RAISE NOTICE '================================';
END $$; 