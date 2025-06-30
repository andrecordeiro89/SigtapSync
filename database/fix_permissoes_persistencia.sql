-- =====================================================
-- CORREÇÃO DE PERMISSÕES - PERSISTÊNCIA SIGTAP
-- =====================================================

-- 1. VERIFICAR RLS (Row Level Security)
SELECT 
    schemaname,
    tablename,
    rowsecurity,
    'RLS Status' as info
FROM pg_tables 
WHERE tablename IN ('sigtap_procedures', 'sigtap_versions', 'sigtap_procedimentos_oficial')
AND schemaname = 'public';

-- 2. VERIFICAR POLÍTICAS RLS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual,
    with_check
FROM pg_policies 
WHERE tablename IN ('sigtap_procedures', 'sigtap_versions', 'sigtap_procedimentos_oficial');

-- 3. TEMPORARIAMENTE DESABILITAR RLS PARA TESTE (se necessário)
-- DESCOMENTE APENAS SE OS DADOS NÃO CARREGAREM
-- ALTER TABLE sigtap_procedures DISABLE ROW LEVEL SECURITY;
-- ALTER TABLE sigtap_versions DISABLE ROW LEVEL SECURITY;

-- 4. VERIFICAR USUÁRIO ATUAL E PERMISSÕES
SELECT 
    current_user as usuario_atual,
    session_user as usuario_sessao,
    current_setting('role') as role_atual;

-- 5. TESTAR ACESSO DIRETO ÀS TABELAS
SELECT 'TESTE: sigtap_procedures' as teste, COUNT(*) as registros FROM sigtap_procedures;
SELECT 'TESTE: sigtap_versions' as teste, COUNT(*) as registros FROM sigtap_versions;
SELECT 'TESTE: sigtap_versions ativas' as teste, COUNT(*) as registros FROM sigtap_versions WHERE is_active = true;

-- 6. FORÇAR CRIAÇÃO DE VERSÃO ATIVA SE NECESSÁRIO
DO $$
DECLARE
    dados_count INTEGER;
    versao_ativa_count INTEGER;
    primeira_versao_id UUID;
BEGIN
    -- Verificar dados e versões
    SELECT COUNT(*) INTO dados_count FROM sigtap_procedures;
    SELECT COUNT(*) INTO versao_ativa_count FROM sigtap_versions WHERE is_active = true;
    
    RAISE NOTICE '📊 Dados: %, Versões ativas: %', dados_count, versao_ativa_count;
    
    -- Se há dados mas sem versão ativa
    IF dados_count > 0 AND versao_ativa_count = 0 THEN
        -- Pegar ID da primeira versão disponível
        SELECT id INTO primeira_versao_id 
        FROM sigtap_versions 
        ORDER BY created_at DESC 
        LIMIT 1;
        
        IF primeira_versao_id IS NOT NULL THEN
            -- Ativar a versão mais recente
            UPDATE sigtap_versions 
            SET is_active = true 
            WHERE id = primeira_versao_id;
            
            RAISE NOTICE '✅ Versão % ativada automaticamente', primeira_versao_id;
        ELSE
            -- Criar nova versão se não existe nenhuma
            INSERT INTO sigtap_versions (
                version_name,
                file_type,
                total_procedures,
                extraction_method,
                import_status,
                import_date,
                is_active
            ) VALUES (
                'Emergency_Recovery_' || extract(epoch from now()),
                'pdf',
                dados_count,
                'pdf',
                'completed',
                now(),
                true
            ) RETURNING id INTO primeira_versao_id;
            
            -- Associar todos os procedimentos à nova versão
            UPDATE sigtap_procedures SET version_id = primeira_versao_id WHERE version_id IS NULL;
            
            RAISE NOTICE '🆘 Nova versão emergencial criada: %', primeira_versao_id;
        END IF;
    END IF;
END $$;

-- 7. VERIFICAÇÃO FINAL
SELECT 
    '=== STATUS FINAL ===' as info,
    (SELECT COUNT(*) FROM sigtap_procedures) as dados_total,
    (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) as versoes_ativas,
    (SELECT COUNT(*) FROM sigtap_procedures WHERE version_id IN (SELECT id FROM sigtap_versions WHERE is_active = true)) as dados_com_versao_ativa;

-- 8. TESTE DE QUERY EXATA QUE O SISTEMA USA
SELECT 
    'SIMULAÇÃO: Query do sistema' as teste,
    COUNT(*) as registros_que_sistema_deveria_ver
FROM sigtap_procedures sp
JOIN sigtap_versions sv ON sp.version_id = sv.id 
WHERE sv.is_active = true; 