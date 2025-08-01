-- ================================================================
-- 🔍 DIAGNÓSTICO: DISCREPÂNCIA DE VALORES MÉDICOS
-- ================================================================
-- Propósito: Entender por que R$1.885.705,65 (cabeçalho) não bate com soma dos médicos
-- Data: $(date)

-- ================================================================
-- 1. VALOR TOTAL NO CABEÇALHO (TABELA AIHS)
-- ================================================================
SELECT 
  '1. CABECALHO - TABELA AIHS' as fonte,
  COUNT(*) as total_aihs,
  SUM(calculated_total_value) as valor_total_centavos,
  ROUND(SUM(calculated_total_value) / 100.0, 2) as valor_total_reais,
  COUNT(CASE WHEN calculated_total_value > 0 THEN 1 END) as aihs_com_valor,
  COUNT(CASE WHEN calculated_total_value IS NULL THEN 1 END) as aihs_sem_valor
FROM aihs;

-- ================================================================
-- 2. VALOR TOTAL DOS PROCEDIMENTOS (TABELA PROCEDURE_RECORDS)
-- ================================================================
SELECT 
  '2. PROCEDIMENTOS - TABELA PROCEDURE_RECORDS' as fonte,
  COUNT(*) as total_procedimentos,
  SUM(total_value) as valor_total_centavos,
  ROUND(SUM(total_value) / 100.0, 2) as valor_total_reais,
  SUM(value_charged) as valor_charged_centavos,
  ROUND(SUM(value_charged) / 100.0, 2) as valor_charged_reais,
  COUNT(DISTINCT patient_id) as pacientes_com_procedimentos,
  COUNT(DISTINCT aih_id) as aihs_com_procedimentos
FROM procedure_records;

-- ================================================================
-- 3. COMPARAÇÃO AIH vs PROCEDIMENTOS POR PACIENTE
-- ================================================================
SELECT 
  '3. COMPARACAO POR PACIENTE' as fonte,
  COUNT(*) as pacientes_total,
  ROUND(SUM(aih_value) / 100.0, 2) as valor_aihs_reais,
  ROUND(SUM(proc_value) / 100.0, 2) as valor_procedimentos_reais,
  ROUND((SUM(aih_value) - SUM(proc_value)) / 100.0, 2) as diferenca_reais,
  COUNT(CASE WHEN aih_value != proc_value THEN 1 END) as pacientes_com_diferenca
FROM (
  SELECT 
    p.id as patient_id,
    p.name as patient_name,
    COALESCE(a.calculated_total_value, 0) as aih_value,
    COALESCE(SUM(pr.total_value), 0) as proc_value
  FROM patients p
  LEFT JOIN aihs a ON p.id = a.patient_id
  LEFT JOIN procedure_records pr ON p.id = pr.patient_id
  GROUP BY p.id, p.name, a.calculated_total_value
) comparacao;

-- ================================================================
-- 4. AIHs SEM PROCEDIMENTOS CORRESPONDENTES
-- ================================================================
SELECT 
  '4. AIHS SEM PROCEDIMENTOS' as fonte,
  COUNT(*) as aihs_sem_procedimentos,
  ROUND(SUM(calculated_total_value) / 100.0, 2) as valor_perdido_reais,
  ROUND(AVG(calculated_total_value) / 100.0, 2) as valor_medio_por_aih
FROM aihs a
LEFT JOIN procedure_records pr ON a.id = pr.aih_id
WHERE pr.aih_id IS NULL;

-- ================================================================
-- 5. PROCEDIMENTOS SEM AIH CORRESPONDENTE
-- ================================================================
SELECT 
  '5. PROCEDIMENTOS ORFAOS' as fonte,
  COUNT(*) as procedimentos_orfaos,
  ROUND(SUM(total_value) / 100.0, 2) as valor_orfao_reais,
  COUNT(DISTINCT patient_id) as pacientes_afetados
FROM procedure_records pr
LEFT JOIN aihs a ON pr.aih_id = a.id
WHERE a.id IS NULL;

-- ================================================================
-- 6. TOP 10 PACIENTES COM MAIOR DISCREPÂNCIA
-- ================================================================
SELECT 
  '6. MAIORES DISCREPANCIAS' as fonte,
  p.name as paciente,
  a.aih_number,
  ROUND(a.calculated_total_value / 100.0, 2) as valor_aih_reais,
  ROUND(COALESCE(SUM(pr.total_value), 0) / 100.0, 2) as valor_procedimentos_reais,
  ROUND((a.calculated_total_value - COALESCE(SUM(pr.total_value), 0)) / 100.0, 2) as diferenca_reais
FROM patients p
INNER JOIN aihs a ON p.id = a.patient_id
LEFT JOIN procedure_records pr ON p.id = pr.patient_id
GROUP BY p.id, p.name, a.aih_number, a.calculated_total_value
HAVING ABS(a.calculated_total_value - COALESCE(SUM(pr.total_value), 0)) > 1000 -- Diferença > R$10
ORDER BY ABS(a.calculated_total_value - COALESCE(SUM(pr.total_value), 0)) DESC
LIMIT 10;

-- ================================================================
-- 7. RESUMO FINAL DA DISCREPÂNCIA
-- ================================================================
WITH totals AS (
  SELECT 
    ROUND(SUM(a.calculated_total_value) / 100.0, 2) as total_aihs_reais,
    ROUND(SUM(pr.total_value) / 100.0, 2) as total_procedimentos_reais
  FROM aihs a
  FULL OUTER JOIN procedure_records pr ON a.patient_id = pr.patient_id
)
SELECT 
  '7. RESUMO DISCREPANCIA' as diagnostico,
  total_aihs_reais as valor_cabecalho_esperado,
  total_procedimentos_reais as valor_medicos_atual,
  total_aihs_reais - total_procedimentos_reais as diferenca_reais,
  ROUND(((total_procedimentos_reais / total_aihs_reais) * 100), 2) as percentual_capturado
FROM totals;