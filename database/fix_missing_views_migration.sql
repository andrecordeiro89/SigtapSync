-- ================================================================
-- FIX MISSING VIEWS - SIGTAP SYNC
-- ================================================================
-- Propósito: Criar views que estão faltando no banco de dados
-- Data: 2024-11-24
-- Problema: v_doctors_aggregated e v_specialty_revenue_stats retornando erro 500
-- ================================================================

-- ================================================================
-- 1. DROP VIEWS EXISTENTES (SE HOUVER)
-- ================================================================
DROP VIEW IF EXISTS v_specialty_revenue_stats CASCADE;
DROP VIEW IF EXISTS v_doctors_aggregated CASCADE;

-- ================================================================
-- 2. CRIAR VIEW: v_doctors_aggregated
-- ================================================================
-- Esta view agrega dados de médicos, hospitais e faturamento
-- IMPORTANTE: Exclui anestesistas (CBO 225151) dos procedimentos 04.xxx
-- MANTÉM: Procedimentos 03.xxx e cesariana (04.17.01.001-0) para anestesistas
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
  
  -- Hospitais agrupados (elimina duplicação)
  STRING_AGG(DISTINCT h.name, ' | ' ORDER BY h.name) as hospitals_list,
  STRING_AGG(DISTINCT h.id::text, ',' ORDER BY h.id) as hospital_ids,
  COUNT(DISTINCT h.id) as hospitals_count,
  
  -- Hospital primário (primeiro da lista alfabeticamente)
  (SELECT h2.name FROM hospitals h2 
   JOIN doctor_hospital dh2 ON h2.id = dh2.hospital_id 
   WHERE dh2.doctor_id = d.id AND dh2.is_active = true 
   ORDER BY h2.name LIMIT 1) as primary_hospital_name,
  
  -- Roles e departamentos agrupados
  STRING_AGG(DISTINCT dh.role, ', ' ORDER BY dh.role) as roles_list,
  STRING_AGG(DISTINCT dh.department, ', ' ORDER BY dh.department) as departments_list,
  
  -- Faturamento (últimos 12 meses) - EXCLUINDO ANESTESISTAS
  (SELECT COALESCE(SUM(pr.value_charged), 0) 
   FROM procedure_records pr 
   WHERE (pr.professional = d.cns OR pr.professional_cbo = d.cns OR pr.notes LIKE '%' || d.cns || '%') 
     AND (
       pr.professional_cbo != '225151' OR 
       pr.professional_cbo IS NULL OR
       (pr.professional_cbo = '225151' AND pr.procedure_code LIKE '03%') OR
       (pr.professional_cbo = '225151' AND pr.procedure_code = '04.17.01.001-0')
     ) -- 🚫 EXCLUIR ANESTESISTAS 04.xxx (MANTER 03.xxx + CESARIANA)
     AND pr.procedure_date >= NOW() - INTERVAL '12 months'
  ) as total_revenue_12months_cents,
  
  ROUND((SELECT COALESCE(SUM(pr.value_charged), 0) 
         FROM procedure_records pr 
         WHERE (pr.professional = d.cns OR pr.professional_cbo = d.cns OR pr.notes LIKE '%' || d.cns || '%') 
           AND (
       pr.professional_cbo != '225151' OR 
       pr.professional_cbo IS NULL OR
       (pr.professional_cbo = '225151' AND pr.procedure_code LIKE '03%') OR
       (pr.professional_cbo = '225151' AND pr.procedure_code = '04.17.01.001-0')
     ) -- 🚫 EXCLUIR ANESTESISTAS 04.xxx (MANTER 03.xxx + CESARIANA)
           AND pr.procedure_date >= NOW() - INTERVAL '12 months'
        ) / 100.0, 2) as total_revenue_12months_reais,
  
  (SELECT COUNT(pr.id) 
   FROM procedure_records pr 
   WHERE (pr.professional = d.cns OR pr.professional_cbo = d.cns OR pr.notes LIKE '%' || d.cns || '%') 
     AND (
       pr.professional_cbo != '225151' OR 
       pr.professional_cbo IS NULL OR
       (pr.professional_cbo = '225151' AND pr.procedure_code LIKE '03%') OR
       (pr.professional_cbo = '225151' AND pr.procedure_code = '04.17.01.001-0')
     ) -- 🚫 EXCLUIR ANESTESISTAS 04.xxx (MANTER 03.xxx + CESARIANA)
     AND pr.procedure_date >= NOW() - INTERVAL '12 months'
  ) as total_procedures_12months,
  
  -- Taxa de pagamento (últimos 12 meses) - EXCLUINDO ANESTESISTAS
  ROUND((SELECT COALESCE(
    COUNT(CASE WHEN pr.billing_status = 'paid' THEN 1 END) * 100.0 / 
    NULLIF(COUNT(pr.id), 0), 0) 
   FROM procedure_records pr 
   WHERE (pr.professional = d.cns OR pr.professional_cbo = d.cns OR pr.notes LIKE '%' || d.cns || '%') 
     AND (
       pr.professional_cbo != '225151' OR 
       pr.professional_cbo IS NULL OR
       (pr.professional_cbo = '225151' AND pr.procedure_code LIKE '03%') OR
       (pr.professional_cbo = '225151' AND pr.procedure_code = '04.17.01.001-0')
     ) -- 🚫 EXCLUIR ANESTESISTAS 04.xxx (MANTER 03.xxx + CESARIANA)
     AND pr.procedure_date >= NOW() - INTERVAL '12 months'
  ), 2) as payment_rate_12months_percent,
  
  -- Taxa de aprovação (últimos 12 meses) - EXCLUINDO ANESTESISTAS
  ROUND((SELECT COALESCE(
    COUNT(CASE WHEN pr.billing_status != 'rejected' THEN 1 END) * 100.0 / 
    NULLIF(COUNT(pr.id), 0), 0) 
   FROM procedure_records pr 
   WHERE (pr.professional = d.cns OR pr.professional_cbo = d.cns OR pr.notes LIKE '%' || d.cns || '%') 
     AND (
       pr.professional_cbo != '225151' OR 
       pr.professional_cbo IS NULL OR
       (pr.professional_cbo = '225151' AND pr.procedure_code LIKE '03%') OR
       (pr.professional_cbo = '225151' AND pr.procedure_code = '04.17.01.001-0')
     ) -- 🚫 EXCLUIR ANESTESISTAS 04.xxx (MANTER 03.xxx + CESARIANA)
     AND pr.procedure_date >= NOW() - INTERVAL '12 months'
  ), 2) as approval_rate_12months_percent,
  
  -- Atividade recente
  (SELECT MAX(pr.procedure_date) 
   FROM procedure_records pr 
   WHERE (pr.professional = d.cns OR pr.professional_cbo = d.cns OR pr.notes LIKE '%' || d.cns || '%') 
     AND (
       pr.professional_cbo != '225151' OR 
       pr.professional_cbo IS NULL OR
       (pr.professional_cbo = '225151' AND pr.procedure_code LIKE '03%') OR
       (pr.professional_cbo = '225151' AND pr.procedure_code = '04.17.01.001-0')
     ) -- 🚫 EXCLUIR ANESTESISTAS 04.xxx (MANTER 03.xxx + CESARIANA)
  ) as last_procedure_date,
  
  -- Status de atividade
  CASE 
    WHEN (SELECT MAX(pr.procedure_date) 
          FROM procedure_records pr 
          WHERE (pr.professional = d.cns OR pr.professional_cbo = d.cns OR pr.notes LIKE '%' || d.cns || '%') 
            AND (
              pr.professional_cbo != '225151' OR 
              pr.professional_cbo IS NULL OR
              (pr.professional_cbo = '225151' AND pr.procedure_code LIKE '03%') OR
              (pr.professional_cbo = '225151' AND pr.procedure_code = '04.17.01.001-0')
            )
         ) >= NOW() - INTERVAL '30 days' THEN 'active'
    WHEN (SELECT MAX(pr.procedure_date) 
          FROM procedure_records pr 
          WHERE (pr.professional = d.cns OR pr.professional_cbo = d.cns OR pr.notes LIKE '%' || d.cns || '%') 
            AND (
              pr.professional_cbo != '225151' OR 
              pr.professional_cbo IS NULL OR
              (pr.professional_cbo = '225151' AND pr.procedure_code LIKE '03%') OR
              (pr.professional_cbo = '225151' AND pr.procedure_code = '04.17.01.001-0')
            )
         ) >= NOW() - INTERVAL '90 days' THEN 'inactive_30days'
    WHEN (SELECT MAX(pr.procedure_date) 
          FROM procedure_records pr 
          WHERE (pr.professional = d.cns OR pr.professional_cbo = d.cns OR pr.notes LIKE '%' || d.cns || '%') 
            AND (
              pr.professional_cbo != '225151' OR 
              pr.professional_cbo IS NULL OR
              (pr.professional_cbo = '225151' AND pr.procedure_code LIKE '03%') OR
              (pr.professional_cbo = '225151' AND pr.procedure_code = '04.17.01.001-0')
            )
         ) >= NOW() - INTERVAL '180 days' THEN 'inactive_90days'
    ELSE 'inactive_180days'
  END as activity_status

