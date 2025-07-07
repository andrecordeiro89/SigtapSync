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

-- ================================================
-- EXPANSÃO DE CAMPOS - PROCEDURE_RECORDS
-- Adicionar descrições de procedimentos
-- ================================================

-- 1. ADICIONAR CAMPO PROCEDURE_DESCRIPTION
-- ================================================

-- Verificar se o campo já existe
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'procedure_records' 
    AND column_name = 'procedure_description'
  ) THEN
    ALTER TABLE procedure_records 
    ADD COLUMN procedure_description TEXT;
    
    RAISE NOTICE 'Campo procedure_description adicionado com sucesso';
  ELSE
    RAISE NOTICE 'Campo procedure_description já existe';
  END IF;
END $$;

-- 2. POPULAR DESCRIÇÕES EXISTENTES COM DADOS DO SIGTAP
-- ================================================

UPDATE procedure_records 
SET procedure_description = sigtap.description
FROM (
  SELECT sp.code, sp.description
  FROM sigtap_procedures sp
  JOIN sigtap_versions sv ON sp.version_id = sv.id
  WHERE sv.is_active = true
) sigtap
WHERE procedure_records.procedure_code = sigtap.code
  AND procedure_records.procedure_description IS NULL;

-- 3. POPULAR DESCRIÇÕES FALTANTES COM PADRÃO
-- ================================================

UPDATE procedure_records 
SET procedure_description = 'Procedimento: ' || procedure_code
WHERE procedure_description IS NULL 
  AND procedure_code IS NOT NULL;

-- 4. CRIAR FUNÇÃO PARA AUTO-POPULAR DESCRIÇÕES
-- ================================================

CREATE OR REPLACE FUNCTION auto_populate_procedure_description()
RETURNS TRIGGER AS $$
BEGIN
  -- Se não tem descrição mas tem código, buscar no SIGTAP
  IF NEW.procedure_description IS NULL AND NEW.procedure_code IS NOT NULL THEN
    SELECT sp.description INTO NEW.procedure_description
    FROM sigtap_procedures sp
    JOIN sigtap_versions sv ON sp.version_id = sv.id
    WHERE sp.code = NEW.procedure_code 
      AND sv.is_active = true
    LIMIT 1;
    
    -- Se não encontrou no SIGTAP, usar padrão
    IF NEW.procedure_description IS NULL THEN
      NEW.procedure_description := 'Procedimento: ' || NEW.procedure_code;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. CRIAR TRIGGER PARA AUTO-POPULAR
-- ================================================

DROP TRIGGER IF EXISTS trigger_auto_populate_procedure_description ON procedure_records;

CREATE TRIGGER trigger_auto_populate_procedure_description
  BEFORE INSERT OR UPDATE ON procedure_records
  FOR EACH ROW
  EXECUTE FUNCTION auto_populate_procedure_description();

-- 6. ADICIONAR ÍNDICE PARA PERFORMANCE
-- ================================================

CREATE INDEX IF NOT EXISTS idx_procedure_records_code_description 
ON procedure_records(procedure_code, procedure_description);

-- 7. VERIFICAÇÃO FINAL
-- ================================================

SELECT 
  'VERIFICAÇÃO FINAL' as status,
  COUNT(*) as total_procedimentos,
  COUNT(CASE WHEN procedure_description IS NOT NULL THEN 1 END) as com_descricao,
  COUNT(CASE WHEN procedure_description IS NULL THEN 1 END) as sem_descricao,
  ROUND(
    COUNT(CASE WHEN procedure_description IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 
    2
  ) as percentual_completo
FROM procedure_records;

-- 8. MOSTRAR EXEMPLOS
-- ================================================

SELECT 
  procedure_code as "Código",
  procedure_description as "Descrição",
  created_at as "Criado em"
FROM procedure_records 
WHERE procedure_description IS NOT NULL
ORDER BY created_at DESC
LIMIT 10; 