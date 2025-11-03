-- ================================================================
-- CORRIGIR TAMANHO DAS COLUNAS: CNS/CPF e ID Prontuário
-- Tabela: hospital_discharges
-- Data: 2025-11-03
-- ================================================================
-- Problema: VARCHAR(20) é muito curto para CPFs formatados
-- Solução: Aumentar para VARCHAR(50) e VARCHAR(100)
-- ================================================================

-- 1. ALTERAR TAMANHO DAS COLUNAS EXISTENTES
ALTER TABLE hospital_discharges 
ALTER COLUMN cns_cpf TYPE VARCHAR(50);

ALTER TABLE hospital_discharges 
ALTER COLUMN id_prontuario TYPE VARCHAR(100);

-- 2. VERIFICAR DADOS EXISTENTES QUE POSSAM TER SIDO TRUNCADOS
SELECT 
  COUNT(*) as total_registros,
  COUNT(cns_cpf) as registros_com_cns_cpf,
  COUNT(id_prontuario) as registros_com_prontuario,
  MAX(LENGTH(cns_cpf)) as maior_cns_cpf,
  MAX(LENGTH(id_prontuario)) as maior_prontuario
FROM hospital_discharges;

-- 3. VERIFICAR ESTRUTURA ATUALIZADA
SELECT 
  column_name,
  data_type,
  character_maximum_length,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'hospital_discharges'
  AND column_name IN ('cns_cpf', 'id_prontuario')
ORDER BY column_name;

-- ✅ FINALIZADO
SELECT 'Tamanho das colunas corrigido com sucesso!' as status;

