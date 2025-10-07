-- ========================================
-- 🔍 DIAGNÓSTICO: PACIENTES FALTANDO NA TELA ANALYTICS
-- ========================================

-- 1️⃣ VERIFICAR SE OS MÉDICOS ESTÃO CADASTRADOS NA TABELA DOCTORS
SELECT 
  'MÉDICOS NA TABELA DOCTORS' as diagnostico,
  name as nome_medico,
  cns,
  is_active as ativo
FROM doctors
WHERE name IN ('DJAVAN BLUM', 'ALANNA SILVA HUK FARIAS', 'RAFAEL FERNANDES')
ORDER BY name;

-- 2️⃣ VERIFICAR AIHs DESSES MÉDICOS (por nome no requesting_physician)
SELECT 
  'AIHs POR REQUESTING_PHYSICIAN' as diagnostico,
  aih_number as numero_aih,
  requesting_physician as medico_solicitante,
  cns_responsavel as cns_responsavel,
  competencia,
  discharge_date as data_alta,
  admission_date as data_admissao,
  hospital_id
FROM aihs
WHERE requesting_physician IN ('DJAVAN BLUM', 'ALANNA SILVA HUK FARIAS', 'RAFAEL FERNANDES')
  AND hospital_id = (SELECT id FROM hospitals WHERE name LIKE '%Juarez Barreto%' LIMIT 1)
ORDER BY requesting_physician, discharge_date;

-- 3️⃣ VERIFICAR SE cns_responsavel ESTÁ NULL OU VAZIO
SELECT 
  'AIHs SEM CNS_RESPONSAVEL' as diagnostico,
  COUNT(*) as total_aihs,
  COUNT(CASE WHEN cns_responsavel IS NULL THEN 1 END) as cns_null,
  COUNT(CASE WHEN cns_responsavel = '' THEN 1 END) as cns_vazio,
  COUNT(CASE WHEN cns_responsavel IS NOT NULL AND cns_responsavel != '' THEN 1 END) as cns_preenchido
FROM aihs
WHERE hospital_id = (SELECT id FROM hospitals WHERE name LIKE '%Juarez Barreto%' LIMIT 1)
  AND TO_CHAR(discharge_date, 'YYYY-MM') = '2025-07';

-- 4️⃣ VERIFICAR COMPETÊNCIA DAS AIHs DE JULHO/2025
SELECT 
  'COMPETÊNCIA DAS AIHs DE JULHO/2025' as diagnostico,
  competencia,
  COUNT(*) as total_aihs,
  MIN(discharge_date) as primeira_alta,
  MAX(discharge_date) as ultima_alta
FROM aihs
WHERE hospital_id = (SELECT id FROM hospitals WHERE name LIKE '%Juarez Barreto%' LIMIT 1)
  AND TO_CHAR(discharge_date, 'YYYY-MM') = '2025-07'
GROUP BY competencia
ORDER BY competencia;

-- 5️⃣ VERIFICAR AIHs ESPECÍFICAS DA IMAGEM (por número de AIH)
SELECT 
  'AIHs ESPECÍFICAS DA IMAGEM' as diagnostico,
  aih_number as numero_aih,
  requesting_physician as medico_solicitante,
  cns_responsavel,
  competencia,
  discharge_date as data_alta,
  calculated_total_value / 100.0 as valor_total_reais,
  (SELECT name FROM patients WHERE id = aihs.patient_id) as nome_paciente
FROM aihs
WHERE aih_number IN (
  '4125113482920', '4125113483535', '4125113483580', 
  '4125113483799', '4125113484283', '4125113484305',
  '4125113484338', '4125113484460', '4125113484580',
  '4125113484877', '4125113484943', '4125113485020',
  '4125113485031', '4125114314948', '4125114315124'
)
ORDER BY aih_number;

-- 6️⃣ CROSS-CHECK: VERIFICAR SE ESSAS AIHs TÊM PROCEDIMENTOS
SELECT 
  'AIHs COM/SEM PROCEDIMENTOS' as diagnostico,
  a.aih_number,
  a.requesting_physician,
  COUNT(pr.id) as total_procedimentos
FROM aihs a
LEFT JOIN procedure_records pr ON pr.aih_id = a.id
WHERE a.aih_number IN (
  '4125113482920', '4125113483535', '4125113483580', 
  '4125113483799', '4125113484283', '4125113484305',
  '4125113484338', '4125113484460', '4125113484580',
  '4125113484877', '4125113484943', '4125113485020',
  '4125113485031', '4125114314948', '4125114315124'
)
GROUP BY a.aih_number, a.requesting_physician
ORDER BY a.aih_number;

-- 7️⃣ SOLUÇÃO: UPDATE PARA PREENCHER cns_responsavel BASEADO EM requesting_physician
-- (NÃO EXECUTAR AINDA - APENAS PREPARAR)
/*
UPDATE aihs
SET cns_responsavel = (
  SELECT cns 
  FROM doctors 
  WHERE UPPER(doctors.name) = UPPER(aihs.requesting_physician)
  LIMIT 1
)
WHERE cns_responsavel IS NULL 
  AND requesting_physician IS NOT NULL
  AND requesting_physician != ''
  AND EXISTS (
    SELECT 1 FROM doctors 
    WHERE UPPER(doctors.name) = UPPER(aihs.requesting_physician)
  );
*/

-- 8️⃣ VERIFICAR QUANTOS REGISTROS SERIAM ATUALIZADOS
SELECT 
  'PREVIEW DO UPDATE' as diagnostico,
  COUNT(*) as total_aihs_a_atualizar,
  STRING_AGG(DISTINCT requesting_physician, ', ') as medicos_encontrados
FROM aihs
WHERE cns_responsavel IS NULL 
  AND requesting_physician IS NOT NULL
  AND requesting_physician != ''
  AND EXISTS (
    SELECT 1 FROM doctors 
    WHERE UPPER(doctors.name) = UPPER(aihs.requesting_physician)
  );

