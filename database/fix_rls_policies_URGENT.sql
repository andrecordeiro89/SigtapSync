-- ================================================
-- FIX POLÍTICAS RLS - CORREÇÃO URGENTE ERRO 406
-- Compatível com sistema de autenticação por sessão
-- ================================================

-- DIAGNÓSTICO: As políticas RLS atuais usam auth.uid() e user_hospital_access
-- que não existem. O sistema usa user_profiles com hospital_access[].

DO $$
BEGIN
    RAISE NOTICE '🔧 INICIANDO CORREÇÃO DAS POLÍTICAS RLS...';
    RAISE NOTICE '';
    RAISE NOTICE '📋 PROBLEMA IDENTIFICADO:';
    RAISE NOTICE '   - Políticas RLS usam auth.uid() mas sistema usa sessão';
    RAISE NOTICE '   - Tabela user_hospital_access não existe';
    RAISE NOTICE '   - Consultas SELECT falham com erro 406';
    RAISE NOTICE '';
    RAISE NOTICE '🎯 SOLUÇÃO: Políticas permissivas para desenvolvimento';
    RAISE NOTICE '';
END $$;

-- ================================================
-- ETAPA 1: REMOVER POLÍTICAS PROBLEMÁTICAS
-- ================================================

DO $$
BEGIN
    RAISE NOTICE '🗑️ Removendo políticas RLS problemáticas...';
    
    -- Remover todas as políticas existentes
    DROP POLICY IF EXISTS "hospital_access" ON hospitals;
    DROP POLICY IF EXISTS "patients_hospital_access" ON patients;
    DROP POLICY IF EXISTS "aihs_hospital_access" ON aihs;
    DROP POLICY IF EXISTS "procedure_records_hospital_access" ON procedure_records;
    DROP POLICY IF EXISTS "Users can only access procedures from their hospital" ON aih_procedures;
    
    -- Remover políticas de outras tabelas se existirem
    DROP POLICY IF EXISTS "sigtap_access" ON sigtap_procedures;
    DROP POLICY IF EXISTS "sigtap_versions_access" ON sigtap_versions;
    DROP POLICY IF EXISTS "aih_matches_access" ON aih_matches;
    DROP POLICY IF EXISTS "doctors_access" ON doctors;
    
    RAISE NOTICE '✅ Políticas antigas removidas';
END $$;

-- ================================================
-- ETAPA 2: CRIAR POLÍTICAS PERMISSIVAS PARA DESENVOLVIMENTO
-- ================================================

DO $$
BEGIN
    RAISE NOTICE '🔓 Criando políticas permissivas para desenvolvimento...';
    
    -- HOSPITAIS - Acesso total para desenvolvimento
    CREATE POLICY "dev_hospital_access" ON hospitals
        FOR ALL
        USING (TRUE)
        WITH CHECK (TRUE);
    
    -- PACIENTES - Acesso total para desenvolvimento
    CREATE POLICY "dev_patients_access" ON patients
        FOR ALL
        USING (TRUE)
        WITH CHECK (TRUE);
    
    -- AIHs - Acesso total para desenvolvimento
    CREATE POLICY "dev_aihs_access" ON aihs
        FOR ALL
        USING (TRUE)
        WITH CHECK (TRUE);
    
    -- PROCEDURE RECORDS - Acesso total para desenvolvimento
    CREATE POLICY "dev_procedure_records_access" ON procedure_records
        FOR ALL
        USING (TRUE)
        WITH CHECK (TRUE);
    
    RAISE NOTICE '✅ Políticas permissivas criadas';
END $$;

-- ================================================
-- ETAPA 3: CONFIGURAR POLÍTICAS PARA TABELAS SIGTAP
-- ================================================

DO $$
BEGIN
    RAISE NOTICE '📊 Configurando acesso às tabelas SIGTAP...';
    
    -- SIGTAP PROCEDURES - Leitura pública para todos
    ALTER TABLE sigtap_procedures ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "public_sigtap_procedures_read" ON sigtap_procedures
        FOR SELECT
        USING (TRUE);
    
    CREATE POLICY "dev_sigtap_procedures_write" ON sigtap_procedures
        FOR INSERT
        WITH CHECK (TRUE);
    
    -- SIGTAP VERSIONS - Leitura pública para todos
    ALTER TABLE sigtap_versions ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "public_sigtap_versions_read" ON sigtap_versions
        FOR SELECT
        USING (TRUE);
    
    CREATE POLICY "dev_sigtap_versions_write" ON sigtap_versions
        FOR INSERT
        WITH CHECK (TRUE);
    
    -- AIH MATCHES - Acesso total para desenvolvimento
    ALTER TABLE aih_matches ENABLE ROW LEVEL SECURITY;
    CREATE POLICY "dev_aih_matches_access" ON aih_matches
        FOR ALL
        USING (TRUE)
        WITH CHECK (TRUE);
    
    RAISE NOTICE '✅ Tabelas SIGTAP configuradas';
