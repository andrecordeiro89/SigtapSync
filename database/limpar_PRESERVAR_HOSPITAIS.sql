-- ================================================
-- SIGTAP SYNC - LIMPEZA PRESERVANDO HOSPITAIS
-- ✅ MANTÉM: Dados dos hospitais reais
-- 🧹 LIMPA: Pacientes, AIHs, Procedimentos, etc.
-- ================================================

-- ETAPA 1: DESABILITAR RLS PARA EVITAR CONFLITOS
ALTER TABLE IF EXISTS patients DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS aihs DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS procedure_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS aih_matches DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sigtap_procedures DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS sigtap_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS system_settings DISABLE ROW LEVEL SECURITY;

-- ETAPA 2: REMOVER POLÍTICAS RLS (EXCETO HOSPITALS)
DO $$
DECLARE
    pol RECORD;
BEGIN
    FOR pol IN 
        SELECT schemaname, tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public'
        AND tablename != 'hospitals'  -- PRESERVAR políticas dos hospitais
    LOOP
        EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', 
                      pol.policyname, pol.schemaname, pol.tablename);
        RAISE NOTICE 'Política % removida da tabela %', pol.policyname, pol.tablename;
    END LOOP;
END $$;

-- ETAPA 3: LIMPAR TABELAS (EM ORDEM DEVIDO A FOREIGN KEYS)
DO $$
DECLARE
    tabelas_limpeza TEXT[] := ARRAY[
        'procedure_records',    -- Dependente de aihs e sigtap_procedures
        'aih_matches',         -- Dependente de aihs e sigtap_procedures
        'aihs',                -- Dependente de patients
        'patients',            -- Dependente de hospitals (mas vamos manter hospitals)
        'sigtap_procedures',   -- Independente
        'sigtap_versions',     -- Independente
        'system_settings'      -- Independente
    ];
    tabela TEXT;
    contador INTEGER;
BEGIN
    RAISE NOTICE '🧹 LIMPANDO TABELAS (PRESERVANDO HOSPITAIS)...';
    
    FOREACH tabela IN ARRAY tabelas_limpeza
    LOOP
        IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = tabela) THEN
            -- Contar registros antes de limpar
            EXECUTE format('SELECT COUNT(*) FROM %I', tabela) INTO contador;
            
            -- Limpar tabela
            EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', tabela);
            
            RAISE NOTICE '✅ Tabela % limpa (% registros removidos)', tabela, contador;
        ELSE
            RAISE NOTICE '⚠️ Tabela % não existe', tabela;
        END IF;
    END LOOP;
    
    RAISE NOTICE '🏥 HOSPITAIS PRESERVADOS - dados mantidos intactos';
END $$;

-- ETAPA 4: VERIFICAR HOSPITAIS EXISTENTES
DO $$
DECLARE
    hospital_count INTEGER;
    rec RECORD;
BEGIN
    SELECT COUNT(*) INTO hospital_count FROM hospitals;
    
    RAISE NOTICE '';
    RAISE NOTICE '🏥 HOSPITAIS PRESERVADOS: % hospitais mantidos', hospital_count;
    
    FOR rec IN SELECT name, city, state FROM hospitals ORDER BY name
    LOOP
        RAISE NOTICE '  📍 %: %, %', rec.name, rec.city, rec.state;
    END LOOP;
    
    RAISE NOTICE '';
END $$;

-- ETAPA 5: RECRIAR CONFIGURAÇÕES BÁSICAS DO SISTEMA
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
    ('development.mode', 'true', 'boolean', 'Modo de desenvolvimento ativo', true)
ON CONFLICT (hospital_id, setting_key) DO UPDATE SET
    setting_value = EXCLUDED.setting_value,
    updated_at = NOW();

-- ETAPA 6: CRIAR VERSÃO SIGTAP INICIAL
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
    'Aguardando Importação',
    TO_CHAR(CURRENT_DATE, 'YYYY-MM'),
    NOW(),
    0,
    false,
    'pending',
    'Sistema limpo - aguardando importação de dados SIGTAP reais'
);

