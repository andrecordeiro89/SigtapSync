-- ================================================================
-- RECRIAR VIEW v_hospital_revenue_stats COM ESTRUTURA CORRETA
-- ================================================================

-- Dropar a view existente
DROP VIEW IF EXISTS v_hospital_revenue_stats;

-- Recriar com TODAS as colunas necessárias
CREATE OR REPLACE VIEW v_hospital_revenue_stats AS
SELECT 
  h.id::text as hospital_id,
  h.name as hospital_name,
  COALESCE(h.cnpj, '') as hospital_cnpj,
  
  -- Contagem de médicos ativos
  COALESCE((
    SELECT COUNT(DISTINCT d.id)
    FROM doctors d
    JOIN doctor_hospital dh ON d.id = dh.doctor_id
    WHERE dh.hospital_id = h.id 
    AND d.is_active = true 
    AND dh.is_active = true
  ), 0) as active_doctors_count,
  
  -- Médicos muito ativos
  COALESCE((
    SELECT COUNT(DISTINCT d.id)
    FROM doctors d
    JOIN doctor_hospital dh ON d.id = dh.doctor_id
    WHERE dh.hospital_id = h.id 
    AND d.is_active = true 
    AND dh.is_active = true
    AND EXISTS (
      SELECT 1 FROM procedure_records pr 
      WHERE (pr.professional = d.cns OR pr.professional_cbo = d.cns)
      AND pr.procedure_date >= NOW() - INTERVAL '30 days'
    )
  ), 0) as very_active_doctors,
  
  -- Faturamento em centavos
  COALESCE((
    SELECT SUM(pr.total_value_cents)
    FROM procedure_records pr
    JOIN doctors d ON (pr.professional = d.cns OR pr.professional_cbo = d.cns)
    JOIN doctor_hospital dh ON d.id = dh.doctor_id
    WHERE dh.hospital_id = h.id 
    AND pr.procedure_date >= NOW() - INTERVAL '12 months'
    AND pr.billing_status IN ('PAID', 'BILLED')
  ), 0) as total_hospital_revenue_cents,
  
  -- ✅ COLUNA QUE ESTAVA FALTANDO: Faturamento em reais
  ROUND(COALESCE((
    SELECT SUM(pr.total_value_cents)
    FROM procedure_records pr
    JOIN doctors d ON (pr.professional = d.cns OR pr.professional_cbo = d.cns)
    JOIN doctor_hospital dh ON d.id = dh.doctor_id
    WHERE dh.hospital_id = h.id 
    AND pr.procedure_date >= NOW() - INTERVAL '12 months'
    AND pr.billing_status IN ('PAID', 'BILLED')
  ), 0) / 100.0, 2) as total_hospital_revenue_reais,
  
  -- ✅ COLUNA QUE ESTAVA FALTANDO: Média por médico
  ROUND(COALESCE((
    SELECT AVG(pr.total_value_cents)
    FROM procedure_records pr
    JOIN doctors d ON (pr.professional = d.cns OR pr.professional_cbo = d.cns)
    JOIN doctor_hospital dh ON d.id = dh.doctor_id
    WHERE dh.hospital_id = h.id 
    AND pr.procedure_date >= NOW() - INTERVAL '12 months'
    AND pr.billing_status IN ('PAID', 'BILLED')
  ), 0) / 100.0, 2) as avg_doctor_revenue_reais,
  
  -- ✅ COLUNA QUE ESTAVA FALTANDO: Total de procedimentos
  COALESCE((
    SELECT COUNT(pr.id)
    FROM procedure_records pr
    JOIN doctors d ON (pr.professional = d.cns OR pr.professional_cbo = d.cns)
    JOIN doctor_hospital dh ON d.id = dh.doctor_id
    WHERE dh.hospital_id = h.id 
    AND pr.procedure_date >= NOW() - INTERVAL '12 months'
  ), 0) as total_procedures,
  
  -- ✅ COLUNA QUE ESTAVA FALTANDO: Média de procedimentos por médico
  ROUND(COALESCE((
    SELECT COUNT(pr.id)::numeric / NULLIF(COUNT(DISTINCT d.id), 0)
    FROM procedure_records pr
    JOIN doctors d ON (pr.professional = d.cns OR pr.professional_cbo = d.cns)
    JOIN doctor_hospital dh ON d.id = dh.doctor_id
    WHERE dh.hospital_id = h.id 
    AND pr.procedure_date >= NOW() - INTERVAL '12 months'
  ), 0), 0) as avg_procedures_per_doctor,
  
  -- ✅ COLUNA QUE ESTAVA FALTANDO: Taxa de pagamento
  ROUND(COALESCE((
    SELECT 
      CASE 
        WHEN COUNT(pr.id) > 0 THEN 
          (COUNT(CASE WHEN pr.billing_status = 'PAID' THEN 1 END) * 100.0 / COUNT(pr.id))
        ELSE 0 
      END
    FROM procedure_records pr
    JOIN doctors d ON (pr.professional = d.cns OR pr.professional_cbo = d.cns)
    JOIN doctor_hospital dh ON d.id = dh.doctor_id
    WHERE dh.hospital_id = h.id 
    AND pr.procedure_date >= NOW() - INTERVAL '12 months'
  ), 0), 2) as avg_payment_rate,
  
  -- ✅ COLUNA QUE ESTAVA FALTANDO: Especialidade principal
  (
    SELECT d.specialty
    FROM doctors d
    JOIN doctor_hospital dh ON d.id = dh.doctor_id
    WHERE dh.hospital_id = h.id 
    AND d.is_active = true 
    AND dh.is_active = true
    AND d.specialty IS NOT NULL
    LIMIT 1
  ) as top_specialty_by_revenue

FROM hospitals h
ORDER BY h.name;

-- Testar se a view foi criada corretamente
SELECT 
  'View recriada com sucesso!' as status,
  COUNT(*) as total_hospitais
FROM v_hospital_revenue_stats;

-- Verificar se todas as colunas existem
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'v_hospital_revenue_stats'
ORDER BY ordinal_position;

-- Testar o Hospital Santa Alice
SELECT 
  hospital_name,
  active_doctors_count,
  very_active_doctors,
  total_hospital_revenue_reais,
  avg_payment_rate
FROM v_hospital_revenue_stats
WHERE hospital_name ILIKE '%santa%alice%'; 