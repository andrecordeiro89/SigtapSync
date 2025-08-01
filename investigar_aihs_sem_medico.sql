-- ================================================================
-- 🔍 INVESTIGAÇÃO: 65 AIHs SEM MÉDICO RESPONSÁVEL
-- ================================================================

-- 1. AMOSTRA DAS AIHs SEM MÉDICO RESPONSÁVEL
SELECT 
  'AIHs sem médico' as tipo,
  id,
  aih_number,
  admission_date,
  processing_status,
  cns_responsavel,
  cns_solicitante,
  cns_autorizador,
  source_file
FROM aihs 
WHERE cns_responsavel IS NULL
ORDER BY admission_date DESC
LIMIT 10;

-- 2. STATUS DAS AIHs SEM MÉDICO
SELECT 
  'Status das AIHs sem médico' as tipo,
  processing_status,
  COUNT(*) as quantidade
FROM aihs 
WHERE cns_responsavel IS NULL
GROUP BY processing_status
ORDER BY COUNT(*) DESC;

-- 3. VERIFICAR SE HÁ OUTROS CAMPOS CNS PREENCHIDOS
SELECT 
  'Outros CNS preenchidos' as tipo,
  COUNT(CASE WHEN cns_solicitante IS NOT NULL THEN 1 END) as tem_solicitante,
  COUNT(CASE WHEN cns_autorizador IS NOT NULL THEN 1 END) as tem_autorizador,
  COUNT(CASE WHEN cns_responsavel IS NULL AND cns_solicitante IS NOT NULL THEN 1 END) as pode_usar_solicitante
FROM aihs 
WHERE cns_responsavel IS NULL;

-- 4. ORIGEM DOS ARQUIVOS SEM MÉDICO
SELECT 
  'Arquivos fonte' as tipo,
  source_file,
  COUNT(*) as aihs_sem_medico
FROM aihs 
WHERE cns_responsavel IS NULL
GROUP BY source_file
ORDER BY COUNT(*) DESC;