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

-- ================================================
-- DIAGNÓSTICO E CORREÇÃO DE PROCEDIMENTOS - URGENTE
-- Sistema SIGTAP Billing Wizard
-- ================================================

-- 1. DIAGNÓSTICO COMPLETO
-- ================================================

-- Verificar total de AIHs e procedimentos
SELECT 
  'AIHs Totais' as tipo,
  COUNT(*) as quantidade,
  MAX(created_at) as ultima_criacao
FROM aihs
WHERE hospital_id = (SELECT id FROM hospitals LIMIT 1)

UNION ALL

SELECT 
  'Procedimentos Totais' as tipo,
  COUNT(*) as quantidade,
  MAX(created_at) as ultima_criacao
FROM procedure_records
WHERE hospital_id = (SELECT id FROM hospitals LIMIT 1)

UNION ALL

SELECT 
  'AIHs com Procedimentos' as tipo,
  COUNT(DISTINCT pr.aih_id) as quantidade,
  MAX(pr.created_at) as ultima_criacao
FROM procedure_records pr
WHERE pr.hospital_id = (SELECT id FROM hospitals LIMIT 1);

-- 2. IDENTIFICAR AIHs SEM PROCEDIMENTOS
-- ================================================

SELECT 
  a.aih_number as "Número AIH",
  a.procedure_code as "Código Procedimento Principal",
  a.total_procedures as "Total Reportado",
  COUNT(pr.id) as "Procedimentos Reais",
  a.created_at as "Criada em"
FROM aihs a
LEFT JOIN procedure_records pr ON a.id = pr.aih_id
WHERE a.hospital_id = (SELECT id FROM hospitals LIMIT 1)
GROUP BY a.id, a.aih_number, a.procedure_code, a.total_procedures, a.created_at
HAVING COUNT(pr.id) = 0
ORDER BY a.created_at DESC
LIMIT 20;

-- 3. VERIFICAR INCONSISTÊNCIAS NAS ESTATÍSTICAS
-- ================================================

SELECT 
  a.aih_number as "Número AIH",
  a.total_procedures as "Total Reportado",
  COUNT(pr.id) as "Procedimentos Reais",
  COUNT(CASE WHEN pr.match_status = 'approved' THEN 1 END) as "Aprovados Reais",
  a.approved_procedures as "Aprovados Reportados"
FROM aihs a
LEFT JOIN procedure_records pr ON a.id = pr.aih_id
WHERE a.hospital_id = (SELECT id FROM hospitals LIMIT 1)
GROUP BY a.id, a.aih_number, a.total_procedures, a.approved_procedures
HAVING 
  a.total_procedures != COUNT(pr.id) OR
  a.approved_procedures != COUNT(CASE WHEN pr.match_status = 'approved' THEN 1 END)
ORDER BY a.created_at DESC
LIMIT 10;

-- 4. ESTATÍSTICAS DE PROCEDIMENTOS POR STATUS
-- ================================================

SELECT 
  COALESCE(pr.match_status, 'NULL') as "Status",
  COUNT(*) as "Quantidade",
  ROUND(AVG(pr.value_charged / 100.0), 2) as "Valor Médio (R$)",
  SUM(pr.value_charged / 100.0) as "Valor Total (R$)"
FROM procedure_records pr
WHERE pr.hospital_id = (SELECT id FROM hospitals LIMIT 1)
GROUP BY pr.match_status
ORDER BY COUNT(*) DESC;

-- 5. CORREÇÃO AUTOMÁTICA - CRIAR PROCEDIMENTOS FALTANTES
-- ================================================
-- ATENÇÃO: Execute apenas após análise dos dados acima!

