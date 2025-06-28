-- ================================================
-- SINCRONIZAÇÃO MANUAL - TABELAS AUXILIARES → PRINCIPAL
-- Execute este script no SQL Editor do Supabase
-- ================================================

SELECT '🔄 INICIANDO SINCRONIZAÇÃO MANUAL...' as status;

-- ================================================
-- 1. VERIFICAR DADOS ANTES DA SINCRONIZAÇÃO
-- ================================================

-- Contar procedimentos nas tabelas auxiliares
SELECT 
  (SELECT COUNT(*) FROM sigtap_procedimentos_oficial) as auxiliar_total,
  (SELECT COUNT(*) FROM sigtap_procedures) as principal_total,
  (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) as versoes_ativas;

-- ================================================
-- 2. CRIAR VERSÃO PARA OS DADOS OFICIAIS
-- ================================================

-- Inserir uma versão para os dados oficiais se não existir
INSERT INTO sigtap_versions (
  version_name,
  file_type,
  extraction_method,
  total_procedures,
  import_status,
  import_date,
  is_active
)
SELECT 
  'Dados_Oficiais_SIGTAP_' || (SELECT competencia FROM sigtap_procedimentos_oficial LIMIT 1),
  'zip',
  'official',
  (SELECT COUNT(*) FROM sigtap_procedimentos_oficial),
  'completed',
  NOW(),
  false
WHERE NOT EXISTS (
  SELECT 1 FROM sigtap_versions 
  WHERE version_name LIKE 'Dados_Oficiais_SIGTAP_%'
  AND extraction_method = 'official'
);

-- Pegar o ID da versão oficial
DO $$
DECLARE
  v_version_id UUID;
  v_total_inserted INTEGER := 0;
  v_batch_size INTEGER := 100;
  v_offset INTEGER := 0;
  v_total_oficial INTEGER;
