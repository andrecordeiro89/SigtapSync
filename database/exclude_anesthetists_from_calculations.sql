-- ================================================================
-- LÓGICA REFINADA PARA ANESTESISTAS - SISTEMA SIGTAP
-- ================================================================
-- Data: 2024-12-30
-- Propósito: Implementar lógica refinada para valores de anestesistas baseada no código do procedimento
-- Funcionalidade: CBO 225151 + 03.xxx = calculado | CBO 225151 + 04.xxx = não calculado
-- ================================================================

-- PASSO 1: Recriar view de faturamento mensal por médico
DROP VIEW IF EXISTS v_doctor_revenue_monthly CASCADE;

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
  
  -- Hospitais agrupados (elimina duplicação)
  STRING_AGG(h.name, ' | ' ORDER BY h.name) as hospitals_list,
  STRING_AGG(h.id::text, ',' ORDER BY h.id) as hospital_ids,
  COUNT(DISTINCT h.id) as hospitals_count,
  
  -- Período de faturamento
  EXTRACT(YEAR FROM pr.procedure_date) as revenue_year,
  EXTRACT(MONTH FROM pr.procedure_date) as revenue_month,
  DATE_TRUNC('month', pr.procedure_date) as revenue_month_date,
  
  -- Métricas financeiras (valores reais da procedure_records)
  COUNT(pr.id) as total_procedures,
  COUNT(CASE WHEN pr.billing_status = 'pending' THEN 1 END) as pending_procedures,
  COUNT(CASE WHEN pr.billing_status = 'billed' THEN 1 END) as billed_procedures,
  COUNT(CASE WHEN pr.billing_status = 'paid' THEN 1 END) as paid_procedures,
  COUNT(CASE WHEN pr.billing_status = 'rejected' THEN 1 END) as rejected_procedures,
  
  -- Valores financeiros (em centavos - conforme schema)
  SUM(pr.value_charged) as total_revenue_cents,
  AVG(pr.value_charged) as avg_procedure_value_cents,
  MIN(pr.value_charged) as min_procedure_value_cents,
  MAX(pr.value_charged) as max_procedure_value_cents,
  
  -- Valores em reais (conversão)
  ROUND(SUM(pr.value_charged) / 100.0, 2) as total_revenue_reais,
  ROUND(AVG(pr.value_charged) / 100.0, 2) as avg_procedure_value_reais,
  
  -- Métricas de performance
  ROUND(
    COUNT(CASE WHEN pr.billing_status = 'paid' THEN 1 END) * 100.0 / 
    NULLIF(COUNT(pr.id), 0), 2
  ) as payment_rate_percent,
  
  ROUND(
    COUNT(CASE WHEN pr.billing_status != 'rejected' THEN 1 END) * 100.0 / 
    NULLIF(COUNT(pr.id), 0), 2
  ) as approval_rate_percent,
  
  -- Última atividade
  MAX(pr.procedure_date) as last_procedure_date,
  MAX(pr.created_at) as last_created_at

FROM doctors d
LEFT JOIN doctor_hospital dh ON d.id = dh.doctor_id AND dh.is_active = true
LEFT JOIN hospitals h ON dh.hospital_id = h.id  
LEFT JOIN procedure_records pr ON (
  pr.professional = d.cns OR 
  pr.professional_cbo = d.cns OR
  pr.notes LIKE '%' || d.cns || '%'
) AND (
  pr.professional_cbo != '225151' OR 
  pr.professional_cbo IS NULL OR
  (pr.professional_cbo = '225151' AND pr.procedure_code LIKE '03%') OR
  (pr.professional_cbo = '225151' AND pr.procedure_code = '04.17.01.001-0')
) -- 🚫 EXCLUIR ANESTESISTAS 04.xxx (MANTER 03.xxx + CESARIANA)
WHERE d.is_active = true
GROUP BY d.id, d.name, d.cns, d.crm, d.specialty, d.secondary_specialties, 
         d.email, d.phone, d.is_active, d.notes,
         EXTRACT(YEAR FROM pr.procedure_date), 
         EXTRACT(MONTH FROM pr.procedure_date),
         DATE_TRUNC('month', pr.procedure_date)
