-- =====================================================
-- CORREÇÃO DEFINITIVA - PERSISTÊNCIA SIGTAP
-- =====================================================

-- PROBLEMA IDENTIFICADO:
-- O SigtapContext está tentando carregar da tabela 'sigtap_procedimentos_oficial' (vazia)
-- Mas os dados estão na tabela 'sigtap_procedures' (onde foram salvos pelo upload)

-- 1. VERIFICAR E CORRIGIR VERSÃO ATIVA
-- Se não há versão ativa, criar uma para os dados existentes

DO $$
DECLARE
    dados_count INTEGER;
    versao_ativa_count INTEGER;
    nova_versao_id UUID;
BEGIN
    -- Contar dados na tabela de upload
    SELECT COUNT(*) INTO dados_count FROM sigtap_procedures;
    
    -- Contar versões ativas
    SELECT COUNT(*) INTO versao_ativa_count FROM sigtap_versions WHERE is_active = true;
    
    RAISE NOTICE 'Dados na tabela: %, Versões ativas: %', dados_count, versao_ativa_count;
    
    -- Se há dados mas não há versão ativa, criar uma
    IF dados_count > 0 AND versao_ativa_count = 0 THEN
        
        -- Inserir nova versão
        INSERT INTO sigtap_versions (
            version_name,
            file_type,
            total_procedures,
            extraction_method,
            import_status,
            import_date,
            is_active
        ) VALUES (
            'Auto_Recovery_Version_' || to_char(now(), 'YYYY-MM-DD_HH24-MI'),
            'pdf',
            dados_count,
            'pdf',
            'completed',
            now(),
            true
        ) RETURNING id INTO nova_versao_id;
        
        -- Atualizar todos os procedimentos existentes para usar esta versão
        UPDATE sigtap_procedures 
        SET version_id = nova_versao_id 
        WHERE version_id IS NULL OR version_id NOT IN (
            SELECT id FROM sigtap_versions WHERE is_active = true
        );
        
        RAISE NOTICE 'CORREÇÃO APLICADA: Nova versão ativa criada com ID %', nova_versao_id;
        
    ELSIF versao_ativa_count > 1 THEN
        -- Se há múltiplas versões ativas, desativar todas exceto a mais recente
        UPDATE sigtap_versions 
        SET is_active = false 
        WHERE is_active = true
        AND id NOT IN (
            SELECT id FROM sigtap_versions 
            WHERE is_active = true 
            ORDER BY created_at DESC 
            LIMIT 1
        );
        
        RAISE NOTICE 'CORREÇÃO APLICADA: Múltiplas versões ativas corrigidas';
        
    ELSE
        RAISE NOTICE 'CONFIGURAÇÃO OK: % dados, % versão ativa', dados_count, versao_ativa_count;
    END IF;
    
END $$;

-- 2. VERIFICAR RESULTADO DA CORREÇÃO
SELECT 
    'DIAGNÓSTICO PÓS-CORREÇÃO' as status,
    (SELECT COUNT(*) FROM sigtap_procedures) as dados_upload,
    (SELECT COUNT(*) FROM sigtap_versions WHERE is_active = true) as versoes_ativas,
    (SELECT version_name FROM sigtap_versions WHERE is_active = true ORDER BY created_at DESC LIMIT 1) as versao_ativa_nome;

-- 3. SAMPLE DOS DADOS PARA CONFIRMAÇÃO
SELECT 
    'SAMPLE DADOS DISPONÍVEIS' as info,
    code,
    LEFT(description, 50) as description_sample,
    value_hosp,
    value_prof
FROM sigtap_procedures 
WHERE version_id IN (SELECT id FROM sigtap_versions WHERE is_active = true)
ORDER BY code
LIMIT 3; 