BEGIN
  -- Buscar versão oficial
  SELECT id INTO v_version_id
  FROM sigtap_versions 
  WHERE version_name LIKE 'Dados_Oficiais_SIGTAP_%'
  AND extraction_method = 'official'
  LIMIT 1;
  
  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'Versão oficial não encontrada';
  END IF;
  
  -- Contar total de procedimentos oficiais
  SELECT COUNT(*) INTO v_total_oficial
  FROM sigtap_procedimentos_oficial;
  
  RAISE NOTICE '📊 Sincronizando % procedimentos oficiais...', v_total_oficial;
  
  -- Limpar dados anteriores desta versão (se existir)
  DELETE FROM sigtap_procedures WHERE version_id = v_version_id;
  
  -- Loop para processar em lotes
  LOOP
    EXIT WHEN v_offset >= v_total_oficial;
    
    -- Inserir lote de dados convertidos
    WITH converted_data AS (
      SELECT 
        v_version_id as version_id,
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
        
        -- Valores convertidos para centavos
        COALESCE((p.valor_sa * 100)::INTEGER, 0) as value_amb,
        COALESCE((p.valor_sa * 100)::INTEGER, 0) as value_amb_total,
        COALESCE((p.valor_sh * 100)::INTEGER, 0) as value_hosp,
        COALESCE((p.valor_sp * 100)::INTEGER, 0) as value_prof,
        COALESCE(((p.valor_sh + p.valor_sp) * 100)::INTEGER, 0) as value_hosp_total,
        
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
        
        COALESCE(p.idade_minima, 0) as min_age,
        CASE WHEN p.idade_minima IS NOT NULL THEN 'ANOS' ELSE '' END as min_age_unit,
        COALESCE(p.idade_maxima, 0) as max_age,
        CASE WHEN p.idade_maxima IS NOT NULL THEN 'ANOS' ELSE '' END as max_age_unit,
        
        COALESCE(p.quantidade_maxima, 0) as max_quantity,
        COALESCE(p.dias_permanencia, 0) as average_stay,
        COALESCE(p.pontos, 0) as points,
        
        -- Arrays vazios por enquanto (dados de relacionamento virão depois)
        '{}'::TEXT[] as cid,
        '{}'::TEXT[] as cbo,
        
        'Não informado' as habilitation,
        '{}'::TEXT[] as habilitation_group,
        
        -- Metadados
        100 as extraction_confidence,
        'valid' as validation_status,
        'Dados oficiais DATASUS' as validation_notes,
        
        NOW() as created_at
        
      FROM sigtap_procedimentos_oficial p
      LEFT JOIN sigtap_financiamento f ON p.codigo_financiamento = f.codigo
      ORDER BY p.codigo
      LIMIT v_batch_size OFFSET v_offset
    )
    INSERT INTO sigtap_procedures (
      version_id, code, description, origem, complexity, modality, 
      registration_instrument, financing, value_amb, value_amb_total, 
      value_hosp, value_prof, value_hosp_total, complementary_attribute,
      service_classification, especialidade_leito, gender, min_age, 
      min_age_unit, max_age, max_age_unit, max_quantity, average_stay, 
      points, cid, cbo, habilitation, habilitation_group, 
      extraction_confidence, validation_status, validation_notes, created_at
    )
    SELECT * FROM converted_data
    ON CONFLICT (version_id, code) DO UPDATE SET
      description = EXCLUDED.description,
      complexity = EXCLUDED.complexity,
      financing = EXCLUDED.financing,
      value_amb = EXCLUDED.value_amb,
      value_hosp = EXCLUDED.value_hosp,
      value_prof = EXCLUDED.value_prof,
      gender = EXCLUDED.gender,
      min_age = EXCLUDED.min_age,
      max_age = EXCLUDED.max_age,
      max_quantity = EXCLUDED.max_quantity,
      average_stay = EXCLUDED.average_stay,
      points = EXCLUDED.points;
    
    -- Atualizar contadores
    GET DIAGNOSTICS v_total_inserted = ROW_COUNT;
    v_offset := v_offset + v_batch_size;
    
    -- Log do progresso
    RAISE NOTICE 'Processados % de % procedimentos (%.1f%%)', 
      v_offset, v_total_oficial, 
      (v_offset::DECIMAL / v_total_oficial * 100);
  END LOOP;
  
  -- Ativar a versão oficial
  UPDATE sigtap_versions 
  SET is_active = FALSE; -- Desativar todas
  
  UPDATE sigtap_versions 
  SET 
    is_active = TRUE,
    total_procedures = v_total_inserted,
    processing_time_ms = EXTRACT(EPOCH FROM NOW() - created_at) * 1000
  WHERE id = v_version_id;
  
  RAISE NOTICE '🎉 SINCRONIZAÇÃO CONCLUÍDA!';
  RAISE NOTICE '📊 Total sincronizado: % procedimentos', v_total_inserted;
  RAISE NOTICE '✅ Versão % ativada', v_version_id;
END;
$$;

-- ================================================
-- 3. VERIFICAR RESULTADOS
-- ================================================

SELECT '📊 VERIFICANDO RESULTADOS...' as status;

-- Estatísticas finais
SELECT 
  'RESULTADOS DA SINCRONIZAÇÃO' as titulo,
  (SELECT COUNT(*) FROM sigtap_procedimentos_oficial) as auxiliar_total,
  (SELECT COUNT(*) FROM sigtap_procedures) as principal_total,
  (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) as versoes_ativas,
  (SELECT version_name FROM sigtap_versions WHERE is_active = true LIMIT 1) as versao_ativa;

-- Amostras dos dados sincronizados
SELECT 
  'AMOSTRAS DOS DADOS SINCRONIZADOS' as titulo,
  code, 
  LEFT(description, 50) || '...' as description_preview,
  complexity,
  financing,
  value_amb,
  value_hosp,
  value_prof
FROM sigtap_procedures 
WHERE version_id IN (SELECT id FROM sigtap_versions WHERE is_active = true)
ORDER BY code 
LIMIT 5;

SELECT '🎉 SINCRONIZAÇÃO MANUAL CONCLUÍDA!' as status; 