-- ================================================
-- EXPANSÃO SCHEMA - CAMPOS ADICIONAIS AIH
-- Sistema SIGTAP Billing Wizard v2.0
-- ================================================

-- 1. ADICIONAR CAMPOS FALTANTES NA TABELA AIHs
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS aih_anterior VARCHAR(50);
ALTER TABLE aihs ADD COLUMN IF NOT EXISTS aih_posterior VARCHAR(50);

-- 2. ADICIONAR CAMPOS FALTANTES NA TABELA PATIENTS  
ALTER TABLE patients ADD COLUMN IF NOT EXISTS nationality VARCHAR(50) DEFAULT 'BRASIL';
ALTER TABLE patients ADD COLUMN IF NOT EXISTS race_color VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS document_type VARCHAR(20);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS document_number VARCHAR(50);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS mother_name VARCHAR(255);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS address_complement VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS municipality VARCHAR(100);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS state_uf VARCHAR(2);
ALTER TABLE patients ADD COLUMN IF NOT EXISTS postal_code VARCHAR(10);

-- 3. CRIAR ÍNDICES PARA OS NOVOS CAMPOS
CREATE INDEX IF NOT EXISTS idx_aihs_anterior ON aihs(aih_anterior);
CREATE INDEX IF NOT EXISTS idx_aihs_posterior ON aihs(aih_posterior);
CREATE INDEX IF NOT EXISTS idx_patients_document ON patients(document_type, document_number);
CREATE INDEX IF NOT EXISTS idx_patients_mother ON patients(mother_name);
CREATE INDEX IF NOT EXISTS idx_patients_nationality ON patients(nationality);

-- 4. VERIFICAÇÃO FINAL
SELECT 'Expansão do schema concluída com sucesso!' as resultado; 