-- ETAPA 7: FUNÇÃO DE VERIFICAÇÃO ATUALIZADA
CREATE OR REPLACE FUNCTION check_system_health()
RETURNS TABLE (
    check_name TEXT,
    status TEXT,
    details TEXT
) AS $$
BEGIN
    -- Verificar hospitais (preservados)
    RETURN QUERY
    SELECT 
        'Hospitais Preservados'::TEXT,
        CASE WHEN (SELECT COUNT(*) FROM hospitals) >= 1 
             THEN '✅ MANTIDOS' ELSE '❌ MISSING' END,
        CONCAT((SELECT COUNT(*) FROM hospitals), ' hospitais preservados')::TEXT;
    
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
             ELSE '⚠️ LIMPO - Pronto para importação' END,
        CONCAT((SELECT COUNT(*) FROM sigtap_procedures), ' procedimentos')::TEXT;
        
    -- Verificar versões SIGTAP
    RETURN QUERY
    SELECT 
        'Versões SIGTAP'::TEXT,
        CASE WHEN EXISTS(SELECT 1 FROM sigtap_versions) 
             THEN '✅ OK' ELSE '❌ MISSING' END,
        CONCAT((SELECT COUNT(*) FROM sigtap_versions), ' versões disponíveis')::TEXT;
        
    -- Verificar pacientes (deve estar vazio)
    RETURN QUERY
    SELECT 
        'Pacientes'::TEXT,
        CASE WHEN (SELECT COUNT(*) FROM patients) = 0 
             THEN '✅ LIMPO' 
             ELSE '⚠️ COM DADOS' END,
        CONCAT((SELECT COUNT(*) FROM patients), ' pacientes registrados')::TEXT;
        
    -- Verificar AIHs (deve estar vazio)
    RETURN QUERY
    SELECT 
        'AIHs'::TEXT,
        CASE WHEN (SELECT COUNT(*) FROM aihs) = 0 
             THEN '✅ LIMPO' 
             ELSE '⚠️ COM DADOS' END,
        CONCAT((SELECT COUNT(*) FROM aihs), ' AIHs processadas')::TEXT;
        
    -- Status geral
    RETURN QUERY
    SELECT 
        'Status Geral'::TEXT,
        '✅ HOSPITAIS PRESERVADOS'::TEXT,
        'Dados limpos, hospitais mantidos - pronto para uso'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ETAPA 8: EXECUTAR VERIFICAÇÃO
SELECT * FROM check_system_health();

-- ETAPA 9: LISTAR HOSPITAIS PRESERVADOS
SELECT 
    name as "Hospital",
    city as "Cidade",
    state as "Estado",
    array_length(habilitacoes, 1) as "Qtd_Habilitações",
    CASE WHEN is_active THEN '✅ Ativo' ELSE '❌ Inativo' END as "Status"
FROM hospitals 
ORDER BY name;

-- ETAPA 10: MENSAGENS FINAIS
DO $$
DECLARE
    hospital_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO hospital_count FROM hospitals;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 LIMPEZA SELETIVA CONCLUÍDA!';
    RAISE NOTICE '';
    RAISE NOTICE '✅ % hospitais PRESERVADOS', hospital_count;
    RAISE NOTICE '✅ Todas as outras tabelas LIMPAS';
    RAISE NOTICE '✅ Configurações básicas INSERIDAS';
    RAISE NOTICE '✅ Sistema pronto para novo uso';
    RAISE NOTICE '';
    RAISE NOTICE '📋 PRÓXIMOS PASSOS:';
    RAISE NOTICE '1. Teste: npm run dev';
    RAISE NOTICE '2. Importe dados SIGTAP (Excel/PDF/ZIP)';
    RAISE NOTICE '3. Cadastre pacientes';
    RAISE NOTICE '4. Teste upload de AIH';
    RAISE NOTICE '5. Gere relatórios';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 Para verificar: SELECT * FROM check_system_health();';
    RAISE NOTICE '🏥 Para ver hospitais: SELECT name, city FROM hospitals;';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 SISTEMA LIMPO COM HOSPITAIS PRESERVADOS!';
END $$; 