FROM doctors d
LEFT JOIN doctor_hospital dh ON d.id = dh.doctor_id AND dh.is_active = true
LEFT JOIN hospitals h ON dh.hospital_id = h.id
WHERE d.is_active = true
GROUP BY d.id, d.name, d.cns, d.crm, d.specialty, d.secondary_specialties, 
         d.email, d.phone, d.is_active, d.notes, d.created_at, d.updated_at
ORDER BY total_revenue_12months_reais DESC NULLS LAST, d.name;

-- ================================================================
-- 3. CRIAR VIEW: v_specialty_revenue_stats
-- ================================================================
-- Esta view agrega estatísticas de faturamento por especialidade médica
-- ================================================================

CREATE OR REPLACE VIEW v_specialty_revenue_stats AS
SELECT 
  -- Especialidade (usando specialty principal)
  COALESCE(d.specialty, 'Sem Especialidade') as specialty,
  
  -- Contagem de médicos
  COUNT(DISTINCT d.id) as total_doctors,
  
  -- Médicos ativos (nos últimos 30 dias)
  COUNT(DISTINCT CASE 
    WHEN da.activity_status = 'active' THEN d.id 
  END) as active_doctors,
  
  -- Faturamento total (últimos 12 meses)
  COALESCE(SUM(da.total_revenue_12months_cents), 0) as total_specialty_revenue_cents,
  ROUND(COALESCE(SUM(da.total_revenue_12months_reais), 0), 2) as total_specialty_revenue_reais,
  
  -- Faturamento médio por médico
  ROUND(
    COALESCE(AVG(da.total_revenue_12months_reais), 0), 2
  ) as avg_revenue_per_doctor_reais,
  
  -- Total de procedimentos
  COALESCE(SUM(da.total_procedures_12months), 0) as total_specialty_procedures,
  
  -- Média de procedimentos por médico
  ROUND(
    COALESCE(AVG(da.total_procedures_12months), 0), 2
  ) as avg_procedures_per_doctor,
  
  -- Taxa média de pagamento
  ROUND(
    COALESCE(AVG(da.payment_rate_12months_percent), 0), 2
  ) as avg_payment_rate_percent,
  
  -- Taxa média de aprovação
  ROUND(
    COALESCE(AVG(da.approval_rate_12months_percent), 0), 2
  ) as avg_approval_rate_percent,
  
  -- Hospitais associados
  COUNT(DISTINCT h.id) as associated_hospitals_count,
  STRING_AGG(DISTINCT h.name, ' | ' ORDER BY h.name) as associated_hospitals_list