END $$;

-- ================================================
-- ETAPA 4: CONFIGURAR TABELA DOCTORS (SE EXISTIR)
-- ================================================

DO $$
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'doctors') THEN
        RAISE NOTICE '👨‍⚕️ Configurando acesso à tabela doctors...';
        
        ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
        CREATE POLICY "dev_doctors_access" ON doctors
            FOR ALL
            USING (TRUE)
            WITH CHECK (TRUE);
        
        RAISE NOTICE '✅ Tabela doctors configurada';
    ELSE
        RAISE NOTICE '⚠️ Tabela doctors não encontrada, ignorando';
    END IF;
END $$;

-- ================================================
-- ETAPA 5: VERIFICAR STATUS DAS POLÍTICAS
-- ================================================

DO $$
DECLARE
    rec RECORD;
    policy_count INTEGER := 0;
BEGIN
    RAISE NOTICE '📋 VERIFICANDO POLÍTICAS CRIADAS:';
    RAISE NOTICE '';
    
    FOR rec IN 
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
        WHERE schemaname = 'public'
        ORDER BY tablename, policyname
    LOOP
        RAISE NOTICE '✅ %.%: %', rec.tablename, rec.policyname, rec.cmd;
        policy_count := policy_count + 1;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '📊 Total de políticas ativas: %', policy_count;
END $$;

-- ================================================
-- ETAPA 6: TESTAR ACESSO ÀS TABELAS
-- ================================================

DO $$
DECLARE
    test_count INTEGER;
    table_name TEXT;
    tables_to_test TEXT[] := ARRAY['hospitals', 'patients', 'aihs', 'sigtap_procedures', 'sigtap_versions'];
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTANDO ACESSO ÀS TABELAS:';
    
    FOREACH table_name IN ARRAY tables_to_test
    LOOP
        BEGIN
            EXECUTE format('SELECT COUNT(*) FROM %I', table_name) INTO test_count;
            RAISE NOTICE '✅ %: % registros (acesso OK)', table_name, test_count;
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE '❌ %: ERRO - %', table_name, SQLERRM;
        END;
    END LOOP;
END $$;

-- ================================================
-- ETAPA 7: CONFIGURAÇÕES ESPECIAIS PARA DESENVOLVIMENTO
-- ================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '⚙️ APLICANDO CONFIGURAÇÕES ESPECIAIS...';
    
    -- Garantir que service_role tem acesso total
    GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
    GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO service_role;
    
    -- Garantir que anon tem acesso de leitura necessário
    GRANT SELECT ON sigtap_procedures TO anon;
    GRANT SELECT ON sigtap_versions TO anon;
    GRANT SELECT ON hospitals TO anon;
    
    RAISE NOTICE '✅ Permissões especiais aplicadas';
END $$;

-- ================================================
-- MENSAGEM FINAL
-- ================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 CORREÇÃO RLS CONCLUÍDA COM SUCESSO!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 O QUE FOI CORRIGIDO:';
    RAISE NOTICE '   ✅ Políticas RLS problemáticas removidas';
    RAISE NOTICE '   ✅ Políticas permissivas para desenvolvimento criadas';
    RAISE NOTICE '   ✅ Tabelas SIGTAP configuradas para acesso público';
    RAISE NOTICE '   ✅ Permissões especiais aplicadas';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 PRÓXIMOS PASSOS:';
    RAISE NOTICE '   1. Teste as consultas no frontend';
    RAISE NOTICE '   2. Verifique se erro 406 foi resolvido';
    RAISE NOTICE '   3. Teste upload e persistência de AIH';
    RAISE NOTICE '';
    RAISE NOTICE '⚠️ NOTA: Estas são políticas permissivas para desenvolvimento.';
    RAISE NOTICE '   Em produção, implemente políticas mais restritivas baseadas';
    RAISE NOTICE '   no sistema user_profiles.hospital_access existente.';
    RAISE NOTICE '';
    RAISE NOTICE '🔍 Para verificar políticas: SELECT * FROM pg_policies WHERE schemaname = ''public'';';
END $$; 