-- SCHEMA MIGRATION - AIH COMPLETA
-- Adiciona campos necessários para popular dados completos da AIH

-- Expandir tabela aihs
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS situacao VARCHAR(50);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS tipo VARCHAR(20);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS data_autorizacao TIMESTAMP WITH TIME ZONE;
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS motivo_encerramento VARCHAR(100);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS cns_autorizador VARCHAR(15);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS cns_solicitante VARCHAR(15);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS cns_responsavel VARCHAR(15);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS aih_anterior VARCHAR(50);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS aih_posterior VARCHAR(50);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS procedimento_solicitado VARCHAR(20);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS mudanca_procedimento BOOLEAN DEFAULT FALSE;
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS especialidade VARCHAR(100);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS modalidade VARCHAR(100);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS caracter_atendimento VARCHAR(50);

-- Expandir tabela patients
ALTER TABLE patients ADD COLUMN IF NOT EXISTS prontuario VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nacionalidade VARCHAR(50) DEFAULT 'BRASIL';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS raca_cor VARCHAR(30);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS tipo_documento VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS documento VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nome_responsavel VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nome_mae VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS numero_endereco VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS complemento_endereco VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS bairro VARCHAR(100);

-- Criar tabela aih_procedures
CREATE TABLE IF NOT EXISTS aih_procedures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  aih_id UUID NOT NULL REFERENCES aihs(id) ON DELETE CASCADE,
  sequencia INTEGER NOT NULL,
  codigo_procedimento VARCHAR(20) NOT NULL,
  descricao TEXT,
  data_realizacao DATE,
  documento_profissional VARCHAR(15),
  cbo VARCHAR(10),
  participacao VARCHAR(10),
  cnes VARCHAR(10),
  valor_original INTEGER DEFAULT 0,
  valor_calculado INTEGER DEFAULT 0,
  match_status VARCHAR(20) DEFAULT 'pending',
  porcentagem_sus INTEGER DEFAULT 100,
  aprovado BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  UNIQUE(aih_id, sequencia)
); 