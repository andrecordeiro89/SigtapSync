-- ================================================================
-- VERIFICAÇÃO DE DADOS PARA DASHBOARD DE ESPECIALIDADES
-- ================================================================
-- Criado em: 2024-12-19
-- Propósito: Verificar se temos dados suficientes para o dashboard
-- View testada: v_specialty_revenue_stats
-- ================================================================

-- ================================================================
-- 1. VERIFICAR ESTRUTURA DA VIEW
-- ================================================================
SELECT 
  'ESTRUTURA DA VIEW v_specialty_revenue_stats' as verificacao,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'v_specialty_revenue_stats'
ORDER BY ordinal_position;

-- ================================================================
-- 2. VERIFICAR SE A VIEW EXISTE E TEM DADOS
-- ================================================================
SELECT 
  'DADOS DA VIEW v_specialty_revenue_stats' as verificacao,
  COUNT(*) as total_especialidades,
  SUM(doctors_count) as total_medicos,
  ROUND(SUM(total_specialty_revenue_reais), 2) as faturamento_total,
  MAX(total_specialty_revenue_reais) as maior_faturamento,
  MIN(total_specialty_revenue_reais) as menor_faturamento
FROM v_specialty_revenue_stats;

-- ================================================================
-- 3. LISTAR ESPECIALIDADES COM DADOS
-- ================================================================
SELECT 
  'ESPECIALIDADES DISPONÍVEIS' as verificacao,
  doctor_specialty,
  doctors_count,
  total_specialty_revenue_reais,
  avg_doctor_revenue_reais,
  total_procedures
FROM v_specialty_revenue_stats
ORDER BY total_specialty_revenue_reais DESC
LIMIT 10;

-- ================================================================
-- 4. VERIFICAR TABELAS BASE
-- ================================================================

-- Médicos cadastrados
SELECT 
  'MÉDICOS CADASTRADOS' as verificacao,
  COUNT(*) as total_medicos,
  COUNT(DISTINCT specialty) as especialidades_unicas,
  COUNT(CASE WHEN is_active THEN 1 END) as medicos_ativos
FROM doctors;

-- Especialidades distintas
SELECT 
  'ESPECIALIDADES DISTINTAS' as verificacao,
  specialty,
  COUNT(*) as quantidade_medicos
FROM doctors 
WHERE is_active = true 
  AND specialty IS NOT NULL
GROUP BY specialty
ORDER BY COUNT(*) DESC;

-- Procedimentos cadastrados
SELECT 
  'PROCEDIMENTOS CADASTRADOS' as verificacao,
  COUNT(*) as total_procedimentos,
  COUNT(DISTINCT professional) as profissionais_distintos,
  ROUND(SUM(value_charged) / 100.0, 2) as valor_total_procedimentos,
  MIN(procedure_date) as data_mais_antiga,
  MAX(procedure_date) as data_mais_recente
FROM procedure_records;

-- ================================================================
-- 5. VERIFICAR CONEXÃO MÉDICOS <-> PROCEDIMENTOS
-- ================================================================
SELECT 
  'CONEXÃO MÉDICOS-PROCEDIMENTOS' as verificacao,
  COUNT(DISTINCT d.id) as medicos_com_procedimentos,
  COUNT(DISTINCT pr.id) as procedimentos_ligados,
  COUNT(DISTINCT d.specialty) as especialidades_ativas
FROM doctors d
JOIN doctor_hospital dh ON d.id = dh.doctor_id
JOIN procedure_records pr ON (pr.professional = d.cns OR pr.professional_cbo = d.cns)
WHERE d.is_active = true;

-- ================================================================
-- 6. TESTE DA VIEW v_doctors_aggregated (BASE DA ESPECIALIDADES)
-- ================================================================
SELECT 
  'VIEW v_doctors_aggregated' as verificacao,
  COUNT(*) as total_medicos_agregados,
  COUNT(CASE WHEN total_revenue_12months_reais > 0 THEN 1 END) as medicos_com_faturamento,
  COUNT(DISTINCT doctor_specialty) as especialidades_na_view,
  ROUND(SUM(total_revenue_12months_reais), 2) as faturamento_total_view
FROM v_doctors_aggregated;

-- ================================================================
-- 7. VERIFICAR SE PRECISAMOS INSERIR DADOS DE EXEMPLO
-- ================================================================
DO $$
DECLARE
    medicos_count INTEGER;
    especialidades_count INTEGER;
    procedimentos_count INTEGER;
