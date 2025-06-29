-- ================================================
-- FUNÇÃO RPC PARA MIGRAÇÃO DE SCHEMA AIH
-- Execute este SQL no painel do Supabase (SQL Editor)
-- ================================================

-- Função para aplicar migração do schema AIH
CREATE OR REPLACE FUNCTION apply_aih_schema_migration()
RETURNS jsonb AS $$
DECLARE
  result jsonb := '{"success": true, "applied": [], "errors": []}';
  applied_statements text[] := ARRAY[]::text[];
  error_messages text[] := ARRAY[]::text[];
  stmt text;
BEGIN
  -- EXPANDIR TABELA AIHS
  BEGIN
    -- Array de statements para AIHs
    FOR stmt IN 
      SELECT unnest(ARRAY[
        'ALTER TABLE aihs ADD COLUMN IF NOT EXISTS aih_situation VARCHAR(50)',
        'ALTER TABLE aihs ADD COLUMN IF NOT EXISTS aih_type VARCHAR(20)', 
        'ALTER TABLE aihs ADD COLUMN IF NOT EXISTS authorization_date DATE',
        'ALTER TABLE aihs ADD COLUMN IF NOT EXISTS cns_authorizer VARCHAR(15)',
        'ALTER TABLE aihs ADD COLUMN IF NOT EXISTS cns_requester VARCHAR(15)',
        'ALTER TABLE aihs ADD COLUMN IF NOT EXISTS cns_responsible VARCHAR(15)',
        'ALTER TABLE aihs ADD COLUMN IF NOT EXISTS procedure_requested VARCHAR(50)',
        'ALTER TABLE aihs ADD COLUMN IF NOT EXISTS procedure_changed BOOLEAN DEFAULT FALSE',
        'ALTER TABLE aihs ADD COLUMN IF NOT EXISTS discharge_reason VARCHAR(100)',
        'ALTER TABLE aihs ADD COLUMN IF NOT EXISTS specialty VARCHAR(50)',
        'ALTER TABLE aihs ADD COLUMN IF NOT EXISTS care_modality VARCHAR(50)',
        'ALTER TABLE aihs ADD COLUMN IF NOT EXISTS care_character VARCHAR(50)',
        'ALTER TABLE aihs ADD COLUMN IF NOT EXISTS estimated_original_value INTEGER'
      ])
    LOOP
      BEGIN
        EXECUTE stmt;
        applied_statements := applied_statements || stmt;
      EXCEPTION WHEN OTHERS THEN
        error_messages := error_messages || (stmt || ': ' || SQLERRM);
      END;
    END LOOP;

    -- EXPANDIR TABELA PATIENTS
    FOR stmt IN 
      SELECT unnest(ARRAY[
        'ALTER TABLE patients ADD COLUMN IF NOT EXISTS medical_record VARCHAR(50)',
        'ALTER TABLE patients ADD COLUMN IF NOT EXISTS nationality VARCHAR(50) DEFAULT ''BRASIL''',
        'ALTER TABLE patients ADD COLUMN IF NOT EXISTS mother_name VARCHAR(255)',
        'ALTER TABLE patients ADD COLUMN IF NOT EXISTS neighborhood VARCHAR(100)',
        'ALTER TABLE patients ADD COLUMN IF NOT EXISTS responsible_name VARCHAR(255)',
        'ALTER TABLE patients ADD COLUMN IF NOT EXISTS document_type VARCHAR(20)',
        'ALTER TABLE patients ADD COLUMN IF NOT EXISTS document_number VARCHAR(20)'
      ])
    LOOP
      BEGIN
        EXECUTE stmt;
        applied_statements := applied_statements || stmt;
      EXCEPTION WHEN OTHERS THEN
        error_messages := error_messages || (stmt || ': ' || SQLERRM);
      END;
    END LOOP;

    -- CRIAR ÍNDICES
    FOR stmt IN 
      SELECT unnest(ARRAY[
        'CREATE INDEX IF NOT EXISTS idx_aihs_authorization_date ON aihs(authorization_date)',
        'CREATE INDEX IF NOT EXISTS idx_aihs_cns_authorizer ON aihs(cns_authorizer)',
        'CREATE INDEX IF NOT EXISTS idx_aihs_specialty ON aihs(specialty)',
        'CREATE INDEX IF NOT EXISTS idx_patients_medical_record ON patients(medical_record)',
        'CREATE INDEX IF NOT EXISTS idx_patients_mother_name ON patients(mother_name)'
      ])
    LOOP
      BEGIN
        EXECUTE stmt;
        applied_statements := applied_statements || stmt;
      EXCEPTION WHEN OTHERS THEN
        error_messages := error_messages || (stmt || ': ' || SQLERRM);
      END;
    END LOOP;

  EXCEPTION WHEN OTHERS THEN
    error_messages := error_messages || ('Erro geral: ' || SQLERRM);
  END;

  -- Montar resultado
  result := jsonb_build_object(
    'success', array_length(error_messages, 1) IS NULL OR array_length(error_messages, 1) = 0,
    'applied', applied_statements,
    'errors', error_messages,
    'total_applied', array_length(applied_statements, 1),
    'total_errors', COALESCE(array_length(error_messages, 1), 0)
  );

  RETURN result;
END;
$$ LANGUAGE plpgsql; 