FROM v_doctors_aggregated da
JOIN doctors d ON da.doctor_id = d.id
LEFT JOIN doctor_hospital dh ON d.id = dh.doctor_id AND dh.is_active = true
LEFT JOIN hospitals h ON dh.hospital_id = h.id
GROUP BY d.specialty
ORDER BY total_specialty_revenue_reais DESC NULLS LAST;

-- ================================================================
-- 4. COMENTÁRIOS E DOCUMENTAÇÃO
-- ================================================================

COMMENT ON VIEW v_doctors_aggregated IS 
'Médicos agregados com faturamento - EXCLUI anestesistas 04.xxx (CBO 225151), INCLUI 03.xxx + cesariana';

COMMENT ON VIEW v_specialty_revenue_stats IS 
'Estatísticas de faturamento agrupadas por especialidade médica';

-- ================================================================
-- 5. PERMISSÕES
-- ================================================================
-- Garantir que usuários autenticados possam acessar as views

GRANT SELECT ON v_doctors_aggregated TO authenticated;
GRANT SELECT ON v_specialty_revenue_stats TO authenticated;

-- ================================================================
-- 6. ÍNDICES PARA PERFORMANCE (OPCIONAL)
-- ================================================================
-- Criar índices nas tabelas base se ainda não existirem

CREATE INDEX IF NOT EXISTS idx_procedure_records_professional 
  ON procedure_records(professional);

CREATE INDEX IF NOT EXISTS idx_procedure_records_professional_cbo 
  ON procedure_records(professional_cbo);

CREATE INDEX IF NOT EXISTS idx_procedure_records_procedure_date 
  ON procedure_records(procedure_date);

CREATE INDEX IF NOT EXISTS idx_procedure_records_billing_status 
  ON procedure_records(billing_status);

CREATE INDEX IF NOT EXISTS idx_doctor_hospital_doctor_id 
  ON doctor_hospital(doctor_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_doctor_hospital_hospital_id 
  ON doctor_hospital(hospital_id) WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_doctors_cns 
  ON doctors(cns) WHERE is_active = true;

-- ================================================================
-- FIM DA MIGRATION
-- ================================================================

