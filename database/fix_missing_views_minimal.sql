-- ================================================================
-- FIX RÁPIDO: CRIAR VIEWS ESSENCIAIS FALTANTES
-- ================================================================
-- Execute este script no SQL Editor do Supabase
-- ================================================================

-- ================================================================
-- 1. VIEW: v_doctor_revenue_monthly (BASE)
-- ================================================================
CREATE OR REPLACE VIEW v_doctor_revenue_monthly AS
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
  
  STRING_AGG(h.name, ' | ' ORDER BY h.name) as hospitals_list,
  STRING_AGG(h.id::text, ',' ORDER BY h.id) as hospital_ids,
  COUNT(DISTINCT h.id) as hospitals_count,
  
  EXTRACT(YEAR FROM pr.procedure_date) as revenue_year,
  EXTRACT(MONTH FROM pr.procedure_date) as revenue_month,
  DATE_TRUNC('month', pr.procedure_date) as revenue_month_date,
  
  COUNT(pr.id) as total_procedures,
  COUNT(CASE WHEN pr.billing_status = 'pending' THEN 1 END) as pending_procedures,
  COUNT(CASE WHEN pr.billing_status = 'billed' THEN 1 END) as billed_procedures,
  COUNT(CASE WHEN pr.billing_status = 'paid' THEN 1 END) as paid_procedures,
  COUNT(CASE WHEN pr.billing_status = 'rejected' THEN 1 END) as rejected_procedures,
  
  SUM(pr.value_charged) as total_revenue_cents,
  AVG(pr.value_charged) as avg_procedure_value_cents,
  MIN(pr.value_charged) as min_procedure_value_cents,
  MAX(pr.value_charged) as max_procedure_value_cents,
  
  ROUND(SUM(pr.value_charged) / 100.0, 2) as total_revenue_reais,
  ROUND(AVG(pr.value_charged) / 100.0, 2) as avg_procedure_value_reais,
  
  ROUND(
    COUNT(CASE WHEN pr.billing_status = 'paid' THEN 1 END) * 100.0 / 
    NULLIF(COUNT(pr.id), 0), 2
  ) as payment_rate_percent,
  
  ROUND(
    COUNT(CASE WHEN pr.billing_status != 'rejected' THEN 1 END) * 100.0 / 
    NULLIF(COUNT(pr.id), 0), 2
  ) as approval_rate_percent,
  
  MAX(pr.procedure_date) as last_procedure_date,
  MAX(pr.created_at) as last_created_at

FROM doctors d
LEFT JOIN doctor_hospital dh ON d.id = dh.doctor_id AND dh.is_active = true
LEFT JOIN hospitals h ON dh.hospital_id = h.id  
LEFT JOIN procedure_records pr ON (
  pr.professional = d.cns OR 
  pr.professional_cbo = d.cns OR
  pr.notes LIKE '%' || d.cns || '%'
) AND pr.professional_cbo != '225151' -- Excluir anestesistas
WHERE d.is_active = true
GROUP BY d.id, d.name, d.cns, d.crm, d.specialty, d.secondary_specialties, 
         d.email, d.phone, d.is_active, d.notes,
         EXTRACT(YEAR FROM pr.procedure_date), 
         EXTRACT(MONTH FROM pr.procedure_date),
         DATE_TRUNC('month', pr.procedure_date)
ORDER BY total_revenue_reais DESC NULLS LAST, d.name;

-- ================================================================
-- 2. VIEW: v_doctors_aggregated (ESSENCIAL)
-- ================================================================
CREATE OR REPLACE VIEW v_doctors_aggregated AS
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
  
  STRING_AGG(h.name, ' | ' ORDER BY h.name) as hospitals_list,
  STRING_AGG(h.id::text, ',' ORDER BY h.id) as hospital_ids,
  COUNT(DISTINCT h.id) as hospitals_count,
  
  (SELECT h2.name FROM hospitals h2 
   JOIN doctor_hospital dh2 ON h2.id = dh2.hospital_id 
   WHERE dh2.doctor_id = d.id AND dh2.is_primary_hospital = true 
   LIMIT 1) as primary_hospital_name,
   
  STRING_AGG(dh.role, ' | ' ORDER BY dh.role) as roles_list,
  STRING_AGG(dh.department, ' | ' ORDER BY dh.department) as departments_list,
  
  COALESCE(
    (SELECT SUM(drm.total_revenue_cents) 
     FROM v_doctor_revenue_monthly drm 
     WHERE drm.doctor_id = d.id 
     AND drm.revenue_month_date >= DATE_TRUNC('month', NOW() - INTERVAL '12 months')), 0
  ) as total_revenue_12months_cents,
  
  ROUND(COALESCE(
    (SELECT SUM(drm.total_revenue_cents) 
     FROM v_doctor_revenue_monthly drm 
     WHERE drm.doctor_id = d.id 
     AND drm.revenue_month_date >= DATE_TRUNC('month', NOW() - INTERVAL '12 months')), 0
  ) / 100.0, 2) as total_revenue_12months_reais,
  
  COALESCE(
    (SELECT SUM(drm.total_procedures) 
     FROM v_doctor_revenue_monthly drm 
     WHERE drm.doctor_id = d.id 
     AND drm.revenue_month_date >= DATE_TRUNC('month', NOW() - INTERVAL '12 months')), 0
  ) as total_procedures_12months,
  
  ROUND(COALESCE(
    (SELECT AVG(drm.payment_rate_percent) 
     FROM v_doctor_revenue_monthly drm 
     WHERE drm.doctor_id = d.id 
     AND drm.revenue_month_date >= DATE_TRUNC('month', NOW() - INTERVAL '12 months')), 0
  ), 2) as avg_payment_rate_12months,
  
  CASE 
    WHEN COALESCE((SELECT SUM(drm.total_procedures) 
                   FROM v_doctor_revenue_monthly drm 
                   WHERE drm.doctor_id = d.id 
                   AND drm.revenue_month_date >= DATE_TRUNC('month', NOW() - INTERVAL '1 months')), 0) > 20 
    THEN 'ATIVO'
    WHEN COALESCE((SELECT SUM(drm.total_procedures) 
                   FROM v_doctor_revenue_monthly drm 
                   WHERE drm.doctor_id = d.id 
                   AND drm.revenue_month_date >= DATE_TRUNC('month', NOW() - INTERVAL '3 months')), 0) > 10 
    THEN 'MODERADO'
    ELSE 'INATIVO'
  END as activity_status,
  
  (SELECT MAX(drm.last_procedure_date) 
   FROM v_doctor_revenue_monthly drm 
   WHERE drm.doctor_id = d.id) as last_activity_date

