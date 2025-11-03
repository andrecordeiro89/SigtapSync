-- ================================================================
-- REMOVER COLUNA: CNS/CPF
-- Tabela: hospital_discharges
-- Data: 2025-11-03
-- ================================================================
-- Motivo: Coluna contém dados misturados (CNS + CPF)
-- Solução: Usar apenas ID Prontuário como identificador
-- ================================================================

-- 1. REMOVER ÍNDICE DA COLUNA CNS/CPF
DROP INDEX IF EXISTS idx_discharges_cns_cpf;

-- 2. REMOVER A COLUNA
ALTER TABLE hospital_discharges 
DROP COLUMN IF EXISTS cns_cpf;

-- 3. VERIFICAR ESTRUTURA ATUALIZADA
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'hospital_discharges'
ORDER BY ordinal_position;

-- ✅ FINALIZADO
SELECT 'Coluna CNS/CPF removida com sucesso! Usando apenas ID Prontuário.' as status;

