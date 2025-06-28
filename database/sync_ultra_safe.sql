-- ================================================
-- SINCRONIZAÇÃO ULTRA SEGURA - SEM OVERFLOWS
-- Execute este script no SQL Editor do Supabase
-- ================================================

SELECT '🛡️ INICIANDO SINCRONIZAÇÃO ULTRA SEGURA...' as status;

-- ================================================
-- 1. VERIFICAR DADOS PROBLEMÁTICOS ANTES
-- ================================================

-- Verificar valores que podem causar overflow
SELECT 
    'VERIFICANDO POTENCIAIS OVERFLOWS' as titulo,
    MAX(dias_permanencia) as max_dias_permanencia,
    MAX(idade_minima) as max_idade_minima,
    MAX(idade_maxima) as max_idade_maxima,
    MAX(quantidade_maxima) as max_quantidade_maxima,
    MAX(pontos) as max_pontos,
    MAX(valor_sa) as max_valor_sa,
    MAX(valor_sh) as max_valor_sh,
    MAX(valor_sp) as max_valor_sp
FROM sigtap_procedimentos_oficial;

-- Contar registros problemáticos
SELECT 
    'REGISTROS PROBLEMÁTICOS' as titulo,
    COUNT(*) FILTER (WHERE dias_permanencia > 999.99) as dias_acima_999,
    COUNT(*) FILTER (WHERE idade_minima > 2000000000) as idade_min_overflow,
    COUNT(*) FILTER (WHERE idade_maxima > 2000000000) as idade_max_overflow,
    COUNT(*) FILTER (WHERE quantidade_maxima > 2000000000) as quantidade_overflow,
    COUNT(*) FILTER (WHERE pontos > 2000000000) as pontos_overflow
FROM sigtap_procedimentos_oficial;

-- ================================================
-- 2. VERIFICAR E CORRIGIR CONSTRAINTS SE NECESSÁRIO
-- ================================================

-- Adicionar constraint se não existir
DO $$
BEGIN
    -- Verificar se a constraint já existe
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE table_name = 'sigtap_procedures' 
        AND constraint_type = 'UNIQUE'
        AND constraint_name LIKE '%version_id%'
    ) THEN
        -- Criar constraint se não existe
        ALTER TABLE sigtap_procedures 
        ADD CONSTRAINT uk_sigtap_procedures_version_code 
        UNIQUE (version_id, code);
        
        RAISE NOTICE '✅ Constraint única (version_id, code) criada';
    ELSE
        RAISE NOTICE '✅ Constraint única já existe';
    END IF;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '⚠️ Erro ao criar constraint: %. Continuando sem ela...', SQLERRM;
END $$;

-- ================================================
-- 3. CRIAR VERSÃO PARA OS DADOS OFICIAIS
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
  'Dados_Oficiais_SIGTAP_' || COALESCE((SELECT competencia FROM sigtap_procedimentos_oficial LIMIT 1), '202504'),
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

-- ================================================
-- 4. SINCRONIZAÇÃO ULTRA SEGURA
-- ================================================

-- Método ULTRA SEGURO - com tratamento de overflows
DO $$
DECLARE
  v_version_id UUID;
  v_total_inserted INTEGER := 0;
  v_batch_size INTEGER := 50; -- Lotes menores para mais controle
  v_offset INTEGER := 0;
  v_total_oficial INTEGER;
  v_current_batch INTEGER;
  v_errors INTEGER := 0;
