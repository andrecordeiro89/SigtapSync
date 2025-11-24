-- ================================================================
-- SOLUÇÃO DE PERFORMANCE: MATERIALIZED VIEWS
-- ================================================================
-- Execute este script no SQL Editor do Supabase
-- Cria versões MATERIALIZADAS (físicas) das views para performance
-- ================================================================

-- ================================================================
-- PASSO 1: CRIAR ÍNDICES ESSENCIAIS
-- ================================================================
-- Índices para otimizar consultas de faturamento
CREATE INDEX IF NOT EXISTS idx_procedure_records_professional_date 
ON procedure_records(professional, procedure_date);

CREATE INDEX IF NOT EXISTS idx_procedure_records_cbo_date 
ON procedure_records(professional_cbo, procedure_date);

CREATE INDEX IF NOT EXISTS idx_procedure_records_billing_status 
ON procedure_records(billing_status, procedure_date);

CREATE INDEX IF NOT EXISTS idx_procedure_records_value 
ON procedure_records(value_charged) WHERE value_charged IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_doctor_hospital_active 
ON doctor_hospital(doctor_id, hospital_id, is_active);

CREATE INDEX IF NOT EXISTS idx_doctors_active_specialty 
ON doctors(is_active, specialty) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_doctors_cns 
ON doctors(cns) WHERE cns IS NOT NULL;

-- ================================================================
-- PASSO 2: DROP DAS VIEWS NORMAIS E CRIAR MATERIALIZED VIEWS
-- ================================================================

-- Remover views normais (se existirem)
DROP VIEW IF EXISTS v_hospital_revenue_stats CASCADE;
DROP VIEW IF EXISTS v_specialty_revenue_stats CASCADE;
DROP VIEW IF EXISTS v_doctors_aggregated CASCADE;
DROP VIEW IF EXISTS v_doctor_revenue_monthly CASCADE;

-- ================================================================
-- 1. MATERIALIZED VIEW: FATURAMENTO MENSAL POR MÉDICO (BASE)
-- ================================================================
CREATE MATERIALIZED VIEW v_doctor_revenue_monthly AS
SELECT 
  d.id as doctor_id,
  d.name as doctor_name,
  d.cns as doctor_cns,
  d.crm as doctor_crm,
  d.specialty as doctor_specialty,
  
  -- Período de faturamento
  EXTRACT(YEAR FROM pr.procedure_date) as revenue_year,
  EXTRACT(MONTH FROM pr.procedure_date) as revenue_month,
  DATE_TRUNC('month', pr.procedure_date) as revenue_month_date,
  
  -- Métricas financeiras
  COUNT(pr.id) as total_procedures,
  COUNT(CASE WHEN pr.billing_status = 'paid' THEN 1 END) as paid_procedures,
  COUNT(CASE WHEN pr.billing_status = 'rejected' THEN 1 END) as rejected_procedures,
  
  -- Valores financeiros
  SUM(pr.value_charged) as total_revenue_cents,
  ROUND(SUM(pr.value_charged) / 100.0, 2) as total_revenue_reais,
  
  -- Taxa de pagamento
  ROUND(
    COUNT(CASE WHEN pr.billing_status = 'paid' THEN 1 END) * 100.0 / 
    NULLIF(COUNT(pr.id), 0), 2
  ) as payment_rate_percent,
  
  -- Última atividade
  MAX(pr.procedure_date) as last_procedure_date

FROM doctors d
LEFT JOIN procedure_records pr ON (
  pr.professional = d.cns OR 
  pr.professional_cbo = d.cns
) 
AND pr.professional_cbo != '225151' -- Excluir anestesistas
AND pr.procedure_date >= DATE_TRUNC('month', NOW() - INTERVAL '13 months') -- Últimos 13 meses
WHERE d.is_active = true
GROUP BY 
  d.id, d.name, d.cns, d.crm, d.specialty,
  EXTRACT(YEAR FROM pr.procedure_date), 
  EXTRACT(MONTH FROM pr.procedure_date),
  DATE_TRUNC('month', pr.procedure_date);

