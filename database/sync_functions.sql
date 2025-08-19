-- ================================================================
-- RPC: get_hospital_kpis
-- Retorna faturamento total e quantidade de AIHs para um hospital
-- no intervalo [p_start, p_end]
-- ================================================================

CREATE OR REPLACE FUNCTION public.get_hospital_kpis(
  p_hospital_id uuid,
  p_start timestamptz,
  p_end timestamptz
) RETURNS TABLE (
  total_revenue numeric,
  total_aihs integer
) LANGUAGE plpgsql AS $$
BEGIN
  RETURN QUERY
  SELECT
    COALESCE(SUM(aih.calculated_total_value), 0)::numeric AS total_revenue,
    COUNT(*)::int AS total_aihs
  FROM public.aihs aih
  WHERE aih.hospital_id = p_hospital_id
    AND aih.discharge_date >= p_start
    AND aih.discharge_date <= p_end
    AND aih.calculated_total_value IS NOT NULL;
END;
$$;

COMMENT ON FUNCTION public.get_hospital_kpis(uuid, timestamptz, timestamptz)
  IS 'KPIs do hospital: soma de calculated_total_value e count de AIHs no período.';

-- ================================================
-- FUNÇÕES DE SINCRONIZAÇÃO - SIGTAP OFICIAL
-- Sincroniza dados oficiais com a tabela principal
-- ================================================

-- Função para sincronizar dados oficiais com a tabela principal
CREATE OR REPLACE FUNCTION sync_official_to_main_table(p_version_id UUID)
RETURNS TABLE(
  total_imported INTEGER,
  total_errors INTEGER,
  success_rate DECIMAL(5,2)
) AS $$
DECLARE
  v_imported INTEGER := 0;
  v_errors INTEGER := 0;
  v_batch_size INTEGER := 500;
  v_offset INTEGER := 0;
  v_total_official INTEGER;
  v_batch_count INTEGER;
