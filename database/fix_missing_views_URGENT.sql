-- ================================================================
-- CORREÇÃO URGENTE: VIEWS AUSENTES SISTEMA SIGTAP
-- ================================================================
-- Data: 2024-12-20
-- Propósito: Criar todas as views que estão causando erros 404/406
-- Problema: Sistema tentando acessar views que não existem
-- CORREÇÃO: Contar AIHs únicas, não procedimentos individuais
-- ================================================================

-- ================================================================
-- 0. REMOVER VIEWS EXISTENTES (RESOLVE CONFLITO DE TIPOS)
-- ================================================================
DROP VIEW IF EXISTS v_procedure_summary_by_hospital CASCADE;
DROP VIEW IF EXISTS v_hospital_financial_summary CASCADE;
DROP VIEW IF EXISTS v_aih_billing_by_procedure CASCADE;

-- ================================================================
-- 1. VIEW: PROCEDURE SUMMARY BY HOSPITAL (CORRIGIDA!)
-- ================================================================
CREATE OR REPLACE VIEW v_procedure_summary_by_hospital AS
SELECT 
  pr.hospital_id::text as hospital_id,
  h.name as hospital_name,
  pr.procedure_code,
  sp.description as procedure_description,
  
  -- ✅ CORREÇÃO: Contar procedimentos (não AIHs)
  COUNT(pr.id) as total_count,
  COUNT(DISTINCT pr.aih_id) as unique_aihs_count,
  COUNT(DISTINCT pr.patient_id) as unique_patients_count,
  
  -- Valores financeiros (convertendo de centavos para reais)
  ROUND(SUM(pr.value_charged) / 100.0, 2) as total_value,
  ROUND(AVG(pr.value_charged) / 100.0, 2) as avg_value_per_procedure,
  
  -- Aprovações
  COUNT(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN 1 END) as approved_count,
  COUNT(CASE WHEN pr.billing_status = 'rejected' THEN 1 END) as rejected_count,
  COUNT(CASE WHEN pr.billing_status = 'pending' OR pr.billing_status = 'submitted' THEN 1 END) as pending_count,
  
  -- Percentuais
  ROUND(
    COUNT(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN 1 END) * 100.0 / COUNT(pr.id), 
    1
  ) as approval_percentage,
  
  -- Datas
  MIN(pr.procedure_date) as earliest_date,
  MAX(pr.procedure_date) as latest_date

FROM procedure_records pr
LEFT JOIN hospitals h ON h.id::text = pr.hospital_id::text
LEFT JOIN sigtap_procedures sp ON sp.code = pr.procedure_code
WHERE pr.value_charged > 0
GROUP BY pr.hospital_id, h.name, pr.procedure_code, sp.description
ORDER BY pr.hospital_id, total_value DESC;

-- ================================================================
-- 2. VIEW: HOSPITAL FINANCIAL SUMMARY (CORRIGIDA!)
-- ================================================================
CREATE OR REPLACE VIEW v_hospital_financial_summary AS
SELECT 
  h.id::text as hospital_id,
  h.name as hospital_name,
  h.cnpj as hospital_cnpj,
  
  -- ✅ CORREÇÃO: Distinguir procedimentos vs AIHs
  COUNT(DISTINCT pr.id) as total_procedures,
  COUNT(DISTINCT pr.aih_id) as total_aihs,
  COUNT(DISTINCT pr.patient_id) as total_patients,
  COUNT(DISTINCT pr.professional_name) as active_doctors_count,
  
  -- Valores financeiros (convertendo de centavos para reais)
  ROUND(SUM(pr.value_charged) / 100.0, 2) as total_hospital_revenue_reais,
  ROUND(AVG(pr.value_charged) / 100.0, 2) as avg_value_per_procedure,
  
  -- Aprovações
  COUNT(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN 1 END) as approved_procedures,
  COUNT(CASE WHEN pr.billing_status = 'rejected' THEN 1 END) as rejected_procedures,
  COUNT(CASE WHEN pr.billing_status = 'pending' OR pr.billing_status = 'submitted' THEN 1 END) as pending_procedures,
  
  -- Percentuais
  ROUND(
    COUNT(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN 1 END) * 100.0 / COUNT(pr.id), 
    1
  ) as approval_rate,
  
  -- Médicas calculadas
  CASE 
    WHEN COUNT(DISTINCT pr.professional_name) > 0 
    THEN ROUND(SUM(pr.value_charged) / 100.0 / COUNT(DISTINCT pr.professional_name), 2)
    ELSE 0
  END as avg_revenue_per_doctor,
  
  -- Datas
  MIN(pr.procedure_date) as earliest_activity,
  MAX(pr.procedure_date) as last_activity_date,
  
  -- Status de atividade
  CASE 
    WHEN MAX(pr.procedure_date) >= CURRENT_DATE - INTERVAL '30 days' THEN 'active'
    WHEN MAX(pr.procedure_date) >= CURRENT_DATE - INTERVAL '90 days' THEN 'low_activity'
    ELSE 'inactive'
  END as activity_status