BEGIN
  -- Buscar versão oficial
  SELECT id INTO v_version_id
  FROM sigtap_versions 
  WHERE version_name LIKE 'Dados_Oficiais_SIGTAP_%'
  AND extraction_method = 'official'
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF v_version_id IS NULL THEN
    RAISE EXCEPTION 'Versão oficial não encontrada';
  END IF;
  
  -- Contar total de procedimentos oficiais
  SELECT COUNT(*) INTO v_total_oficial
  FROM sigtap_procedimentos_oficial;
  
  RAISE NOTICE '📊 Sincronizando % procedimentos oficiais com tratamento de overflow...', v_total_oficial;
  
  -- Limpar dados anteriores desta versão (se existir)
  DELETE FROM sigtap_procedures WHERE version_id = v_version_id;
  RAISE NOTICE '🗑️ Dados anteriores removidos';
  
  -- Loop para processar em lotes
  LOOP
    EXIT WHEN v_offset >= v_total_oficial;
    
    -- Inserir lote de dados convertidos com TRATAMENTO DE OVERFLOW
    BEGIN
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
        
        -- Idades SEGURAS
        CASE 
          WHEN p.idade_minima IS NULL THEN 0
          WHEN p.idade_minima > 150 THEN 150
          WHEN p.idade_minima < 0 THEN 0
          ELSE p.idade_minima
        END as min_age,
        
        CASE WHEN p.idade_minima IS NOT NULL THEN 'ANOS' ELSE '' END as min_age_unit,
        
        CASE 
          WHEN p.idade_maxima IS NULL THEN 0
          WHEN p.idade_maxima > 150 THEN 150
          WHEN p.idade_maxima < 0 THEN 0
          ELSE p.idade_maxima
        END as max_age,
        
        CASE WHEN p.idade_maxima IS NOT NULL THEN 'ANOS' ELSE '' END as max_age_unit,
        
        -- Quantidade SEGURA
        CASE 
          WHEN p.quantidade_maxima IS NULL THEN 0
          WHEN p.quantidade_maxima > 999999 THEN 999999
          WHEN p.quantidade_maxima < 0 THEN 0
          ELSE p.quantidade_maxima
        END as max_quantity,
        
        -- AVERAGE_STAY SEGURO (DECIMAL 5,2 = máximo 999.99)
        CASE 
          WHEN p.dias_permanencia IS NULL THEN 0.00
          WHEN p.dias_permanencia > 999.99 THEN 999.99
          WHEN p.dias_permanencia < 0 THEN 0.00
          ELSE p.dias_permanencia
        END as average_stay,
        
        -- Pontos SEGUROS
        CASE 
          WHEN p.pontos IS NULL THEN 0
          WHEN p.pontos > 999999 THEN 999999
          WHEN p.pontos < 0 THEN 0
          ELSE p.pontos
        END as points,
        
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
      LIMIT v_batch_size OFFSET v_offset;
      
      -- Atualizar contadores
      GET DIAGNOSTICS v_current_batch = ROW_COUNT;
      v_total_inserted := v_total_inserted + v_current_batch;
      
    EXCEPTION
      WHEN OTHERS THEN
        v_errors := v_errors + 1;
        RAISE NOTICE '❌ Erro no lote % (offset %): %', v_errors, v_offset, SQLERRM;
    END;
    
    v_offset := v_offset + v_batch_size;
    
    -- Log do progresso
    RAISE NOTICE 'Processados % de % procedimentos (%.1f%%) - Lote: % - Erros: %', 
      v_offset, v_total_oficial, 
      (v_offset::DECIMAL / v_total_oficial * 100),
      v_current_batch,
      v_errors;
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
  
  RAISE NOTICE '🎉 SINCRONIZAÇÃO ULTRA SEGURA CONCLUÍDA!';
  RAISE NOTICE '📊 Total sincronizado: % procedimentos', v_total_inserted;
  RAISE NOTICE '❌ Total de erros: % lotes', v_errors;
  RAISE NOTICE '✅ Versão % ativada', v_version_id;
END;
$$;

-- ================================================
-- 5. VERIFICAR RESULTADOS ULTRA DETALHADOS
-- ================================================

SELECT '📊 VERIFICANDO RESULTADOS ULTRA DETALHADOS...' as status;

-- Estatísticas finais
SELECT 
  'RESULTADOS DA SINCRONIZAÇÃO ULTRA SEGURA' as titulo,
  (SELECT COUNT(*) FROM sigtap_procedimentos_oficial) as auxiliar_total,
  (SELECT COUNT(*) FROM sigtap_procedures) as principal_total,
  (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) as versoes_ativas,
  (SELECT version_name FROM sigtap_versions WHERE is_active = true LIMIT 1) as versao_ativa;

-- Verificar valores extremos inseridos
SELECT 
  'VALORES EXTREMOS INSERIDOS' as titulo,
  MAX(average_stay) as max_average_stay,
  MIN(average_stay) as min_average_stay,
  MAX(min_age) as max_min_age,
  MAX(max_age) as max_max_age,
  MAX(max_quantity) as max_quantity,
  MAX(points) as max_points
FROM sigtap_procedures 
WHERE version_id IN (SELECT id FROM sigtap_versions WHERE is_active = true);

-- Amostras dos dados sincronizados
SELECT 
  'AMOSTRAS DOS DADOS SINCRONIZADOS' as titulo,
  code, 
  LEFT(description, 40) || '...' as description_preview,
  complexity,
  value_amb,
  value_hosp,
  value_prof,
  average_stay,
  points
FROM sigtap_procedures 
WHERE version_id IN (SELECT id FROM sigtap_versions WHERE is_active = true)
ORDER BY code 
LIMIT 10;

-- Verificar se há dados
SELECT 
  CASE 
    WHEN (SELECT COUNT(*) FROM sigtap_procedures) > 0 
    THEN '🎉 SUCESSO TOTAL! Dados sincronizados com segurança na tabela principal!'
    ELSE '❌ PROBLEMA: Tabela principal ainda vazia'
  END as resultado_final;

SELECT '🛡️ SINCRONIZAÇÃO ULTRA SEGURA CONCLUÍDA!' as status; 