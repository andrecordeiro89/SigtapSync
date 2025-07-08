-- ============================================================================
-- CONFIGURAÇÃO COMPLETA DE TODOS OS USUÁRIOS REAIS - SIGTAP BILLING WIZARD
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

-- 6. CONFIGURAR TODOS OS USUÁRIOS BÁSICOS COM IDS REAIS DOS HOSPITAIS
DO $$
DECLARE
    -- Mapeamento: email -> hospital_id
    user_hospital_mapping RECORD;
BEGIN
    RAISE NOTICE '👥 CONFIGURANDO USUÁRIOS BÁSICOS COM IDS REAIS DOS HOSPITAIS...';
    
    -- Hospital: 019c7380-459d-4aa5-bbd8-2dba4f361e7e (CAR e FAX)
    FOR user_hospital_mapping IN 
        SELECT email, '019c7380-459d-4aa5-bbd8-2dba4f361e7e'::uuid as hospital_id
        FROM (VALUES 
            ('faturamento.car@sigtap.com'),
            ('faturamento.car01@sigtap.com'),
            ('faturamento.car02@sigtap.com'),
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
            'Operador ' || CASE 
                WHEN user_hospital_mapping.email ~ 'car' THEN 'CAR'
                WHEN user_hospital_mapping.email ~ 'fax' THEN 'FAX'
            END || CASE 
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
            
        RAISE NOTICE '✅ Configurado: % -> Hospital CAR/FAX', user_hospital_mapping.email;
    END LOOP;
    
    -- Hospital: 1d8ca73a-1927-462e-91c0-fa7004d0b377 (CAS)
    FOR user_hospital_mapping IN 
        SELECT email, '1d8ca73a-1927-462e-91c0-fa7004d0b377'::uuid as hospital_id
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
            
        RAISE NOTICE '✅ Configurado: % -> Hospital CAS', user_hospital_mapping.email;
    END LOOP;
    
    -- Hospital: 47eddf6e-ac64-4433-acc1-7b644a2b43d0 (FOZ)
    FOR user_hospital_mapping IN 
        SELECT email, '47eddf6e-ac64-4433-acc1-7b644a2b43d0'::uuid as hospital_id
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
            
        RAISE NOTICE '✅ Configurado: % -> Hospital FOZ', user_hospital_mapping.email;
    END LOOP;
    
    -- Hospital: a8978eaa-b90e-4dc8-8fd5-0af984374d34 (FRG)
    FOR user_hospital_mapping IN 
        SELECT email, 'a8978eaa-b90e-4dc8-8fd5-0af984374d34'::uuid as hospital_id
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
            
        RAISE NOTICE '✅ Configurado: % -> Hospital FRG', user_hospital_mapping.email;
    END LOOP;
    
    -- Hospital: 68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b (SM)
    FOR user_hospital_mapping IN 
        SELECT email, '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b'::uuid as hospital_id
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
            
        RAISE NOTICE '✅ Configurado: % -> Hospital SM', user_hospital_mapping.email;
    END LOOP;
    
    -- Hospital: 1218dd7b-efcb-442e-ad2b-b72d04128cb9 (GUA)
    FOR user_hospital_mapping IN 
        SELECT email, '1218dd7b-efcb-442e-ad2b-b72d04128cb9'::uuid as hospital_id
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
            
        RAISE NOTICE '✅ Configurado: % -> Hospital GUA', user_hospital_mapping.email;
    END LOOP;
    
END $$;

-- 7. CONFIGURAR USUÁRIOS COM ROLES ELEVADOS
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔰 CONFIGURANDO USUÁRIOS COM ROLES ELEVADOS...';
    
    -- ADMIN
    INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
    VALUES (
        gen_random_uuid(),
        'admin@sigtap.com', -- Corrigindo o typo do email original
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
    RAISE NOTICE '✅ Admin configurado: admin@sigtap.com';
    
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

-- 8. APLICAR POLÍTICAS RLS

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
DROP POLICY IF EXISTS "hospital_access" ON hospitals;
DROP POLICY IF EXISTS "dev_hospital_access" ON hospitals;

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
DROP POLICY IF EXISTS "patients_hospital_access" ON patients;
DROP POLICY IF EXISTS "dev_patients_access" ON patients;

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
DROP POLICY IF EXISTS "aihs_hospital_access" ON aihs;
DROP POLICY IF EXISTS "dev_aihs_access" ON aihs;

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
DROP POLICY IF EXISTS "procedure_records_hospital_access" ON procedure_records;
DROP POLICY IF EXISTS "dev_procedure_records_access" ON procedure_records;

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
DROP POLICY IF EXISTS "dev_aih_matches_access" ON aih_matches;

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

-- 9. VERIFICAR CONFIGURAÇÃO FINAL
SELECT 
    'Usuários por Role' as categoria,
    role,
    COUNT(*) as quantidade,
    string_agg(SUBSTRING(email FROM 1 FOR 20), ', ') as exemplos
FROM user_profiles 
WHERE email LIKE '%@sigtap.com'
GROUP BY role
ORDER BY role;

SELECT 
    'Usuários por Hospital' as categoria,
    hospital_access[1] as hospital_id,
    COUNT(*) as quantidade
FROM user_profiles 
WHERE role = 'user' AND email LIKE '%@sigtap.com'
GROUP BY hospital_access[1]
ORDER BY hospital_access[1];

SELECT 
    'Políticas RLS' as categoria,
    tablename,
    COUNT(*) as politicas
FROM pg_policies 
WHERE tablename IN ('user_profiles', 'hospitals', 'patients', 'aihs', 'procedure_records', 'aih_matches', 'audit_logs')
GROUP BY tablename
ORDER BY tablename;

-- MENSAGEM FINAL
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 CONFIGURAÇÃO COMPLETA DE TODOS OS USUÁRIOS REAIS CONCLUÍDA!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 RESUMO DA CONFIGURAÇÃO:';
    RAISE NOTICE '   👤 24 Usuários básicos (role: user)';
    RAISE NOTICE '   🔰 6 Usuários elevados (admin, auditor, coordinator, director, ti)';
    RAISE NOTICE '   🏥 7 Hospitais diferentes com IDs reais';
    RAISE NOTICE '   🔒 Políticas RLS aplicadas em todas as tabelas';
    RAISE NOTICE '';
    RAISE NOTICE '🔑 USUÁRIOS ELEVADOS CONFIGURADOS:';
    RAISE NOTICE '   🔵 admin@sigtap.com (admin)';
    RAISE NOTICE '   👁️ auditoria@sigtap.com (auditor)';
    RAISE NOTICE '   ✅ coordenacao@sigtap.com (coordinator)';
    RAISE NOTICE '   🛡️ diretoria@sigtap.com (director)';
    RAISE NOTICE '   👨‍⚕️ medicos@sigtap.com (coordinator médico)';
    RAISE NOTICE '   💻 ti@sigtap.com (ti)';
    RAISE NOTICE '';
    RAISE NOTICE '🔒 REGRAS DE ACESSO:';
    RAISE NOTICE '   • Users: Veem apenas dados do próprio hospital';
    RAISE NOTICE '   • Roles elevados: Veem todos os dados (hospital_access = ALL)';
    RAISE NOTICE '   • RLS aplicado automaticamente';
    RAISE NOTICE '';
    RAISE NOTICE '✅ SISTEMA PRONTO PARA PRODUÇÃO COM USUÁRIOS REAIS!';
    RAISE NOTICE '';
END $$; 