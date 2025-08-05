-- =====================================================
-- VIEWS PARA INTEGRAÇÃO AUTOMÁTICA COM NOMES DE MÉDICOS
-- =====================================================
-- Criado em: 2024
-- Propósito: Facilitar consultas unindo procedure_records com doctors
-- Funcionalidade: Permite usar nomes de médicos automaticamente nos relatórios

-- ==============================================
-- 1. VIEW: Procedimentos com Nomes de Médicos
-- ==============================================
CREATE OR REPLACE VIEW v_procedures_with_doctors AS
SELECT 
    pr.*,
    -- Dados do médico responsável
    d.name as doctor_name,
    d.crm as doctor_crm,
    d.specialty as doctor_specialty,
    d.is_active as doctor_active,
    
    -- Dados do paciente
    p.name as patient_name,
    p.cns as patient_cns,
    p.birth_date as patient_birth_date,
    p.gender as patient_gender,
    
    -- Dados da AIH
    a.aih_number,
    a.admission_date,
    a.discharge_date,
    a.main_cid,
    a.situacao as aih_situacao,
    a.tipo as aih_tipo,
    
    -- Dados do hospital
    h.name as hospital_name,
    h.cnpj as hospital_cnpj
    
FROM procedure_records pr
LEFT JOIN patients p ON pr.patient_id = p.id
LEFT JOIN aihs a ON pr.aih_id = a.id
LEFT JOIN hospitals h ON pr.hospital_id = h.id
LEFT JOIN doctor_hospital dh ON (dh.hospital_id = pr.hospital_id AND dh.doctor_cns = pr.documento_profissional)
LEFT JOIN doctors d ON dh.doctor_id = d.id;

-- ==============================================
-- 2. VIEW: Resumo de Procedimentos por Médico
-- ==============================================
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
WHERE pr.professional_cbo != '225151' OR pr.professional_cbo IS NULL -- 🚫 EXCLUIR ANESTESISTAS
GROUP BY pr.hospital_id, h.name, pr.documento_profissional, d.name, d.crm, d.specialty
ORDER BY total_value_cents DESC;

-- ==============================================
-- 3. VIEW: AIHs Completas com Médicos
-- ==============================================
CREATE OR REPLACE VIEW v_aihs_with_doctors AS
SELECT 
    a.*,
    -- Paciente
    p.name as patient_name,
    p.cns as patient_cns,
    p.medical_record as patient_medical_record,
    
    -- Hospital
    h.name as hospital_name,
    
    -- Médico Autorizador
    d_auth.name as cns_autorizador_name,
    d_auth.crm as cns_autorizador_crm,
    
    -- Médico Solicitante
    d_solic.name as cns_solicitante_name,
    d_solic.crm as cns_solicitante_crm,
    d_solic.specialty as cns_solicitante_specialty,
    
    -- Médico Responsável
    d_resp.name as cns_responsavel_name,
    d_resp.crm as cns_responsavel_crm,
    d_resp.specialty as cns_responsavel_specialty,
    
    -- Estatísticas de procedimentos
    (SELECT COUNT(*) FROM procedure_records WHERE aih_id = a.id) as total_procedures,
    (SELECT COUNT(*) FROM procedure_records WHERE aih_id = a.id AND aprovado = true) as approved_procedures,
    (SELECT SUM(total_value) FROM procedure_records WHERE aih_id = a.id) as total_value_cents,
    ROUND((SELECT SUM(total_value) FROM procedure_records WHERE aih_id = a.id) / 100.0, 2) as total_value_reais
    
FROM aihs a
LEFT JOIN patients p ON a.patient_id = p.id
LEFT JOIN hospitals h ON a.hospital_id = h.id
-- Junção com médico autorizador
LEFT JOIN doctor_hospital dh_auth ON (dh_auth.hospital_id = a.hospital_id AND dh_auth.doctor_cns = a.cns_autorizador)
LEFT JOIN doctors d_auth ON dh_auth.doctor_id = d_auth.id
-- Junção com médico solicitante
LEFT JOIN doctor_hospital dh_solic ON (dh_solic.hospital_id = a.hospital_id AND dh_solic.doctor_cns = a.cns_solicitante)
LEFT JOIN doctors d_solic ON dh_solic.doctor_id = d_solic.id
-- Junção com médico responsável
LEFT JOIN doctor_hospital dh_resp ON (dh_resp.hospital_id = a.hospital_id AND dh_resp.doctor_cns = a.cns_responsavel)
LEFT JOIN doctors d_resp ON dh_resp.doctor_id = d_resp.id;

