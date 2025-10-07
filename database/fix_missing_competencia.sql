-- =====================================================
-- SCRIPT DE CORREÇÃO: Preencher campo competencia
-- =====================================================
-- Problema: AIHs sem competencia definida causam discrepância
-- entre tela Pacientes e tela Analytics
-- Data: 07/10/2025
-- =====================================================

-- 1. DIAGNÓSTICO: Verificar quantas AIHs estão sem competencia
SELECT 
  hospital_id,
  COUNT(*) as total_aihs,
  COUNT(CASE WHEN competencia IS NULL THEN 1 END) as sem_competencia,
  COUNT(CASE WHEN cns_responsavel IS NULL THEN 1 END) as sem_medico_responsavel,
  ROUND(
    COUNT(CASE WHEN competencia IS NULL THEN 1 END) * 100.0 / COUNT(*),
    2
  ) as percentual_sem_competencia
FROM aihs
GROUP BY hospital_id
ORDER BY sem_competencia DESC;

-- 2. DIAGNÓSTICO DETALHADO: AIHs sem competencia por mês de alta
SELECT 
  hospital_id,
  TO_CHAR(discharge_date, 'YYYY-MM') as mes_alta,
  COUNT(*) as total_sem_competencia,
  MIN(discharge_date) as primeira_alta,
  MAX(discharge_date) as ultima_alta
FROM aihs
WHERE competencia IS NULL
  AND discharge_date IS NOT NULL
GROUP BY hospital_id, TO_CHAR(discharge_date, 'YYYY-MM')
ORDER BY hospital_id, mes_alta DESC;

-- 3. CORREÇÃO: Preencher competencia baseada na data de alta (PRIORIDADE 1)
-- Competência SUS é sempre o mês de alta do paciente
UPDATE aihs
SET 
  competencia = TO_CHAR(discharge_date, 'YYYY-MM') || '-01',
  updated_at = NOW()
WHERE competencia IS NULL
  AND discharge_date IS NOT NULL;

-- Verificar quantas foram atualizadas
SELECT 
  'Atualizadas com discharge_date' as tipo,
  COUNT(*) as total
FROM aihs
WHERE updated_at >= NOW() - INTERVAL '5 seconds';

-- 4. CORREÇÃO: Fallback para data de admissão se alta estiver nula (PRIORIDADE 2)
-- Casos onde não temos discharge_date, usamos admission_date
UPDATE aihs
SET 
  competencia = TO_CHAR(admission_date, 'YYYY-MM') || '-01',
  updated_at = NOW()
WHERE competencia IS NULL
  AND discharge_date IS NULL
  AND admission_date IS NOT NULL;

-- Verificar quantas foram atualizadas no fallback
SELECT 
  'Atualizadas com admission_date (fallback)' as tipo,
  COUNT(*) as total
FROM aihs
WHERE updated_at >= NOW() - INTERVAL '5 seconds';

-- 5. VERIFICAÇÃO FINAL: Confirmar que todas as AIHs têm competencia
SELECT 
  hospital_id,
  COUNT(*) as total_aihs,
  COUNT(CASE WHEN competencia IS NULL THEN 1 END) as ainda_sem_competencia,
  COUNT(CASE WHEN competencia IS NOT NULL THEN 1 END) as com_competencia,
  ROUND(
    COUNT(CASE WHEN competencia IS NOT NULL THEN 1 END) * 100.0 / COUNT(*),
    2
  ) as percentual_preenchido
FROM aihs
GROUP BY hospital_id
ORDER BY hospital_id;

-- 6. CRIAR FUNÇÃO DE QUALIDADE DE DADOS (para monitoramento contínuo)
CREATE OR REPLACE FUNCTION check_aih_quality(p_hospital_id TEXT DEFAULT NULL)
RETURNS JSON AS $$
DECLARE
  result JSON;
