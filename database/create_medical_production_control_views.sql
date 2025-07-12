-- ================================================================
-- VIEWS PARA CONTROLE DE PRODUÇÃO MÉDICA
-- ================================================================
-- Criado em: 2024-12-19
-- Propósito: Controlar produção médica por paciente e procedimento
-- Funcionalidade: Métricas avançadas de produtividade médica
-- ================================================================

-- ================================================================
-- 1. VIEW: PRODUÇÃO MÉDICA POR PACIENTE E PROCEDIMENTO
-- ================================================================
CREATE OR REPLACE VIEW v_medical_production_control AS
SELECT 
    -- IDENTIFICAÇÃO ÚNICA
    pr.id as procedure_record_id,
    pr.aih_id,
    pr.patient_id,
    pr.hospital_id,
    
    -- 👨‍⚕️ DADOS DO MÉDICO
    d.id as doctor_id,
    d.name as doctor_name,
    d.crm as doctor_crm,
    d.cns as doctor_cns,
    d.specialty as doctor_specialty,
    d.is_active as doctor_is_active,
    
    -- 👤 DADOS DO PACIENTE
    p.name as patient_name,
    p.cns as patient_cns,
    p.birth_date as patient_birth_date,
    p.gender as patient_gender,
    p.medical_record as patient_medical_record,
    
    -- 🏥 DADOS DO PROCEDIMENTO
    pr.procedure_code,
    pr.procedure_description,
    pr.sequencia as procedure_sequence,
    pr.procedure_date,
    pr.value_charged as procedure_value_cents,
    ROUND(pr.value_charged / 100.0, 2) as procedure_value_reais,
    pr.aprovado as procedure_approved,
    pr.match_confidence,
    pr.billing_status,
    
    -- 📊 CLASSIFICAÇÃO SIGTAP
    sp.description as sigtap_description,
    sp.complexity as sigtap_complexity,
    sp.value_hosp as sigtap_value_hosp,
    sp.value_prof as sigtap_value_prof,
    sp.financing as sigtap_financing,
    sp.modality as sigtap_modality,
    
    -- 📋 DADOS DA AIH
    a.aih_number,
    a.admission_date,
    a.discharge_date,
    a.main_cid as aih_main_cid,
    a.situacao as aih_situation,
    a.tipo as aih_type,
    
    -- 🏥 DADOS DO HOSPITAL
    h.name as hospital_name,
    h.cnpj as hospital_cnpj,
    
    -- 📈 MÉTRICAS CALCULADAS
    CASE 
        WHEN pr.sequencia = 1 THEN 'PRINCIPAL'
        WHEN pr.sequencia <= 5 THEN 'SECUNDÁRIO'
        ELSE 'ADICIONAL'
    END as procedure_category,
    
    CASE 
        WHEN pr.aprovado = true THEN 'APROVADO'
        WHEN pr.billing_status = 'rejected' THEN 'REJEITADO'
        WHEN pr.billing_status = 'pending' THEN 'PENDENTE'
        ELSE 'EM_ANÁLISE'
    END as production_status,
    
    -- 🎯 PRODUTIVIDADE
    EXTRACT(YEAR FROM pr.procedure_date) as production_year,
    EXTRACT(MONTH FROM pr.procedure_date) as production_month,
    EXTRACT(WEEK FROM pr.procedure_date) as production_week,
    DATE_TRUNC('day', pr.procedure_date) as production_day,
    
    -- ⏱️ TEMPO DE PROCESSAMENTO
    EXTRACT(EPOCH FROM (pr.updated_at - pr.created_at)) / 3600 as processing_hours,
    
    -- 💰 ANÁLISE FINANCEIRA
    CASE 
        WHEN pr.value_charged > 0 AND sp.value_hosp > 0 THEN 
            ROUND((pr.value_charged / sp.value_hosp::decimal) * 100, 2)
        ELSE 0
    END as value_realization_percent,
    
    -- 📊 AUDITORIA
    pr.created_at as record_created_at,
    pr.updated_at as record_updated_at,
    pr.created_by as record_created_by

