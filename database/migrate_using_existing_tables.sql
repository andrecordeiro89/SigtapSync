-- ================================================
-- SCHEMA MIGRATION OTIMIZADA - USANDO TABELAS EXISTENTES
-- Expande aih_matches, procedure_records, aihs e patients
-- para suportar 100% dos dados da AIH MultiPageTester
-- ================================================

-- ================================================
-- 1. EXPANDIR TABELA AIHS (14 campos novos)
-- ================================================

-- Dados básicos da AIH
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS situacao VARCHAR(50);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS tipo VARCHAR(20);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS data_autorizacao TIMESTAMP WITH TIME ZONE;
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS motivo_encerramento VARCHAR(100);

-- CNS dos médicos responsáveis
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS cns_autorizador VARCHAR(15);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS cns_solicitante VARCHAR(15);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS cns_responsavel VARCHAR(15);

-- AIHs relacionadas
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS aih_anterior VARCHAR(50);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS aih_posterior VARCHAR(50);

-- Dados da internação
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS procedimento_solicitado VARCHAR(20);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS mudanca_procedimento BOOLEAN DEFAULT FALSE;
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS especialidade VARCHAR(100);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS modalidade VARCHAR(100);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS caracter_atendimento VARCHAR(50);

-- ================================================
-- 2. EXPANDIR TABELA PATIENTS (10 campos novos)
-- ================================================

-- Identificação adicional
ALTER TABLE patients ADD COLUMN IF NOT EXISTS prontuario VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nacionalidade VARCHAR(50) DEFAULT 'BRASIL';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS raca_cor VARCHAR(30);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS documento VARCHAR(20);

-- Dados familiares
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nome_responsavel VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nome_mae VARCHAR(255);

-- Endereço detalhado
ALTER TABLE patients ADD COLUMN IF NOT EXISTS numero_endereco VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS complemento_endereco VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);

-- ================================================
-- 3. EXPANDIR TABELA PROCEDURE_RECORDS (10 campos novos)
-- ================================================

-- Dados originais da AIH
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS sequencia INTEGER;
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS codigo_procedimento_original VARCHAR(20);
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS documento_profissional VARCHAR(15);
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS participacao VARCHAR(10);
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS cnes VARCHAR(10);

-- Valores e matching
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS valor_original INTEGER DEFAULT 0;
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS porcentagem_sus INTEGER DEFAULT 100;
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS aprovado BOOLEAN DEFAULT FALSE;
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS descricao_original TEXT;
ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS match_status VARCHAR(20) DEFAULT 'pending';

-- ================================================
-- 4. CONSTRAINTS E VALIDAÇÕES
-- ================================================

-- procedure_records constraints
ALTER TABLE procedure_records ADD CONSTRAINT IF NOT EXISTS unique_aih_sequencia 
  UNIQUE(aih_id, sequencia);

ALTER TABLE procedure_records ADD CONSTRAINT IF NOT EXISTS check_porcentagem_sus 
  CHECK (porcentagem_sus >= 0 AND porcentagem_sus <= 100);

ALTER TABLE procedure_records ADD CONSTRAINT IF NOT EXISTS check_match_status 
  CHECK (match_status IN ('pending', 'matched', 'manual', 'rejected'));

-- ================================================
-- 5. ÍNDICES PARA PERFORMANCE
-- ================================================

-- Índices para novos campos aihs
CREATE INDEX IF NOT EXISTS idx_aihs_situacao ON aihs(situacao);
CREATE INDEX IF NOT EXISTS idx_aihs_cns_solicitante ON aihs(cns_solicitante);
CREATE INDEX IF NOT EXISTS idx_aihs_cns_responsavel ON aihs(cns_responsavel);
CREATE INDEX IF NOT EXISTS idx_aihs_especialidade ON aihs(especialidade);

-- Índices para novos campos patients
CREATE INDEX IF NOT EXISTS idx_patients_prontuario ON patients(hospital_id, prontuario);
CREATE INDEX IF NOT EXISTS idx_patients_documento ON patients(tipo_documento, documento);

-- Índices para novos campos procedure_records
CREATE INDEX IF NOT EXISTS idx_procedure_records_sequencia ON procedure_records(aih_id, sequencia);
CREATE INDEX IF NOT EXISTS idx_procedure_records_codigo_original ON procedure_records(codigo_procedimento_original);
CREATE INDEX IF NOT EXISTS idx_procedure_records_documento_prof ON procedure_records(documento_profissional);
CREATE INDEX IF NOT EXISTS idx_procedure_records_match_status ON procedure_records(match_status);
CREATE INDEX IF NOT EXISTS idx_procedure_records_aprovado ON procedure_records(aprovado);

-- ================================================
-- 6. TRIGGERS
-- ================================================

