-- 🔍 DIAGNÓSTICO DA TABELA procedure_records
-- Execute este arquivo para testar inserção com schema mínimo

-- 1️⃣ Verificar campos obrigatórios (NOT NULL)
SELECT 
  column_name, 
  data_type, 
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'procedure_records'
  AND is_nullable = 'NO'
ORDER BY ordinal_position;

-- 2️⃣ Verificar se temos dados de referência necessários
SELECT 
  'hospitals' as tabela,
  COUNT(*) as total,
  MIN(id::text) as exemplo_id
FROM hospitals
UNION ALL
SELECT 
  'patients' as tabela,
  COUNT(*) as total,
  MIN(id::text) as exemplo_id  
FROM patients
UNION ALL
SELECT 
  'aihs' as tabela,
  COUNT(*) as total,
  MIN(id::text) as exemplo_id
FROM aihs
UNION ALL
SELECT 
  'sigtap_procedures' as tabela,
  COUNT(*) as total,
  MIN(id::text) as exemplo_id
FROM sigtap_procedures;

-- 3️⃣ Teste de inserção MÍNIMA (apenas campos obrigatórios)
-- SUBSTITUIR pelos IDs reais do seu banco antes de executar!

/*
INSERT INTO procedure_records (
  id,
  hospital_id,
  patient_id, 
  procedure_id,
  procedure_date,
  value_charged
) VALUES (
  gen_random_uuid(),
  'a8978eaa-b90e-4dc8-8fd5-0af984374d34',  -- SEU hospital_id
  (SELECT id FROM patients LIMIT 1),       -- Primeiro paciente
  (SELECT id FROM sigtap_procedures LIMIT 1), -- Primeiro procedimento SIGTAP
  NOW(),
  100000  -- R$ 1000,00 em centavos
);
*/

-- 4️⃣ Verificar se a inserção funcionou
SELECT 
  COUNT(*) as total_procedures,
  MAX(created_at) as ultimo_criado
FROM procedure_records;

-- 5️⃣ Mostrar últimos registros criados
SELECT 
  id,
  procedure_code,
  procedure_name,
  value_charged,
  created_at
FROM procedure_records 
ORDER BY created_at DESC 
LIMIT 5; 