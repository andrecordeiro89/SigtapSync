-- ================================================================
-- VIEW OTIMIZADA PARA FATURAMENTO HOSPITALAR
-- ================================================================
-- Criado em: 2024-12-19
-- Propósito: Agregar faturamento por hospital usando múltiplas fontes
-- Funcionalidade: Considera todos os status e campos de valor disponíveis
-- ================================================================

-- ================================================================
-- 1. VIEW: FATURAMENTO HOSPITALAR OTIMIZADO
-- ================================================================
CREATE OR REPLACE VIEW v_hospital_revenue_optimized AS
SELECT 
  h.id::text as hospital_id,
  h.name as hospital_name,
  COALESCE(h.cnpj, '') as hospital_cnpj,
  
  -- ✅ CONTAGEM DE MÉDICOS ATIVOS
  COALESCE((
    SELECT COUNT(DISTINCT d.id)
    FROM doctors d
    JOIN doctor_hospital dh ON d.id = dh.doctor_id
    WHERE dh.hospital_id = h.id 
    AND d.is_active = true 
    AND dh.is_active = true
  ), 0) as active_doctors_count,
  
  -- ✅ MÉDICOS MUITO ATIVOS (últimos 30 dias)
  COALESCE((
    SELECT COUNT(DISTINCT d.id)
    FROM doctors d
    JOIN doctor_hospital dh ON d.id = dh.doctor_id
    WHERE dh.hospital_id = h.id 
    AND d.is_active = true 
    AND dh.is_active = true
    AND EXISTS (
      SELECT 1 FROM procedure_records pr 
      WHERE (pr.professional = d.cns OR pr.professional_cbo = d.cns OR pr.documento_profissional = d.cns)
      AND pr.procedure_date >= NOW() - INTERVAL '30 days'
      AND pr.hospital_id = h.id
    )
  ), 0) as very_active_doctors,
  
  -- ✅ FATURAMENTO ESTRATÉGIA 1: procedure_records com value_charged
  ROUND(COALESCE((
    SELECT SUM(
      CASE 
        WHEN pr.value_charged > 1000000 THEN pr.value_charged / 100.0  -- Corrigir se em centavos
        ELSE pr.value_charged
      END
    )
    FROM procedure_records pr
    WHERE pr.hospital_id = h.id 
    AND pr.procedure_date >= NOW() - INTERVAL '12 months'
    AND (
      pr.billing_status IN ('PAID', 'BILLED', 'APPROVED') OR
      pr.aprovado = true OR
      pr.status = 'approved'
    )
  ), 0), 2) as revenue_from_procedure_records,
  
  -- ✅ FATURAMENTO ESTRATÉGIA 2: procedure_records com total_value
  ROUND(COALESCE((
    SELECT SUM(
      CASE 
        WHEN pr.total_value > 1000000 THEN pr.total_value / 100.0  -- Corrigir se em centavos
        ELSE pr.total_value
      END
    )
    FROM procedure_records pr
    WHERE pr.hospital_id = h.id 
    AND pr.procedure_date >= NOW() - INTERVAL '12 months'
    AND (
      pr.aprovado = true OR
      pr.status = 'approved' OR
      pr.billing_status NOT IN ('REJECTED', 'CANCELLED')
    )
  ), 0), 2) as revenue_from_total_value,
  
  -- ✅ FATURAMENTO ESTRATÉGIA 3: AIHs calculadas
  ROUND(COALESCE((
    SELECT SUM(
      CASE 
        WHEN a.calculated_total_value > 1000000 THEN a.calculated_total_value / 100.0
        ELSE a.calculated_total_value
      END
    )
    FROM aihs a
    WHERE a.hospital_id = h.id 
    AND a.admission_date >= NOW() - INTERVAL '12 months'
    AND a.processing_status != 'rejected'
  ), 0), 2) as revenue_from_aihs,
  
  -- ✅ FATURAMENTO ESTRATÉGIA 4: Médicos agregados
  ROUND(COALESCE((
    SELECT SUM(da.total_revenue_12months_reais)
    FROM v_doctors_aggregated da
    JOIN doctor_hospital dh ON da.doctor_id = dh.doctor_id
    WHERE dh.hospital_id = h.id 
    AND dh.is_active = true
    AND da.total_revenue_12months_reais > 0
  ), 0), 2) as revenue_from_doctors,
  
  -- ✅ FATURAMENTO CONSOLIDADO (melhor valor disponível)
  ROUND(COALESCE(
    GREATEST(
      -- Estratégia 1: procedure_records value_charged
      (SELECT SUM(
        CASE 
          WHEN pr.value_charged > 1000000 THEN pr.value_charged / 100.0
          ELSE pr.value_charged
        END
      )
      FROM procedure_records pr
      WHERE pr.hospital_id = h.id 
      AND pr.procedure_date >= NOW() - INTERVAL '12 months'
      AND (
        pr.billing_status IN ('PAID', 'BILLED', 'APPROVED') OR
        pr.aprovado = true OR
        pr.status = 'approved'
      )),
      
      -- Estratégia 2: procedure_records total_value
      (SELECT SUM(
        CASE 
          WHEN pr.total_value > 1000000 THEN pr.total_value / 100.0
          ELSE pr.total_value
        END
      )
      FROM procedure_records pr
      WHERE pr.hospital_id = h.id 
      AND pr.procedure_date >= NOW() - INTERVAL '12 months'
      AND (
        pr.aprovado = true OR
        pr.status = 'approved' OR
        pr.billing_status NOT IN ('REJECTED', 'CANCELLED')
      )),
      
      -- Estratégia 3: AIHs
      (SELECT SUM(
        CASE 
          WHEN a.calculated_total_value > 1000000 THEN a.calculated_total_value / 100.0
          ELSE a.calculated_total_value
        END
      )
      FROM aihs a
      WHERE a.hospital_id = h.id 
      AND a.admission_date >= NOW() - INTERVAL '12 months'
      AND a.processing_status != 'rejected'),
      
      -- Estratégia 4: Médicos agregados
      (SELECT SUM(da.total_revenue_12months_reais)
      FROM v_doctors_aggregated da
      JOIN doctor_hospital dh ON da.doctor_id = dh.doctor_id
      WHERE dh.hospital_id = h.id 
      AND dh.is_active = true
      AND da.total_revenue_12months_reais > 0)
    ), 0
  ), 2) as total_hospital_revenue_reais,
  
  -- ✅ CONTAGEM DE PROCEDIMENTOS
  COALESCE((
    SELECT COUNT(pr.id)
    FROM procedure_records pr
    WHERE pr.hospital_id = h.id 
    AND pr.procedure_date >= NOW() - INTERVAL '12 months'
  ), 0) as total_procedures,
  
  -- ✅ PROCEDIMENTOS APROVADOS
  COALESCE((
    SELECT COUNT(pr.id)
    FROM procedure_records pr
    WHERE pr.hospital_id = h.id 
    AND pr.procedure_date >= NOW() - INTERVAL '12 months'
    AND (
      pr.aprovado = true OR
      pr.status = 'approved' OR
      pr.billing_status IN ('PAID', 'BILLED', 'APPROVED')
    )
  ), 0) as approved_procedures,
  
  -- ✅ TAXA DE APROVAÇÃO
  ROUND(COALESCE((
    SELECT 
      CASE 
        WHEN COUNT(pr.id) > 0 THEN 
          (COUNT(CASE WHEN (pr.aprovado = true OR pr.status = 'approved' OR pr.billing_status IN ('PAID', 'BILLED', 'APPROVED')) THEN 1 END) * 100.0 / COUNT(pr.id))
        ELSE 0 
      END
    FROM procedure_records pr
    WHERE pr.hospital_id = h.id 
    AND pr.procedure_date >= NOW() - INTERVAL '12 months'
  ), 0), 2) as approval_rate,
  
  -- ✅ ESPECIALIDADE PRINCIPAL
  (
    SELECT da.doctor_specialty 
    FROM v_doctors_aggregated da
    JOIN doctor_hospital dh ON da.doctor_id = dh.doctor_id
    WHERE dh.hospital_id = h.id 
    AND da.doctor_specialty IS NOT NULL
    AND da.total_revenue_12months_reais > 0
    GROUP BY da.doctor_specialty
    ORDER BY SUM(da.total_revenue_12months_reais) DESC
    LIMIT 1
  ) as top_specialty_by_revenue,
  
  -- ✅ ÚLTIMA ATIVIDADE
  (
    SELECT MAX(pr.procedure_date)
    FROM procedure_records pr
    WHERE pr.hospital_id = h.id
  ) as last_activity_date,
  
  -- ✅ STATUS CALCULADO
  CASE 
    WHEN (SELECT MAX(pr.procedure_date) FROM procedure_records pr WHERE pr.hospital_id = h.id) >= NOW() - INTERVAL '7 days' THEN 'MUITO_ATIVO'
    WHEN (SELECT MAX(pr.procedure_date) FROM procedure_records pr WHERE pr.hospital_id = h.id) >= NOW() - INTERVAL '30 days' THEN 'ATIVO'
    WHEN (SELECT MAX(pr.procedure_date) FROM procedure_records pr WHERE pr.hospital_id = h.id) >= NOW() - INTERVAL '90 days' THEN 'POUCO_ATIVO'
    ELSE 'INATIVO'
  END as activity_status