FROM procedure_records pr
LEFT JOIN patients p ON pr.patient_id = p.id
LEFT JOIN aihs a ON pr.aih_id = a.id
LEFT JOIN hospitals h ON pr.hospital_id = h.id
LEFT JOIN doctor_hospital dh ON (dh.hospital_id = pr.hospital_id AND dh.doctor_cns = pr.documento_profissional)
LEFT JOIN doctors d ON dh.doctor_id = d.id
LEFT JOIN sigtap_procedures sp ON pr.procedure_id = sp.id
ORDER BY pr.procedure_date DESC, pr.sequencia ASC;

-- ================================================================
-- 2. VIEW: PRODUTIVIDADE MÉDICA POR PERÍODO
-- ================================================================
CREATE OR REPLACE VIEW v_doctor_productivity_metrics AS
SELECT 
    -- IDENTIFICAÇÃO
    d.id as doctor_id,
    d.name as doctor_name,
    d.crm as doctor_crm,
    d.cns as doctor_cns,
    d.specialty as doctor_specialty,
    h.id as hospital_id,
    h.name as hospital_name,
    
    -- PERÍODO
    EXTRACT(YEAR FROM pr.procedure_date) as year,
    EXTRACT(MONTH FROM pr.procedure_date) as month,
    DATE_TRUNC('month', pr.procedure_date) as month_date,
    
    -- 📊 CONTADORES DE PRODUÇÃO
    COUNT(DISTINCT pr.patient_id) as unique_patients_attended,
    COUNT(DISTINCT pr.aih_id) as unique_aihs_handled,
    COUNT(pr.id) as total_procedures_performed,
    COUNT(CASE WHEN pr.sequencia = 1 THEN 1 END) as principal_procedures,
    COUNT(CASE WHEN pr.sequencia > 1 THEN 1 END) as secondary_procedures,
    
    -- 📈 MÉTRICAS DE APROVAÇÃO
    COUNT(CASE WHEN pr.aprovado = true THEN 1 END) as approved_procedures,
    COUNT(CASE WHEN pr.billing_status = 'rejected' THEN 1 END) as rejected_procedures,
    COUNT(CASE WHEN pr.billing_status = 'pending' THEN 1 END) as pending_procedures,
    
    -- 🎯 TAXAS DE PERFORMANCE
    ROUND(
        COUNT(CASE WHEN pr.aprovado = true THEN 1 END) * 100.0 / 
        NULLIF(COUNT(pr.id), 0), 2
    ) as approval_rate_percent,
    
    ROUND(
        COUNT(CASE WHEN pr.billing_status = 'rejected' THEN 1 END) * 100.0 / 
        NULLIF(COUNT(pr.id), 0), 2
    ) as rejection_rate_percent,
    
    -- 💰 MÉTRICAS FINANCEIRAS
    SUM(pr.value_charged) as total_revenue_cents,
    ROUND(SUM(pr.value_charged) / 100.0, 2) as total_revenue_reais,
    ROUND(AVG(pr.value_charged) / 100.0, 2) as avg_procedure_value_reais,
    
    -- 📊 ANÁLISE DE COMPLEXIDADE
    COUNT(CASE WHEN sp.complexity = 'ALTA COMPLEXIDADE' THEN 1 END) as high_complexity_procedures,
    COUNT(CASE WHEN sp.complexity = 'MÉDIA COMPLEXIDADE' THEN 1 END) as medium_complexity_procedures,
    COUNT(CASE WHEN sp.complexity = 'ATENÇÃO BÁSICA' THEN 1 END) as basic_complexity_procedures,
    
    -- ⏱️ MÉTRICAS DE TEMPO
    ROUND(AVG(EXTRACT(EPOCH FROM (pr.updated_at - pr.created_at)) / 3600), 2) as avg_processing_hours,
    ROUND(AVG(pr.match_confidence), 2) as avg_match_confidence,
    
    -- 🏥 DISTRIBUIÇÃO DE PACIENTES
    ROUND(
        COUNT(DISTINCT pr.patient_id) * 100.0 / 
        NULLIF(COUNT(pr.id), 0), 2
    ) as patient_diversity_percent,
    
    -- 📅 ATIVIDADE
    COUNT(DISTINCT DATE_TRUNC('day', pr.procedure_date)) as active_days,
    ROUND(COUNT(pr.id) / NULLIF(COUNT(DISTINCT DATE_TRUNC('day', pr.procedure_date)), 0), 2) as procedures_per_day,
    
    -- 📊 TENDÊNCIAS
    LAG(COUNT(pr.id)) OVER (
        PARTITION BY d.id, h.id 
        ORDER BY EXTRACT(YEAR FROM pr.procedure_date), EXTRACT(MONTH FROM pr.procedure_date)
    ) as previous_month_procedures,
    
    CASE 
        WHEN LAG(COUNT(pr.id)) OVER (
            PARTITION BY d.id, h.id 
            ORDER BY EXTRACT(YEAR FROM pr.procedure_date), EXTRACT(MONTH FROM pr.procedure_date)
        ) > 0 THEN
            ROUND(
                (COUNT(pr.id) - LAG(COUNT(pr.id)) OVER (
                    PARTITION BY d.id, h.id 
                    ORDER BY EXTRACT(YEAR FROM pr.procedure_date), EXTRACT(MONTH FROM pr.procedure_date)
                )) * 100.0 / 
                LAG(COUNT(pr.id)) OVER (
                    PARTITION BY d.id, h.id 
                    ORDER BY EXTRACT(YEAR FROM pr.procedure_date), EXTRACT(MONTH FROM pr.procedure_date)
                ), 2
            )
        ELSE 0
    END as month_over_month_growth_percent

