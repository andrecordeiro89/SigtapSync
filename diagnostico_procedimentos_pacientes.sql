-- 🔍 DIAGNÓSTICO: COMPATIBILIDADE ENTRE AIHS E PROCEDURE_RECORDS
-- Verifica se os patient_ids das AIHs têm procedimentos correspondentes

-- 1. CONTADORES GERAIS
SELECT 
    '1. CONTADORES GERAIS' as secao,
    (SELECT COUNT(*) FROM aihs) as total_aihs,
    (SELECT COUNT(*) FROM procedure_records) as total_procedimentos,
    (SELECT COUNT(DISTINCT patient_id) FROM aihs WHERE patient_id IS NOT NULL) as pacientes_unicos_aihs,
    (SELECT COUNT(DISTINCT patient_id) FROM procedure_records WHERE patient_id IS NOT NULL) as pacientes_unicos_procedimentos;

-- 2. ANÁLISE DE COMPATIBILIDADE DE PATIENT_IDS
SELECT 
    '2. COMPATIBILIDADE PATIENT_IDS' as secao,
    (SELECT COUNT(DISTINCT a.patient_id) 
     FROM aihs a 
     WHERE a.patient_id IS NOT NULL) as pacientes_com_aihs,
    
    (SELECT COUNT(DISTINCT a.patient_id) 
     FROM aihs a 
     INNER JOIN procedure_records p ON a.patient_id = p.patient_id
     WHERE a.patient_id IS NOT NULL) as pacientes_com_aihs_e_procedimentos,
     
    (SELECT COUNT(DISTINCT a.patient_id) 
     FROM aihs a 
     LEFT JOIN procedure_records p ON a.patient_id = p.patient_id
     WHERE a.patient_id IS NOT NULL AND p.patient_id IS NULL) as pacientes_com_aihs_sem_procedimentos;

-- 3. AMOSTRA DE PATIENT_IDS SEM PROCEDIMENTOS
SELECT 
    '3. SAMPLE - AIHS SEM PROCEDIMENTOS' as info,
    a.id as aih_id,
    a.patient_id,
    a.aih_number,
    a.cns_responsavel,
    patients.name as patient_name
FROM aihs a
LEFT JOIN procedure_records p ON a.patient_id = p.patient_id  
LEFT JOIN patients ON a.patient_id = patients.id
WHERE a.patient_id IS NOT NULL 
  AND p.patient_id IS NULL
ORDER BY a.patient_id
LIMIT 10;

-- 4. VERIFICAR SE HÁ PROCEDIMENTOS COM PATIENT_ID INVÁLIDO
SELECT 
    '4. PROCEDIMENTOS COM PATIENT_ID INVÁLIDO' as info,
    p.id as proc_id,
    p.patient_id,
    p.procedure_code,
    p.procedure_description
FROM procedure_records p
LEFT JOIN patients ON p.patient_id = patients.id
WHERE p.patient_id IS NOT NULL 
  AND patients.id IS NULL
LIMIT 10;

-- 5. VERIFICAR DISTRIBUIÇÃO DE PROCEDIMENTOS POR MÉDICO (CNS_RESPONSAVEL)
SELECT 
    '5. PROCEDIMENTOS POR MÉDICO RESPONSÁVEL' as info,
    a.cns_responsavel,
    COUNT(DISTINCT a.patient_id) as pacientes_unicos,
    COUNT(DISTINCT p.id) as total_procedimentos,
    COUNT(DISTINCT a.id) as total_aihs
FROM aihs a
LEFT JOIN procedure_records p ON a.patient_id = p.patient_id
WHERE a.cns_responsavel IS NOT NULL
GROUP BY a.cns_responsavel
ORDER BY total_procedimentos DESC
LIMIT 5;

-- 6. ANÁLISE ESPECÍFICA: AIHS QUE DEVERIAM TER PROCEDIMENTOS MAS NÃO TÊM
SELECT 
    '6. SAMPLE - AIHS QUE DEVERIAM TER PROCEDIMENTOS' as info,
    a.id as aih_id,
    a.patient_id,
    a.aih_number,
    a.calculated_total_value,
    a.total_procedures as procedimentos_declarados_na_aih,
    COALESCE(p.procedimentos_reais, 0) as procedimentos_encontrados_na_tabela
FROM aihs a
LEFT JOIN (
    SELECT patient_id, COUNT(*) as procedimentos_reais
    FROM procedure_records 
    GROUP BY patient_id
) p ON a.patient_id = p.patient_id
WHERE a.total_procedures > 0  -- AIH declara que tem procedimentos
  AND COALESCE(p.procedimentos_reais, 0) = 0  -- Mas não encontramos procedimentos na tabela
LIMIT 10;