ORDER BY total_revenue_reais DESC NULLS LAST, d.name;

-- PASSO 2: Recriar view de médicos agregados
DROP VIEW IF EXISTS v_doctors_aggregated CASCADE;

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
  ), 2) as avg_payment_rate_12months,
  
  -- Última atividade
  (SELECT MAX(pr.procedure_date) 
   FROM procedure_records pr 
   WHERE (pr.professional = d.cns OR pr.professional_cbo = d.cns OR pr.notes LIKE '%' || d.cns || '%') 
     AND (
       pr.professional_cbo != '225151' OR 
       pr.professional_cbo IS NULL OR
       (pr.professional_cbo = '225151' AND pr.procedure_code LIKE '03%') OR
       (pr.professional_cbo = '225151' AND pr.procedure_code = '04.17.01.001-0')
     ) -- 🚫 EXCLUIR ANESTESISTAS 04.xxx (MANTER 03.xxx + CESARIANA)
  ) as last_activity_date,
  
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
     ) -- 🚫 EXCLUIR ANESTESISTAS 04.xxx (MANTER 03.xxx + CESARIANA)
         ) >= NOW() - INTERVAL '30 days' THEN 'ATIVO'
    WHEN (SELECT MAX(pr.procedure_date) 
          FROM procedure_records pr 
          WHERE (pr.professional = d.cns OR pr.professional_cbo = d.cns OR pr.notes LIKE '%' || d.cns || '%') 
            AND (
       pr.professional_cbo != '225151' OR 
       pr.professional_cbo IS NULL OR
       (pr.professional_cbo = '225151' AND pr.procedure_code LIKE '03%') OR
       (pr.professional_cbo = '225151' AND pr.procedure_code = '04.17.01.001-0')
     ) -- 🚫 EXCLUIR ANESTESISTAS 04.xxx (MANTER 03.xxx + CESARIANA)
         ) >= NOW() - INTERVAL '90 days' THEN 'POUCO_ATIVO'
    ELSE 'INATIVO'
  END as activity_status

FROM doctors d
LEFT JOIN doctor_hospital dh ON d.id = dh.doctor_id AND dh.is_active = true
LEFT JOIN hospitals h ON dh.hospital_id = h.id  
WHERE d.is_active = true
GROUP BY d.id, d.name, d.cns, d.crm, d.specialty, d.secondary_specialties, 
         d.email, d.phone, d.is_active, d.notes, d.created_at, d.updated_at
ORDER BY total_revenue_12months_reais DESC NULLS LAST, d.name;

-- PASSO 3: Recriar view de resumo de procedimentos por médico
DROP VIEW IF EXISTS v_doctor_procedure_summary CASCADE;

CREATE OR REPLACE VIEW v_doctor_procedure_summary AS
SELECT 
    pr.hospital_id,
    h.name as hospital_name,
    pr.documento_profissional,
    d.name as doctor_name,
    d.crm as doctor_crm,
    d.specialty as doctor_specialty,
    COUNT(pr.id) as total_procedures,
    COUNT(CASE WHEN pr.aprovado = true THEN 1 END) as approved_procedures,
    COUNT(CASE WHEN pr.status = 'pending' THEN 1 END) as pending_procedures,
    SUM(pr.total_value) as total_value_cents,
    ROUND(SUM(pr.total_value) / 100.0, 2) as total_value_reais,
    AVG(pr.match_confidence) as avg_match_confidence
FROM procedure_records pr
LEFT JOIN hospitals h ON pr.hospital_id = h.id
LEFT JOIN doctor_hospital dh ON (dh.hospital_id = pr.hospital_id AND dh.doctor_cns = pr.documento_profissional)
LEFT JOIN doctors d ON dh.doctor_id = d.id
WHERE (
  pr.professional_cbo != '225151' OR 
  pr.professional_cbo IS NULL OR
  (pr.professional_cbo = '225151' AND pr.procedure_code LIKE '03%') OR
  (pr.professional_cbo = '225151' AND pr.procedure_code = '04.17.01.001-0')
) -- 🚫 EXCLUIR ANESTESISTAS 04.xxx (MANTER 03.xxx + CESARIANA)
GROUP BY pr.hospital_id, h.name, pr.documento_profissional, d.name, d.crm, d.specialty
ORDER BY total_value_cents DESC;

