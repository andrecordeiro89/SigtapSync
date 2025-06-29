-- LIMPEZA TOTAL E CORREÇÃO DA CONSTRAINT

-- 1. Remover constraint problemática
ALTER TABLE sigtap_versions DROP CONSTRAINT IF EXISTS sigtap_versions_extraction_method_check;

-- 2. LIMPAR TODOS OS DADOS da tabela (começar do zero)
DELETE FROM sigtap_procedures;  -- Limpar procedimentos primeiro (foreign key)
DELETE FROM sigtap_versions;    -- Limpar versões

-- 3. Criar constraint corrigida
ALTER TABLE sigtap_versions 
ADD CONSTRAINT sigtap_versions_extraction_method_check 
CHECK (extraction_method IS NULL OR extraction_method IN (
    'pdf', 'excel', 'zip', 'hybrid', 'traditional', 'gemini', 'fast', 'manual', 'automated'
));

-- 4. Teste
INSERT INTO sigtap_versions (version_name, file_type, total_procedures, extraction_method, import_status) 
VALUES ('TESTE_PDF', 'pdf', 1, 'pdf', 'completed');

DELETE FROM sigtap_versions WHERE version_name = 'TESTE_PDF';

-- 5. Verificar
SELECT 
    'TABELA LIMPA E PRONTA' as status,
    COUNT(*) as registros_restantes
FROM sigtap_versions; 