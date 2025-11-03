-- ================================================================
-- ADICIONAR COLUNAS: CNS/CPF e ID Prontuário
-- Tabela: hospital_discharges
-- Data: 2025-11-03
-- ================================================================

-- 1. ADICIONAR NOVAS COLUNAS
ALTER TABLE hospital_discharges
ADD COLUMN IF NOT EXISTS cns_cpf VARCHAR(50),
ADD COLUMN IF NOT EXISTS id_prontuario VARCHAR(100);

-- 2. CRIAR ÍNDICES PARA AS NOVAS COLUNAS
-- Índice para CNS/CPF (busca por identificação do paciente)
CREATE INDEX IF NOT EXISTS idx_discharges_cns_cpf 
ON hospital_discharges(cns_cpf);

-- Índice para ID Prontuário (busca por prontuário)
CREATE INDEX IF NOT EXISTS idx_discharges_id_prontuario 
ON hospital_discharges(id_prontuario);

-- 3. COMENTÁRIOS DESCRITIVOS
COMMENT ON COLUMN hospital_discharges.cns_cpf IS 'CNS (Cartão Nacional de Saúde) ou CPF do paciente';
COMMENT ON COLUMN hospital_discharges.id_prontuario IS 'Número de identificação do prontuário no sistema hospitalar';

-- 4. VERIFICAR ESTRUTURA ATUALIZADA
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_name = 'hospital_discharges'
ORDER BY ordinal_position;

-- ✅ FINALIZADO
SELECT 'Colunas CNS/CPF e ID Prontuário adicionadas com sucesso!' as status;