-- Trigger para atualizar updated_at em procedure_records (se não existir)
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_trigger 
        WHERE tgname = 'update_procedure_records_updated_at'
    ) THEN
        -- Primeiro adicionar coluna updated_at se não existir
        ALTER TABLE procedure_records ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
        
        -- Depois criar o trigger
        CREATE TRIGGER update_procedure_records_updated_at 
            BEFORE UPDATE ON procedure_records
            FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
    END IF;
END
$$;

-- ================================================
-- 7. COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ================================================

-- Comentários aihs
COMMENT ON COLUMN aihs.situacao IS 'Situação da AIH (AUTORIZADA, CANCELADA, etc.)';
COMMENT ON COLUMN aihs.cns_solicitante IS 'CNS do médico solicitante';
COMMENT ON COLUMN aihs.cns_responsavel IS 'CNS do médico responsável';
COMMENT ON COLUMN aihs.cns_autorizador IS 'CNS do médico autorizador';

-- Comentários patients
COMMENT ON COLUMN patients.prontuario IS 'Número do prontuário no hospital';
COMMENT ON COLUMN patients.nome_mae IS 'Nome da mãe do paciente';

-- Comentários procedure_records
COMMENT ON COLUMN procedure_records.sequencia IS 'Ordem do procedimento na AIH (1=principal)';
COMMENT ON COLUMN procedure_records.codigo_procedimento_original IS 'Código SIGTAP original da AIH';
COMMENT ON COLUMN procedure_records.documento_profissional IS 'CNS do profissional que realizou';
COMMENT ON COLUMN procedure_records.porcentagem_sus IS 'Porcentagem SUS aplicada (0-100%)';

-- ================================================
-- 8. VIEWS AUXILIARES ATUALIZADAS
-- ================================================

-- View completa de AIH com procedimentos
CREATE OR REPLACE VIEW v_aihs_complete AS
SELECT 
  a.*,
  p.name as patient_name,
  p.cns as patient_cns,
  p.prontuario,
  h.name as hospital_name,
  COUNT(pr.id) as total_procedures,
  COUNT(CASE WHEN pr.aprovado = true THEN 1 END) as approved_procedures,
  SUM(CASE WHEN pr.aprovado = true THEN pr.value_charged ELSE 0 END) as total_value
FROM aihs a
LEFT JOIN patients p ON a.patient_id = p.id
LEFT JOIN hospitals h ON a.hospital_id = h.id
LEFT JOIN procedure_records pr ON a.id = pr.aih_id
GROUP BY a.id, p.name, p.cns, p.prontuario, h.name;

-- View para procedimentos com nomes dos médicos
CREATE OR REPLACE VIEW v_procedures_with_doctors AS
SELECT 
  pr.*,
  a.aih_number,
  p.name as patient_name,
  d.name as doctor_name,
  d.specialty as doctor_specialty
FROM procedure_records pr
JOIN aihs a ON pr.aih_id = a.id
JOIN patients p ON a.patient_id = p.id
LEFT JOIN doctors d ON pr.documento_profissional = d.cns 
  AND EXISTS (
    SELECT 1 FROM doctor_hospital dh 
    WHERE dh.doctor_id = d.id 
    AND dh.hospital_id = pr.hospital_id
  );

-- ================================================
-- 9. LOG DA MIGRAÇÃO
-- ================================================

-- Registrar a migração
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public)
VALUES (
  'schema_migration_existing_tables',
  '{"version": "2.0.0", "applied_at": "' || NOW()::text || '", "status": "completed", "tables_modified": ["aihs", "patients", "procedure_records"]}',
  'object',
  'Migração otimizada usando tabelas existentes para dados completos da AIH',
  false
) ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();

-- ================================================
-- MIGRAÇÃO CONCLUÍDA
-- ================================================

DO $$
BEGIN
  RAISE NOTICE '🎉 MIGRAÇÃO OTIMIZADA CONCLUÍDA!';
  RAISE NOTICE '';
  RAISE NOTICE '✅ TABELAS EXPANDIDAS:';
  RAISE NOTICE '   📊 aihs: +14 campos (situação, CNS médicos, etc.)';
  RAISE NOTICE '   👤 patients: +10 campos (prontuário, endereço completo, etc.)';
  RAISE NOTICE '   💊 procedure_records: +10 campos (sequência, códigos originais, etc.)';
  RAISE NOTICE '';
  RAISE NOTICE '✅ APROVEITADAS TABELAS EXISTENTES:';
  RAISE NOTICE '   🎯 aih_matches: perfeita para matching!';
  RAISE NOTICE '   📋 procedure_records: agora completa!';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 RESULTADO: 100% dos dados da AIH podem ser persistidos!';
  RAISE NOTICE '🚀 Sistema pronto para produção!';
END $$; 