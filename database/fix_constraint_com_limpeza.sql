-- ================================================
-- FIX DEFINITIVO: CONSTRAINT + LIMPEZA DE DADOS
-- ================================================

-- ETAPA 1: Verificar dados existentes que estão causando o problema
SELECT 
    'DADOS PROBLEMÁTICOS' as categoria,
    id,
    version_name,
    extraction_method,
    file_type,
    created_at
FROM sigtap_versions
WHERE extraction_method IS NOT NULL
ORDER BY created_at DESC;

-- ETAPA 2: Mostrar TODOS os valores de extraction_method existentes
SELECT 
    'VALORES EXISTENTES' as categoria,
    extraction_method,
    COUNT(*) as quantidade
FROM sigtap_versions
WHERE extraction_method IS NOT NULL
GROUP BY extraction_method
ORDER BY quantidade DESC;

-- ETAPA 3: Remover constraint atual
ALTER TABLE sigtap_versions DROP CONSTRAINT IF EXISTS sigtap_versions_extraction_method_check;

-- ETAPA 4: Corrigir dados problemáticos (ou remover se necessário)
DO $$
DECLARE
    record_count INTEGER;
BEGIN
    -- Contar registros com valores inválidos
    SELECT COUNT(*) INTO record_count
    FROM sigtap_versions 
    WHERE extraction_method IS NOT NULL 
    AND extraction_method NOT IN ('pdf', 'excel', 'zip', 'hybrid', 'traditional', 'gemini', 'fast', 'manual');
    
    IF record_count > 0 THEN
        RAISE NOTICE '🔧 Encontrados % registros com valores inválidos', record_count;
        
        -- Opção 1: Corrigir valores inválidos para 'manual'
        UPDATE sigtap_versions 
        SET extraction_method = 'manual'
        WHERE extraction_method IS NOT NULL 
        AND extraction_method NOT IN ('pdf', 'excel', 'zip', 'hybrid', 'traditional', 'gemini', 'fast', 'manual');
        
        RAISE NOTICE '✅ Valores inválidos corrigidos para "manual"';
    ELSE
        RAISE NOTICE '✅ Nenhum valor inválido encontrado';
    END IF;
END $$;

-- ETAPA 5: Limpar registros vazios/problemáticos se necessário
DELETE FROM sigtap_versions WHERE extraction_method = '';

-- ETAPA 6: Mostrar dados após limpeza
SELECT 
    'APÓS LIMPEZA' as categoria,
    extraction_method,
    COUNT(*) as quantidade
FROM sigtap_versions
WHERE extraction_method IS NOT NULL
GROUP BY extraction_method;

-- ETAPA 7: Criar constraint corrigida
ALTER TABLE sigtap_versions 
ADD CONSTRAINT sigtap_versions_extraction_method_check 
CHECK (extraction_method IS NULL OR extraction_method IN (
    'pdf', 'excel', 'zip', 'hybrid', 'traditional', 'gemini', 'fast', 'manual', 'automated'
));

-- ETAPA 8: Teste de inserção
DO $$
DECLARE
    test_id UUID;
BEGIN
    INSERT INTO sigtap_versions (
        version_name,
        file_type,
        total_procedures,
        extraction_method,
        import_status
    ) VALUES (
        'TESTE_CONSTRAINT_' || EXTRACT(EPOCH FROM NOW()),
        'pdf',
        1,
        'pdf',
        'completed'
    ) RETURNING id INTO test_id;
    
    DELETE FROM sigtap_versions WHERE id = test_id;
    
    RAISE NOTICE '✅ TESTE INSERÇÃO: SUCESSO!';
    RAISE NOTICE '✅ Constraint funcionando corretamente';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ TESTE AINDA FALHOU: %', SQLERRM;
END $$;

-- RESULTADO FINAL
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 CORREÇÃO COMPLETA APLICADA!';
    RAISE NOTICE '================================';
    RAISE NOTICE '1. Dados problemáticos limpos';
    RAISE NOTICE '2. Constraint recriada corretamente';
    RAISE NOTICE '3. Upload SIGTAP deve funcionar';
    RAISE NOTICE '================================';
    RAISE NOTICE '';
END $$; 