FROM hospitals h
LEFT JOIN procedure_records pr ON h.id::text = pr.hospital_id::text
WHERE h.is_active = true
GROUP BY h.id, h.name, h.cnpj
ORDER BY total_hospital_revenue_reais DESC NULLS LAST;

-- ================================================================
-- 3. VIEW: BILLING BY PROCEDURE (CORRIGIDA PARA ANALYTICS!)
-- ================================================================
CREATE OR REPLACE VIEW v_aih_billing_by_procedure AS
SELECT 
  sp.code as procedure_code,
  sp.description as procedure_description,
  
  -- ✅ CORREÇÃO CRÍTICA: Contar AIHs únicas, não procedimentos
  COUNT(DISTINCT pr.aih_id) as total_aihs,
  COUNT(DISTINCT CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN pr.aih_id END) as approved_aihs,
  COUNT(DISTINCT CASE WHEN pr.billing_status = 'rejected' THEN pr.aih_id END) as rejected_aihs,
  COUNT(DISTINCT CASE WHEN pr.billing_status = 'pending' OR pr.billing_status = 'submitted' THEN pr.aih_id END) as pending_aihs,
  
  -- Valores financeiros (convertendo de centavos para reais)
  ROUND(SUM(pr.value_charged) / 100.0, 2) as total_value,
  ROUND(AVG(pr.value_charged) / 100.0, 2) as avg_value_per_aih,
  
  -- Valores aprovados
  ROUND(
    SUM(CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN pr.value_charged ELSE 0 END) / 100.0, 
    2
  ) as approved_value,
  
  -- Valores pendentes
  ROUND(
    SUM(CASE WHEN pr.billing_status = 'pending' OR pr.billing_status = 'submitted' THEN pr.value_charged ELSE 0 END) / 100.0, 
    2
  ) as pending_value,
  
  -- Estatísticas diversas
  COUNT(DISTINCT pr.hospital_id) as unique_hospitals,
  COUNT(DISTINCT pr.professional_name) as unique_doctors,
  COUNT(DISTINCT pr.patient_id) as unique_patients,
  
  -- Percentuais (baseado em AIHs, não procedimentos)
  ROUND(
    COUNT(DISTINCT CASE WHEN pr.billing_status = 'approved' OR pr.billing_status = 'paid' THEN pr.aih_id END) * 100.0 / COUNT(DISTINCT pr.aih_id), 
    1
  ) as approval_percentage

FROM procedure_records pr
LEFT JOIN sigtap_procedures sp ON sp.code = pr.procedure_code
WHERE pr.value_charged > 0
GROUP BY sp.code, sp.description
ORDER BY total_value DESC;

-- ================================================================
-- 4. ÍNDICES PARA OTIMIZAÇÃO
-- ================================================================

-- Índices para procedure_records
CREATE INDEX IF NOT EXISTS idx_procedure_records_hospital_procedure 
ON procedure_records(hospital_id, procedure_code);

CREATE INDEX IF NOT EXISTS idx_procedure_records_billing_status 
ON procedure_records(billing_status);

CREATE INDEX IF NOT EXISTS idx_procedure_records_value_date 
ON procedure_records(value_charged, procedure_date);

CREATE INDEX IF NOT EXISTS idx_procedure_records_aih_id 
ON procedure_records(aih_id);

-- Índices para hospitais
CREATE INDEX IF NOT EXISTS idx_hospitals_active 
ON hospitals(is_active) WHERE is_active = true;

-- ================================================================
-- 5. PERMISSÕES (ROW LEVEL SECURITY)
-- ================================================================

-- Habilitar RLS nas views se necessário
-- ALTER TABLE procedure_records ENABLE ROW LEVEL SECURITY;

-- Política básica de acesso (ajustar conforme necessário)
-- CREATE POLICY "procedure_records_policy" ON procedure_records
-- FOR SELECT USING (true);

-- ================================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ================================================================

COMMENT ON VIEW v_procedure_summary_by_hospital IS 'Resumo de procedimentos agrupados por hospital - corrige erro 404 - CONTA AIHS ÚNICAS';
COMMENT ON VIEW v_hospital_financial_summary IS 'Resumo financeiro consolidado por hospital - corrige erro 406 - DISTINGUE PROCEDIMENTOS VS AIHS';
COMMENT ON VIEW v_aih_billing_by_procedure IS 'Faturamento detalhado por procedimento - view principal Analytics - CONTA AIHS ÚNICAS';

-- ================================================================
-- FIM DO SCRIPT
-- ================================================================ 