FROM procedure_records pr
LEFT JOIN patients p ON pr.patient_id = p.id
LEFT JOIN aihs a ON pr.aih_id = a.id
LEFT JOIN hospitals h ON pr.hospital_id = h.id
LEFT JOIN doctor_hospital dh ON (dh.hospital_id = pr.hospital_id AND dh.doctor_cns = pr.documento_profissional)
LEFT JOIN doctors d ON dh.doctor_id = d.id
LEFT JOIN sigtap_procedures sp ON pr.procedure_id = sp.id
WHERE d.id IS NOT NULL
GROUP BY d.id, d.name, d.crm, d.cns, d.specialty, h.id, h.name,
         EXTRACT(YEAR FROM pr.procedure_date), 
         EXTRACT(MONTH FROM pr.procedure_date),
         DATE_TRUNC('month', pr.procedure_date)
ORDER BY year DESC, month DESC, total_procedures_performed DESC;

-- ================================================================
-- 3. VIEW: ANÁLISE MÉDICO-PACIENTE-PROCEDIMENTO
-- ================================================================
CREATE OR REPLACE VIEW v_doctor_patient_procedure_analysis AS
SELECT 
    -- IDENTIFICAÇÃO
    d.id as doctor_id,
    d.name as doctor_name,
    d.crm as doctor_crm,
    d.specialty as doctor_specialty,
    p.id as patient_id,
    p.name as patient_name,
    p.cns as patient_cns,
    
    -- RELACIONAMENTO HISTÓRICO
    COUNT(pr.id) as total_procedures_together,
    COUNT(DISTINCT pr.procedure_code) as unique_procedures_performed,
    COUNT(DISTINCT a.aih_number) as unique_aihs_together,
    
    -- PERÍODO DE RELACIONAMENTO
    MIN(pr.procedure_date) as first_procedure_date,
    MAX(pr.procedure_date) as last_procedure_date,
    EXTRACT(DAYS FROM (MAX(pr.procedure_date) - MIN(pr.procedure_date))) as relationship_days,
    
    -- MÉTRICAS DE QUALIDADE
    COUNT(CASE WHEN pr.aprovado = true THEN 1 END) as approved_procedures,
    ROUND(
        COUNT(CASE WHEN pr.aprovado = true THEN 1 END) * 100.0 / 
        NULLIF(COUNT(pr.id), 0), 2
    ) as approval_rate_percent,
    
    ROUND(AVG(pr.match_confidence), 2) as avg_match_confidence,
    
    -- MÉTRICAS FINANCEIRAS
    SUM(pr.value_charged) as total_value_cents,
    ROUND(SUM(pr.value_charged) / 100.0, 2) as total_value_reais,
    ROUND(AVG(pr.value_charged) / 100.0, 2) as avg_procedure_value_reais,
    
    -- ANÁLISE DE COMPLEXIDADE
    COUNT(CASE WHEN sp.complexity = 'ALTA COMPLEXIDADE' THEN 1 END) as high_complexity_count,
    COUNT(CASE WHEN sp.complexity = 'MÉDIA COMPLEXIDADE' THEN 1 END) as medium_complexity_count,
    COUNT(CASE WHEN sp.complexity = 'ATENÇÃO BÁSICA' THEN 1 END) as basic_complexity_count,
    
    -- PROCEDIMENTOS MAIS REALIZADOS
    STRING_AGG(DISTINCT pr.procedure_code, ', ' ORDER BY pr.procedure_code) as procedures_list,
    
    -- STATUS DO RELACIONAMENTO
    CASE 
        WHEN MAX(pr.procedure_date) >= NOW() - INTERVAL '30 days' THEN 'ATIVO'
        WHEN MAX(pr.procedure_date) >= NOW() - INTERVAL '90 days' THEN 'MODERADO'
        ELSE 'INATIVO'
    END as relationship_status,
    
    -- ÚLTIMA ATIVIDADE
    MAX(pr.procedure_date) as last_activity_date,
    EXTRACT(DAYS FROM (NOW() - MAX(pr.procedure_date))) as days_since_last_activity

