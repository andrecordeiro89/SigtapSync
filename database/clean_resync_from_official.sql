-- ================================================
-- LIMPEZA E RE-SINCRONIZAÇÃO TOTAL 
-- Usando tabela auxiliar como fonte da verdade
-- ================================================

SELECT '🧹 INICIANDO LIMPEZA E RE-SINCRONIZAÇÃO...' as status;

-- ================================================
-- 1. VERIFICAÇÃO PRÉ-LIMPEZA
-- ================================================

SELECT 
    '📊 SITUAÇÃO ATUAL' as info,
    (SELECT COUNT(*) FROM sigtap_procedimentos_oficial) as auxiliar_oficial,
    (SELECT COUNT(*) FROM sigtap_procedures) as principal_atual,
    (SELECT COUNT(*) FROM sigtap_procedures) - (SELECT COUNT(*) FROM sigtap_procedimentos_oficial) as diferenca;

-- ================================================
-- 2. BACKUP DE SEGURANÇA
-- ================================================

-- Backup completo da tabela principal atual
DROP TABLE IF EXISTS sigtap_procedures_backup_completo;
CREATE TABLE sigtap_procedures_backup_completo AS 
SELECT * FROM sigtap_procedures;

SELECT '💾 BACKUP criado: ' || (SELECT COUNT(*) FROM sigtap_procedures_backup_completo) || ' registros salvos' as backup_info;

-- ================================================
-- 3. IDENTIFICAR VERSÃO ATIVA
-- ================================================

DO $$
DECLARE
    v_version_id UUID;
BEGIN
    -- Buscar versão oficial ativa
    SELECT id INTO v_version_id
    FROM sigtap_versions 
    WHERE extraction_method = 'official'
    AND is_active = true
    ORDER BY created_at DESC
    LIMIT 1;
    
    IF v_version_id IS NULL THEN
        RAISE NOTICE '⚠️ Nenhuma versão oficial ativa encontrada. Criando uma nova...';
        
        -- Criar versão se não existir
        INSERT INTO sigtap_versions (
            version_name,
            file_type,
            extraction_method,
            total_procedures,
            import_status,
            import_date,
            is_active
        ) VALUES (
            'Dados_Oficiais_SIGTAP_Limpo_' || TO_CHAR(NOW(), 'YYYYMMDD_HH24MI'),
            'zip',
            'official',
            (SELECT COUNT(*) FROM sigtap_procedimentos_oficial),
            'completed',
            NOW(),
            true
        ) RETURNING id INTO v_version_id;
    END IF;
    
    RAISE NOTICE '✅ Versão oficial ID: %', v_version_id;
END $$;

-- ================================================
-- 4. LIMPEZA TOTAL DA TABELA PRINCIPAL
-- ================================================

DELETE FROM sigtap_procedures;

SELECT '🗑️ Tabela principal limpa. Registros removidos: ' || (SELECT COUNT(*) FROM sigtap_procedures_backup_completo) as limpeza_info;

-- ================================================
-- 5. RE-SINCRONIZAÇÃO COMPLETA E SEGURA
-- ================================================

-- Buscar dados complementares
CREATE TEMP TABLE temp_financiamentos AS
SELECT codigo, nome FROM sigtap_financiamento;

