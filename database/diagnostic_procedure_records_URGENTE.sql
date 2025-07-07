-- 🔍 DIAGNÓSTICO URGENTE - TABELA PROCEDURE_RECORDS
-- Script para investigar problemas na busca de procedimentos

-- ==================================================
-- 1. VERIFICAR SE A TABELA EXISTS
-- ==================================================

SELECT 
    table_name,
    table_schema,
    table_type
FROM information_schema.tables 
WHERE table_name = 'procedure_records';

-- ==================================================
-- 2. VERIFICAR ESTRUTURA DA TABELA
-- ==================================================

SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns 
WHERE table_name = 'procedure_records'
ORDER BY ordinal_position;

-- ==================================================
-- 3. VERIFICAR SE HÁ DADOS NA TABELA
-- ==================================================

SELECT 
    COUNT(*) as total_records,
    COUNT(DISTINCT aih_id) as unique_aihs,
    COUNT(DISTINCT hospital_id) as unique_hospitals
FROM procedure_records;

-- ==================================================
-- 4. VERIFICAR HOSPITAL ESPECÍFICO
-- ==================================================

SELECT 
    COUNT(*) as total_procedures,
    hospital_id,
    array_agg(DISTINCT aih_id) as aih_ids
FROM procedure_records 
WHERE hospital_id = 'a8978eaa-b90e-4dc8-8fd5-0af984374d34'
GROUP BY hospital_id;

-- ==================================================
-- 5. VERIFICAR AIH ESPECÍFICA
-- ==================================================

SELECT 
    id,
    aih_id,
    procedure_sequence,
    procedure_code,
    match_status,
    created_at
FROM procedure_records 
WHERE aih_id = 'b9fc1770-aa93-4430-a34c-d2f6b39e0a78'
ORDER BY procedure_sequence;

-- ==================================================
-- 6. VERIFICAR FOREIGN KEYS E RELACIONAMENTOS
-- ==================================================

SELECT
    tc.table_name,
    tc.constraint_name,
    tc.constraint_type,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
LEFT JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
WHERE tc.table_name = 'procedure_records'
ORDER BY tc.constraint_type, tc.constraint_name;

-- ==================================================
-- 7. VERIFICAR RELACIONAMENTO COM SIGTAP_PROCEDURES
-- ==================================================

SELECT 
    COUNT(*) as total_sigtap_procedures
FROM sigtap_procedures;

-- Verificar se há matches entre procedure_records e sigtap_procedures
SELECT 
    pr.procedure_code,
    sp.code as sigtap_code,
    sp.description,
    COUNT(*) as matches
FROM procedure_records pr
LEFT JOIN sigtap_procedures sp ON pr.procedure_code = sp.code
GROUP BY pr.procedure_code, sp.code, sp.description
LIMIT 10;

-- ==================================================
-- 8. VERIFICAR RELACIONAMENTO COM AIH_MATCHES
-- ==================================================

SELECT 
    COUNT(*) as total_aih_matches
FROM aih_matches;

-- Verificar matches específicos para a AIH problema
SELECT 
    am.aih_id,
    am.procedure_sequence,
    am.overall_score,
    am.match_confidence,
    am.status
FROM aih_matches am
WHERE am.aih_id = 'b9fc1770-aa93-4430-a34c-d2f6b39e0a78'
ORDER BY am.procedure_sequence;

-- ==================================================
-- 9. VERIFICAR POLÍTICAS RLS (SE EXISTEM)
-- ==================================================

SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename = 'procedure_records';

-- ==================================================
-- 10. TESTE DE QUERY SIMPLES (A QUE ESTÁ FALHANDO)
-- ==================================================

-- Esta é a query que deve funcionar após as correções
SELECT 
    pr.*,
    sp.code as sigtap_code,
    sp.description as sigtap_description,
    sp.value_hosp_total,
    sp.complexity
FROM procedure_records pr
LEFT JOIN sigtap_procedures sp ON pr.procedure_code = sp.code
WHERE pr.aih_id = 'b9fc1770-aa93-4430-a34c-d2f6b39e0a78'
ORDER BY pr.procedure_sequence;

-- ==================================================
-- 11. CRIAR DADOS DE TESTE SE NECESSÁRIO
-- ==================================================

-- Se não houver dados, criar alguns para teste
-- APENAS EXECUTE ESTA SEÇÃO SE AS CONSULTAS ACIMA MOSTRAREM TABELA VAZIA

/*
INSERT INTO procedure_records (
    id,
    hospital_id,
    aih_id,
    patient_id,
    procedure_sequence,
    procedure_code,
    procedure_description,
    match_status,
    match_confidence,
    value_charged,
    professional,
    professional_cbo,
    procedure_date,
    created_at,
    created_by
) VALUES (
    gen_random_uuid(),
    'a8978eaa-b90e-4dc8-8fd5-0af984374d34',
    'b9fc1770-aa93-4430-a34c-d2f6b39e0a78',
    (SELECT patient_id FROM aihs WHERE id = 'b9fc1770-aa93-4430-a34c-d2f6b39e0a78' LIMIT 1),
    1,
    '0301010019', -- Código SIGTAP exemplo
    'Consulta médica em atenção primária',
    'pending',
    0.95,
    2200, -- R$ 22,00 em centavos
    'Dr. João Silva',
    '225125',
    CURRENT_DATE,
    NOW(),
    'system'
), (
    gen_random_uuid(),
    'a8978eaa-b90e-4dc8-8fd5-0af984374d34',
    'b9fc1770-aa93-4430-a34c-d2f6b39e0a78',
    (SELECT patient_id FROM aihs WHERE id = 'b9fc1770-aa93-4430-a34c-d2f6b39e0a78' LIMIT 1),
    2,
    '0301010027',
    'Consulta médica em atenção especializada',
    'approved',
    0.89,
    3500,
    'Dr. Maria Santos',
    '225130',
    CURRENT_DATE,
    NOW(),
    'system'
);
*/

-- ==================================================
-- 12. RESULTADO ESPERADO
-- ==================================================

SELECT 
    'DIAGNÓSTICO COMPLETO REALIZADO' as status,
    'Verifique os resultados acima para identificar o problema' as instrucoes; 