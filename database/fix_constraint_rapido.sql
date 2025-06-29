-- CORREÇÃO RÁPIDA: CONSTRAINT EXTRACTION_METHOD

-- 1. Remover constraint problemática
ALTER TABLE sigtap_versions DROP CONSTRAINT IF EXISTS sigtap_versions_extraction_method_check;

-- 2. Criar constraint corrigida (incluindo "pdf")
ALTER TABLE sigtap_versions 
ADD CONSTRAINT sigtap_versions_extraction_method_check 
CHECK (extraction_method IN ('pdf', 'excel', 'zip', 'hybrid', 'traditional', 'gemini', 'fast', 'manual'));

-- 3. Verificar se funcionou
INSERT INTO sigtap_versions (version_name, file_type, total_procedures, extraction_method, import_status) 
VALUES ('TESTE_PDF', 'pdf', 1, 'pdf', 'completed');

DELETE FROM sigtap_versions WHERE version_name = 'TESTE_PDF';

SELECT 'CONSTRAINT CORRIGIDA!' as status; 