FROM procedure_records pr
LEFT JOIN patients p ON pr.patient_id = p.id
LEFT JOIN aihs a ON pr.aih_id = a.id
LEFT JOIN hospitals h ON pr.hospital_id = h.id
LEFT JOIN doctor_hospital dh ON (dh.hospital_id = pr.hospital_id AND dh.doctor_cns = pr.documento_profissional)
LEFT JOIN doctors d ON dh.doctor_id = d.id
LEFT JOIN sigtap_procedures sp ON pr.procedure_id = sp.id
WHERE d.id IS NOT NULL AND p.id IS NOT NULL
GROUP BY d.id, d.name, d.crm, d.specialty, p.id, p.name, p.cns
HAVING COUNT(pr.id) > 0
ORDER BY total_procedures_together DESC, last_procedure_date DESC;

-- ================================================================
-- 4. VIEW: RANKING DE PRODUTIVIDADE
-- ================================================================
CREATE OR REPLACE VIEW v_doctor_productivity_ranking AS
SELECT 
    -- RANKING GERAL
    RANK() OVER (ORDER BY COUNT(pr.id) DESC) as overall_productivity_rank,
    RANK() OVER (PARTITION BY d.specialty ORDER BY COUNT(pr.id) DESC) as specialty_productivity_rank,
    RANK() OVER (PARTITION BY h.id ORDER BY COUNT(pr.id) DESC) as hospital_productivity_rank,
    
    -- DADOS DO MÉDICO
    d.id as doctor_id,
    d.name as doctor_name,
    d.crm as doctor_crm,
    d.specialty as doctor_specialty,
    h.name as hospital_name,
    
    -- MÉTRICAS DE PRODUTIVIDADE (ÚLTIMOS 6 MESES)
    COUNT(pr.id) as total_procedures_6months,
    COUNT(DISTINCT pr.patient_id) as unique_patients_6months,
    COUNT(DISTINCT pr.aih_id) as unique_aihs_6months,
    COUNT(DISTINCT DATE_TRUNC('day', pr.procedure_date)) as active_days_6months,
    
    -- MÉTRICAS FINANCEIRAS
    ROUND(SUM(pr.value_charged) / 100.0, 2) as total_revenue_6months_reais,
    ROUND(AVG(pr.value_charged) / 100.0, 2) as avg_procedure_value_reais,
    
    -- MÉTRICAS DE QUALIDADE
    ROUND(
        COUNT(CASE WHEN pr.aprovado = true THEN 1 END) * 100.0 / 
        NULLIF(COUNT(pr.id), 0), 2
    ) as approval_rate_percent,
    
    ROUND(AVG(pr.match_confidence), 2) as avg_match_confidence,
    
    -- PRODUTIVIDADE MÉDIA
    ROUND(
        COUNT(pr.id) / NULLIF(COUNT(DISTINCT DATE_TRUNC('day', pr.procedure_date)), 0), 2
    ) as procedures_per_active_day,
    
    ROUND(
        COUNT(DISTINCT pr.patient_id) / NULLIF(COUNT(DISTINCT DATE_TRUNC('day', pr.procedure_date)), 0), 2
    ) as patients_per_active_day,
    
    -- SCORE GERAL DE PRODUTIVIDADE (0-100)
    ROUND(
        (COUNT(pr.id) * 0.4 + 
         COUNT(DISTINCT pr.patient_id) * 0.3 + 
         COUNT(CASE WHEN pr.aprovado = true THEN 1 END) * 0.2 + 
         AVG(pr.match_confidence) * 0.1) / 10, 2
    ) as productivity_score,
    
    -- ÚLTIMA ATIVIDADE
    MAX(pr.procedure_date) as last_activity_date,
    EXTRACT(DAYS FROM (NOW() - MAX(pr.procedure_date))) as days_since_last_activity

