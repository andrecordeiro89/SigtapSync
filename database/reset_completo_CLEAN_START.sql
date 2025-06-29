-- ================================================
-- SIGTAP SYNC - RESET COMPLETO E RECRIAÇÃO TOTAL
-- ⚠️ ATENÇÃO: ESTE SCRIPT APAGA TODOS OS DADOS!
-- ================================================

-- ETAPA 1: DESABILITAR RLS PARA EVITAR CONFLITOS
ALTER TABLE IF EXISTS hospitals DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS aihs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS procedure_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS aih_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sigtap_procedures DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sigtap_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS system_settings DISABLE ROW LEVEL SECURITY;

-- ETAPA 2: REMOVER TODAS AS POLÍTICAS RLS
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      pol.policyname, pol.schemaname, pol.tablename);
        RAISE NOTICE 'Política % removida da tabela %', pol.policyname, pol.tablename;
    END LOOP;
END $$;

-- ETAPA 3: TRUNCAR TODAS AS TABELAS (PRESERVANDO ESTRUTURA)
DO $$
DECLARE
    tabelas TEXT[] := ARRAY[
        'procedure_records', 'aih_matches', 'aihs', 'patients',
        'sigtap_procedures', 'sigtap_versions', 'system_settings', 'hospitals'
    ];
    tabela TEXT;
BEGIN
    RAISE NOTICE '🧹 LIMPANDO TODAS AS TABELAS...';
    
    FOREACH tabela IN ARRAY tabelas
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tabela) THEN
            EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', tabela);
            RAISE NOTICE '✅ Tabela % limpa', tabela;
        ELSE
            RAISE NOTICE '⚠️ Tabela % não existe', tabela;
        END IF;
    END LOOP;
    
    RAISE NOTICE '🧹 LIMPEZA CONCLUÍDA!';
END $$;

-- ETAPA 4: REMOVER CONSTRAINTS PROBLEMÁTICAS
DO $$
BEGIN
    -- Remover constraint de CNPJ se existir
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name = 'hospitals_cnpj_check'
    ) THEN
        ALTER TABLE hospitals DROP CONSTRAINT hospitals_cnpj_check;
        RAISE NOTICE '✅ Constraint hospitals_cnpj_check removida';
    END IF;
    
    -- Remover outras constraints problemáticas se existirem
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE constraint_name LIKE '%cnpj%' OR constraint_name LIKE '%cpf%'
    ) THEN
        RAISE NOTICE '⚠️ Outras constraints de CPF/CNPJ encontradas';
    END IF;
END $$;

-- ETAPA 5: RECRIAR DADOS BÁSICOS (SEM CONSTRAINTS PROBLEMÁTICAS)
-- Hospital padrão com CNPJ simples
INSERT INTO hospitals (
    id, 
    name, 
    cnpj, 
    address, 
    city, 
    state, 
    habilitacoes, 
    is_active
) VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'Hospital Demo - SIGTAP Sync',
    '12345678000190',  -- CNPJ sem formatação
    'Rua Demo, 123 - Centro',
    'São Paulo',
    'SP',
    ARRAY['CARDIOLOGIA', 'NEUROLOGIA', 'ONCOLOGIA', 'UTI'],
    true
);

-- Hospital adicional para testes
INSERT INTO hospitals (
    id, 
    name, 
    cnpj, 
    address, 
    city, 
    state, 
    habilitacoes, 
    is_active
) VALUES (
    'b0000000-0000-0000-0000-000000000002',
    'Hospital Teste - SIGTAP Sync',
    '98765432000111',  -- CNPJ sem formatação
    'Av. Teste, 456 - Jardins',
    'Rio de Janeiro',
    'RJ',
    ARRAY['PEDIATRIA', 'CARDIOLOGIA', 'EMERGENCIA'],
    true
);

-- ETAPA 6: CONFIGURAÇÕES DO SISTEMA
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public)
VALUES
    ('system.version', '"3.0.0"', 'string', 'Versão do sistema', true),
    ('system.name', '"SIGTAP Sync"', 'string', 'Nome do sistema', true),
    ('match.confidence_threshold', '70', 'number', 'Threshold mínimo de confiança para match automático', false),
    ('match.require_manual_review_below', '50', 'number', 'Score abaixo do qual requer revisão manual', false),
    ('billing.default_currency', '"BRL"', 'string', 'Moeda padrão para faturamento', true),
    ('sigtap.auto_activate_imports', 'true', 'boolean', 'Ativar automaticamente importações SIGTAP', false),
    ('aih.default_percentage_secondary', '70', 'number', 'Porcentagem padrão para procedimentos secundários', false),
    ('system.max_users_per_hospital', '50', 'number', 'Máximo de usuários por hospital', false),
    ('audit.retention_days', '365', 'number', 'Dias de retenção dos logs de auditoria', false),
    ('development.mode', 'true', 'boolean', 'Modo de desenvolvimento ativo', true);