FROM hospitals h
WHERE h.is_active = true
ORDER BY total_hospital_revenue_reais DESC NULLS LAST, h.name;

-- ================================================================
-- 2. VIEW: RESUMO FINANCEIRO POR HOSPITAL (SIMPLIFICADA)
-- ================================================================
CREATE OR REPLACE VIEW v_hospital_financial_summary AS
SELECT 
  hospital_id,
  hospital_name,
  hospital_cnpj,
  active_doctors_count,
  very_active_doctors,
  total_hospital_revenue_reais,
  total_procedures,
  approved_procedures,
  approval_rate,
  top_specialty_by_revenue,
  activity_status,
  last_activity_date,
  
  -- ✅ MÉTRICAS CALCULADAS
  CASE 
    WHEN active_doctors_count > 0 THEN ROUND(total_hospital_revenue_reais / active_doctors_count, 2)
    ELSE 0
  END as avg_revenue_per_doctor,
  
  CASE 
    WHEN total_procedures > 0 THEN ROUND(total_hospital_revenue_reais / total_procedures, 2)
    ELSE 0
  END as avg_revenue_per_procedure,
  
  CASE 
    WHEN active_doctors_count > 0 THEN ROUND(total_procedures / active_doctors_count::decimal, 0)
    ELSE 0
  END as avg_procedures_per_doctor