BEGIN
  -- Contar total de procedimentos oficiais
  SELECT COUNT(*) INTO v_total_official
  FROM sigtap_procedimentos_oficial;
  
  -- Desativar todas as versões anteriores
  UPDATE sigtap_versions 
  SET is_active = FALSE 
  WHERE id != p_version_id;
  
  -- Ativar a nova versão
  UPDATE sigtap_versions 
  SET is_active = TRUE 
  WHERE id = p_version_id;
  
  -- Loop para processar em lotes
  LOOP
    EXIT WHEN v_offset >= v_total_official;
    
    -- Inserir lote de dados convertidos
    WITH converted_data AS (
      SELECT 
        p_version_id as version_id,
        p.codigo as code,
        p.nome as description,
        'Não informado' as origem, -- Padrão para dados oficiais
        
        -- Converter complexidade
        CASE p.complexidade
          WHEN '1' THEN 'ATENÇÃO BÁSICA'
          WHEN '2' THEN 'MÉDIA COMPLEXIDADE'
          WHEN '3' THEN 'ALTA COMPLEXIDADE'
          ELSE 'NÃO INFORMADO'
        END as complexity,
        
        -- Buscar modalidade
        COALESCE(
          (SELECT m.nome FROM sigtap_modalidade m 
           JOIN sigtap_procedimento_modalidade pm ON m.codigo = pm.codigo_modalidade 
           WHERE pm.codigo_procedimento = p.codigo LIMIT 1),
          'Não informado'
        ) as modality,
        
        'Não informado' as registration_instrument, -- Padrão
        
        -- Buscar financiamento
        COALESCE(f.nome, 'Não informado') as financing,
        
        -- Valores convertidos para centavos
        COALESCE((p.valor_sa * 100)::INTEGER, 0) as value_amb,
        COALESCE((p.valor_sa * 100)::INTEGER, 0) as value_amb_total,
        COALESCE((p.valor_sh * 100)::INTEGER, 0) as value_hosp,
        COALESCE((p.valor_sp * 100)::INTEGER, 0) as value_prof,
        COALESCE(((p.valor_sh + p.valor_sp) * 100)::INTEGER, 0) as value_hosp_total,
        
        'Não informado' as complementary_attribute,
        'Não informado' as service_classification,
        'Não informado' as especialidade_leito,
        
        -- Converter sexo
        CASE p.sexo
          WHEN 'A' THEN 'AMBOS'
          WHEN 'M' THEN 'M'
          WHEN 'F' THEN 'F'
          ELSE NULL
        END as gender,
        
        p.idade_minima as min_age,
        CASE 
          WHEN p.idade_minima IS NOT NULL THEN 'ANOS'
          ELSE NULL
        END as min_age_unit,
        
        p.idade_maxima as max_age,
        CASE 
          WHEN p.idade_maxima IS NOT NULL THEN 'ANOS'
          ELSE NULL
        END as max_age_unit,
        
        p.quantidade_maxima as max_quantity,
        p.dias_permanencia as average_stay,
        p.pontos,
        
        -- Arrays de CIDs relacionados
        COALESCE(
          ARRAY(
            SELECT pc.codigo_cid 
            FROM sigtap_procedimento_cid pc 
            WHERE pc.codigo_procedimento = p.codigo
          ),
          '{}'::TEXT[]
        ) as cid,
        
        -- Arrays de CBOs relacionados
        COALESCE(
          ARRAY(
            SELECT po.codigo_ocupacao 
            FROM sigtap_procedimento_ocupacao po 
            WHERE po.codigo_procedimento = p.codigo
          ),
          '{}'::TEXT[]
        ) as cbo,
        
        'Não informado' as habilitation,
        '{}'::TEXT[] as habilitation_group,
        
        -- Metadados
        100 as extraction_confidence, -- 100% confiança (dados oficiais)
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
      modality = EXCLUDED.modality,
      financing = EXCLUDED.financing,
      value_amb = EXCLUDED.value_amb,
      value_hosp = EXCLUDED.value_hosp,
      value_prof = EXCLUDED.value_prof,
      gender = EXCLUDED.gender,
      min_age = EXCLUDED.min_age,
      max_age = EXCLUDED.max_age,
      max_quantity = EXCLUDED.max_quantity,
      average_stay = EXCLUDED.average_stay,
      points = EXCLUDED.points,
      cid = EXCLUDED.cid,
      cbo = EXCLUDED.cbo,
      extraction_confidence = EXCLUDED.extraction_confidence,
      validation_status = EXCLUDED.validation_status,
      validation_notes = EXCLUDED.validation_notes;
    
    -- Atualizar contadores
    GET DIAGNOSTICS v_batch_count = ROW_COUNT;
    v_imported := v_imported + v_batch_count;
    v_offset := v_offset + v_batch_size;
    
    -- Log do progresso
    RAISE NOTICE 'Processados % de % procedimentos (%.1f%%)', 
      v_offset, v_total_official, 
      (v_offset::DECIMAL / v_total_official * 100);
  END LOOP;
  
  -- Atualizar estatísticas da versão
  UPDATE sigtap_versions 
  SET 
    total_procedures = v_imported,
    import_status = CASE WHEN v_errors = 0 THEN 'completed' ELSE 'completed_with_errors' END,
    processing_time_ms = EXTRACT(EPOCH FROM NOW() - created_at) * 1000
  WHERE id = p_version_id;
  
  -- Retornar resultados
  RETURN QUERY SELECT 
    v_imported,
    v_errors,
    CASE WHEN v_imported > 0 THEN 
      ((v_imported - v_errors)::DECIMAL / v_imported * 100)::DECIMAL(5,2)
    ELSE 0::DECIMAL(5,2) END;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- FUNÇÃO PARA LIMPAR DADOS ANTIGOS
-- ================================================
CREATE OR REPLACE FUNCTION cleanup_old_official_data()
RETURNS INTEGER AS $$
DECLARE
  v_deleted INTEGER := 0;
BEGIN
  -- Deletar dados de relacionamentos órfãos
  DELETE FROM sigtap_procedimento_cid 
  WHERE codigo_procedimento NOT IN (
    SELECT codigo FROM sigtap_procedimentos_oficial
  );
  
  DELETE FROM sigtap_procedimento_ocupacao 
  WHERE codigo_procedimento NOT IN (
    SELECT codigo FROM sigtap_procedimentos_oficial
  );
  
  DELETE FROM sigtap_procedimento_modalidade 
  WHERE codigo_procedimento NOT IN (
    SELECT codigo FROM sigtap_procedimentos_oficial
  );
  
  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  
  RETURN v_deleted;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- FUNÇÃO PARA ESTATÍSTICAS DE IMPORTAÇÃO
-- ================================================
CREATE OR REPLACE FUNCTION get_import_statistics()
RETURNS TABLE(
  total_financiamentos INTEGER,
  total_modalidades INTEGER,
  total_procedimentos INTEGER,
  total_relacionamentos_cid INTEGER,
  total_relacionamentos_ocupacao INTEGER,
  total_relacionamentos_modalidade INTEGER,
  competencia_mais_recente VARCHAR(6)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    (SELECT COUNT(*)::INTEGER FROM sigtap_financiamento) as total_financiamentos,
    (SELECT COUNT(*)::INTEGER FROM sigtap_modalidade) as total_modalidades,
    (SELECT COUNT(*)::INTEGER FROM sigtap_procedimentos_oficial) as total_procedimentos,
    (SELECT COUNT(*)::INTEGER FROM sigtap_procedimento_cid) as total_relacionamentos_cid,
    (SELECT COUNT(*)::INTEGER FROM sigtap_procedimento_ocupacao) as total_relacionamentos_ocupacao,
    (SELECT COUNT(*)::INTEGER FROM sigtap_procedimento_modalidade) as total_relacionamentos_modalidade,
    (SELECT competencia FROM sigtap_procedimentos_oficial ORDER BY competencia DESC LIMIT 1) as competencia_mais_recente;
END;
$$ LANGUAGE plpgsql;

-- ================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ================================================
COMMENT ON FUNCTION sync_official_to_main_table(UUID) IS 'Sincroniza dados oficiais SIGTAP com a tabela principal sigtap_procedures';
COMMENT ON FUNCTION cleanup_old_official_data() IS 'Remove dados órfãos das tabelas de relacionamento';
COMMENT ON FUNCTION get_import_statistics() IS 'Retorna estatísticas dos dados oficiais importados'; 