-- ================================================================
-- 🔍 DIAGNÓSTICO: DISCREPÂNCIA AIH-PACIENTES NA TABELA MÉDICA
-- ================================================================
-- Propósito: Entender por que 818 AIHs não resultam em 818 pacientes na tabela
-- Data: $(date)

-- ================================================================
-- 1. CONTAGEM TOTAL DE AIHS
-- ================================================================
SELECT 
  '1. TOTAL DE AIHS' as diagnostico,
  COUNT(*) as total_aihs,
  COUNT(CASE WHEN cns_responsavel IS NOT NULL THEN 1 END) as aihs_com_medico_responsavel,
  COUNT(CASE WHEN cns_responsavel IS NULL THEN 1 END) as aihs_sem_medico_responsavel,
  ROUND(
    (COUNT(CASE WHEN cns_responsavel IS NOT NULL THEN 1 END) * 100.0 / COUNT(*)), 2
  ) as percentual_com_medico
FROM aihs;

-- ================================================================
-- 2. MÉDICOS RESPONSÁVEIS ÚNICOS
-- ================================================================
SELECT 
  '2. MEDICOS RESPONSAVEIS' as diagnostico,
  COUNT(DISTINCT cns_responsavel) as medicos_unicos,
  COUNT(*) as total_registros_com_medico
FROM aihs 
WHERE cns_responsavel IS NOT NULL;

-- ================================================================
-- 3. RELAÇÃO AIH-PACIENTE (DEVE SER 1:1)
-- ================================================================
SELECT 
  '3. RELACAO AIH-PACIENTE' as diagnostico,
  COUNT(*) as total_aihs,
  COUNT(DISTINCT patient_id) as pacientes_unicos,
  COUNT(*) - COUNT(DISTINCT patient_id) as possíveis_duplicatas
FROM aihs 
WHERE cns_responsavel IS NOT NULL;

-- ================================================================
-- 4. PACIENTES COM MÚLTIPLAS AIHS
-- ================================================================
SELECT 
  '4. PACIENTES MULTIPLAS AIHS' as diagnostico,
  COUNT(*) as pacientes_com_multiplas_aihs,
  SUM(aih_count) as total_aihs_dessas_duplicatas
FROM (
  SELECT 
    patient_id,
    COUNT(*) as aih_count
  FROM aihs 
  WHERE cns_responsavel IS NOT NULL
  GROUP BY patient_id
  HAVING COUNT(*) > 1
) duplicatas;

-- ================================================================
-- 5. PROCEDIMENTOS ASSOCIADOS
-- ================================================================
SELECT 
  '5. PROCEDIMENTOS' as diagnostico,
  COUNT(*) as total_procedimentos,
  COUNT(DISTINCT patient_id) as pacientes_com_procedimentos,
  COUNT(DISTINCT aih_id) as aihs_com_procedimentos
FROM procedure_records;

-- ================================================================
-- 6. PACIENTES SEM PROCEDIMENTOS
-- ================================================================
SELECT 
  '6. PACIENTES SEM PROCEDIMENTOS' as diagnostico,
  COUNT(DISTINCT a.patient_id) as pacientes_total_aihs,
  COUNT(DISTINCT pr.patient_id) as pacientes_com_procedimentos,
  COUNT(DISTINCT a.patient_id) - COUNT(DISTINCT pr.patient_id) as pacientes_sem_procedimentos
FROM aihs a
LEFT JOIN procedure_records pr ON a.patient_id = pr.patient_id
WHERE a.cns_responsavel IS NOT NULL;

-- ================================================================
-- 7. DADOS DOS MÉDICOS NA TABELA DOCTORS
-- ================================================================
SELECT 
  '7. MEDICOS CADASTRADOS' as diagnostico,
  COUNT(DISTINCT a.cns_responsavel) as medicos_cns_nas_aihs,
  COUNT(DISTINCT d.cns) as medicos_cadastrados_doctors,
  COUNT(DISTINCT a.cns_responsavel) - COUNT(DISTINCT d.cns) as medicos_nao_cadastrados
FROM aihs a
LEFT JOIN doctors d ON a.cns_responsavel = d.cns
WHERE a.cns_responsavel IS NOT NULL;

-- ================================================================
-- 8. AMOSTRA DE MÉDICOS NÃO CADASTRADOS
-- ================================================================
SELECT 
  '8. MEDICOS NAO CADASTRADOS' as diagnostico,
  a.cns_responsavel,
  COUNT(*) as aihs_deste_medico
FROM aihs a
LEFT JOIN doctors d ON a.cns_responsavel = d.cns
WHERE a.cns_responsavel IS NOT NULL 
  AND d.cns IS NULL
GROUP BY a.cns_responsavel
ORDER BY COUNT(*) DESC
LIMIT 10;

-- ================================================================
-- 9. TOP 10 MÉDICOS POR QUANTIDADE DE PACIENTES
-- ================================================================
SELECT 
  '9. TOP MEDICOS' as diagnostico,
  a.cns_responsavel,
  d.name as nome_medico,
  COUNT(DISTINCT a.patient_id) as pacientes_unicos,
  COUNT(*) as total_aihs
FROM aihs a
LEFT JOIN doctors d ON a.cns_responsavel = d.cns
WHERE a.cns_responsavel IS NOT NULL
GROUP BY a.cns_responsavel, d.name
ORDER BY COUNT(DISTINCT a.patient_id) DESC
LIMIT 10;

-- ================================================================
-- 10. RESUMO FINAL
-- ================================================================
SELECT 
  '10. RESUMO FINAL' as diagnostico,
  total_aihs.count as total_aihs_sistema,
  aihs_medicos.count as aihs_com_medico_responsavel,
  pacientes_unicos.count as pacientes_unicos_com_medico,
  procedimentos.count as total_procedimentos,
  medicos_cadastrados.count as medicos_cadastrados_doctors
FROM 
  (SELECT COUNT(*) as count FROM aihs) total_aihs,
  (SELECT COUNT(*) as count FROM aihs WHERE cns_responsavel IS NOT NULL) aihs_medicos,
  (SELECT COUNT(DISTINCT patient_id) as count FROM aihs WHERE cns_responsavel IS NOT NULL) pacientes_unicos,
  (SELECT COUNT(*) as count FROM procedure_records) procedimentos,
  (SELECT COUNT(DISTINCT d.cns) as count 
   FROM aihs a
   INNER JOIN doctors d ON a.cns_responsavel = d.cns
   WHERE a.cns_responsavel IS NOT NULL) medicos_cadastrados;