-- ================================================
-- MIGRAÇÃO: Adicionar campo quantity em procedure_records
-- Implementação do campo quantidade para procedimentos AIH
-- ================================================

-- Adicionar coluna quantity na tabela procedure_records
ALTER TABLE procedure_records 
ADD COLUMN IF NOT EXISTS quantity INTEGER DEFAULT 1 NOT NULL;

-- Adicionar coluna unit_value para armazenar valor unitário (em centavos)
ALTER TABLE procedure_records 
ADD COLUMN IF NOT EXISTS unit_value INTEGER DEFAULT 0;

-- Atualizar registros existentes para ter quantity = 1
UPDATE procedure_records 
SET quantity = 1 
WHERE quantity IS NULL;

-- Calcular unit_value para registros existentes
UPDATE procedure_records 
SET unit_value = value_charged 
WHERE unit_value = 0 AND value_charged > 0;

-- Adicionar comentários nas colunas
COMMENT ON COLUMN procedure_records.quantity IS 'Quantidade do procedimento realizado (padrão: 1)';
COMMENT ON COLUMN procedure_records.unit_value IS 'Valor unitário do procedimento em centavos';

-- Criar índice para consultas por quantidade
CREATE INDEX IF NOT EXISTS idx_procedure_records_quantity 
ON procedure_records(quantity);

-- Verificação da migração
SELECT 
  'Migration completed successfully' as status,
  COUNT(*) as total_records,
  COUNT(CASE WHEN quantity IS NOT NULL THEN 1 END) as records_with_quantity
FROM procedure_records; 