-- Inserir TODOS os dados oficiais com tratamento de overflow
INSERT INTO sigtap_procedures (
    version_id, code, description, origem, complexity, modality, 
    registration_instrument, financing, value_amb, value_amb_total, 
    value_hosp, value_prof, value_hosp_total, complementary_attribute,
    service_classification, especialidade_leito, gender, min_age, 
    min_age_unit, max_age, max_age_unit, max_quantity, average_stay, 
    points, cid, cbo, habilitation, habilitation_group, 
    extraction_confidence, validation_status, validation_notes, created_at
)
SELECT 
    (SELECT id FROM sigtap_versions WHERE is_active = true AND extraction_method = 'official' LIMIT 1) as version_id,
    p.codigo as code,
    p.nome as description,
    'Dados Oficiais DATASUS' as origem,
    
    -- Converter complexidade
    CASE p.complexidade
        WHEN '1' THEN 'ATENÇÃO BÁSICA'
        WHEN '2' THEN 'MÉDIA COMPLEXIDADE'
        WHEN '3' THEN 'ALTA COMPLEXIDADE'
        ELSE 'NÃO INFORMADO'
    END as complexity,
    
    'Não informado' as modality,
    'Tabela Oficial' as registration_instrument,
    
    -- Buscar financiamento
    COALESCE(f.nome, 'Não informado') as financing,
    
    -- Valores convertidos para centavos (SEGUROS)
    CASE 
        WHEN p.valor_sa IS NULL THEN 0
        WHEN p.valor_sa * 100 > 2000000000 THEN 2000000000
        WHEN p.valor_sa * 100 < 0 THEN 0
        ELSE (p.valor_sa * 100)::INTEGER
    END as value_amb,
    
    CASE 
        WHEN p.valor_sa IS NULL THEN 0
        WHEN p.valor_sa * 100 > 2000000000 THEN 2000000000
        WHEN p.valor_sa * 100 < 0 THEN 0
        ELSE (p.valor_sa * 100)::INTEGER
    END as value_amb_total,
    
    CASE 
        WHEN p.valor_sh IS NULL THEN 0
        WHEN p.valor_sh * 100 > 2000000000 THEN 2000000000
        WHEN p.valor_sh * 100 < 0 THEN 0
        ELSE (p.valor_sh * 100)::INTEGER
    END as value_hosp,
    
    CASE 
        WHEN p.valor_sp IS NULL THEN 0
        WHEN p.valor_sp * 100 > 2000000000 THEN 2000000000
        WHEN p.valor_sp * 100 < 0 THEN 0
        ELSE (p.valor_sp * 100)::INTEGER
    END as value_prof,
    
    CASE 
        WHEN p.valor_sh IS NULL AND p.valor_sp IS NULL THEN 0
        WHEN COALESCE(p.valor_sh, 0) + COALESCE(p.valor_sp, 0) > 20000000 THEN 2000000000
        WHEN COALESCE(p.valor_sh, 0) + COALESCE(p.valor_sp, 0) < 0 THEN 0
        ELSE ((COALESCE(p.valor_sh, 0) + COALESCE(p.valor_sp, 0)) * 100)::INTEGER
    END as value_hosp_total,
    
    'Dados Oficiais' as complementary_attribute,
    'Não informado' as service_classification,
    'Não informado' as especialidade_leito,
    
    -- Converter sexo
    CASE p.sexo
        WHEN 'A' THEN 'AMBOS'
        WHEN 'M' THEN 'M'
        WHEN 'F' THEN 'F'
        ELSE 'AMBOS'
    END as gender,
    
    -- Idades com proteção
    CASE 
        WHEN p.idade_minima > 150 THEN 0
        ELSE COALESCE(p.idade_minima, 0)
    END as min_age,
    
    CASE 
        WHEN p.idade_minima IS NOT NULL AND p.idade_minima <= 150 THEN 'ANOS'
        ELSE ''
    END as min_age_unit,
    
    CASE 
        WHEN p.idade_maxima > 150 THEN 150
        ELSE COALESCE(p.idade_maxima, 0)
    END as max_age,
    
    CASE 
        WHEN p.idade_maxima IS NOT NULL AND p.idade_maxima <= 150 THEN 'ANOS'
        ELSE ''
    END as max_age_unit,
    
    -- Quantidade máxima com proteção
    CASE 
        WHEN p.quantidade_maxima > 2000000000 THEN 999999
        ELSE COALESCE(p.quantidade_maxima, 0)
    END as max_quantity,
    
    -- Dias permanência com proteção
    CASE 
        WHEN p.dias_permanencia > 999.99 THEN 999.99
        WHEN p.dias_permanencia < 0 THEN 0
        ELSE COALESCE(p.dias_permanencia, 0)
    END as average_stay,
    
    -- Pontos com proteção
    CASE 
        WHEN p.pontos > 2000000000 THEN 999999
        ELSE COALESCE(p.pontos, 0)
    END as points,
    
    '{}'::text[] as cid,
    '{}'::text[] as cbo,
    'Não informado' as habilitation,
    '{}'::text[] as habilitation_group,
    0.95 as extraction_confidence,
    'validated' as validation_status,
    'Dados oficiais DATASUS' as validation_notes,
    NOW() as created_at

FROM sigtap_procedimentos_oficial p
LEFT JOIN temp_financiamentos f ON f.codigo = p.codigo_financiamento
ORDER BY p.codigo;

-- ================================================
-- 6. ATUALIZAR ESTATÍSTICAS DA VERSÃO
-- ================================================

UPDATE sigtap_versions 
SET total_procedures = (SELECT COUNT(*) FROM sigtap_procedures)
WHERE is_active = true AND extraction_method = 'official';

-- ================================================
-- 7. VERIFICAÇÃO FINAL COMPLETA
-- ================================================

SELECT '✅ RE-SINCRONIZAÇÃO CONCLUÍDA' as status;

SELECT 
    '📊 RESULTADO FINAL' as resultado,
    (SELECT COUNT(*) FROM sigtap_procedimentos_oficial) as registros_oficiais,
    (SELECT COUNT(*) FROM sigtap_procedures) as registros_principais,
    CASE 
        WHEN (SELECT COUNT(*) FROM sigtap_procedures) = (SELECT COUNT(*) FROM sigtap_procedimentos_oficial)
        THEN '✅ PERFEITO: Quantidades iguais'
        ELSE '❌ ERRO: Quantidades diferentes'
    END as status_sincronizacao;

SELECT 
    '🎯 ESTATÍSTICAS FINAIS' as info,
    MIN(code) as primeiro_codigo,
    MAX(code) as ultimo_codigo,
    COUNT(DISTINCT code) as codigos_unicos,
    COUNT(*) as total_registros
FROM sigtap_procedures;

-- Limpar tabelas temporárias
DROP TABLE IF EXISTS temp_financiamentos;

SELECT 
    '🎉 PROCESSO CONCLUÍDO!' as status,
    'Agora recarregue a página do frontend e teste!' as proxima_acao; 