-- Criar procedimentos principais para AIHs sem procedimentos
INSERT INTO procedure_records (
  id,
  hospital_id,
  patient_id,
  aih_id,
  procedure_code,
  procedure_name,
  procedure_date,
  value_charged,
  total_value,
  professional_name,
  professional_cbo,
  quantity,
  status,
  billing_status,
  sequencia,
  codigo_procedimento_original,
  match_status,
  created_at
)
SELECT 
  gen_random_uuid() as id,
  a.hospital_id,
  a.patient_id,
  a.id as aih_id,
  a.procedure_code,
  'Procedimento Principal: ' || a.procedure_code as procedure_name,
  a.admission_date as procedure_date,
  COALESCE(a.calculated_total_value, 0) as value_charged,
  COALESCE(a.calculated_total_value, 0) as total_value,
  COALESCE(a.requesting_physician, 'PROFISSIONAL RESPONSÁVEL') as professional_name,
  COALESCE(a.professional_cbo, '225125') as professional_cbo,
  1 as quantity,
  'pending' as status,
  'pending' as billing_status,
  1 as sequencia,
  a.procedure_code as codigo_procedimento_original,
  'pending' as match_status,
  NOW() as created_at
FROM aihs a
LEFT JOIN procedure_records pr ON a.id = pr.aih_id
WHERE a.hospital_id = (SELECT id FROM hospitals LIMIT 1)
  AND pr.id IS NULL  -- Apenas AIHs sem procedimentos
  AND a.procedure_code IS NOT NULL
GROUP BY a.id, a.hospital_id, a.patient_id, a.procedure_code, 
         a.admission_date, a.calculated_total_value, a.requesting_physician, 
         a.professional_cbo;

-- 6. ATUALIZAR ESTATÍSTICAS DAS AIHs
-- ================================================

UPDATE aihs 
SET 
  total_procedures = subquery.real_count,
  approved_procedures = subquery.approved_count,
  rejected_procedures = subquery.rejected_count,
  calculated_total_value = subquery.total_value,
  updated_at = NOW()
FROM (
  SELECT 
    pr.aih_id,
    COUNT(*) as real_count,
    COUNT(CASE WHEN pr.match_status = 'approved' THEN 1 END) as approved_count,
    COUNT(CASE WHEN pr.match_status = 'rejected' THEN 1 END) as rejected_count,
    SUM(CASE WHEN pr.match_status = 'approved' THEN pr.value_charged ELSE 0 END) as total_value
  FROM procedure_records pr
  WHERE pr.hospital_id = (SELECT id FROM hospitals LIMIT 1)
  GROUP BY pr.aih_id
) subquery
WHERE aihs.id = subquery.aih_id
  AND aihs.hospital_id = (SELECT id FROM hospitals LIMIT 1);

-- 7. VERIFICAÇÃO FINAL
-- ================================================

SELECT 
  'RESULTADO FINAL' as status,
  COUNT(DISTINCT a.id) as "AIHs Totais",
  COUNT(pr.id) as "Procedimentos Totais",
  COUNT(DISTINCT pr.aih_id) as "AIHs com Procedimentos",
  COUNT(DISTINCT a.id) - COUNT(DISTINCT pr.aih_id) as "AIHs sem Procedimentos"
FROM aihs a
LEFT JOIN procedure_records pr ON a.id = pr.aih_id
WHERE a.hospital_id = (SELECT id FROM hospitals LIMIT 1);

-- 8. LOGS DE AUDITORIA
-- ================================================

INSERT INTO audit_logs (
  id,
  action,
  table_name,
  record_id,
  details,
  user_id,
  created_at
)
SELECT 
  gen_random_uuid(),
  'PROCEDURE_SYNC',
  'procedure_records',
  pr.id::text,
  jsonb_build_object(
    'action', 'auto_created_principal_procedure',
    'aih_number', a.aih_number,
    'procedure_code', pr.procedure_code,
    'sync_date', NOW()
  ),
  (SELECT id FROM auth.users LIMIT 1),
  NOW()
FROM procedure_records pr
JOIN aihs a ON pr.aih_id = a.id
WHERE pr.created_at > NOW() - INTERVAL '1 hour'
  AND pr.sequencia = 1
  AND pr.hospital_id = (SELECT id FROM hospitals LIMIT 1);

-- ================================================
-- COMANDOS UTILITÁRIOS ADICIONAIS
-- ================================================

-- Comando para verificar schema da tabela procedure_records
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'procedure_records' 
ORDER BY ordinal_position;

-- Comando para verificar índices
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'procedure_records';

-- Comando para verificar constraints
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'procedure_records'; 