-- Criar índice na view materializada
CREATE INDEX idx_mv_doctor_revenue_monthly_doctor 
ON v_doctor_revenue_monthly(doctor_id, revenue_month_date);

CREATE INDEX idx_mv_doctor_revenue_monthly_date 
ON v_doctor_revenue_monthly(revenue_month_date);

-- ================================================================
-- 2. MATERIALIZED VIEW: MÉDICOS AGREGADOS (OTIMIZADA)
-- ================================================================
CREATE MATERIALIZED VIEW v_doctors_aggregated AS
SELECT 
  d.id as doctor_id,
  d.name as doctor_name,
  d.cns as doctor_cns,
  d.crm as doctor_crm,
  d.specialty as doctor_specialty,
  d.secondary_specialties as doctor_secondary_specialties,
  d.email as doctor_email,
  d.phone as doctor_phone,
  d.is_active as doctor_is_active,
  d.notes as doctor_notes,
  d.created_at as doctor_created_at,
  d.updated_at as doctor_updated_at,
  
  -- Hospitais agrupados
  STRING_AGG(h.name, ' | ' ORDER BY h.name) as hospitals_list,
  STRING_AGG(h.id::text, ',' ORDER BY h.id) as hospital_ids,
  COUNT(DISTINCT h.id) as hospitals_count,
  
  -- Faturamento 12 meses (agregado direto)
  COALESCE(SUM(drm.total_revenue_cents), 0) as total_revenue_12months_cents,
  ROUND(COALESCE(SUM(drm.total_revenue_cents), 0) / 100.0, 2) as total_revenue_12months_reais,
  COALESCE(SUM(drm.total_procedures), 0) as total_procedures_12months,
  ROUND(AVG(drm.payment_rate_percent), 2) as avg_payment_rate_12months,
  
  -- Status de atividade
  CASE 
    WHEN COALESCE(SUM(CASE 
      WHEN drm.revenue_month_date >= DATE_TRUNC('month', NOW() - INTERVAL '1 month') 
      THEN drm.total_procedures 
      ELSE 0 
    END), 0) > 20 THEN 'ATIVO'
    WHEN COALESCE(SUM(CASE 
      WHEN drm.revenue_month_date >= DATE_TRUNC('month', NOW() - INTERVAL '3 months') 
      THEN drm.total_procedures 
      ELSE 0 
    END), 0) > 10 THEN 'MODERADO'
    ELSE 'INATIVO'
  END as activity_status,
  
  MAX(drm.last_procedure_date) as last_activity_date

FROM doctors d
LEFT JOIN doctor_hospital dh ON d.id = dh.doctor_id AND dh.is_active = true
LEFT JOIN hospitals h ON dh.hospital_id = h.id
LEFT JOIN v_doctor_revenue_monthly drm ON d.id = drm.doctor_id
WHERE d.is_active = true
GROUP BY 
  d.id, d.name, d.cns, d.crm, d.specialty, d.secondary_specialties, 
  d.email, d.phone, d.is_active, d.notes, d.created_at, d.updated_at;

-- Criar índices na view materializada
CREATE INDEX idx_mv_doctors_aggregated_id 
ON v_doctors_aggregated(doctor_id);

CREATE INDEX idx_mv_doctors_aggregated_specialty 
ON v_doctors_aggregated(doctor_specialty);

CREATE INDEX idx_mv_doctors_aggregated_revenue 
ON v_doctors_aggregated(total_revenue_12months_reais DESC);

-- ================================================================
-- 3. MATERIALIZED VIEW: ESTATÍSTICAS POR ESPECIALIDADE
-- ================================================================
CREATE MATERIALIZED VIEW v_specialty_revenue_stats AS
SELECT 
  doctor_specialty,
  COUNT(doctor_id) as doctors_count,
  SUM(total_revenue_12months_cents) as total_specialty_revenue_cents,
  ROUND(SUM(total_revenue_12months_cents) / 100.0, 2) as total_specialty_revenue_reais,
  ROUND(AVG(total_revenue_12months_cents) / 100.0, 2) as avg_doctor_revenue_reais,
  SUM(total_procedures_12months) as total_procedures,
  ROUND(AVG(total_procedures_12months), 0) as avg_procedures_per_doctor,
  ROUND(AVG(avg_payment_rate_12months), 2) as avg_payment_rate