BEGIN
    -- Contar dados existentes
    SELECT COUNT(*) INTO medicos_count FROM doctors WHERE is_active = true;
    SELECT COUNT(DISTINCT specialty) INTO especialidades_count FROM doctors WHERE is_active = true AND specialty IS NOT NULL;
    SELECT COUNT(*) INTO procedimentos_count FROM procedure_records;
    
    RAISE NOTICE '';
    RAISE NOTICE '🔍 DIAGNÓSTICO DO SISTEMA:';
    RAISE NOTICE '================================';
    RAISE NOTICE '📋 Médicos ativos: %', medicos_count;
    RAISE NOTICE '🏥 Especialidades: %', especialidades_count;
    RAISE NOTICE '📊 Procedimentos: %', procedimentos_count;
    RAISE NOTICE '';
    
    IF medicos_count = 0 THEN
        RAISE NOTICE '❌ PROBLEMA: Nenhum médico cadastrado!';
        RAISE NOTICE '💡 SOLUÇÃO: Execute os INSERTs de médicos de exemplo abaixo';
    ELSIF especialidades_count = 0 THEN
        RAISE NOTICE '❌ PROBLEMA: Médicos sem especialidades definidas!';
        RAISE NOTICE '💡 SOLUÇÃO: Atualize os médicos com especialidades';
    ELSIF procedimentos_count = 0 THEN
        RAISE NOTICE '❌ PROBLEMA: Nenhum procedimento cadastrado!';
        RAISE NOTICE '💡 SOLUÇÃO: Execute os INSERTs de procedimentos de exemplo';
    ELSE
        RAISE NOTICE '✅ SISTEMA: Dados básicos presentes';
        RAISE NOTICE '📊 Dashboard de especialidades deve funcionar';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- ================================================================
-- 8. DADOS DE EXEMPLO PARA TESTES (SE NECESSÁRIO)
-- ================================================================

-- DESCOMENTE ABAIXO SE NÃO HOUVER MÉDICOS CADASTRADOS:

/*
-- Inserir médicos de exemplo
INSERT INTO doctors (name, cns, crm, specialty, is_active) VALUES
('Dr. Carlos Eduardo Silva', '123456789012345', 'SP-123456', 'Cardiologia', true),
('Dra. Maria Santos Oliveira', '234567890123456', 'SP-234567', 'Neurologia', true),
('Dr. João Pedro Costa', '345678901234567', 'SP-345678', 'Ortopedia', true),
('Dra. Ana Clara Rodrigues', '456789012345678', 'SP-456789', 'Pediatria', true),
('Dr. Roberto Almeida', '567890123456789', 'SP-567890', 'Cirurgia Geral', true),
('Dra. Fernanda Lima', '678901234567890', 'SP-678901', 'Ginecologia', true),
('Dr. Marcos Vinícius', '789012345678901', 'SP-789012', 'Urologia', true),
('Dra. Patricia Souza', '890123456789012', 'SP-890123', 'Dermatologia', true),
('Dr. André Santos', '901234567890123', 'SP-901234', 'Oftalmologia', true),
('Dra. Camila Ribeiro', '012345678901234', 'SP-012345', 'Endocrinologia', true)
ON CONFLICT (cns) DO NOTHING;

-- Vincular médicos ao hospital demo
INSERT INTO doctor_hospital (doctor_id, hospital_id, role, is_active, is_primary_hospital)
SELECT 
    d.id,
    'a0000000-0000-0000-0000-000000000001', -- Hospital Demo
    'Médico Assistente',
    true,
    true
FROM doctors d
WHERE NOT EXISTS (
    SELECT 1 FROM doctor_hospital dh 
    WHERE dh.doctor_id = d.id 
    AND dh.hospital_id = 'a0000000-0000-0000-0000-000000000001'
);

-- Inserir procedimentos de exemplo para dar faturamento aos médicos
INSERT INTO procedure_records (
    hospital_id,
    patient_id,
    procedure_code,
    procedure_description,
    professional,
    value_charged,
    procedure_date,
    billing_status,
    match_confidence
)
SELECT 
    'a0000000-0000-0000-0000-000000000001', -- Hospital Demo
    gen_random_uuid(), -- Patient fictício
    '0301010019', -- Código de consulta
    'Consulta médica - ' || d.specialty,
    d.cns,
    FLOOR(RANDOM() * 50000 + 10000)::INTEGER, -- Valor entre R$ 100 e R$ 500
    CURRENT_DATE - (RANDOM() * INTERVAL '90 days')::INTEGER,
    CASE WHEN RANDOM() > 0.2 THEN 'paid' ELSE 'pending' END,
    0.95
FROM doctors d
WHERE d.is_active = true
    AND NOT EXISTS (
        SELECT 1 FROM procedure_records pr 
        WHERE pr.professional = d.cns
    );
*/

-- ================================================================
-- 9. VERIFICAÇÃO FINAL
-- ================================================================
SELECT 
  'VERIFICAÇÃO FINAL' as status,
  'Se os dados acima mostrarem 0 especialidades, execute os INSERTs comentados acima' as instrucoes;

SELECT 
  'TESTE FINAL DA VIEW' as teste,
  doctor_specialty,
  doctors_count,
  ROUND(total_specialty_revenue_reais, 2) as faturamento,
  total_procedures
FROM v_specialty_revenue_stats
ORDER BY total_specialty_revenue_reais DESC
LIMIT 5; 