FROM doctors d
LEFT JOIN doctor_hospital dh ON d.id = dh.doctor_id AND dh.is_active = true
LEFT JOIN hospitals h ON dh.hospital_id = h.id
WHERE d.is_active = true
GROUP BY d.id, d.name, d.cns, d.crm, d.specialty, d.secondary_specialties, 
         d.email, d.phone, d.is_active, d.notes, d.created_at, d.updated_at
ORDER BY total_revenue_12months_reais DESC NULLS LAST;

-- ================================================================
-- 3. VIEW: v_specialty_revenue_stats (ESSENCIAL)
-- ================================================================
CREATE OR REPLACE VIEW v_specialty_revenue_stats AS
SELECT 
  da.doctor_specialty,
  COUNT(da.doctor_id) as doctors_count,
  SUM(da.total_revenue_12months_cents) as total_specialty_revenue_cents,
  ROUND(SUM(da.total_revenue_12months_cents) / 100.0, 2) as total_specialty_revenue_reais,
  ROUND(AVG(da.total_revenue_12months_cents) / 100.0, 2) as avg_doctor_revenue_reais,
  SUM(da.total_procedures_12months) as total_procedures,
  ROUND(AVG(da.total_procedures_12months), 0) as avg_procedures_per_doctor,
  ROUND(AVG(da.avg_payment_rate_12months), 2) as avg_payment_rate
FROM v_doctors_aggregated da
WHERE da.doctor_specialty IS NOT NULL
GROUP BY da.doctor_specialty
ORDER BY total_specialty_revenue_reais DESC;

-- ================================================================
-- 4. VIEW: v_hospital_revenue_stats (ESSENCIAL)
-- ================================================================
CREATE OR REPLACE VIEW v_hospital_revenue_stats AS
SELECT 
  h.id as hospital_id,
  h.name as hospital_name,
  h.cnpj as hospital_cnpj,
  
  COUNT(DISTINCT dh.doctor_id) as active_doctors_count,
  COUNT(DISTINCT CASE WHEN da.activity_status = 'ATIVO' THEN dh.doctor_id END) as very_active_doctors,
  
  SUM(da.total_revenue_12months_cents) as total_hospital_revenue_cents,
  ROUND(SUM(da.total_revenue_12months_cents) / 100.0, 2) as total_hospital_revenue_reais,
  ROUND(AVG(da.total_revenue_12months_cents) / 100.0, 2) as avg_doctor_revenue_reais,
  
  SUM(da.total_procedures_12months) as total_procedures,
  ROUND(AVG(da.total_procedures_12months), 0) as avg_procedures_per_doctor,
  
  ROUND(AVG(da.avg_payment_rate_12months), 2) as avg_payment_rate,
  
  (SELECT da2.doctor_specialty 
   FROM v_doctors_aggregated da2
   JOIN doctor_hospital dh2 ON da2.doctor_id = dh2.doctor_id
   WHERE dh2.hospital_id = h.id 
   AND da2.doctor_specialty IS NOT NULL
   GROUP BY da2.doctor_specialty
   ORDER BY SUM(da2.total_revenue_12months_cents) DESC
   LIMIT 1
  ) as top_specialty_by_revenue

FROM hospitals h
LEFT JOIN doctor_hospital dh ON h.id = dh.hospital_id AND dh.is_active = true
LEFT JOIN v_doctors_aggregated da ON dh.doctor_id = da.doctor_id
GROUP BY h.id, h.name, h.cnpj
ORDER BY total_hospital_revenue_reais DESC NULLS LAST;

-- ================================================================
-- VERIFICAÇÃO
-- ================================================================
SELECT 
  'Views criadas com sucesso!' as status,
  COUNT(*) as total_views
FROM pg_views 
WHERE viewname IN (
  'v_doctor_revenue_monthly',
  'v_doctors_aggregated', 
  'v_specialty_revenue_stats',
  'v_hospital_revenue_stats'
);

