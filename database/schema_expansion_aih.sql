-- ================================================
-- EXPANSÃO DO SCHEMA PARA AIH COMPLETA
-- Baseado no documento AIH fornecido pelo usuário
-- ================================================

-- EXPANDIR TABELA AIHS COM CAMPOS DA AIH REAL
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS aih_situation VARCHAR(50);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS aih_type VARCHAR(20);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS authorization_date DATE;

-- CNS dos responsáveis pela AIH
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS cns_authorizer VARCHAR(15);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS cns_requester VARCHAR(15);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS cns_responsible VARCHAR(15);

-- Dados da internação
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS procedure_requested VARCHAR(50);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS procedure_changed BOOLEAN DEFAULT FALSE;
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS discharge_reason VARCHAR(100);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS specialty VARCHAR(50);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS care_modality VARCHAR(50);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS care_character VARCHAR(50);

-- Estimativa de valor original da AIH (para comparação)
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS estimated_original_value INTEGER; -- em centavos

-- EXPANDIR TABELA PATIENTS COM CAMPOS ADICIONAIS DA AIH
ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_record VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nationality VARCHAR(50) DEFAULT 'BRASIL';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS mother_name VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS document_type VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS document_number VARCHAR(20);

-- ÍNDICES ADICIONAIS PARA PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_aihs_authorization_date ON aihs(authorization_date);
CREATE INDEX IF NOT EXISTS idx_aihs_cns_authorizer ON aihs(cns_authorizer);
CREATE INDEX IF NOT EXISTS idx_aihs_specialty ON aihs(specialty);
CREATE INDEX IF NOT EXISTS idx_patients_medical_record ON patients(medical_record);
CREATE INDEX IF NOT EXISTS idx_patients_mother_name ON patients(mother_name);

-- COMENTÁRIOS PARA DOCUMENTAÇÃO
COMMENT ON COLUMN aihs.aih_situation IS 'Situação da AIH: Apresentação, Reapresentação, etc.';
COMMENT ON COLUMN aihs.aih_type IS 'Tipo da AIH: 1.inicial, 3.continuação, 5.longa permanência';
COMMENT ON COLUMN aihs.authorization_date IS 'Data de autorização da AIH';
COMMENT ON COLUMN aihs.cns_authorizer IS 'CNS do profissional autorizador';
COMMENT ON COLUMN aihs.cns_requester IS 'CNS do profissional solicitante';
COMMENT ON COLUMN aihs.cns_responsible IS 'CNS do profissional responsável';
COMMENT ON COLUMN aihs.procedure_requested IS 'Código do procedimento inicialmente solicitado';
COMMENT ON COLUMN aihs.procedure_changed IS 'Indica se houve mudança do procedimento principal';
COMMENT ON COLUMN aihs.discharge_reason IS 'Motivo do encerramento da internação';
COMMENT ON COLUMN aihs.specialty IS 'Especialidade médica da internação';
COMMENT ON COLUMN aihs.care_modality IS 'Modalidade de atendimento: Ambulatorial, Hospitalar, etc.';
COMMENT ON COLUMN aihs.care_character IS 'Caráter do atendimento: Eletivo, Urgência, etc.';

COMMENT ON COLUMN patients.medical_record IS 'Número do prontuário médico do paciente';
COMMENT ON COLUMN patients.nationality IS 'Nacionalidade do paciente';
COMMENT ON COLUMN patients.mother_name IS 'Nome da mãe do paciente';
COMMENT ON COLUMN patients.neighborhood IS 'Bairro de residência do paciente';
COMMENT ON COLUMN patients.responsible_name IS 'Nome do responsável pelo paciente';
COMMENT ON COLUMN patients.document_type IS 'Tipo do documento: CPF, RG, etc.';
COMMENT ON COLUMN patients.document_number IS 'Número do documento do paciente'; 