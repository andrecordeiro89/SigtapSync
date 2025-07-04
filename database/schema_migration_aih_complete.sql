-- ================================================
-- SCHEMA MIGRATION - AIH COMPLETA
-- Adiciona todos os campos necessários para popular 
-- 100% dos dados extraídos da AIH MultiPageTester
-- ================================================

-- ================================================
-- 1. EXPANDIR TABELA AIHS
-- ================================================

-- Adicionar campos da AIH que estão faltando
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

-- Dados específicos de faturamento SUS (campos extras)
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS uti_dias INTEGER DEFAULT 0;
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS atos_medicos TEXT;
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS permanencia_dias INTEGER;
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS complexidade_especifica VARCHAR(100);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS procedimento_sequencial BOOLEAN DEFAULT FALSE;
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS procedimento_especial BOOLEAN DEFAULT FALSE;
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS valor_diaria INTEGER DEFAULT 0; -- em centavos
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS observacoes_faturamento TEXT;

-- Comentários para os novos campos
COMMENT ON COLUMN aihs.situacao IS 'Situação da AIH (ex: AUTORIZADA, CANCELADA)';
COMMENT ON COLUMN aihs.tipo IS 'Tipo da AIH (ex: NORMAL, ESPECIAL)';
COMMENT ON COLUMN aihs.data_autorizacao IS 'Data de autorização da AIH';
COMMENT ON COLUMN aihs.motivo_encerramento IS 'Motivo do encerramento da internação';
COMMENT ON COLUMN aihs.cns_autorizador IS 'CNS do médico autorizador';
COMMENT ON COLUMN aihs.cns_solicitante IS 'CNS do médico solicitante';
COMMENT ON COLUMN aihs.cns_responsavel IS 'CNS do médico responsável';
COMMENT ON COLUMN aihs.aih_anterior IS 'Número da AIH anterior (se houver)';
COMMENT ON COLUMN aihs.aih_posterior IS 'Número da AIH posterior (se houver)';
COMMENT ON COLUMN aihs.procedimento_solicitado IS 'Código do procedimento originalmente solicitado';
COMMENT ON COLUMN aihs.mudanca_procedimento IS 'Se houve mudança do procedimento durante a internação';

-- ================================================
-- 2. EXPANDIR TABELA PATIENTS
-- ================================================

-- Adicionar campos do paciente que estão faltando
ALTER TABLE patients ADD COLUMN IF NOT EXISTS prontuario VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nacionalidade VARCHAR(50) DEFAULT 'BRASIL';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS raca_cor VARCHAR(30);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS documento VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nome_responsavel VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nome_mae VARCHAR(255);

-- Campos de endereço detalhados
ALTER TABLE patients ADD COLUMN IF NOT EXISTS numero_endereco VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS complemento_endereco VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);

-- Comentários para os novos campos
COMMENT ON COLUMN patients.prontuario IS 'Número do prontuário do paciente no hospital';
COMMENT ON COLUMN patients.nacionalidade IS 'Nacionalidade do paciente';
COMMENT ON COLUMN patients.raca_cor IS 'Raça/cor do paciente conforme IBGE';
COMMENT ON COLUMN patients.tipo_documento IS 'Tipo de documento (RG, CPF, etc.)';
COMMENT ON COLUMN patients.documento IS 'Número do documento';
COMMENT ON COLUMN patients.nome_responsavel IS 'Nome do responsável pelo paciente (se menor)';
COMMENT ON COLUMN patients.nome_mae IS 'Nome da mãe do paciente';
COMMENT ON COLUMN patients.numero_endereco IS 'Número do endereço';
COMMENT ON COLUMN patients.complemento_endereco IS 'Complemento do endereço';
COMMENT ON COLUMN patients.bairro IS 'Bairro do endereço';

-- ================================================
-- 3. CRIAR TABELA AIH_PROCEDURES
-- ================================================

