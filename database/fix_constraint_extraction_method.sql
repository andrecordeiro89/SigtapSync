-- ================================================
-- FIX: CONSTRAINT EXTRACTION_METHOD BLOQUEANDO UPLOAD
-- ================================================

-- ETAPA 1: Verificar constraint atual
SELECT 
    'CONSTRAINT ATUAL' as categoria,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname LIKE '%extraction_method%' 
AND conrelid = 'sigtap_versions'::regclass;

-- ETAPA 2: Mostrar valores que estão sendo rejeitados
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔍 DIAGNÓSTICO DO ERRO:';
    RAISE NOTICE '================================';
    RAISE NOTICE 'Valor tentado: "pdf"';
    RAISE NOTICE 'Constraint: sigtap_versions_extraction_method_check';
    RAISE NOTICE 'Status: REJEITADO (por isso o erro 23514)';
    RAISE NOTICE '';
END $$;

-- ETAPA 3: Remover constraint problemática
ALTER TABLE sigtap_versions DROP CONSTRAINT IF EXISTS sigtap_versions_extraction_method_check;

-- ETAPA 4: Criar constraint corrigida com TODOS os valores necessários
ALTER TABLE sigtap_versions 
ADD CONSTRAINT sigtap_versions_extraction_method_check 
CHECK (extraction_method IN (
    'pdf',          -- ✅ VALOR QUE ESTAVA FALTANDO
    'excel', 
    'zip',
    'hybrid', 
    'traditional', 
    'gemini',
    'fast',
    'manual',
    'automated'
));

-- ETAPA 5: Verificar constraint corrigida
SELECT 
    'CONSTRAINT CORRIGIDA' as categoria,
    conname as constraint_name,
    pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname LIKE '%extraction_method%' 
AND conrelid = 'sigtap_versions'::regclass;

-- ETAPA 6: Teste de inserção com valor "pdf"
DO $$
DECLARE
    test_version_id UUID;
    test_success BOOLEAN := false;
BEGIN
    -- Tentar inserir exatamente como o frontend está fazendo
    BEGIN
        INSERT INTO sigtap_versions (
            version_name,
            file_type,
            total_procedures,
            extraction_method,  -- Este era o campo problemático
            import_status,
            import_date,
            is_active
        ) VALUES (
            'TESTE_PDF_' || TO_CHAR(NOW(), 'HH24:MI:SS'),
            'pdf',
            4866,
            'pdf',  -- ✅ VALOR QUE AGORA DEVE FUNCIONAR
            'completed',
            NOW(),
            false
        ) RETURNING id INTO test_version_id;
        
        test_success := true;
        RAISE NOTICE '✅ TESTE DE INSERÇÃO: SUCESSO!';
        RAISE NOTICE 'Versão criada: %', test_version_id;
        
        -- Limpar teste
        DELETE FROM sigtap_versions WHERE id = test_version_id;
        RAISE NOTICE '🧹 Dados de teste removidos';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ TESTE AINDA FALHOU: %', SQLERRM;
        RAISE NOTICE 'Código: %', SQLSTATE;
    END;
    
    -- Resultado
    IF test_success THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 CONSTRAINT CORRIGIDA COM SUCESSO!';
        RAISE NOTICE '✅ Upload SIGTAP agora deve funcionar';
        RAISE NOTICE '✅ Valor "pdf" aceito na constraint';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '🚨 AINDA HÁ PROBLEMAS - Verificar outros constraints';
    END IF;
    RAISE NOTICE '';
END $$;

-- ETAPA 7: Verificar se há outras constraints problemáticas
SELECT 
    'OUTRAS CONSTRAINTS' as categoria,
    conname as constraint_name,
    pg_get_constraintdef(oid) as definition
FROM pg_constraint 
WHERE conrelid = 'sigtap_versions'::regclass
AND contype = 'c'  -- check constraints
ORDER BY conname;

-- ETAPA 8: Status final da tabela
SELECT 
    'TABELA SIGTAP_VERSIONS' as categoria,
    'Pronta para upload' as status,
    COUNT(*) as versoes_existentes
FROM sigtap_versions;

-- RESULTADO FINAL
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📋 CORREÇÃO APLICADA!';
    RAISE NOTICE '================================';
    RAISE NOTICE '1. Constraint extraction_method CORRIGIDA';
    RAISE NOTICE '2. Valor "pdf" agora é ACEITO';
    RAISE NOTICE '3. Upload SIGTAP deve funcionar';
    RAISE NOTICE '4. Teste novamente o upload';
    RAISE NOTICE '================================';
    RAISE NOTICE '';
END $$; 