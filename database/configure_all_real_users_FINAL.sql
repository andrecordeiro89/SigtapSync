-- ============================================================================
-- CONFIGURAÇÃO FINAL DE TODOS OS USUÁRIOS REAIS - SIGTAP BILLING WIZARD
-- Sistema: SIGTAP Billing Wizard v3.0
-- ============================================================================

-- 1. ATUALIZAR CONSTRAINT DE ROLES (incluir todos os roles)
ALTER TABLE user_profiles 
DROP CONSTRAINT IF EXISTS user_profiles_role_check;

ALTER TABLE user_profiles 
ADD CONSTRAINT user_profiles_role_check 
CHECK (role IN ('developer', 'admin', 'user', 'director', 'ti', 'coordinator', 'auditor'));

-- 2. ADICIONAR CAMPOS FALTANTES SE NÃO EXISTIREM
DO $$
BEGIN
    -- Verificar e adicionar temp_password_set
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'user_profiles' AND column_name = 'temp_password_set') THEN
        ALTER TABLE user_profiles ADD COLUMN temp_password_set BOOLEAN DEFAULT false;
        RAISE NOTICE '✅ Campo temp_password_set adicionado';
    END IF;
    
    -- Verificar e adicionar migrated_to_auth
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                  WHERE table_name = 'user_profiles' AND column_name = 'migrated_to_auth') THEN
        ALTER TABLE user_profiles ADD COLUMN migrated_to_auth BOOLEAN DEFAULT false;
        RAISE NOTICE '✅ Campo migrated_to_auth adicionado';
    END IF;
END $$;

-- 3. REMOVER POLÍTICAS RLS ANTIGAS
DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
DROP POLICY IF EXISTS "Allow all for testing" ON user_profiles;
DROP POLICY IF EXISTS "basic_users_own_profile" ON user_profiles;
DROP POLICY IF EXISTS "full_access_all_profiles" ON user_profiles;
DROP POLICY IF EXISTS "service_role_access" ON user_profiles;
DROP POLICY IF EXISTS "hospital_access" ON hospitals;
DROP POLICY IF EXISTS "dev_hospital_access" ON hospitals;
DROP POLICY IF EXISTS "hospital_full_access" ON hospitals;
DROP POLICY IF EXISTS "hospital_user_access" ON hospitals;
DROP POLICY IF EXISTS "patients_hospital_access" ON patients;
DROP POLICY IF EXISTS "dev_patients_access" ON patients;
DROP POLICY IF EXISTS "patients_full_access" ON patients;
DROP POLICY IF EXISTS "patients_user_hospital" ON patients;
DROP POLICY IF EXISTS "aihs_hospital_access" ON aihs;
DROP POLICY IF EXISTS "dev_aihs_access" ON aihs;
DROP POLICY IF EXISTS "aihs_full_access" ON aihs;
DROP POLICY IF EXISTS "aihs_user_hospital" ON aihs;
DROP POLICY IF EXISTS "procedure_records_hospital_access" ON procedure_records;
DROP POLICY IF EXISTS "dev_procedure_records_access" ON procedure_records;
DROP POLICY IF EXISTS "procedure_records_full_access" ON procedure_records;
DROP POLICY IF EXISTS "procedure_records_user_hospital" ON procedure_records;
DROP POLICY IF EXISTS "dev_aih_matches_access" ON aih_matches;
DROP POLICY IF EXISTS "aih_matches_full_access" ON aih_matches;
DROP POLICY IF EXISTS "aih_matches_user_hospital" ON aih_matches;
DROP POLICY IF EXISTS "audit_logs_full_access" ON audit_logs;
DROP POLICY IF EXISTS "audit_logs_own_actions" ON audit_logs;