BEGIN
  IF p_hospital_id IS NULL OR p_hospital_id = 'ALL' THEN
    -- Análise global (todos os hospitais)
    SELECT json_build_object(
      'total_aihs', COUNT(*),
      'missing_competencia', COUNT(*) FILTER (WHERE competencia IS NULL),
      'missing_doctor', COUNT(*) FILTER (WHERE cns_responsavel IS NULL),
      'missing_discharge_date', COUNT(*) FILTER (WHERE discharge_date IS NULL),
      'cross_month_admission_discharge', COUNT(*) FILTER (
        WHERE DATE_TRUNC('month', admission_date) != DATE_TRUNC('month', discharge_date)
      ),
      'percentual_sem_competencia', ROUND(
        COUNT(*) FILTER (WHERE competencia IS NULL) * 100.0 / NULLIF(COUNT(*), 0),
        2
      ),
      'percentual_sem_medico', ROUND(
        COUNT(*) FILTER (WHERE cns_responsavel IS NULL) * 100.0 / NULLIF(COUNT(*), 0),
        2
      )
    )
    INTO result
    FROM aihs;
  ELSE
    -- Análise por hospital específico
    SELECT json_build_object(
      'total_aihs', COUNT(*),
      'missing_competencia', COUNT(*) FILTER (WHERE competencia IS NULL),
      'missing_doctor', COUNT(*) FILTER (WHERE cns_responsavel IS NULL),
      'missing_discharge_date', COUNT(*) FILTER (WHERE discharge_date IS NULL),
      'cross_month_admission_discharge', COUNT(*) FILTER (
        WHERE DATE_TRUNC('month', admission_date) != DATE_TRUNC('month', discharge_date)
      ),
      'percentual_sem_competencia', ROUND(
        COUNT(*) FILTER (WHERE competencia IS NULL) * 100.0 / NULLIF(COUNT(*), 0),
        2
      ),
      'percentual_sem_medico', ROUND(
        COUNT(*) FILTER (WHERE cns_responsavel IS NULL) * 100.0 / NULLIF(COUNT(*), 0),
        2
      )
    )
    INTO result
    FROM aihs
    WHERE hospital_id = p_hospital_id;
  END IF;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 7. TESTAR FUNÇÃO DE QUALIDADE
SELECT check_aih_quality('ALL');

-- 8. CRIAR TRIGGER PARA AUTO-PREENCHER competencia (PREVENIR FUTUROS PROBLEMAS)
CREATE OR REPLACE FUNCTION auto_fill_competencia()
RETURNS TRIGGER AS $$
BEGIN
  -- Se competencia não foi informada, preencher automaticamente
  IF NEW.competencia IS NULL THEN
    -- Priorizar data de alta
    IF NEW.discharge_date IS NOT NULL THEN
      NEW.competencia := TO_CHAR(NEW.discharge_date, 'YYYY-MM') || '-01';
    -- Fallback para data de admissão
    ELSIF NEW.admission_date IS NOT NULL THEN
      NEW.competencia := TO_CHAR(NEW.admission_date, 'YYYY-MM') || '-01';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Remover trigger antigo se existir
DROP TRIGGER IF EXISTS trigger_auto_fill_competencia ON aihs;

-- Criar novo trigger
CREATE TRIGGER trigger_auto_fill_competencia
  BEFORE INSERT OR UPDATE ON aihs
  FOR EACH ROW
  EXECUTE FUNCTION auto_fill_competencia();

-- 9. ANÁLISE ESPECÍFICA: Hospital FAX - Competência 07/2025
-- Verificar os 15 pacientes que podem estar faltando
SELECT 
  'Hospital FAX - Julho 2025' as analise,
  COUNT(*) as total_aihs,
  COUNT(CASE WHEN competencia = '2025-07-01' THEN 1 END) as com_competencia_julho,
  COUNT(CASE WHEN competencia IS NULL AND TO_CHAR(discharge_date, 'YYYY-MM') = '2025-07' THEN 1 END) as sem_competencia_alta_julho,
  COUNT(CASE WHEN cns_responsavel IS NULL THEN 1 END) as sem_medico_responsavel
FROM aihs
WHERE hospital_id = (SELECT id FROM hospitals WHERE name ILIKE '%juarez%barreto%' OR name ILIKE '%fax%' LIMIT 1)
  AND (
    (discharge_date >= '2025-07-01' AND discharge_date < '2025-08-01')
    OR competencia = '2025-07-01'
  );

-- 10. LISTA DETALHADA: AIHs potencialmente perdidas (FAX 07/2025)
SELECT 
  a.id,
  a.aih_number,
  p.name as paciente,
  a.admission_date,
  a.discharge_date,
  a.competencia,
  a.cns_responsavel,
  d.name as medico_responsavel,
  a.care_character,
  a.calculated_total_value / 100.0 as valor_total_reais
FROM aihs a
LEFT JOIN patients p ON a.patient_id = p.id
LEFT JOIN doctors d ON a.cns_responsavel = d.cns
WHERE a.hospital_id = (SELECT id FROM hospitals WHERE name ILIKE '%juarez%barreto%' OR name ILIKE '%fax%' LIMIT 1)
  AND a.discharge_date >= '2025-07-01' 
  AND a.discharge_date < '2025-08-01'
  AND (
    a.competencia IS NULL 
    OR a.competencia != '2025-07-01'
  )
ORDER BY a.discharge_date DESC;

-- =====================================================
-- RESUMO DE EXECUÇÃO
-- =====================================================
-- 1. Execute o script completo em ordem
-- 2. Verifique os diagnósticos iniciais (etapas 1-2)
-- 3. Execute as correções (etapas 3-4)
-- 4. Confirme o resultado (etapas 5-10)
-- 5. O trigger (etapa 8) previne futuros problemas
-- 6. A função check_aih_quality() pode ser usada para monitoramento
-- =====================================================

-- EXEMPLO DE USO DA FUNÇÃO:
-- SELECT * FROM check_aih_quality('FAX');
-- SELECT * FROM check_aih_quality('ALL');