-- Nova tabela para armazenar os procedimentos realizados na AIH
CREATE TABLE IF NOT EXISTS aih_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aih_id UUID NOT NULL REFERENCES aihs(id) ON DELETE CASCADE,
  
  -- Dados do procedimento
  sequencia INTEGER NOT NULL,
  codigo_procedimento VARCHAR(20) NOT NULL,
  descricao TEXT,
  data_realizacao DATE,
  
  -- Dados do profissional
  documento_profissional VARCHAR(15),
  cbo VARCHAR(10),
  participacao VARCHAR(10),
  cnes VARCHAR(10),
  
  -- Valores (em centavos para precisão)
  valor_original INTEGER DEFAULT 0,
  valor_calculado INTEGER DEFAULT 0,
  
  -- Matching com SIGTAP
  match_status VARCHAR(20) DEFAULT 'pending',
  match_confidence INTEGER DEFAULT 0,
  sigtap_procedure_id UUID REFERENCES sigtap_procedures(id),
  
  -- Lógica de porcentagem SUS
  porcentagem_sus INTEGER DEFAULT 100,
  is_principal BOOLEAN DEFAULT FALSE,
  
  -- Regras especiais de cirurgias múltiplas
  is_special_rule BOOLEAN DEFAULT FALSE,
  regra_especial VARCHAR(100),
  valor_calculado_sh INTEGER DEFAULT 0, -- Serviços Hospitalares
  valor_calculado_sp INTEGER DEFAULT 0, -- Serviços Profissionais  
  valor_calculado_sa INTEGER DEFAULT 0, -- Serviços Auxiliares
  
  -- Aprovação
  aprovado BOOLEAN DEFAULT FALSE,
  revisado_por UUID REFERENCES auth.users(id),
  data_revisao TIMESTAMP WITH TIME ZONE,
  observacoes TEXT,
  
  -- Auditoria
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id),
  
  -- Constraints
  UNIQUE(aih_id, sequencia),
  CHECK (porcentagem_sus >= 0 AND porcentagem_sus <= 100),
  CHECK (match_status IN ('pending', 'matched', 'manual', 'rejected')),
  CHECK (match_confidence >= 0 AND match_confidence <= 100)
);

-- Comentários para a nova tabela
COMMENT ON TABLE aih_procedures IS 'Procedimentos realizados em cada AIH';
COMMENT ON COLUMN aih_procedures.sequencia IS 'Sequência do procedimento na AIH (1=principal)';
COMMENT ON COLUMN aih_procedures.codigo_procedimento IS 'Código SIGTAP do procedimento';
COMMENT ON COLUMN aih_procedures.documento_profissional IS 'CNS do profissional que realizou';
COMMENT ON COLUMN aih_procedures.participacao IS 'Código de participação profissional';
COMMENT ON COLUMN aih_procedures.cnes IS 'CNES onde foi realizado';
COMMENT ON COLUMN aih_procedures.match_status IS 'Status do matching com SIGTAP';
COMMENT ON COLUMN aih_procedures.porcentagem_sus IS 'Porcentagem SUS aplicada (0-100%)';
COMMENT ON COLUMN aih_procedures.is_special_rule IS 'Se aplica regra especial de cirurgia múltipla';

-- ================================================
-- 4. ÍNDICES PARA PERFORMANCE
-- ================================================

-- Índices para tabela aihs (novos campos)
CREATE INDEX IF NOT EXISTS idx_aihs_situacao ON aihs(situacao);
CREATE INDEX IF NOT EXISTS idx_aihs_tipo ON aihs(tipo);
CREATE INDEX IF NOT EXISTS idx_aihs_data_autorizacao ON aihs(data_autorizacao);
CREATE INDEX IF NOT EXISTS idx_aihs_cns_solicitante ON aihs(cns_solicitante);
CREATE INDEX IF NOT EXISTS idx_aihs_cns_responsavel ON aihs(cns_responsavel);
CREATE INDEX IF NOT EXISTS idx_aihs_especialidade ON aihs(especialidade);

-- Índices para tabela patients (novos campos)
CREATE INDEX IF NOT EXISTS idx_patients_prontuario ON patients(hospital_id, prontuario);
CREATE INDEX IF NOT EXISTS idx_patients_documento ON patients(tipo_documento, documento);
CREATE INDEX IF NOT EXISTS idx_patients_nome_mae ON patients(nome_mae);

-- Índices para tabela aih_procedures
CREATE INDEX IF NOT EXISTS idx_aih_procedures_aih ON aih_procedures(aih_id);
CREATE INDEX IF NOT EXISTS idx_aih_procedures_codigo ON aih_procedures(codigo_procedimento);
CREATE INDEX IF NOT EXISTS idx_aih_procedures_status ON aih_procedures(match_status);
CREATE INDEX IF NOT EXISTS idx_aih_procedures_profissional ON aih_procedures(documento_profissional);
CREATE INDEX IF NOT EXISTS idx_aih_procedures_data ON aih_procedures(data_realizacao);
CREATE INDEX IF NOT EXISTS idx_aih_procedures_sigtap ON aih_procedures(sigtap_procedure_id);
CREATE INDEX IF NOT EXISTS idx_aih_procedures_aprovado ON aih_procedures(aprovado);

