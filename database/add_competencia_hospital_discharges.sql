-- ================================================================
-- ADICIONAR COLUNA: Competência em hospital_discharges
-- Data: 2025-11-03
-- ================================================================
-- Objetivo: Permitir filtrar altas por competência (mesmo formato das AIHs)
-- Formato: YYYY-MM-DD (primeiro dia do mês da alta)
-- ================================================================

-- 1. ADICIONAR COLUNA COMPETÊNCIA
ALTER TABLE hospital_discharges
ADD COLUMN IF NOT EXISTS competencia DATE;

-- 2. POPULAR COMPETÊNCIA PARA REGISTROS EXISTENTES
-- Extrair primeiro dia do mês da data_saida
UPDATE hospital_discharges
SET competencia = DATE_TRUNC('month', data_saida)::DATE
WHERE competencia IS NULL AND data_saida IS NOT NULL;

-- 3. CRIAR ÍNDICE PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_discharges_competencia 
ON hospital_discharges(competencia);

-- 4. CRIAR ÍNDICE COMPOSTO (hospital + competência)
CREATE INDEX IF NOT EXISTS idx_discharges_hospital_competencia 
ON hospital_discharges(hospital_id, competencia);

-- 5. COMENTÁRIO DESCRITIVO
COMMENT ON COLUMN hospital_discharges.competencia IS 'Competência da alta (primeiro dia do mês) - formato YYYY-MM-DD para match com AIHs';

-- 6. CRIAR FUNÇÃO PARA CALCULAR COMPETÊNCIA AUTOMATICAMENTE
CREATE OR REPLACE FUNCTION calculate_discharge_competencia()
RETURNS TRIGGER AS $$
BEGIN
  -- Calcular competência baseado na data_saida (primeiro dia do mês)
  IF NEW.data_saida IS NOT NULL THEN
    NEW.competencia := DATE_TRUNC('month', NEW.data_saida)::DATE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 7. CRIAR TRIGGER PARA ATUALIZAR COMPETÊNCIA AUTOMATICAMENTE
DROP TRIGGER IF EXISTS set_discharge_competencia ON hospital_discharges;
CREATE TRIGGER set_discharge_competencia
  BEFORE INSERT OR UPDATE OF data_saida ON hospital_discharges
  FOR EACH ROW
  EXECUTE FUNCTION calculate_discharge_competencia();

-- 8. VERIFICAR ESTRUTURA ATUALIZADA
SELECT 
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'hospital_discharges'
  AND column_name = 'competencia';

-- 9. VERIFICAR DADOS
SELECT 
  COUNT(*) as total_registros,
  COUNT(competencia) as registros_com_competencia,
  COUNT(DISTINCT competencia) as competencias_unicas
FROM hospital_discharges;

-- ✅ FINALIZADO
SELECT 'Coluna competência adicionada com sucesso!' as status;

