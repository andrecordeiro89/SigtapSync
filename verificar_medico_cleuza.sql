-- 🔍 VERIFICAR DADOS DO MÉDICO DA CLEUZA
-- CNS da Cleuza: 707000845390335

-- 1. BUSCAR MÉDICO POR CNS
SELECT 
    'MÉDICO DA CLEUZA' as info,
    id,
    name,
    cns,
    crm,
    specialty,
    email,
    phone
FROM doctors 
WHERE cns = '707000845390335';

-- 2. VERIFICAR SE EXISTE O CNS NA TABELA DOCTORS
SELECT 
    'CNS EXISTE?' as info,
    COUNT(*) as count,
    CASE 
        WHEN COUNT(*) > 0 THEN 'SIM ✅'
        ELSE 'NÃO ❌'
    END as status
FROM doctors 
WHERE cns = '707000845390335';

-- 3. BUSCAR AIHs COM ESTE CNS RESPONSÁVEL
SELECT 
    'AIHs COM CNS RESPONSAVEL' as info,
    COUNT(*) as total_aihs,
    COUNT(DISTINCT patient_id) as total_patients
FROM aihs 
WHERE cns_responsavel = '707000845390335';

-- 4. BUSCAR AIHs COM ESTE CNS SOLICITANTE
SELECT 
    'AIHs COM CNS SOLICITANTE' as info,
    COUNT(*) as total_aihs,
    COUNT(DISTINCT patient_id) as total_patients
FROM aihs 
WHERE cns_solicitante = '707000845390335';

-- 5. BUSCAR AIHs COM ESTE CNS AUTORIZADOR  
SELECT 
    'AIHs COM CNS AUTORIZADOR' as info,
    COUNT(*) as total_aihs,
    COUNT(DISTINCT patient_id) as total_patients
FROM aihs 
WHERE cns_autorizador = '707000845390335';

-- 6. VERIFICAR DADOS COMPLETOS DAS AIHs DA CLEUZA
SELECT 
    'DADOS COMPLETOS AIH CLEUZA' as info,
    a.id as aih_id,
    a.aih_number,
    a.patient_id,
    p.name as patient_name,
    a.cns_responsavel,
    a.cns_solicitante,
    a.cns_autorizador,
    a.calculated_total_value,
    a.admission_date,
    a.discharge_date
FROM aihs a
JOIN patients p ON a.patient_id = p.id
WHERE p.id = '09e61fa4-0248-4209-9ead-e226ce0a49fb';  -- ID da Cleuza

-- 7. VERIFICAR QUAIS CNS SÃO USADOS PARA A CLEUZA
SELECT 
    'CNS USADO PARA CLEUZA' as info,
    COALESCE(a.cns_responsavel, 'NULL') as cns_responsavel,
    COALESCE(a.cns_solicitante, 'NULL') as cns_solicitante,
    COALESCE(a.cns_autorizador, 'NULL') as cns_autorizador,
    CASE 
        WHEN a.cns_responsavel IS NOT NULL THEN 'CNS_RESPONSAVEL'
        WHEN a.cns_solicitante IS NOT NULL THEN 'CNS_SOLICITANTE'  
        WHEN a.cns_autorizador IS NOT NULL THEN 'CNS_AUTORIZADOR'
        ELSE 'NENHUM_CNS'
    END as priority_used
FROM aihs a
JOIN patients p ON a.patient_id = p.id
WHERE p.id = '09e61fa4-0248-4209-9ead-e226ce0a49fb';  -- ID da Cleuza