-- ================================================
-- 5. TRIGGERS E FUNÇÕES
-- ================================================

-- Trigger para atualizar updated_at na tabela aih_procedures
CREATE TRIGGER update_aih_procedures_updated_at 
  BEFORE UPDATE ON aih_procedures
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ================================================
-- 6. ROW LEVEL SECURITY (RLS)
-- ================================================

-- Habilitar RLS na nova tabela
ALTER TABLE aih_procedures ENABLE ROW LEVEL SECURITY;

-- Política para aih_procedures - usuários só veem dados do seu hospital
CREATE POLICY "Users can only access procedures from their hospital" ON aih_procedures
  FOR ALL
  USING (
    aih_id IN (
      SELECT id FROM aihs WHERE hospital_id = auth.jwt() ->> 'hospital_id'
    )
  );

-- ================================================
-- 7. GRANTS DE PERMISSÃO
-- ================================================

-- Garantir que usuários autenticados possam acessar a nova tabela
GRANT ALL ON aih_procedures TO authenticated;
GRANT USAGE ON SEQUENCE aih_procedures_id_seq TO authenticated;

-- ================================================
-- 8. VIEWS AUXILIARES
-- ================================================

-- View para AIH completa com procedimentos
CREATE OR REPLACE VIEW v_aihs_complete AS
SELECT 
  a.*,
  p.name as patient_name,
  p.cns as patient_cns,
  h.name as hospital_name,
  h.cnpj as hospital_cnpj,
  COUNT(ap.id) as total_procedures,
  COUNT(CASE WHEN ap.aprovado = true THEN 1 END) as approved_procedures,
  COUNT(CASE WHEN ap.aprovado = false THEN 1 END) as rejected_procedures,
  SUM(CASE WHEN ap.aprovado = true THEN ap.valor_calculado ELSE 0 END) as total_value
FROM aihs a
LEFT JOIN patients p ON a.patient_id = p.id
LEFT JOIN hospitals h ON a.hospital_id = h.id
LEFT JOIN aih_procedures ap ON a.id = ap.aih_id
GROUP BY a.id, p.name, p.cns, h.name, h.cnpj;

-- View para relatórios de procedimentos
CREATE OR REPLACE VIEW v_procedures_report AS
SELECT 
  ap.*,
  a.aih_number,
  a.admission_date,
  a.discharge_date,
  p.name as patient_name,
  p.cns as patient_cns,
  h.name as hospital_name,
  sp.description as sigtap_description,
  sp.value_amb + sp.value_hosp + sp.value_prof as sigtap_total_value
FROM aih_procedures ap
JOIN aihs a ON ap.aih_id = a.id
JOIN patients p ON a.patient_id = p.id
JOIN hospitals h ON a.hospital_id = h.id
LEFT JOIN sigtap_procedures sp ON ap.sigtap_procedure_id = sp.id;

-- ================================================
-- 9. COMENTÁRIOS FINAIS
-- ================================================

COMMENT ON VIEW v_aihs_complete IS 'View completa de AIHs com dados agregados dos procedimentos';
COMMENT ON VIEW v_procedures_report IS 'View para relatórios detalhados de procedimentos';

-- ================================================
-- MIGRATION COMPLETED SUCCESSFULLY
-- ================================================

-- Inserir log da migração
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public)
VALUES (
  'schema_migration_aih_complete',
  '{"version": "1.0.0", "applied_at": "' || NOW()::text || '", "status": "completed"}',
  'object',
  'Schema migration para suporte completo aos dados da AIH',
  false
) ON CONFLICT (setting_key) DO UPDATE SET
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();

-- Log de sucesso
DO $$
BEGIN
  RAISE NOTICE '✅ SCHEMA MIGRATION COMPLETED SUCCESSFULLY!';
  RAISE NOTICE '📊 Added 14 fields to aihs table';
  RAISE NOTICE '👤 Added 10 fields to patients table';
  RAISE NOTICE '💊 Created aih_procedures table';
  RAISE NOTICE '📈 Created performance indexes';
  RAISE NOTICE '🔒 Applied RLS policies';
  RAISE NOTICE '📋 Created helpful views';
  RAISE NOTICE '';
  RAISE NOTICE '🎉 Your database is now ready to store 100%% of AIH data!';
END $$; 