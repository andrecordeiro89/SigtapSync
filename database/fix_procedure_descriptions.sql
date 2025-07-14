-- ================================================
-- SCRIPT PARA CORRIGIR PROCEDURE_DESCRIPTION
-- ================================================

-- 1. Verificar situação atual
SELECT 
    'SITUAÇÃO ATUAL' as status,
    COUNT(*) as total_procedimentos,
    COUNT(CASE WHEN procedure_description LIKE 'Procedimento: %' THEN 1 END) as com_fallback,
    COUNT(CASE WHEN procedure_description NOT LIKE 'Procedimento: %' AND procedure_description IS NOT NULL THEN 1 END) as com_descricao_real,
    COUNT(CASE WHEN procedure_description IS NULL THEN 1 END) as sem_descricao
FROM procedure_records;

-- 2. Atualizar descrições usando dados do SIGTAP oficial
UPDATE procedure_records 
SET procedure_description = sigtap.nome
FROM sigtap_procedimentos_oficial sigtap
WHERE procedure_records.procedure_code = sigtap.codigo
  AND (
    procedure_records.procedure_description IS NULL 
    OR procedure_records.procedure_description LIKE 'Procedimento: %'
  );

-- 3. Verificar resultados após atualização
SELECT 
    'APÓS ATUALIZAÇÃO' as status,
    COUNT(*) as total_procedimentos,
    COUNT(CASE WHEN procedure_description LIKE 'Procedimento: %' THEN 1 END) as com_fallback,
    COUNT(CASE WHEN procedure_description NOT LIKE 'Procedimento: %' AND procedure_description IS NOT NULL THEN 1 END) as com_descricao_real,
    COUNT(CASE WHEN procedure_description IS NULL THEN 1 END) as sem_descricao
FROM procedure_records;

-- 4. Mostrar alguns exemplos atualizados
SELECT 
    procedure_code,
    procedure_description,
    created_at
FROM procedure_records 
WHERE procedure_description NOT LIKE 'Procedimento: %'
  AND procedure_description IS NOT NULL
ORDER BY created_at DESC
LIMIT 10;

-- 5. Mostrar procedimentos que ainda têm fallback (se houver)
SELECT 
    procedure_code,
    procedure_description,
    'Não encontrado no SIGTAP' as observacao
FROM procedure_records 
WHERE procedure_description LIKE 'Procedimento: %'
LIMIT 10; 