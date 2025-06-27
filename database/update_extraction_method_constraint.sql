-- ================================================
-- ATUALIZAÇÃO DOS CONSTRAINTS - SIGTAP VERSIONS
-- Corrige extraction_method e file_type para incluir novos valores
-- ================================================

-- Primeiro, vamos verificar se existe um constraint
DO $$
DECLARE
    constraint_exists BOOLEAN;
BEGIN
    -- Verificar se existe constraint CHECK para extraction_method
    SELECT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints tc
        JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
        WHERE tc.table_name = 'sigtap_versions'
        AND tc.constraint_type = 'CHECK'
        AND cc.constraint_name LIKE '%extraction_method%'
    ) INTO constraint_exists;
    
    IF constraint_exists THEN
        RAISE NOTICE 'Constraint encontrado para extraction_method - será atualizado';
        
        -- Remover constraint existente se houver
        ALTER TABLE sigtap_versions 
        DROP CONSTRAINT IF EXISTS sigtap_versions_extraction_method_check;
        
    ELSE
        RAISE NOTICE 'Nenhum constraint específico encontrado para extraction_method';
    END IF;
    
    -- Adicionar novo constraint para extraction_method com valores expandidos
    ALTER TABLE sigtap_versions 
    ADD CONSTRAINT sigtap_versions_extraction_method_check 
    CHECK (
        extraction_method IS NULL OR 
        extraction_method IN ('excel', 'hybrid', 'traditional', 'gemini', 'official')
    );
    
    RAISE NOTICE 'Constraint extraction_method atualizado - valores permitidos: excel, hybrid, traditional, gemini, official';
    
    -- Remover constraint file_type se existir
    ALTER TABLE sigtap_versions 
    DROP CONSTRAINT IF EXISTS sigtap_versions_file_type_check;
    
    -- Adicionar novo constraint para file_type
    ALTER TABLE sigtap_versions 
    ADD CONSTRAINT sigtap_versions_file_type_check 
    CHECK (
        file_type IS NULL OR 
        file_type IN ('excel', 'pdf', 'zip')
    );
    
    RAISE NOTICE 'Constraint file_type atualizado - valores permitidos: excel, pdf, zip';
    
END
$$;

-- ================================================
-- VERIFICAÇÃO DO CONSTRAINT ATUALIZADO
-- ================================================

-- Consultar constraints atuais da tabela
SELECT 
    tc.constraint_name,
    tc.constraint_type,
    cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.table_name = 'sigtap_versions'
AND tc.constraint_type = 'CHECK'
AND (cc.constraint_name LIKE '%extraction_method%' OR cc.constraint_name LIKE '%file_type%');

-- ================================================
-- COMENTÁRIOS PARA DOCUMENTAÇÃO
-- ================================================
COMMENT ON CONSTRAINT sigtap_versions_extraction_method_check ON sigtap_versions 
IS 'Valores permitidos para extraction_method: excel, hybrid, traditional, gemini, official';

COMMENT ON CONSTRAINT sigtap_versions_file_type_check ON sigtap_versions 
IS 'Valores permitidos para file_type: excel, pdf, zip';

-- ================================================
-- TESTE DO CONSTRAINT (OPCIONAL)
-- ================================================

-- Testar inserção com novos valores (deve funcionar)
/*
INSERT INTO sigtap_versions (
    version_name, 
    extraction_method,
    file_type,
    import_status
) VALUES (
    'Teste Oficial', 
    'official',
    'zip',
    'processing'
);

-- Remover o teste
DELETE FROM sigtap_versions WHERE version_name = 'Teste Oficial';
*/ 