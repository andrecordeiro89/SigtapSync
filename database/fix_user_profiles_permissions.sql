-- ============================================================================
-- CORREÇÃO COMPLETA DE PERMISSÕES - USER_PROFILES
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

-- 6. NOVAS POLÍTICAS RLS PARA USER_PROFILES
-- Usuários básicos só veem seu próprio perfil
CREATE POLICY "basic_users_own_profile" ON user_profiles
    FOR ALL USING (
        auth.uid() = id AND is_basic_user()
    );

-- Usuários com acesso total veem todos os perfis
CREATE POLICY "full_access_all_profiles" ON user_profiles
    FOR ALL USING (
        has_full_access_role()
    );

-- Service role tem acesso total (para operações do sistema)
CREATE POLICY "service_role_access" ON user_profiles
    FOR ALL USING (
        auth.jwt() ->> 'role' = 'service_role'
    );

-- 7. APLICAR RLS PARA OUTRAS TABELAS PRINCIPAIS

-- HOSPITALS: Users só veem hospitais do seu acesso, outros veem todos
DROP POLICY IF EXISTS "hospital_access" ON hospitals;
DROP POLICY IF EXISTS "dev_hospital_access" ON hospitals;

CREATE POLICY "hospital_full_access" ON hospitals
    FOR ALL USING (
        has_full_access_role() OR auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY "hospital_user_access" ON hospitals
    FOR SELECT USING (
        is_basic_user() AND (
            id = ANY(
                SELECT unnest(hospital_access) 
                FROM user_profiles 
                WHERE user_profiles.id = auth.uid()
            )
        )
    );

-- PATIENTS: Users só veem pacientes do seu hospital, outros veem todos
DROP POLICY IF EXISTS "patients_hospital_access" ON patients;
DROP POLICY IF EXISTS "dev_patients_access" ON patients;

CREATE POLICY "patients_full_access" ON patients
    FOR ALL USING (
        has_full_access_role() OR auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY "patients_user_hospital" ON patients
    FOR ALL USING (
        is_basic_user() AND hospital_id = ANY(
            SELECT unnest(hospital_access) 
            FROM user_profiles 
            WHERE user_profiles.id = auth.uid()
        )
    );

-- AIHS: Users só veem AIHs do seu hospital, outros veem todas
DROP POLICY IF EXISTS "aihs_hospital_access" ON aihs;
DROP POLICY IF EXISTS "dev_aihs_access" ON aihs;

CREATE POLICY "aihs_full_access" ON aihs
    FOR ALL USING (
        has_full_access_role() OR auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY "aihs_user_hospital" ON aihs
    FOR ALL USING (
        is_basic_user() AND hospital_id = ANY(
            SELECT unnest(hospital_access) 
            FROM user_profiles 
            WHERE user_profiles.id = auth.uid()
        )
    );

-- PROCEDURE_RECORDS: Users só veem procedimentos do seu hospital, outros veem todos
DROP POLICY IF EXISTS "procedure_records_hospital_access" ON procedure_records;
DROP POLICY IF EXISTS "dev_procedure_records_access" ON procedure_records;

CREATE POLICY "procedure_records_full_access" ON procedure_records
    FOR ALL USING (
        has_full_access_role() OR auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY "procedure_records_user_hospital" ON procedure_records
    FOR ALL USING (
        is_basic_user() AND hospital_id = ANY(
            SELECT unnest(hospital_access) 
            FROM user_profiles 
            WHERE user_profiles.id = auth.uid()
        )
    );

-- AIH_MATCHES: Users só veem matches de AIHs do seu hospital, outros veem todos
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
            AND aihs.hospital_id = ANY(
                SELECT unnest(hospital_access) 
                FROM user_profiles 
                WHERE user_profiles.id = auth.uid()
            )
        )
    );

-- AUDIT_LOGS: Users só veem próprios logs, outros veem todos
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "audit_logs_full_access" ON audit_logs
    FOR ALL USING (
        has_full_access_role() OR auth.jwt() ->> 'role' = 'service_role'
    );

CREATE POLICY "audit_logs_own_actions" ON audit_logs
    FOR SELECT USING (
        is_basic_user() AND user_id = auth.uid()
    );

-- 8. CRIAR USUÁRIOS DEMO COM TODOS OS ROLES
INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
VALUES 
    (gen_random_uuid(), 'developer@sigtap.com', 'developer', 'Desenvolvedor Sistema', ARRAY['ALL'], ARRAY['all'], true),
    (gen_random_uuid(), 'admin@sigtap.com', 'admin', 'Administrador Geral', ARRAY['ALL'], ARRAY['admin_access', 'generate_reports'], true),
    (gen_random_uuid(), 'director@sigtap.com', 'director', 'Diretor Executivo', ARRAY['ALL'], ARRAY['executive_access', 'generate_reports'], true),
    (gen_random_uuid(), 'coordinator@sigtap.com', 'coordinator', 'Coordenador Geral', ARRAY['ALL'], ARRAY['coordination_access', 'generate_reports'], true),
    (gen_random_uuid(), 'auditor@sigtap.com', 'auditor', 'Auditor do Sistema', ARRAY['ALL'], ARRAY['audit_access', 'view_all_data'], true),
    (gen_random_uuid(), 'ti@sigtap.com', 'ti', 'Suporte TI', ARRAY['ALL'], ARRAY['technical_access', 'system_config'], true),
    (gen_random_uuid(), 'user@hospital1.com', 'user', 'Operador Hospital 1', ARRAY['a0000000-0000-0000-0000-000000000001'], ARRAY['basic_access'], true)
ON CONFLICT (email) DO UPDATE SET
    role = EXCLUDED.role,
    full_name = EXCLUDED.full_name,
    hospital_access = EXCLUDED.hospital_access,
    permissions = EXCLUDED.permissions,
    updated_at = NOW();

-- 9. VERIFICAR CONFIGURAÇÃO
SELECT 
    'Estrutura user_profiles' as check_name,
    CASE WHEN EXISTS(
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'user_profiles' 
        AND column_name IN ('temp_password_set', 'migrated_to_auth')
    ) THEN '✅ OK' ELSE '❌ MISSING' END as status;

SELECT 
    'Políticas RLS' as check_name,
    CASE WHEN (
        SELECT COUNT(*) FROM pg_policies 
        WHERE tablename = 'user_profiles'
    ) >= 3 THEN '✅ OK' ELSE '❌ INCOMPLETE' END as status;

SELECT 
    'Usuários Demo' as check_name,
    CASE WHEN (
        SELECT COUNT(DISTINCT role) FROM user_profiles 
        WHERE email LIKE '%@sigtap.com'
    ) >= 6 THEN '✅ OK' ELSE '⚠️ PARTIAL' END as status;

-- MENSAGEM FINAL
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔐 CONFIGURAÇÃO DE PERMISSÕES CONCLUÍDA!';
    RAISE NOTICE '';
    RAISE NOTICE '👥 HIERARQUIA DE ACESSO:';
    RAISE NOTICE '   🟣 DEVELOPER: Acesso total + código';
    RAISE NOTICE '   🔵 ADMIN: Acesso administrativo total';
    RAISE NOTICE '   🛡️ DIRECTOR: Acesso executivo total';
    RAISE NOTICE '   ✅ COORDINATOR: Acesso supervisão total';
    RAISE NOTICE '   👁️ AUDITOR: Acesso monitoramento total';
    RAISE NOTICE '   💻 TI: Acesso técnico total';
    RAISE NOTICE '   👤 USER: Acesso limitado ao próprio hospital';
    RAISE NOTICE '';
    RAISE NOTICE '🔒 REGRAS RLS APLICADAS:';
    RAISE NOTICE '   • Users: Veem apenas seus dados';
    RAISE NOTICE '   • Outros roles: Veem todos os dados';
    RAISE NOTICE '   • Service role: Acesso total sempre';
    RAISE NOTICE '';
END $$; 