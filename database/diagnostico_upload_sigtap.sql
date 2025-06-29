-- ================================================
-- DIAGNÓSTICO: SIGTAP UPLOAD NÃO SALVANDO
-- ================================================

-- Verificar se tabelas existem
SELECT 'TABELAS' as categoria, 
       table_name as nome,
       'EXISTS' as status
FROM information_schema.tables 
WHERE table_name IN ('sigtap_versions', 'sigtap_procedures');

-- Contar dados atuais
SELECT 'DADOS ATUAIS' as categoria,
       'sigtap_versions' as tabela,
       COUNT(*)::text as quantidade
FROM sigtap_versions
UNION ALL
SELECT 'DADOS ATUAIS',
       'sigtap_procedures',
       COUNT(*)::text
FROM sigtap_procedures;

-- Verificar últimas 3 versões
SELECT version_name, total_procedures, import_status, is_active, created_at
FROM sigtap_versions 
ORDER BY created_at DESC 
LIMIT 3;

-- Verificar se há constraint problemática
SELECT constraint_name, check_clause
FROM information_schema.check_constraints 
WHERE table_name = 'sigtap_versions';

-- Teste de inserção simples
DO $$
DECLARE
    test_id UUID;
BEGIN
    -- Tentar inserir versão de teste
    INSERT INTO sigtap_versions (version_name, file_type, total_procedures)
    VALUES ('TESTE_DIAGNÓSTICO', 'manual', 0)
    RETURNING id INTO test_id;
    
    RAISE NOTICE 'TESTE: Versão criada com ID %', test_id;
    
    -- Limpar teste
    DELETE FROM sigtap_versions WHERE id = test_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERRO NO TESTE: % (Código: %)', SQLERRM, SQLSTATE;
END $$; 