-- 4. CRIAR FUNÇÃO PARA VERIFICAR ACESSO TOTAL
CREATE OR REPLACE FUNCTION has_full_access_role(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = user_id 
        AND role IN ('developer', 'admin', 'director', 'coordinator', 'auditor', 'ti')
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. CRIAR FUNÇÃO PARA VERIFICAR SE É USUÁRIO BÁSICO
CREATE OR REPLACE FUNCTION is_basic_user(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = user_id 
        AND role = 'user'
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. CONFIGURAR TODOS OS USUÁRIOS BÁSICOS COM IDS CORRETOS DOS HOSPITAIS
DO $$
DECLARE
    user_hospital_mapping RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '👥 CONFIGURANDO USUÁRIOS BÁSICOS COM IDS CORRETOS DOS HOSPITAIS...';
    RAISE NOTICE '================================================================';
    
    -- Hospital CAR: 792a0316-92b4-4504-8238-491d284099a3
    FOR user_hospital_mapping IN 
        SELECT email, '792a0316-92b4-4504-8238-491d284099a3'::uuid as hospital_id, 'CAR' as hospital_name
        FROM (VALUES 
            ('faturamento.car@sigtap.com'),
            ('faturamento.car01@sigtap.com'),
            ('faturamento.car02@sigtap.com')
        ) AS t(email)
    LOOP
        INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
        VALUES (
            gen_random_uuid(),
            user_hospital_mapping.email,
            'user',
            'Operador CAR' || CASE 
                WHEN user_hospital_mapping.email ~ '\d+' THEN ' ' || (regexp_match(user_hospital_mapping.email, '(\d+)'))[1]
                ELSE ' Principal'
            END,
            ARRAY[user_hospital_mapping.hospital_id::text],
            ARRAY['basic_access'],
            true
        )
        ON CONFLICT (email) DO UPDATE SET
            role = 'user',
            hospital_access = ARRAY[user_hospital_mapping.hospital_id::text],
            permissions = ARRAY['basic_access'],
            is_active = true,
            updated_at = NOW();
            
        RAISE NOTICE '✅ Configurado: % -> Hospital CAR (ID: %)', 
                    user_hospital_mapping.email, user_hospital_mapping.hospital_id;
    END LOOP;
    
    -- Hospital CAS: 1d8ca73a-1927-462e-91c0-fa7004d0b377
    FOR user_hospital_mapping IN 
        SELECT email, '1d8ca73a-1927-462e-91c0-fa7004d0b377'::uuid as hospital_id, 'CAS' as hospital_name
        FROM (VALUES 
            ('faturamento.cas@sigtap.com'),
            ('faturamento.cas01@sigtap.com'),
            ('faturamento.cas02@sigtap.com')
        ) AS t(email)
    LOOP
        INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
        VALUES (
            gen_random_uuid(),
            user_hospital_mapping.email,
            'user',
            'Operador CAS' || CASE 
                WHEN user_hospital_mapping.email ~ '\d+' THEN ' ' || (regexp_match(user_hospital_mapping.email, '(\d+)'))[1]
                ELSE ' Principal'
            END,
            ARRAY[user_hospital_mapping.hospital_id::text],
            ARRAY['basic_access'],
            true
        )
        ON CONFLICT (email) DO UPDATE SET
            role = 'user',
            hospital_access = ARRAY[user_hospital_mapping.hospital_id::text],
            permissions = ARRAY['basic_access'],
            is_active = true,
            updated_at = NOW();
            
        RAISE NOTICE '✅ Configurado: % -> Hospital CAS (ID: %)', 
                    user_hospital_mapping.email, user_hospital_mapping.hospital_id;
    END LOOP;
    
    -- Hospital FAX: 019c7380-459d-4aa5-bbd8-2dba4f361e7e
    FOR user_hospital_mapping IN 
        SELECT email, '019c7380-459d-4aa5-bbd8-2dba4f361e7e'::uuid as hospital_id, 'FAX' as hospital_name
        FROM (VALUES 
            ('faturamento.fax@sigtap.com'),
            ('faturamento.fax01@sigtap.com'),
            ('faturamento.fax02@sigtap.com')
        ) AS t(email)
    LOOP
        INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
        VALUES (
            gen_random_uuid(),
            user_hospital_mapping.email,
            'user',
            'Operador FAX' || CASE 
                WHEN user_hospital_mapping.email ~ '\d+' THEN ' ' || (regexp_match(user_hospital_mapping.email, '(\d+)'))[1]
                ELSE ' Principal'
            END,
            ARRAY[user_hospital_mapping.hospital_id::text],
            ARRAY['basic_access'],
            true
        )
        ON CONFLICT (email) DO UPDATE SET
            role = 'user',
            hospital_access = ARRAY[user_hospital_mapping.hospital_id::text],
            permissions = ARRAY['basic_access'],
            is_active = true,
            updated_at = NOW();
            
        RAISE NOTICE '✅ Configurado: % -> Hospital FAX (ID: %)', 
                    user_hospital_mapping.email, user_hospital_mapping.hospital_id;
    END LOOP;
    
    -- Hospital FOZ: 47eddf6e-ac64-4433-acc1-7b644a2b43d0
    FOR user_hospital_mapping IN 
        SELECT email, '47eddf6e-ac64-4433-acc1-7b644a2b43d0'::uuid as hospital_id, 'FOZ' as hospital_name
        FROM (VALUES 
            ('faturamento.foz@sigtap.com'),
            ('faturamento.foz01@sigtap.com'),
            ('faturamento.foz02@sigtap.com')
        ) AS t(email)
    LOOP
        INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
        VALUES (
            gen_random_uuid(),
            user_hospital_mapping.email,
            'user',
            'Operador FOZ' || CASE 
                WHEN user_hospital_mapping.email ~ '\d+' THEN ' ' || (regexp_match(user_hospital_mapping.email, '(\d+)'))[1]
                ELSE ' Principal'
            END,
            ARRAY[user_hospital_mapping.hospital_id::text],
            ARRAY['basic_access'],
            true
        )
        ON CONFLICT (email) DO UPDATE SET
            role = 'user',
            hospital_access = ARRAY[user_hospital_mapping.hospital_id::text],
            permissions = ARRAY['basic_access'],
            is_active = true,
            updated_at = NOW();
            
        RAISE NOTICE '✅ Configurado: % -> Hospital FOZ (ID: %)', 
                    user_hospital_mapping.email, user_hospital_mapping.hospital_id;
    END LOOP;
    
    -- Hospital FRG: a8978eaa-b90e-4dc8-8fd5-0af984374d34
    FOR user_hospital_mapping IN 
        SELECT email, 'a8978eaa-b90e-4dc8-8fd5-0af984374d34'::uuid as hospital_id, 'FRG' as hospital_name
        FROM (VALUES 
            ('faturamento.frg@sigtap.com'),
            ('faturamento.frg01@sigtap.com'),
            ('faturamento.frg02@sigtap.com'),
            ('faturamento.frg.03@sigtap.com'),
            ('faturamento.frg.04@sigtap.com'),
            ('faturamento.frg.05@sigtap.com')
        ) AS t(email)
    LOOP
        INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
        VALUES (
            gen_random_uuid(),
            user_hospital_mapping.email,
            'user',
            'Operador FRG' || CASE 
                WHEN user_hospital_mapping.email ~ '\d+' THEN ' ' || REPLACE((regexp_match(user_hospital_mapping.email, '(\d+)'))[1], '.', '')
                ELSE ' Principal'
            END,
            ARRAY[user_hospital_mapping.hospital_id::text],
            ARRAY['basic_access'],
            true
        )
        ON CONFLICT (email) DO UPDATE SET
            role = 'user',
            hospital_access = ARRAY[user_hospital_mapping.hospital_id::text],
            permissions = ARRAY['basic_access'],
            is_active = true,
            updated_at = NOW();
            
        RAISE NOTICE '✅ Configurado: % -> Hospital FRG (ID: %)', 
                    user_hospital_mapping.email, user_hospital_mapping.hospital_id;
    END LOOP;
    
    -- Hospital SM: 68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b
    FOR user_hospital_mapping IN 
        SELECT email, '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b'::uuid as hospital_id, 'SM' as hospital_name
        FROM (VALUES 
            ('faturamento.sm@sigtap.com'),
            ('faturamento.sm01@sigtap.com'),
            ('faturamento.sm02@sigtap.com')
        ) AS t(email)
    LOOP
        INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
        VALUES (
            gen_random_uuid(),
            user_hospital_mapping.email,
            'user',
            'Operador SM' || CASE 
                WHEN user_hospital_mapping.email ~ '\d+' THEN ' ' || (regexp_match(user_hospital_mapping.email, '(\d+)'))[1]
                ELSE ' Principal'
            END,
            ARRAY[user_hospital_mapping.hospital_id::text],
            ARRAY['basic_access'],
            true
        )
        ON CONFLICT (email) DO UPDATE SET
            role = 'user',
            hospital_access = ARRAY[user_hospital_mapping.hospital_id::text],
            permissions = ARRAY['basic_access'],
            is_active = true,
            updated_at = NOW();
            
        RAISE NOTICE '✅ Configurado: % -> Hospital SM (ID: %)', 
                    user_hospital_mapping.email, user_hospital_mapping.hospital_id;
    END LOOP;
    
    -- Hospital GUA: 1218dd7b-efcb-442e-ad2b-b72d04128cb9
    FOR user_hospital_mapping IN 
        SELECT email, '1218dd7b-efcb-442e-ad2b-b72d04128cb9'::uuid as hospital_id, 'GUA' as hospital_name
        FROM (VALUES 
            ('faturamento.gua@sigtap.com'),
            ('faturamento.gua01@sigtap.com'),
            ('faturamento.gua02@sigtap.com')
        ) AS t(email)
    LOOP
        INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
        VALUES (
            gen_random_uuid(),
            user_hospital_mapping.email,
            'user',
            'Operador GUA' || CASE 
                WHEN user_hospital_mapping.email ~ '\d+' THEN ' ' || (regexp_match(user_hospital_mapping.email, '(\d+)'))[1]
                ELSE ' Principal'
            END,
            ARRAY[user_hospital_mapping.hospital_id::text],
            ARRAY['basic_access'],
            true
        )
        ON CONFLICT (email) DO UPDATE SET
            role = 'user',
            hospital_access = ARRAY[user_hospital_mapping.hospital_id::text],
            permissions = ARRAY['basic_access'],
            is_active = true,
            updated_at = NOW();
            
        RAISE NOTICE '✅ Configurado: % -> Hospital GUA (ID: %)', 
                    user_hospital_mapping.email, user_hospital_mapping.hospital_id;
    END LOOP;
    
END $$;

-- 7. CONFIGURAR USUÁRIOS COM ROLES ELEVADOS
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔰 CONFIGURANDO USUÁRIOS COM ROLES ELEVADOS...';
    RAISE NOTICE '=============================================';
    
    -- ADMIN (corrigindo o typo do email)
    INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
    VALUES (
        gen_random_uuid(),
        'admin@sigtap.com', -- Correção: admin@sigtap.om -> admin@sigtap.com
        'admin',
        'Administrador Geral do Sistema',
        ARRAY['ALL'],
        ARRAY['all', 'admin_access', 'user_management', 'system_config'],
        true
    )
    ON CONFLICT (email) DO UPDATE SET
        role = 'admin',
        full_name = 'Administrador Geral do Sistema',
        hospital_access = ARRAY['ALL'],
        permissions = ARRAY['all', 'admin_access', 'user_management', 'system_config'],
        is_active = true,
        updated_at = NOW();
    RAISE NOTICE '✅ Admin configurado: admin@sigtap.com (corrigido typo do .om)';
    
    -- AUDITOR
    INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
    VALUES (
        gen_random_uuid(),
        'auditoria@sigtap.com',
        'auditor',
        'Auditor do Sistema',
        ARRAY['ALL'],
        ARRAY['audit_access', 'view_all_data', 'compliance_check', 'audit_reports'],
        true
    )
    ON CONFLICT (email) DO UPDATE SET
        role = 'auditor',
        full_name = 'Auditor do Sistema',
        hospital_access = ARRAY['ALL'],
        permissions = ARRAY['audit_access', 'view_all_data', 'compliance_check', 'audit_reports'],
        is_active = true,
        updated_at = NOW();
    RAISE NOTICE '✅ Auditor configurado: auditoria@sigtap.com';
    
    -- COORDINATOR
    INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
    VALUES (
        gen_random_uuid(),
        'coordenacao@sigtap.com',
        'coordinator',
        'Coordenador Geral',
        ARRAY['ALL'],
        ARRAY['coordination_access', 'manage_procedures', 'generate_reports', 'team_management'],
        true
    )
    ON CONFLICT (email) DO UPDATE SET
        role = 'coordinator',
        full_name = 'Coordenador Geral',
        hospital_access = ARRAY['ALL'],
        permissions = ARRAY['coordination_access', 'manage_procedures', 'generate_reports', 'team_management'],
        is_active = true,
        updated_at = NOW();
    RAISE NOTICE '✅ Coordinator configurado: coordenacao@sigtap.com';
    
    -- DIRECTOR
    INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
    VALUES (
        gen_random_uuid(),
        'diretoria@sigtap.com',
        'director',
        'Diretor Executivo',
        ARRAY['ALL'],
        ARRAY['executive_access', 'generate_reports', 'financial_overview', 'strategic_analysis'],
        true
    )
    ON CONFLICT (email) DO UPDATE SET
        role = 'director',
        full_name = 'Diretor Executivo',
        hospital_access = ARRAY['ALL'],
        permissions = ARRAY['executive_access', 'generate_reports', 'financial_overview', 'strategic_analysis'],
        is_active = true,
        updated_at = NOW();
    RAISE NOTICE '✅ Director configurado: diretoria@sigtap.com';
    
    -- MEDICOS (como coordinator médico)
    INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
    VALUES (
        gen_random_uuid(),
        'medicos@sigtap.com',
        'coordinator',
        'Coordenador Médico',
        ARRAY['ALL'],
        ARRAY['coordination_access', 'medical_access', 'manage_procedures', 'generate_reports'],
        true
    )
    ON CONFLICT (email) DO UPDATE SET
        role = 'coordinator',
        full_name = 'Coordenador Médico',
        hospital_access = ARRAY['ALL'],
        permissions = ARRAY['coordination_access', 'medical_access', 'manage_procedures', 'generate_reports'],
        is_active = true,
        updated_at = NOW();
    RAISE NOTICE '✅ Coordinator Médico configurado: medicos@sigtap.com';
    
    -- TI
    INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
    VALUES (
        gen_random_uuid(),
        'ti@sigtap.com',
        'ti',
        'Suporte Técnico',
        ARRAY['ALL'],
        ARRAY['technical_access', 'system_config', 'database_access', 'backup_restore'],
        true
    )
    ON CONFLICT (email) DO UPDATE SET
        role = 'ti',
        full_name = 'Suporte Técnico',
        hospital_access = ARRAY['ALL'],
        permissions = ARRAY['technical_access', 'system_config', 'database_access', 'backup_restore'],
        is_active = true,
        updated_at = NOW();
    RAISE NOTICE '✅ TI configurado: ti@sigtap.com';
    
END $$;

-- 8. APLICAR POLÍTICAS RLS COMPLETAS

-- USER_PROFILES
CREATE POLICY "basic_users_own_profile" ON user_profiles
    FOR ALL USING (
        auth.uid() = id AND is_basic_user()
    );

CREATE POLICY "full_access_all_profiles" ON user_profiles
    FOR ALL USING (
        has_full_access_role()
    );

CREATE POLICY "service_role_access" ON user_profiles
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- HOSPITALS
CREATE POLICY "hospital_full_access" ON hospitals
    FOR ALL USING (
        has_full_access_role() OR auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY "hospital_user_access" ON hospitals
    FOR SELECT USING (
        is_basic_user() AND (
            id::text = ANY(
                SELECT unnest(hospital_access) 
                FROM user_profiles 
                WHERE user_profiles.id = auth.uid()
            )
        )
    );

-- PATIENTS
CREATE POLICY "patients_full_access" ON patients
    FOR ALL USING (
        has_full_access_role() OR auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY "patients_user_hospital" ON patients
    FOR ALL USING (
        is_basic_user() AND hospital_id::text = ANY(
            SELECT unnest(hospital_access) 
            FROM user_profiles 
            WHERE user_profiles.id = auth.uid()
        )
    );

-- AIHS
CREATE POLICY "aihs_full_access" ON aihs
    FOR ALL USING (
        has_full_access_role() OR auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY "aihs_user_hospital" ON aihs
    FOR ALL USING (
        is_basic_user() AND hospital_id::text = ANY(
            SELECT unnest(hospital_access) 
            FROM user_profiles 
            WHERE user_profiles.id = auth.uid()
        )
    );

-- PROCEDURE_RECORDS
CREATE POLICY "procedure_records_full_access" ON procedure_records
    FOR ALL USING (
        has_full_access_role() OR auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY "procedure_records_user_hospital" ON procedure_records
    FOR ALL USING (
        is_basic_user() AND hospital_id::text = ANY(
            SELECT unnest(hospital_access) 
            FROM user_profiles 
            WHERE user_profiles.id = auth.uid()
        )
    );

-- AIH_MATCHES
CREATE POLICY "aih_matches_full_access" ON aih_matches
    FOR ALL USING (
        has_full_access_role() OR auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY "aih_matches_user_hospital" ON aih_matches
    FOR ALL USING (
        is_basic_user() AND EXISTS (
            SELECT 1 FROM aihs 
            WHERE aihs.id = aih_matches.aih_id 
            AND aihs.hospital_id::text = ANY(
                SELECT unnest(hospital_access) 
                FROM user_profiles 
                WHERE user_profiles.id = auth.uid()
            )
        )
    );

-- AUDIT_LOGS
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_full_access" ON audit_logs
    FOR ALL USING (
        has_full_access_role() OR auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY "audit_logs_own_actions" ON audit_logs
    FOR SELECT USING (
        is_basic_user() AND user_id = auth.uid()
    );

-- 9. VERIFICAÇÃO FINAL DETALHADA
DO $$
DECLARE
    total_users INTEGER;
    total_elevated INTEGER;
    total_basic INTEGER;
    total_policies INTEGER;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📊 VERIFICAÇÃO FINAL DETALHADA';
    RAISE NOTICE '=============================';
    
    -- Contar usuários por tipo
    SELECT COUNT(*) INTO total_users FROM user_profiles WHERE email LIKE '%@sigtap.com';
    SELECT COUNT(*) INTO total_elevated FROM user_profiles WHERE role IN ('admin', 'coordinator', 'director', 'auditor', 'ti') AND email LIKE '%@sigtap.com';
    SELECT COUNT(*) INTO total_basic FROM user_profiles WHERE role = 'user' AND email LIKE '%@sigtap.com';
    
    -- Contar políticas
    SELECT COUNT(*) INTO total_policies FROM pg_policies 
    WHERE tablename IN ('user_profiles', 'hospitals', 'patients', 'aihs', 'procedure_records', 'aih_matches', 'audit_logs');
    
    RAISE NOTICE '📈 ESTATÍSTICAS FINAIS:';
    RAISE NOTICE '   👥 Total usuários: % (esperado: 30)', total_users;
    RAISE NOTICE '   🔰 Usuários elevados: % (esperado: 6)', total_elevated;
    RAISE NOTICE '   👤 Usuários básicos: % (esperado: 24)', total_basic;
    RAISE NOTICE '   🔒 Políticas RLS: % (esperado: >= 15)', total_policies;
    
    RAISE NOTICE '';
    RAISE NOTICE '🏥 MAPEAMENTO HOSPITAIS CORRIGIDO:';
    RAISE NOTICE '   CAR: 792a0316-92b4-4504-8238-491d284099a3 (CORRIGIDO)';
    RAISE NOTICE '   CAS: 1d8ca73a-1927-462e-91c0-fa7004d0b377';
    RAISE NOTICE '   FAX: 019c7380-459d-4aa5-bbd8-2dba4f361e7e';
    RAISE NOTICE '   FOZ: 47eddf6e-ac64-4433-acc1-7b644a2b43d0';
    RAISE NOTICE '   FRG: a8978eaa-b90e-4dc8-8fd5-0af984374d34';
    RAISE NOTICE '   SM:  68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b';
    RAISE NOTICE '   GUA: 1218dd7b-efcb-442e-ad2b-b72d04128cb9';
    
    RAISE NOTICE '';
    IF total_users = 30 AND total_elevated = 6 AND total_basic = 24 AND total_policies >= 15 THEN
        RAISE NOTICE '🎉 ✅ CONFIGURAÇÃO FINAL CONCLUÍDA COM SUCESSO!';
        RAISE NOTICE '     Sistema pronto para produção com usuários reais.';
    ELSE
        RAISE NOTICE '⚠️ ❌ VERIFICAR CONFIGURAÇÃO - Alguns valores não conferem.';
    END IF;
    
    RAISE NOTICE '';
END $$;

-- Exibir resumo por hospital
SELECT 
    'Usuários por Hospital' as categoria,
    CASE hospital_access[1]
        WHEN '792a0316-92b4-4504-8238-491d284099a3' THEN 'CAR'
        WHEN '1d8ca73a-1927-462e-91c0-fa7004d0b377' THEN 'CAS'  
        WHEN '019c7380-459d-4aa5-bbd8-2dba4f361e7e' THEN 'FAX'
        WHEN '47eddf6e-ac64-4433-acc1-7b644a2b43d0' THEN 'FOZ'
        WHEN 'a8978eaa-b90e-4dc8-8fd5-0af984374d34' THEN 'FRG'
        WHEN '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b' THEN 'SM'
        WHEN '1218dd7b-efcb-442e-ad2b-b72d04128cb9' THEN 'GUA'
        WHEN 'ALL' THEN 'ALL (Acesso Total)'
        ELSE 'DESCONHECIDO'
    END as hospital,
    COUNT(*) as quantidade,
    string_agg(SUBSTRING(email FROM 1 FOR 15), ', ') as usuarios_exemplo
FROM user_profiles 
WHERE email LIKE '%@sigtap.com'
GROUP BY hospital_access[1]
ORDER BY hospital_access[1];

-- Exibir resumo por role
SELECT 
    'Usuários por Role' as categoria,
    role,
    COUNT(*) as quantidade,
    string_agg(SUBSTRING(email FROM 1 FOR 20), ', ') as usuarios_exemplo
FROM user_profiles 
WHERE email LIKE '%@sigtap.com'
GROUP BY role
ORDER BY 
    CASE role
        WHEN 'admin' THEN 1
        WHEN 'director' THEN 2
        WHEN 'coordinator' THEN 3
        WHEN 'auditor' THEN 4
        WHEN 'ti' THEN 5
        WHEN 'user' THEN 6
    END;

-- MENSAGEM FINAL
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 CONFIGURAÇÃO FINAL COMPLETA DE TODOS OS USUÁRIOS REAIS CONCLUÍDA!';
    RAISE NOTICE '';
    RAISE NOTICE '✅ CORREÇÕES APLICADAS:';
    RAISE NOTICE '   • Hospital CAR agora tem ID próprio (792a0316...)';
    RAISE NOTICE '   • Hospital FAX manteve ID original (019c7380...)';
    RAISE NOTICE '   • Email admin@sigtap.om corrigido para admin@sigtap.com';
    RAISE NOTICE '';
    RAISE NOTICE '🔒 SISTEMA DE PERMISSÕES ATIVO:';
    RAISE NOTICE '   • 24 usuários básicos com acesso limitado ao próprio hospital';
    RAISE NOTICE '   • 6 usuários elevados com acesso total (hospital_access = ALL)';
    RAISE NOTICE '   • RLS aplicado em todas as tabelas críticas';
    RAISE NOTICE '';
    RAISE NOTICE '🚀 PRÓXIMOS PASSOS:';
    RAISE NOTICE '   1. Teste login com diferentes usuários';
    RAISE NOTICE '   2. Verifique se users veem apenas seu hospital';
    RAISE NOTICE '   3. Confirme que admins veem todos os dados';
    RAISE NOTICE '   4. Sistema pronto para produção!';
    RAISE NOTICE '';
END $$; 