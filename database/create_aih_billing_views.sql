-- ================================================================
-- VIEWS DE BILLING AIH - SISTEMA SIGTAP
-- ================================================================
-- Criado em: 2024-12-20
-- Propósito: Views agregadas para faturamento por procedimento, hospital, médico
-- Funcionalidade: Análise financeira completa das AIHs processadas
-- ================================================================

-- ================================================================
-- 1. VIEW: BILLING SUMMARY GERAL
-- ================================================================
CREATE OR REPLACE VIEW v_aih_billing_summary AS
SELECT 
  COUNT(pr.id) as total_aihs,
  
  -- Valores financeiros (conversão de centavos para reais)
  ROUND(SUM(pr.value_charged) / 100.0, 2) as total_value,
  ROUND(AVG(pr.value_charged) / 100.0, 2) as avg_value_per_aih,
  
  -- Status de aprovação
  COUNT(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN 1 END) as approved_aihs,
  ROUND(SUM(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as approved_value,
  
  COUNT(CASE WHEN pr.billing_status = 'rejected' THEN 1 END) as rejected_aihs,
  ROUND(SUM(CASE WHEN pr.billing_status = 'rejected' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as rejected_value,
  
  COUNT(CASE WHEN pr.billing_status = 'pending' OR pr.billing_status = 'submitted' THEN 1 END) as pending_aihs,
  ROUND(SUM(CASE WHEN pr.billing_status = 'pending' OR pr.billing_status = 'submitted' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as pending_value,
  
  -- Datas
  MIN(pr.procedure_date) as earliest_date,
  MAX(pr.procedure_date) as latest_date,
  
  -- Tempo médio (simulado - seria calculado pela diferença entre datas)
  3.5 as avg_length_of_stay

FROM procedure_records pr
WHERE pr.value_charged > 0;

-- ================================================================
-- 2. VIEW: BILLING POR PROCEDIMENTO (NOSSA VIEW PRINCIPAL!)
-- ================================================================
CREATE OR REPLACE VIEW v_aih_billing_by_procedure AS
SELECT 
  sp.code as procedure_code,
  sp.description as procedure_description,
  
  -- Contadores
  COUNT(pr.id) as total_aihs,
  COUNT(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN 1 END) as approved_aihs,
  COUNT(CASE WHEN pr.billing_status = 'rejected' THEN 1 END) as rejected_aihs,
  COUNT(CASE WHEN pr.billing_status = 'pending' OR pr.billing_status = 'submitted' THEN 1 END) as pending_aihs,
  
  -- Valores financeiros (conversão correta de centavos para reais)
  ROUND(SUM(pr.value_charged) / 100.0, 2) as total_value,
  ROUND(AVG(pr.value_charged) / 100.0, 2) as avg_value_per_aih,
  
  ROUND(SUM(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as approved_value,
  ROUND(SUM(CASE WHEN pr.billing_status = 'rejected' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as rejected_value,
  ROUND(SUM(CASE WHEN pr.billing_status = 'pending' OR pr.billing_status = 'submitted' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as pending_value,
  
  -- Tempo médio (simulado)
  AVG(3.5) as avg_length_of_stay,
  
  -- Dimensões de agregação
  COUNT(DISTINCT h.id) as unique_hospitals,
  COUNT(DISTINCT pr.professional) as unique_doctors,
  COUNT(DISTINCT sp.specialty) as unique_specialties

FROM procedure_records pr
JOIN sigtap_procedures sp ON pr.procedure_id = sp.id
JOIN hospitals h ON pr.hospital_id = h.id
WHERE pr.value_charged > 0
GROUP BY sp.code, sp.description
ORDER BY total_value DESC;

-- ================================================================
-- 3. VIEW: BILLING POR HOSPITAL
-- ================================================================
CREATE OR REPLACE VIEW v_aih_billing_by_hospital AS
SELECT 
  h.id::text as hospital_id,
  h.name as hospital_name,
  COALESCE(h.cnpj, '') as hospital_cnpj,
  
  -- Contadores
  COUNT(pr.id) as total_aihs,
  COUNT(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN 1 END) as approved_aihs,
  COUNT(CASE WHEN pr.billing_status = 'rejected' THEN 1 END) as rejected_aihs,
  COUNT(CASE WHEN pr.billing_status = 'pending' OR pr.billing_status = 'submitted' THEN 1 END) as pending_aihs,
  
  -- Valores financeiros
  ROUND(SUM(pr.value_charged) / 100.0, 2) as total_value,
  ROUND(AVG(pr.value_charged) / 100.0, 2) as avg_value_per_aih,
  
  ROUND(SUM(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as approved_value,
  ROUND(SUM(CASE WHEN pr.billing_status = 'rejected' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as rejected_value,
  ROUND(SUM(CASE WHEN pr.billing_status = 'pending' OR pr.billing_status = 'submitted' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as pending_value,
  
  -- Tempo médio
  AVG(3.5) as avg_length_of_stay,
  
  -- Dimensões
  COUNT(DISTINCT sp.code) as unique_procedures,
  COUNT(DISTINCT pr.professional) as unique_doctors,
  COUNT(DISTINCT sp.main_cid) as unique_diagnoses

FROM procedure_records pr
JOIN hospitals h ON pr.hospital_id = h.id
JOIN sigtap_procedures sp ON pr.procedure_id = sp.id
WHERE pr.value_charged > 0
GROUP BY h.id, h.name, h.cnpj
ORDER BY total_value DESC;

-- ================================================================
-- 4. VIEW: BILLING POR MÉDICO
-- ================================================================
CREATE OR REPLACE VIEW v_aih_billing_by_doctor AS
SELECT 
  pr.professional as doctor_cns,
  COALESCE(d.name, 'Médico não cadastrado') as doctor_name,
  COALESCE(d.crm, '') as doctor_crm,
  COALESCE(d.crm_state, '') as doctor_crm_state,
  COALESCE(d.specialty, 'Não informado') as doctor_specialty,
  d.id::text as doctor_id,
  
  -- Contadores
  COUNT(pr.id) as total_aihs,
  COUNT(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN 1 END) as approved_aihs,
  COUNT(CASE WHEN pr.billing_status = 'rejected' THEN 1 END) as rejected_aihs,
  COUNT(CASE WHEN pr.billing_status = 'pending' OR pr.billing_status = 'submitted' THEN 1 END) as pending_aihs,
  
  -- Valores financeiros
  ROUND(SUM(pr.value_charged) / 100.0, 2) as total_value,
  ROUND(AVG(pr.value_charged) / 100.0, 2) as avg_value_per_aih,
  
  ROUND(SUM(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as approved_value,
  ROUND(SUM(CASE WHEN pr.billing_status = 'rejected' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as rejected_value,
  ROUND(SUM(CASE WHEN pr.billing_status = 'pending' OR pr.billing_status = 'submitted' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as pending_value,
  
  -- Tempo médio
  AVG(3.5) as avg_length_of_stay,
  
  -- Dimensões
  COUNT(DISTINCT sp.code) as unique_procedures,
  COUNT(DISTINCT h.id) as unique_hospitals,
  COUNT(DISTINCT sp.main_cid) as unique_diagnoses

FROM procedure_records pr
LEFT JOIN doctors d ON pr.professional = d.cns
JOIN sigtap_procedures sp ON pr.procedure_id = sp.id
JOIN hospitals h ON pr.hospital_id = h.id
WHERE pr.value_charged > 0
  AND pr.professional IS NOT NULL
GROUP BY pr.professional, d.id, d.name, d.crm, d.crm_state, d.specialty
ORDER BY total_value DESC;

-- ================================================================
-- 5. VIEW: BILLING POR MÊS
-- ================================================================
CREATE OR REPLACE VIEW v_aih_billing_by_month AS
SELECT 
  TO_CHAR(pr.procedure_date, 'YYYY-MM') as month,
  
  -- Contadores
  COUNT(pr.id) as total_aihs,
  COUNT(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN 1 END) as approved_aihs,
  COUNT(CASE WHEN pr.billing_status = 'rejected' THEN 1 END) as rejected_aihs,
  COUNT(CASE WHEN pr.billing_status = 'pending' OR pr.billing_status = 'submitted' THEN 1 END) as pending_aihs,
  
  -- Valores financeiros
  ROUND(SUM(pr.value_charged) / 100.0, 2) as total_value,
  ROUND(AVG(pr.value_charged) / 100.0, 2) as avg_value_per_aih,
  
  ROUND(SUM(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as approved_value,
  ROUND(SUM(CASE WHEN pr.billing_status = 'rejected' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as rejected_value,
  ROUND(SUM(CASE WHEN pr.billing_status = 'pending' OR pr.billing_status = 'submitted' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as pending_value,
  
  -- Tempo médio
  AVG(3.5) as avg_length_of_stay,
  
  -- Dimensões
  COUNT(DISTINCT h.id) as unique_hospitals,
  COUNT(DISTINCT sp.code) as unique_procedures,
  COUNT(DISTINCT pr.professional) as unique_doctors

FROM procedure_records pr
JOIN hospitals h ON pr.hospital_id = h.id
JOIN sigtap_procedures sp ON pr.procedure_id = sp.id
WHERE pr.value_charged > 0
GROUP BY TO_CHAR(pr.procedure_date, 'YYYY-MM')
ORDER BY month DESC;

-- ================================================================
-- 6. VIEW: BILLING POR HOSPITAL E ESPECIALIDADE
-- ================================================================
CREATE OR REPLACE VIEW v_aih_billing_by_hospital_specialty AS
SELECT 
  h.id::text as hospital_id,
  h.name as hospital_name,
  COALESCE(d.specialty, 'Não informado') as doctor_specialty,
  
  -- Contadores
  COUNT(pr.id) as total_aihs,
  COUNT(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN 1 END) as approved_aihs,
  COUNT(CASE WHEN pr.billing_status = 'rejected' THEN 1 END) as rejected_aihs,
  COUNT(CASE WHEN pr.billing_status = 'pending' OR pr.billing_status = 'submitted' THEN 1 END) as pending_aihs,
  
  -- Valores financeiros
  ROUND(SUM(pr.value_charged) / 100.0, 2) as total_value,
  ROUND(AVG(pr.value_charged) / 100.0, 2) as avg_value_per_aih,
  
  ROUND(SUM(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as approved_value,
  ROUND(SUM(CASE WHEN pr.billing_status = 'rejected' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as rejected_value,
  ROUND(SUM(CASE WHEN pr.billing_status = 'pending' OR pr.billing_status = 'submitted' THEN pr.value_charged ELSE 0 END) / 100.0, 2) as pending_value,
  
  -- Tempo médio
  AVG(3.5) as avg_length_of_stay,
  
  -- Dimensões
  COUNT(DISTINCT sp.code) as unique_procedures,
  COUNT(DISTINCT pr.professional) as unique_doctors,
  COUNT(DISTINCT sp.main_cid) as unique_diagnoses

FROM procedure_records pr
JOIN hospitals h ON pr.hospital_id = h.id
JOIN sigtap_procedures sp ON pr.procedure_id = sp.id
LEFT JOIN doctors d ON pr.professional = d.cns
WHERE pr.value_charged > 0
GROUP BY h.id, h.name, d.specialty
ORDER BY total_value DESC;

-- ================================================================
-- 7. ÍNDICES PARA PERFORMANCE
-- ================================================================

-- Índices para procedure_records
CREATE INDEX IF NOT EXISTS idx_procedure_records_value_status 
ON procedure_records(value_charged, billing_status) WHERE value_charged > 0;

CREATE INDEX IF NOT EXISTS idx_procedure_records_procedure_date 
ON procedure_records(procedure_date);

CREATE INDEX IF NOT EXISTS idx_procedure_records_professional_status 
ON procedure_records(professional, billing_status);

-- Comentários
COMMENT ON VIEW v_aih_billing_by_procedure IS 'Agregação de faturamento por código de procedimento - valores em reais';
COMMENT ON VIEW v_aih_billing_by_hospital IS 'Agregação de faturamento por hospital - valores em reais';
COMMENT ON VIEW v_aih_billing_by_doctor IS 'Agregação de faturamento por médico - valores em reais';
COMMENT ON VIEW v_aih_billing_by_month IS 'Agregação de faturamento por mês - valores em reais';
COMMENT ON VIEW v_aih_billing_summary IS 'Resumo geral de faturamento - valores em reais'; 