-- ==============================================
-- 4. VIEW: Dashboard de Médicos por Hospital
-- ==============================================
CREATE OR REPLACE VIEW v_hospital_doctors_dashboard AS
SELECT 
    h.id as hospital_id,
    h.name as hospital_name,
    d.id as doctor_id,
    d.name as doctor_name,
    d.cns as doctor_cns,
    d.crm as doctor_crm,
    d.specialty as doctor_specialty,
    dh.is_active as active_in_hospital,
    
    -- Estatísticas como responsável (cns_responsavel)
    (SELECT COUNT(*) FROM aihs WHERE hospital_id = h.id AND cns_responsavel = d.cns) as aihs_as_responsible,
    
    -- Estatísticas como solicitante (cns_solicitante)
    (SELECT COUNT(*) FROM aihs WHERE hospital_id = h.id AND cns_solicitante = d.cns) as aihs_as_requester,
    
    -- Estatísticas em procedimentos
    (SELECT COUNT(*) FROM procedure_records WHERE hospital_id = h.id AND documento_profissional = d.cns) as total_procedures,
    (SELECT COUNT(*) FROM procedure_records WHERE hospital_id = h.id AND documento_profissional = d.cns AND aprovado = true) as approved_procedures,
    (SELECT SUM(total_value) FROM procedure_records WHERE hospital_id = h.id AND documento_profissional = d.cns) as total_value_cents,
    ROUND((SELECT SUM(total_value) FROM procedure_records WHERE hospital_id = h.id AND documento_profissional = d.cns) / 100.0, 2) as total_value_reais
    
FROM hospitals h
INNER JOIN doctor_hospital dh ON dh.hospital_id = h.id
INNER JOIN doctors d ON dh.doctor_id = d.id
WHERE dh.is_active = true
ORDER BY h.name, d.name;

-- ==============================================
-- 5. VIEW: Procedimentos com Status Detalhado
-- ==============================================
CREATE OR REPLACE VIEW v_procedures_detailed_status AS
SELECT 
    pr.*,
    p.name as patient_name,
    a.aih_number,
    h.name as hospital_name,
    d.name as doctor_name,
    d.crm as doctor_crm,
    
    -- Análise de status
    CASE 
        WHEN pr.aprovado = true THEN 'Aprovado'
        WHEN pr.status = 'rejected' THEN 'Rejeitado'
        WHEN pr.status = 'pending' AND pr.match_confidence > 0.8 THEN 'Pendente - Alta Confiança'
        WHEN pr.status = 'pending' AND pr.match_confidence > 0.5 THEN 'Pendente - Média Confiança'
        WHEN pr.status = 'pending' THEN 'Pendente - Baixa Confiança'
        ELSE 'Status Desconhecido'
    END as detailed_status,
    
    -- Conversões de valores
    ROUND(pr.unit_value / 100.0, 2) as unit_value_reais,
    ROUND(pr.total_value / 100.0, 2) as total_value_reais,
    ROUND(pr.valor_original / 100.0, 2) as valor_original_reais,
    
    -- Análise de diferenças
    ROUND((pr.total_value - pr.valor_original) / 100.0, 2) as diferenca_valores_reais,
    CASE 
        WHEN pr.valor_original > 0 THEN ROUND(((pr.total_value - pr.valor_original) / pr.valor_original::decimal) * 100, 2)
        ELSE 0
    END as percentual_diferenca
    
FROM procedure_records pr
LEFT JOIN patients p ON pr.patient_id = p.id
LEFT JOIN aihs a ON pr.aih_id = a.id
LEFT JOIN hospitals h ON pr.hospital_id = h.id
LEFT JOIN doctor_hospital dh ON (dh.hospital_id = pr.hospital_id AND dh.doctor_cns = pr.documento_profissional)
LEFT JOIN doctors d ON dh.doctor_id = d.id
ORDER BY pr.created_at DESC;

-- ============================================================
-- COMENTÁRIOS E ÍNDICES PARA OTIMIZAÇÃO
-- ============================================================

-- Criar índices para otimizar consultas das views
CREATE INDEX IF NOT EXISTS idx_procedure_records_hospital_doctor 
ON procedure_records(hospital_id, documento_profissional);

CREATE INDEX IF NOT EXISTS idx_procedure_records_aih_status 
ON procedure_records(aih_id, status, aprovado);

CREATE INDEX IF NOT EXISTS idx_aihs_hospital_cns 
ON aihs(hospital_id, cns_responsavel, cns_solicitante);

-- ============================================================
-- EXEMPLOS DE USO DAS VIEWS
-- ============================================================

/*
-- Exemplo 1: Listar procedimentos com nomes de médicos
SELECT 
    procedure_code,
    procedure_name,
    doctor_name,
    doctor_crm,
    patient_name,
    total_value_reais
FROM v_procedures_with_doctors 
WHERE hospital_id = 'SEU_HOSPITAL_ID'
ORDER BY created_at DESC;

-- Exemplo 2: Resumo por médico
SELECT 
    doctor_name,
    doctor_crm,
    total_procedures,
    approved_procedures,
    total_value_reais
FROM v_doctor_procedure_summary 
WHERE hospital_id = 'SEU_HOSPITAL_ID'
ORDER BY total_value_reais DESC;

-- Exemplo 3: AIHs com nomes de todos os médicos
SELECT 
    aih_number,
    patient_name,
    cns_responsavel_name,
    cns_solicitante_name,
    total_procedures,
    total_value_reais
FROM v_aihs_with_doctors 
WHERE hospital_id = 'SEU_HOSPITAL_ID'
ORDER BY admission_date DESC;
*/ 