FROM v_hospital_revenue_optimized
WHERE total_hospital_revenue_reais > 0
ORDER BY total_hospital_revenue_reais DESC;

-- ================================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ================================================================

COMMENT ON VIEW v_hospital_revenue_optimized IS 'View otimizada para faturamento hospitalar com múltiplas estratégias de busca';
COMMENT ON VIEW v_hospital_financial_summary IS 'Resumo financeiro simplificado por hospital';

-- ================================================================
-- ÍNDICES PARA OTIMIZAÇÃO
-- ================================================================

-- Índices para procedure_records
CREATE INDEX IF NOT EXISTS idx_procedure_records_hospital_date_status 
ON procedure_records(hospital_id, procedure_date, billing_status);

CREATE INDEX IF NOT EXISTS idx_procedure_records_hospital_aprovado 
ON procedure_records(hospital_id, aprovado, procedure_date);

CREATE INDEX IF NOT EXISTS idx_procedure_records_value_charged 
ON procedure_records(hospital_id, value_charged) WHERE value_charged > 0;

-- Índices para aihs
CREATE INDEX IF NOT EXISTS idx_aihs_hospital_date_status 
ON aihs(hospital_id, admission_date, processing_status);

CREATE INDEX IF NOT EXISTS idx_aihs_calculated_value 
ON aihs(hospital_id, calculated_total_value) WHERE calculated_total_value > 0;

-- ================================================================
-- TESTE DA VIEW
-- ================================================================

-- Verificar se a view foi criada corretamente
SELECT 
  'View otimizada criada com sucesso!' as status,
  COUNT(*) as total_hospitais,
  SUM(total_hospital_revenue_reais) as faturamento_total
FROM v_hospital_revenue_optimized;

-- Comparar com view antiga
SELECT 
  'Comparação com view original' as info,
  COUNT(*) as hospitais_com_revenue
FROM v_hospital_revenue_optimized 
WHERE total_hospital_revenue_reais > 0;

-- Mostrar top 5 hospitais por faturamento
SELECT 
  hospital_name,
  active_doctors_count,
  total_hospital_revenue_reais,
  total_procedures,
  approval_rate,
  activity_status
FROM v_hospital_revenue_optimized 
WHERE total_hospital_revenue_reais > 0
ORDER BY total_hospital_revenue_reais DESC
LIMIT 5; 