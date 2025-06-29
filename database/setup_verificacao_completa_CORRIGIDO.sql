-- ================================================
-- SIGTAP SYNC - VERIFICAÇÃO E SETUP COMPLETO (CORRIGIDO)
-- ================================================

-- ETAPA 1: Verificar se todas as tabelas existem
DO $$
DECLARE
    tabelas_necessarias TEXT[] := ARRAY[
        'hospitals', 'sigtap_versions', 'sigtap_procedures', 
        'patients', 'aihs', 'aih_matches', 'procedure_records', 
        'system_settings', 'user_profiles'
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

-- ETAPA 2: Verificar se RLS está configurado
DO $$
DECLARE
    tabela TEXT;
    rls_enabled BOOLEAN;
BEGIN
    RAISE NOTICE '🔒 VERIFICANDO ROW LEVEL SECURITY...';
    
    FOR tabela IN SELECT table_name FROM information_schema.tables 
                  WHERE table_schema = 'public' 
                  AND table_name IN ('hospitals', 'patients', 'aihs', 'procedure_records')
    LOOP
        SELECT relrowsecurity INTO rls_enabled
        FROM pg_class 
        WHERE relname = tabela;
        
        IF rls_enabled THEN
            RAISE NOTICE '✅ RLS habilitado para %', tabela;
        ELSE
            RAISE NOTICE '⚠️ RLS não habilitado para %', tabela;
        END IF;
    END LOOP;
END $$;

-- ETAPA 3: Criar hospital padrão se não existir
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

-- ETAPA 4: Configurações padrão do sistema
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

-- ETAPA 5: Verificar índices críticos
DO $$
DECLARE
    indices_necessarios TEXT[] := ARRAY[
        'idx_patients_cns', 'idx_patients_hospital', 'idx_aihs_hospital_date',
        'idx_aihs_status', 'idx_sigtap_procedures_code', 'idx_aih_matches_aih'
    ];
    indice TEXT;
    existe BOOLEAN;
BEGIN
    RAISE NOTICE '📇 VERIFICANDO ÍNDICES CRÍTICOS...';
    
    FOREACH indice IN ARRAY indices_necessarios
    LOOP
        SELECT EXISTS (
            SELECT FROM pg_indexes 
            WHERE indexname = indice
        ) INTO existe;
        
        IF existe THEN
            RAISE NOTICE '✅ Índice % existe', indice;
        ELSE
            RAISE NOTICE '⚠️ Índice % não encontrado', indice;
        END IF;
    END LOOP;
END $$;

-- ETAPA 6: Estatísticas das tabelas
DO $$
DECLARE
    rec RECORD;
BEGIN
    RAISE NOTICE '📊 ESTATÍSTICAS DAS TABELAS:';
    
    FOR rec IN 
        SELECT 
            table_name,
            (xpath('/row/cnt/text()', xml_count))[1]::text::int as row_count
        FROM (
            SELECT 
                table_name,
                table_schema,
                query_to_xml(format('SELECT count(*) AS cnt FROM %I.%I', table_schema, table_name), false, true, '') as xml_count
            FROM information_schema.tables
            WHERE table_schema = 'public' 
            AND table_type = 'BASE TABLE'
            AND table_name IN ('hospitals', 'patients', 'aihs', 'sigtap_procedures', 'aih_matches', 'procedure_records')
        ) t
    LOOP
        RAISE NOTICE '📋 %: % registros', rec.table_name, COALESCE(rec.row_count, 0);
    END LOOP;
END $$;

-- ETAPA 7: Configurar RLS básico para desenvolvimento (CORRIGIDO)
-- (em produção, usar políticas mais restritivas)

-- Remover políticas existentes primeiro para evitar conflitos
DO $$
BEGIN
    -- Remover políticas se existirem
    DROP POLICY IF EXISTS "hospital_access" ON hospitals;
    DROP POLICY IF EXISTS "patients_hospital_access" ON patients;
    DROP POLICY IF EXISTS "aihs_hospital_access" ON aihs;
    DROP POLICY IF EXISTS "procedure_records_hospital_access" ON procedure_records;
    
    RAISE NOTICE '🔒 Políticas RLS removidas (se existiam)';
END $$;

-- RLS para hospitais - usuários só veem seu hospital
ALTER TABLE hospitals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "hospital_access" ON hospitals
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_hospital_access 
            WHERE hospital_id = hospitals.id
        ) OR 
        auth.jwt() ->> 'role' = 'service_role'
    );

-- RLS para pacientes - por hospital
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "patients_hospital_access" ON patients
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_hospital_access 
            WHERE hospital_id = patients.hospital_id
        ) OR 
        auth.jwt() ->> 'role' = 'service_role'
    );

-- RLS para AIHs - por hospital
ALTER TABLE aihs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "aihs_hospital_access" ON aihs
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_hospital_access 
            WHERE hospital_id = aihs.hospital_id
        ) OR 
        auth.jwt() ->> 'role' = 'service_role'
    );

-- RLS para procedure_records - por hospital
ALTER TABLE procedure_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "procedure_records_hospital_access" ON procedure_records
    FOR ALL USING (
        auth.uid() IN (
            SELECT user_id FROM user_hospital_access 
            WHERE hospital_id = procedure_records.hospital_id
        ) OR 
        auth.jwt() ->> 'role' = 'service_role'
    );

-- ETAPA 8: Função para verificação de saúde do sistema
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
    
    -- Verificar versão SIGTAP ativa
    RETURN QUERY
    SELECT 
        'SIGTAP Ativo'::TEXT,
        CASE WHEN EXISTS(SELECT 1 FROM sigtap_versions WHERE is_active = true) 
             THEN '✅ OK' ELSE '⚠️ NONE' END,
        'Tabela SIGTAP importada e ativa'::TEXT;
    
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
        
    -- Verificar políticas RLS
    RETURN QUERY
    SELECT 
        'Políticas RLS'::TEXT,
        CASE WHEN EXISTS(
            SELECT 1 FROM pg_policies 
            WHERE tablename IN ('hospitals', 'patients', 'aihs', 'procedure_records')
        ) THEN '✅ OK' ELSE '⚠️ MISSING' END,
        'Row Level Security configurado'::TEXT;
END;
$$ LANGUAGE plpgsql;

-- ETAPA 9: Executar verificação final
SELECT * FROM check_system_health();

-- MENSAGEM FINAL
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 SETUP DE VERIFICAÇÃO CONCLUÍDO (CORRIGIDO)!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 PRÓXIMOS PASSOS:';
    RAISE NOTICE '1. Configure o arquivo .env com suas credenciais Supabase';
    RAISE NOTICE '2. Execute: npm run dev';
    RAISE NOTICE '3. Teste o login com as credenciais demo';
    RAISE NOTICE '4. Importe uma tabela SIGTAP (Excel/PDF/ZIP)';
    RAISE NOTICE '5. Teste upload de AIH';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 Para verificar novamente: SELECT * FROM check_system_health();';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ NOTA: Se ainda houver erros com user_hospital_access,';
    RAISE NOTICE '   desabilite temporariamente as políticas RLS para testes.';
END $$; 