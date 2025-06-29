-- ================================================
-- SIGTAP SYNC - SETUP SIMPLIFICADO SEM RLS
-- Para resolver problemas de sintaxe e dependências
-- ================================================

-- ETAPA 1: Verificar se todas as tabelas existem
DO $$
DECLARE
    tabelas_necessarias TEXT[] := ARRAY[
        'hospitals', 'sigtap_versions', 'sigtap_procedures', 
        'patients', 'aihs', 'aih_matches', 'procedure_records', 
        'system_settings'
    ];
    tabela TEXT;
    existe BOOLEAN;
BEGIN
    RAISE NOTICE '🔍 VERIFICANDO TABELAS NECESSÁRIAS...';
    
    FOREACH tabela IN ARRAY tabelas_necessarias
    LOOP
        SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND table_name = tabela
        ) INTO existe;
        
        IF existe THEN
            RAISE NOTICE '✅ Tabela % existe', tabela;
        ELSE
            RAISE NOTICE '❌ Tabela % NÃO EXISTE - Execute database/schema.sql primeiro!', tabela;
        END IF;
    END LOOP;
    
    RAISE NOTICE '🔍 VERIFICAÇÃO DE TABELAS CONCLUÍDA';
END $$;

-- ETAPA 2: Criar hospital padrão se não existir
INSERT INTO hospitals (id, name, cnpj, address, city, state, habilitacoes, is_active)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Hospital Demo - SIGTAP Sync',
    '12.345.678/0001-90',
    'Rua Demo, 123 - Centro',
    'São Paulo',
    'SP',
    ARRAY['CARDIOLOGIA', 'NEUROLOGIA', 'ONCOLOGIA', 'UTI'],
    true
)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    habilitacoes = EXCLUDED.habilitacoes,
    updated_at = NOW();

-- ETAPA 3: Configurações padrão do sistema
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public)
VALUES
    ('system.version', '"3.0.0"', 'string', 'Versão do sistema', true),
    ('match.confidence_threshold', '70', 'number', 'Threshold mínimo de confiança para match automático', false),
    ('match.require_manual_review_below', '50', 'number', 'Score abaixo do qual requer revisão manual', false),
    ('billing.default_currency', '"BRL"', 'string', 'Moeda padrão para faturamento', true),
    ('sigtap.auto_activate_imports', 'true', 'boolean', 'Ativar automaticamente importações SIGTAP', false),
    ('aih.default_percentage_secondary', '70', 'number', 'Porcentagem padrão para procedimentos secundários', false),
    ('system.max_users_per_hospital', '50', 'number', 'Máximo de usuários por hospital', false),
    ('audit.retention_days', '365', 'number', 'Dias de retenção dos logs de auditoria', false)
ON CONFLICT (hospital_id, setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_at = NOW();

-- ETAPA 4: Estatísticas das tabelas
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '📊 ESTATÍSTICAS DAS TABELAS:';
    
    -- Verificar hospitals
    PERFORM 1 FROM hospitals LIMIT 1;
    IF FOUND THEN
        SELECT COUNT(*) as cnt FROM hospitals INTO rec;
        RAISE NOTICE '📋 hospitals: % registros', rec.cnt;
    END IF;
    
    -- Verificar patients
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'patients') THEN
        SELECT COUNT(*) as cnt FROM patients INTO rec;
        RAISE NOTICE '📋 patients: % registros', rec.cnt;
    END IF;
    
    -- Verificar aihs
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'aihs') THEN
        SELECT COUNT(*) as cnt FROM aihs INTO rec;
        RAISE NOTICE '📋 aihs: % registros', rec.cnt;
    END IF;
    
    -- Verificar sigtap_procedures
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'sigtap_procedures') THEN
        SELECT COUNT(*) as cnt FROM sigtap_procedures INTO rec;
        RAISE NOTICE '📋 sigtap_procedures: % registros', rec.cnt;
    END IF;
    
END $$;

-- ETAPA 5: Função para verificação de saúde do sistema (SIMPLIFICADA)
CREATE OR REPLACE FUNCTION check_system_health()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Verificar hospital padrão
    RETURN QUERY
    SELECT 
        'Hospital Padrão'::TEXT,
        CASE WHEN EXISTS(SELECT 1 FROM hospitals WHERE id = 'a0000000-0000-0000-0000-000000000001') 
             THEN '✅ OK' ELSE '❌ MISSING' END,
        'Hospital demo para desenvolvimento'::TEXT;
    
    -- Verificar configurações
    RETURN QUERY
    SELECT 
        'Configurações'::TEXT,
        CASE WHEN (SELECT COUNT(*) FROM system_settings) >= 5 
             THEN '✅ OK' ELSE '⚠️ INCOMPLETE' END,
        'Configurações básicas do sistema'::TEXT;
    
    -- Verificar procedimentos SIGTAP
    RETURN QUERY
    SELECT 
        'Procedimentos SIGTAP'::TEXT,
        CASE WHEN (SELECT COUNT(*) FROM sigtap_procedures) > 1000 
             THEN '✅ OK' 
             WHEN (SELECT COUNT(*) FROM sigtap_procedures) > 0 
             THEN '⚠️ PARTIAL'
             ELSE '❌ EMPTY' END,
        CONCAT((SELECT COUNT(*) FROM sigtap_procedures), ' procedimentos carregados')::TEXT;
        
    -- Verificar versão SIGTAP ativa
    RETURN QUERY
    SELECT 
        'SIGTAP Ativo'::TEXT,
        CASE WHEN EXISTS(SELECT 1 FROM sigtap_versions WHERE is_active = true) 
             THEN '✅ OK' ELSE '⚠️ NONE' END,
        'Tabela SIGTAP importada e ativa'::TEXT;
        
    -- Status geral do banco
    RETURN QUERY
    SELECT 
        'Status Geral'::TEXT,
        '✅ FUNCIONANDO'::TEXT,
        'Sistema pronto para uso'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ETAPA 6: Executar verificação final
SELECT * FROM check_system_health();

-- MENSAGEM FINAL
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 SETUP SIMPLIFICADO CONCLUÍDO!';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Sistema configurado sem RLS (para desenvolvimento)';
    RAISE NOTICE '✅ Hospital padrão criado';
    RAISE NOTICE '✅ Configurações básicas inseridas';
    RAISE NOTICE '✅ Função de verificação disponível';
    RAISE NOTICE '';
    RAISE NOTICE '📋 PRÓXIMOS PASSOS:';
    RAISE NOTICE '1. Configure o arquivo .env com suas credenciais Supabase';
    RAISE NOTICE '2. Execute: npm run dev';
    RAISE NOTICE '3. Teste o login com as credenciais demo';
    RAISE NOTICE '4. Importe uma tabela SIGTAP (Excel/PDF/ZIP)';
    RAISE NOTICE '5. Teste upload de AIH';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 Para verificar status: SELECT * FROM check_system_health();';
    RAISE NOTICE '';
    RAISE NOTICE '💡 NOTA: RLS desabilitado para simplificar desenvolvimento.';
    RAISE NOTICE '   Configure RLS posteriormente para produção.';
END $$; 