FROM procedure_records pr
LEFT JOIN patients p ON pr.patient_id = p.id
LEFT JOIN aihs a ON pr.aih_id = a.id
LEFT JOIN hospitals h ON pr.hospital_id = h.id
LEFT JOIN doctor_hospital dh ON (dh.hospital_id = pr.hospital_id AND dh.doctor_cns = pr.documento_profissional)
LEFT JOIN doctors d ON dh.doctor_id = d.id
LEFT JOIN sigtap_procedures sp ON pr.procedure_id = sp.id
WHERE d.id IS NOT NULL 
  AND pr.procedure_date >= NOW() - INTERVAL '6 months'
GROUP BY d.id, d.name, d.crm, d.specialty, h.id, h.name
HAVING COUNT(pr.id) > 0
ORDER BY productivity_score DESC, total_procedures_6months DESC;

-- ================================================================
-- ÍNDICES PARA OTIMIZAÇÃO
-- ================================================================

-- Índices para controle de produção
CREATE INDEX IF NOT EXISTS idx_procedure_records_doctor_patient_date 
ON procedure_records(documento_profissional, patient_id, procedure_date);

CREATE INDEX IF NOT EXISTS idx_procedure_records_date_approved 
ON procedure_records(procedure_date, aprovado);

CREATE INDEX IF NOT EXISTS idx_procedure_records_sequencia_approved 
ON procedure_records(sequencia, aprovado, procedure_date);

CREATE INDEX IF NOT EXISTS idx_procedure_records_billing_status_date 
ON procedure_records(billing_status, procedure_date);

-- ================================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ================================================================

COMMENT ON VIEW v_medical_production_control IS 'Controle completo de produção médica por paciente e procedimento';
COMMENT ON VIEW v_doctor_productivity_metrics IS 'Métricas de produtividade médica por período com análise de tendências';
COMMENT ON VIEW v_doctor_patient_procedure_analysis IS 'Análise detalhada do relacionamento médico-paciente-procedimento';
COMMENT ON VIEW v_doctor_productivity_ranking IS 'Ranking de produtividade médica com scores e comparações';

-- ================================================================
-- EXEMPLOS DE USO
-- ================================================================

/*
-- Exemplo 1: Produção de um médico específico
SELECT * FROM v_medical_production_control 
WHERE doctor_crm = 'CRM12345' 
ORDER BY procedure_date DESC;

-- Exemplo 2: Produtividade mensal por especialidade
SELECT 
    doctor_specialty,
    month_date,
    AVG(total_procedures_performed) as avg_procedures,
    AVG(approval_rate_percent) as avg_approval_rate
FROM v_doctor_productivity_metrics
GROUP BY doctor_specialty, month_date
ORDER BY month_date DESC;

-- Exemplo 3: Pacientes frequentes de um médico
SELECT * FROM v_doctor_patient_procedure_analysis
WHERE doctor_crm = 'CRM12345'
ORDER BY total_procedures_together DESC
LIMIT 10;

-- Exemplo 4: Top 10 médicos mais produtivos
SELECT * FROM v_doctor_productivity_ranking
LIMIT 10;
*/ 