FROM v_doctors_aggregated
WHERE doctor_specialty IS NOT NULL
GROUP BY doctor_specialty;

-- Criar índice na view materializada
CREATE INDEX idx_mv_specialty_revenue_stats_specialty 
ON v_specialty_revenue_stats(doctor_specialty);

-- ================================================================
-- 4. MATERIALIZED VIEW: ESTATÍSTICAS POR HOSPITAL
-- ================================================================
CREATE MATERIALIZED VIEW v_hospital_revenue_stats AS
SELECT 
  h.id as hospital_id,
  h.name as hospital_name,
  h.cnpj as hospital_cnpj,
  
  COUNT(DISTINCT dh.doctor_id) as active_doctors_count,
  COUNT(DISTINCT CASE WHEN da.activity_status = 'ATIVO' THEN dh.doctor_id END) as very_active_doctors,
  
  COALESCE(SUM(da.total_revenue_12months_cents), 0) as total_hospital_revenue_cents,
  ROUND(COALESCE(SUM(da.total_revenue_12months_cents), 0) / 100.0, 2) as total_hospital_revenue_reais,
  ROUND(AVG(da.total_revenue_12months_cents) / 100.0, 2) as avg_doctor_revenue_reais,
  
  COALESCE(SUM(da.total_procedures_12months), 0) as total_procedures,
  ROUND(AVG(da.total_procedures_12months), 0) as avg_procedures_per_doctor,
  ROUND(AVG(da.avg_payment_rate_12months), 2) as avg_payment_rate

FROM hospitals h
LEFT JOIN doctor_hospital dh ON h.id = dh.hospital_id AND dh.is_active = true
LEFT JOIN v_doctors_aggregated da ON dh.doctor_id = da.doctor_id
GROUP BY h.id, h.name, h.cnpj;

-- Criar índice na view materializada
CREATE INDEX idx_mv_hospital_revenue_stats_id 
ON v_hospital_revenue_stats(hospital_id);

-- ================================================================
-- PASSO 3: FUNÇÃO PARA REFRESH AUTOMÁTICO (OPCIONAL)
-- ================================================================
CREATE OR REPLACE FUNCTION refresh_revenue_views()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_doctor_revenue_monthly;
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_doctors_aggregated;
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_specialty_revenue_stats;
  REFRESH MATERIALIZED VIEW CONCURRENTLY v_hospital_revenue_stats;
  
  RAISE NOTICE 'Views materializadas atualizadas com sucesso às %', NOW();
END;
$$ LANGUAGE plpgsql;

-- ================================================================
-- PASSO 4: REFRESH INICIAL (POPULAR AS VIEWS)
-- ================================================================
REFRESH MATERIALIZED VIEW v_doctor_revenue_monthly;
REFRESH MATERIALIZED VIEW v_doctors_aggregated;
REFRESH MATERIALIZED VIEW v_specialty_revenue_stats;
REFRESH MATERIALIZED VIEW v_hospital_revenue_stats;

-- ================================================================
-- VERIFICAÇÃO FINAL
-- ================================================================
SELECT 
  schemaname,
  matviewname as viewname,
  'MATERIALIZED' as type,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||matviewname)) as size
FROM pg_matviews
WHERE schemaname = 'public'
AND matviewname IN (
  'v_doctor_revenue_monthly',
  'v_doctors_aggregated', 
  'v_specialty_revenue_stats',
  'v_hospital_revenue_stats'
)
ORDER BY matviewname;

-- ================================================================
-- RESULTADO ESPERADO:
-- v_doctor_revenue_monthly     | MATERIALIZED | XX KB
-- v_doctors_aggregated         | MATERIALIZED | XX KB
-- v_hospital_revenue_stats     | MATERIALIZED | XX KB
-- v_specialty_revenue_stats    | MATERIALIZED | XX KB
-- ================================================================