-- PASSO 4: Adicionar comentários explicativos
COMMENT ON VIEW v_doctor_revenue_monthly IS 'Faturamento mensal por médico - EXCLUI anestesistas 04.xxx (CBO 225151), INCLUI 03.xxx + cesariana';
COMMENT ON VIEW v_doctors_aggregated IS 'Médicos agregados com faturamento - EXCLUI anestesistas 04.xxx (CBO 225151), INCLUI 03.xxx + cesariana';  
COMMENT ON VIEW v_doctor_procedure_summary IS 'Resumo de procedimentos por médico - EXCLUI anestesistas 04.xxx (CBO 225151), INCLUI 03.xxx + cesariana';

-- PASSO 5: Criar view para auditoria de anestesistas
DROP VIEW IF EXISTS v_anesthetists_audit CASCADE;

CREATE OR REPLACE VIEW v_anesthetists_audit AS
SELECT 
    pr.id,
    pr.hospital_id,
    h.name as hospital_name,
    pr.patient_id,
    p.name as patient_name,
    pr.procedure_code,
    pr.procedure_name,
    pr.procedure_date,
    pr.professional,
    pr.professional_cbo,
    pr.professional_name,
    pr.value_charged,
    ROUND(pr.value_charged / 100.0, 2) as value_reais,
    pr.billing_status,
    pr.created_at,
    
    -- Identificação do tipo
    CASE 
        WHEN pr.professional_cbo = '225151' THEN 'Anestesiologista (CBO)'
        WHEN LOWER(pr.professional_name) LIKE '%anest%' THEN 'Anestesista (Nome)'
        WHEN LOWER(pr.procedure_name) LIKE '%anest%' THEN 'Anestesia (Procedimento)'
        ELSE 'Outros'
    END as anesthetist_type
    
FROM procedure_records pr
LEFT JOIN hospitals h ON pr.hospital_id = h.id
LEFT JOIN patients p ON pr.patient_id = p.id
WHERE pr.professional_cbo = '225151' 
   OR LOWER(pr.professional_name) LIKE '%anest%'
   OR LOWER(pr.procedure_name) LIKE '%anest%'
ORDER BY pr.procedure_date DESC;

COMMENT ON VIEW v_anesthetists_audit IS 'Auditoria de procedimentos de anestesistas - para controle e rastreamento';

-- PASSO 6: Verificação final
DO $$
DECLARE
    total_procedures_before INTEGER;
    total_procedures_after INTEGER;
    excluded_procedures INTEGER;
BEGIN
    -- Contar total de procedimentos antes (incluindo anestesistas)
    SELECT COUNT(*) INTO total_procedures_before 
    FROM procedure_records;
    
    -- Contar procedimentos após aplicar lógica refinada
    SELECT COUNT(*) INTO total_procedures_after 
    FROM procedure_records 
    WHERE (
      professional_cbo != '225151' OR 
      professional_cbo IS NULL OR
      (professional_cbo = '225151' AND procedure_code LIKE '03%') OR
      (professional_cbo = '225151' AND procedure_code = '04.17.01.001-0')
    );
    
    -- Calcular quantos foram excluídos
    excluded_procedures := total_procedures_before - total_procedures_after;
    
    -- Log do resultado
    RAISE NOTICE '';
    RAISE NOTICE '🔧 === LÓGICA REFINADA PARA ANESTESISTAS ===';
    RAISE NOTICE '📊 Total de procedimentos no banco: %', total_procedures_before;
    RAISE NOTICE '✅ Procedimentos após aplicar lógica: %', total_procedures_after;
    RAISE NOTICE '🚫 Anestesistas 04.xxx excluídos: %', excluded_procedures;
    RAISE NOTICE '📈 Percentual excluído: %.2f%%', 
        CASE WHEN total_procedures_before > 0 
             THEN (excluded_procedures * 100.0 / total_procedures_before)
             ELSE 0 
        END;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Views atualizadas com sucesso!';
    RAISE NOTICE '🔍 Use a view v_anesthetists_audit para auditar anestesistas';
    RAISE NOTICE '';
END $$;