-- 🔍 INVESTIGAÇÃO ESPECÍFICA: CLEUZA DUTRA DA SILVA
-- Verificar se ela tem procedimentos no banco e por que não aparecem na interface

-- 1. BUSCAR DADOS DA PACIENTE CLEUZA
SELECT 
    'DADOS DA PACIENTE CLEUZA' as info,
    p.id as patient_id,
    p.name,
    p.cns,
    p.birth_date,
    p.medical_record
FROM patients p 
WHERE UPPER(p.name) LIKE '%CLEUZA%DUTRA%SILVA%'
   OR UPPER(p.name) LIKE '%CLEUZA%'
ORDER BY p.name;

-- 2. BUSCAR AIHs DA CLEUZA
SELECT 
    'AIHs DA CLEUZA' as info,
    a.id as aih_id,
    a.aih_number,
    a.patient_id,
    a.cns_responsavel,
    a.cns_solicitante, 
    a.cns_autorizador,
    a.calculated_total_value,
    a.total_procedures,
    a.admission_date,
    a.discharge_date,
    p.name as patient_name
FROM aihs a
JOIN patients p ON a.patient_id = p.id
WHERE UPPER(p.name) LIKE '%CLEUZA%DUTRA%SILVA%'
   OR UPPER(p.name) LIKE '%CLEUZA%';

-- 3. BUSCAR PROCEDIMENTOS DA CLEUZA DIRETAMENTE
SELECT 
    'PROCEDIMENTOS DA CLEUZA' as info,
    pr.id as procedure_id,
    pr.patient_id,
    pr.aih_id,
    pr.procedure_code,
    pr.procedure_description,
    pr.procedure_date,
    pr.total_value,
    pr.value_charged,
    pr.status,
    p.name as patient_name
FROM procedure_records pr
JOIN patients p ON pr.patient_id = p.id
WHERE UPPER(p.name) LIKE '%CLEUZA%DUTRA%SILVA%'
   OR UPPER(p.name) LIKE '%CLEUZA%';

-- 4. VERIFICAR SE A CLEUZA TEM PATIENT_ID COMPATÍVEL ENTRE TABELAS
SELECT 
    'COMPATIBILIDADE PATIENT_ID CLEUZA' as info,
    a.patient_id as aih_patient_id,
    p_aih.name as nome_na_aih,
    pr.patient_id as proc_patient_id,
    p_proc.name as nome_no_procedimento,
    CASE 
        WHEN a.patient_id = pr.patient_id THEN 'COMPATÍVEL ✅'
        ELSE 'INCOMPATÍVEL ❌'
    END as compatibilidade
FROM aihs a
JOIN patients p_aih ON a.patient_id = p_aih.id
LEFT JOIN procedure_records pr ON a.patient_id = pr.patient_id
LEFT JOIN patients p_proc ON pr.patient_id = p_proc.id
WHERE UPPER(p_aih.name) LIKE '%CLEUZA%DUTRA%SILVA%'
   OR UPPER(p_aih.name) LIKE '%CLEUZA%';

-- 5. VERIFICAR MÉDICOS RESPONSÁVEIS DA CLEUZA
SELECT 
    'MÉDICOS DA CLEUZA' as info,
    a.cns_responsavel,
    a.cns_solicitante,
    a.cns_autorizador,
    d1.name as nome_responsavel,
    d2.name as nome_solicitante,
    d3.name as nome_autorizador,
    a.aih_number,
    p.name as patient_name
FROM aihs a
JOIN patients p ON a.patient_id = p.id
LEFT JOIN doctors d1 ON a.cns_responsavel = d1.cns
LEFT JOIN doctors d2 ON a.cns_solicitante = d2.cns  
LEFT JOIN doctors d3 ON a.cns_autorizador = d3.cns
WHERE UPPER(p.name) LIKE '%CLEUZA%DUTRA%SILVA%'
   OR UPPER(p.name) LIKE '%CLEUZA%';

-- 6. BUSCAR PROCEDIMENTOS POR AIH_ID DA CLEUZA
SELECT 
    'PROCEDIMENTOS POR AIH_ID DA CLEUZA' as info,
    a.id as aih_id,
    a.aih_number,
    pr.id as procedure_id,
    pr.procedure_code,
    pr.procedure_description,
    pr.patient_id as proc_patient_id,
    pr.aih_id as proc_aih_id,
    p.name as patient_name,
    CASE 
        WHEN pr.aih_id = a.id THEN 'AIH_ID MATCH ✅'
        WHEN pr.patient_id = a.patient_id THEN 'PATIENT_ID MATCH ✅'
        ELSE 'NO MATCH ❌'
    END as match_type
FROM aihs a
JOIN patients p ON a.patient_id = p.id
LEFT JOIN procedure_records pr ON (pr.aih_id = a.id OR pr.patient_id = a.patient_id)
WHERE UPPER(p.name) LIKE '%CLEUZA%DUTRA%SILVA%'
   OR UPPER(p.name) LIKE '%CLEUZA%';