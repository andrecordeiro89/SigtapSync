-- ================================================================
-- ADICIONAR/OTIMIZAR COLUNA COMPETÊNCIA - TABELA AIH_REGISTROS
-- Sistema SISAIH01 - Seleção Manual de Competência
-- ================================================================
-- Data: 2025-01-17
-- Objetivo: Permitir seleção manual da competência ao processar arquivo TXT
-- ================================================================

-- 1. Verificar estrutura atual da coluna competencia
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'aih_registros'
  AND column_name = 'competencia';

-- 2. Garantir que a coluna existe (caso não exista)
ALTER TABLE aih_registros 
  ADD COLUMN IF NOT EXISTS competencia VARCHAR(6);

-- 3. Adicionar comentário explicativo
COMMENT ON COLUMN aih_registros.competencia IS 
  'Competência da AIH no formato YYYYMM (ex: 202501 para janeiro/2025). Selecionada manualmente pelo usuário ao processar arquivo SISAIH01.';

-- 4. Criar índice para otimizar buscas por competência
CREATE INDEX IF NOT EXISTS idx_aih_registros_competencia 
  ON aih_registros(competencia);

COMMENT ON INDEX idx_aih_registros_competencia IS 
  'Índice para otimizar buscas e filtros por competência (mês de referência)';

-- 5. Criar índice composto para consultas por hospital + competência
CREATE INDEX IF NOT EXISTS idx_aih_registros_hospital_competencia 
  ON aih_registros(hospital_id, competencia) 
  WHERE hospital_id IS NOT NULL;

COMMENT ON INDEX idx_aih_registros_hospital_competencia IS 
  'Índice composto para consultas filtradas por hospital e competência';

-- ================================================================
-- VIEW: Estatísticas por Competência
-- ================================================================

CREATE OR REPLACE VIEW aih_registros_por_competencia AS
SELECT 
  competencia,
  COUNT(*) as total_registros,
  COUNT(DISTINCT cns) as pacientes_unicos,
  COUNT(CASE WHEN sexo = 'M' THEN 1 END) as masculino,
  COUNT(CASE WHEN sexo = 'F' THEN 1 END) as feminino,
  COUNT(CASE WHEN tipo_aih = '01' THEN 1 END) as tipo_principal,
  COUNT(CASE WHEN tipo_aih = '03' THEN 1 END) as tipo_continuacao,
  COUNT(CASE WHEN tipo_aih = '05' THEN 1 END) as tipo_longa_permanencia,
  MIN(data_internacao) as primeira_internacao,
  MAX(data_internacao) as ultima_internacao,
  COUNT(DISTINCT cnes_hospital) as hospitais_unicos
FROM aih_registros
WHERE competencia IS NOT NULL
GROUP BY competencia
ORDER BY competencia DESC;

COMMENT ON VIEW aih_registros_por_competencia IS 
  'Estatísticas de registros AIH agrupadas por competência (mês de referência)';

-- ================================================================
-- FUNÇÃO: Listar competências disponíveis
-- ================================================================

CREATE OR REPLACE FUNCTION get_competencias_disponiveis()
RETURNS TABLE (
  competencia VARCHAR(6),
  label TEXT,
  total_registros BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    ar.competencia,
    CASE 
      WHEN ar.competencia ~ '^\d{6}$' THEN 
        SUBSTRING(ar.competencia, 5, 2) || '/' || SUBSTRING(ar.competencia, 1, 4)
      ELSE ar.competencia
    END as label,
    COUNT(*) as total_registros
  FROM aih_registros ar
  WHERE ar.competencia IS NOT NULL
  GROUP BY ar.competencia
  ORDER BY ar.competencia DESC;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_competencias_disponiveis() IS 
  'Retorna lista de competências disponíveis com formatação amigável (MM/YYYY) e total de registros';

-- ================================================================
-- VERIFICAÇÕES FINAIS
-- ================================================================

-- Verificar se índices foram criados
SELECT
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'aih_registros'
  AND indexname LIKE '%competencia%';

-- Testar view de competências
SELECT * FROM aih_registros_por_competencia LIMIT 5;

-- Testar função de listagem
SELECT * FROM get_competencias_disponiveis() LIMIT 10;

-- ================================================================
-- MENSAGEM DE SUCESSO
-- ================================================================

DO $$
BEGIN
  RAISE NOTICE '✅ Coluna competencia configurada com sucesso!';
  RAISE NOTICE '✅ Índices criados para otimização';
  RAISE NOTICE '✅ View aih_registros_por_competencia criada';
  RAISE NOTICE '✅ Função get_competencias_disponiveis() criada';
  RAISE NOTICE '';
  RAISE NOTICE '📊 Execute SELECT * FROM aih_registros_por_competencia;';
  RAISE NOTICE '📋 Execute SELECT * FROM get_competencias_disponiveis();';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Próximo passo: Atualizar interface SISAIH01Page.tsx';
END $$;