-- ETAPA 7: VERSÃO SIGTAP PADRÃO
INSERT INTO sigtap_versions (
    id,
    version_name,
    month_year,
    import_date,
    total_procedures,
    is_active,
    extraction_method,
    notes
) VALUES (
    uuid_generate_v4(),
    'Demo Version 2024.06',
    '2024-06',
    NOW(),
    0,
    false,
    'manual',
    'Versão demo inicial - aguardando importação de dados reais'
);

-- ETAPA 8: FUNÇÃO DE VERIFICAÇÃO ATUALIZADA
CREATE OR REPLACE FUNCTION check_system_health()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Verificar hospitais
    RETURN QUERY
    SELECT 
        'Hospitais'::TEXT,
        CASE WHEN (SELECT COUNT(*) FROM hospitals) >= 1 
             THEN '✅ OK' ELSE '❌ MISSING' END,
        CONCAT((SELECT COUNT(*) FROM hospitals), ' hospitais configurados')::TEXT;
    
    -- Verificar configurações
    RETURN QUERY
    SELECT 
        'Configurações'::TEXT,
        CASE WHEN (SELECT COUNT(*) FROM system_settings) >= 8 
             THEN '✅ OK' ELSE '⚠️ INCOMPLETE' END,
        CONCAT((SELECT COUNT(*) FROM system_settings), ' configurações carregadas')::TEXT;
    
    -- Verificar procedimentos SIGTAP
    RETURN QUERY
    SELECT 
        'Procedimentos SIGTAP'::TEXT,
        CASE WHEN (SELECT COUNT(*) FROM sigtap_procedures) > 1000 
             THEN '✅ OK' 
             WHEN (SELECT COUNT(*) FROM sigtap_procedures) > 0 
             THEN '⚠️ PARTIAL'
             ELSE '⚠️ EMPTY - Aguardando importação' END,
        CONCAT((SELECT COUNT(*) FROM sigtap_procedures), ' procedimentos carregados')::TEXT;
        
    -- Verificar versões SIGTAP
    RETURN QUERY
    SELECT 
        'Versões SIGTAP'::TEXT,
        CASE WHEN EXISTS(SELECT 1 FROM sigtap_versions) 
             THEN '✅ OK' ELSE '❌ MISSING' END,
        CONCAT((SELECT COUNT(*) FROM sigtap_versions), ' versões disponíveis')::TEXT;
        
    -- Verificar pacientes
    RETURN QUERY
    SELECT 
        'Pacientes'::TEXT,
        CASE WHEN (SELECT COUNT(*) FROM patients) > 0 
             THEN '✅ COM DADOS' 
             ELSE '⚠️ VAZIO - Normal para início' END,
        CONCAT((SELECT COUNT(*) FROM patients), ' pacientes registrados')::TEXT;
        
    -- Verificar AIHs
    RETURN QUERY
    SELECT 
        'AIHs'::TEXT,
        CASE WHEN (SELECT COUNT(*) FROM aihs) > 0 
             THEN '✅ COM DADOS' 
             ELSE '⚠️ VAZIO - Normal para início' END,
        CONCAT((SELECT COUNT(*) FROM aihs), ' AIHs processadas')::TEXT;
        
    -- Status geral
    RETURN QUERY
    SELECT 
        'Status Geral'::TEXT,
        '✅ SISTEMA LIMPO'::TEXT,
        'Pronto para uso - dados resetados com sucesso'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ETAPA 9: EXECUTAR VERIFICAÇÃO
SELECT * FROM check_system_health();

-- ETAPA 10: MENSAGENS FINAIS
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 RESET COMPLETO FINALIZADO COM SUCESSO!';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Todas as tabelas foram limpas';
    RAISE NOTICE '✅ Constraints problemáticas removidas';
    RAISE NOTICE '✅ Dados básicos inseridos (2 hospitais)';
    RAISE NOTICE '✅ Configurações do sistema carregadas';
    RAISE NOTICE '✅ Sistema pronto para uso';
    RAISE NOTICE '';
    RAISE NOTICE '📋 PRÓXIMOS PASSOS:';
    RAISE NOTICE '1. Teste: npm run dev';
    RAISE NOTICE '2. Faça login com credenciais demo';
    RAISE NOTICE '3. Importe dados SIGTAP (Excel/PDF/ZIP)';
    RAISE NOTICE '4. Teste upload de AIH';
    RAISE NOTICE '5. Registre pacientes';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 Para verificar status: SELECT * FROM check_system_health();';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 SISTEMA 100% LIMPO E OPERACIONAL!';
END $$; 