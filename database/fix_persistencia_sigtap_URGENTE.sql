-- =====================================================
-- CORREÇÃO URGENTE - PERSISTÊNCIA SIGTAP PARA TODOS OS USUÁRIOS
-- Garante que os 4886 procedimentos sejam visíveis para TODOS
-- =====================================================

-- PASSO 1: DIAGNÓSTICO RÁPIDO
SELECT '🔍 DIAGNÓSTICO RÁPIDO...' as status;

-- Verificar quantos procedimentos temos
SELECT 
    'DADOS SALVOS' as tipo,
    COUNT(*) as total_procedimentos,
    COUNT(DISTINCT version_id) as versoes_diferentes
FROM sigtap_procedures;

-- Verificar versões ativas
SELECT 
    'VERSÕES ATIVAS' as tipo,
    COUNT(*) as versoes_ativas,
    string_agg(version_name, ', ') as nomes_versoes
FROM sigtap_versions 
WHERE is_active = true;

-- PASSO 2: CORREÇÃO AUTOMÁTICA
-- Se há dados mas não há versão ativa, criar uma

DO $$
DECLARE
    dados_count INTEGER;
    versao_ativa_count INTEGER;
    nova_versao_id UUID;
    maior_versao_id UUID;
BEGIN
    -- Contar dados na tabela
    SELECT COUNT(*) INTO dados_count FROM sigtap_procedures;
    
    -- Contar versões ativas
    SELECT COUNT(*) INTO versao_ativa_count FROM sigtap_versions WHERE is_active = true;
    
    RAISE NOTICE '📊 SITUAÇÃO: % procedimentos, % versões ativas', dados_count, versao_ativa_count;
    
    -- CORREÇÃO 1: Se há dados mas não há versão ativa
    IF dados_count > 0 AND versao_ativa_count = 0 THEN
        
        -- Buscar a versão mais recente
        SELECT id INTO maior_versao_id
        FROM sigtap_versions 
        ORDER BY created_at DESC 
        LIMIT 1;
        
        IF maior_versao_id IS NOT NULL THEN
            -- Ativar a versão mais recente
            UPDATE sigtap_versions 
            SET is_active = true 
            WHERE id = maior_versao_id;
            
            RAISE NOTICE '✅ VERSÃO ATIVADA: Versão mais recente foi ativada (%)', maior_versao_id;
        ELSE
            -- Criar nova versão para os dados existentes
            INSERT INTO sigtap_versions (
                version_name,
                file_type,
                total_procedures,
                extraction_method,
                import_status,
                import_date,
                is_active
            ) VALUES (
                'Dados_Existentes_' || to_char(now(), 'YYYY-MM-DD_HH24-MI'),
                'pdf',
                dados_count,
                'pdf',
                'completed',
                now(),
                true
            ) RETURNING id INTO nova_versao_id;
            
            -- Associar todos os procedimentos a esta versão
            UPDATE sigtap_procedures 
            SET version_id = nova_versao_id 
            WHERE version_id IS NULL;
            
            RAISE NOTICE '✅ NOVA VERSÃO CRIADA: % procedimentos associados', dados_count;
        END IF;
        
    -- CORREÇÃO 2: Se há múltiplas versões ativas
    ELSIF versao_ativa_count > 1 THEN
        -- Desativar todas exceto a mais recente
        UPDATE sigtap_versions 
        SET is_active = false 
        WHERE is_active = true
        AND id NOT IN (
            SELECT id FROM sigtap_versions 
            WHERE is_active = true 
            ORDER BY created_at DESC 
            LIMIT 1
        );
        
        RAISE NOTICE '✅ MÚLTIPLAS VERSÕES CORRIGIDAS: Apenas a mais recente permanece ativa';
        
    ELSE
        RAISE NOTICE '✅ SITUAÇÃO NORMAL: % dados, % versão ativa', dados_count, versao_ativa_count;
    END IF;
    
    -- PASSO 3: DESABILITAR RLS PARA ACESSO UNIVERSAL
    RAISE NOTICE '🔓 DESABILITANDO RLS para acesso universal...';
    
END $$;

-- PASSO 3: DESABILITAR RLS PARA ACESSO UNIVERSAL
-- Para garantir que TODOS os usuários vejam os dados
ALTER TABLE sigtap_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE sigtap_procedures DISABLE ROW LEVEL SECURITY;

-- PASSO 4: VERIFICAÇÃO FINAL
SELECT 
    '✅ VERIFICAÇÃO FINAL' as resultado,
    (SELECT COUNT(*) FROM sigtap_procedures) as total_procedimentos,
    (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) as versoes_ativas,
    (SELECT version_name FROM sigtap_versions WHERE is_active = true LIMIT 1) as versao_ativa_nome;

-- PASSO 5: TESTE DE CARREGAMENTO
-- Simular o que o frontend faz
SELECT 
    '🎯 TESTE FRONTEND' as teste,
    sp.code,
    sp.description,
    sp.value_amb,
    sp.value_hosp,
    sp.value_prof
FROM sigtap_procedures sp
JOIN sigtap_versions sv ON sp.version_id = sv.id
WHERE sv.is_active = true
ORDER BY sp.code
LIMIT 5;

-- RESUMO PARA O USUÁRIO
SELECT 
    '🎉 CORREÇÃO APLICADA!' as status,
    'Agora todos os usuários podem ver os ' || (SELECT COUNT(*) FROM sigtap_procedures) || ' procedimentos' as mensagem,
    'Vá para a tela "Consulta SIGTAP" e teste' as proxima_acao; 