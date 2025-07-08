-- ============================================================================
-- CONFIGURAÇÃO DE PERMISSÕES PARA USUÁRIOS REAIS - SIGTAP BILLING WIZARD
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

-- 6. FUNÇÃO PARA EXTRAIR CÓDIGO DO HOSPITAL DO EMAIL
CREATE OR REPLACE FUNCTION extract_hospital_code_from_email(email_address TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Extrai o código após "faturamento." e antes do número ou @
    -- Ex: faturamento.car@sigtap.com -> car
    -- Ex: faturamento.frg01@sigtap.com -> frg
    RETURN (
        SELECT CASE 
            WHEN email_address ~ '^faturamento\.([a-z]+)(\d+)?@' THEN
                (regexp_match(email_address, '^faturamento\.([a-z]+)'))[1]
            ELSE 'unknown'
        END
    );
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- 7. CRIAR/ATUALIZAR HOSPITAIS BASEADO NOS CÓDIGOS DOS EMAILS
DO $$
DECLARE
    hospital_codes TEXT[] := ARRAY['car', 'cas', 'fax', 'foz', 'frg', 'sm', 'gua'];
    hospital_code TEXT;
    hospital_names TEXT[] := ARRAY[
        'Hospital Cardiologia', 
        'Hospital CAS', 
        'Hospital FAX', 
        'Hospital FOZ', 
        'Hospital FRG', 
        'Hospital SM', 
        'Hospital GUA'
    ];
    hospital_name TEXT;
    hospital_id UUID;
    i INTEGER := 1;
BEGIN
    RAISE NOTICE '🏥 CRIANDO/ATUALIZANDO HOSPITAIS BASEADO NOS CÓDIGOS...';
    
    FOREACH hospital_code IN ARRAY hospital_codes
    LOOP
        hospital_name := hospital_names[i];
        hospital_id := gen_random_uuid();
        
        -- Inserir ou atualizar hospital
        INSERT INTO hospitals (id, name, cnpj, address, city, state, habilitacoes, code) 
        VALUES (
            hospital_id,
            hospital_name,
            '12.345.678/000' || i || '-' || LPAD(i::text, 2, '0'),
            'Endereço ' || hospital_name,
            'Cidade ' || hospital_code,
            'SP',
            ARRAY['CARDIOLOGIA', 'NEUROLOGIA', 'ONCOLOGIA'],
            hospital_code
        )
        ON CONFLICT (code) DO UPDATE SET
            name = EXCLUDED.name,
            updated_at = NOW();
            
        RAISE NOTICE '✅ Hospital % (%) configurado', hospital_name, hospital_code;
        i := i + 1;
    END LOOP;
END $$;

-- 8. CONFIGURAR USUÁRIOS EXISTENTES COM BASE NOS EMAILS
DO $$
DECLARE
    user_emails TEXT[] := ARRAY[
        'faturamento.car@sigtap.com',
        'faturamento.car01@sigtap.com', 
        'faturamento.car02@sigtap.com',
        'faturamento.cas@sigtap.com',
        'faturamento.cas01@sigtap.com',
        'faturamento.cas02@sigtap.com',
        'faturamento.fax@sigtap.com',
        'faturamento.fax01@sigtap.com',
        'faturamento.fax02@sigtap.com',
        'faturamento.foz@sigtap.com',
        'faturamento.foz01@sigtap.com',
        'faturamento.foz02@sigtap.com',
        'faturamento.frg@sigtap.com',
        'faturamento.frg01@sigtap.com',
        'faturamento.frg02@sigtap.com',
        'faturamento.frg.03@sigtap.com',
        'faturamento.frg.04@sigtap.com',
        'faturamento.frg.05@sigtap.com',
        'faturamento.sm@sigtap.com',
        'faturamento.sm01@sigtap.com',
        'faturamento.sm02@sigtap.com',
        'faturamento.gua@sigtap.com',
        'faturamento.gua01@sigtap.com',
        'faturamento.gua02@sigtap.com'
    ];
    user_email TEXT;
    hospital_code TEXT;
    hospital_id UUID;
    user_role TEXT;
    user_name TEXT;
    user_permissions TEXT[];
BEGIN
    RAISE NOTICE '👥 CONFIGURANDO USUÁRIOS EXISTENTES...';
    
    FOREACH user_email IN ARRAY user_emails
    LOOP
        -- Extrair código do hospital
        hospital_code := extract_hospital_code_from_email(user_email);
        
        -- Buscar ID do hospital
        SELECT id INTO hospital_id 
        FROM hospitals 
        WHERE code = hospital_code 
        LIMIT 1;
        
        -- TODOS ESTES USUÁRIOS SÃO 'USER' BÁSICOS
        -- (roles elevados serão configurados posteriormente)
        user_role := 'user';
        
        -- Criar nome baseado no hospital e número (se houver)
        IF user_email ~ '\d' THEN
            user_name := 'Operador ' || UPPER(hospital_code) || ' ' || 
                       (regexp_match(user_email, '(\d+)'))[1];
        ELSE
            user_name := 'Operador ' || UPPER(hospital_code) || ' Principal';
        END IF;
        
        user_permissions := ARRAY['basic_access'];
        
        -- Atualizar ou inserir usuário
        UPDATE user_profiles SET
            role = user_role,
            full_name = user_name,
            hospital_access = ARRAY[hospital_id::text], -- Users só acessam seu hospital
            permissions = user_permissions,
            is_active = true,
            updated_at = NOW()
        WHERE email = user_email;
        
        -- Se não atualizou nenhuma linha, inserir novo
        IF NOT FOUND THEN
            INSERT INTO user_profiles (
                id, email, role, full_name, hospital_access, permissions, is_active
            ) VALUES (
                gen_random_uuid(),
                user_email,
                user_role,
                user_name,
                ARRAY[hospital_id::text], -- Users só acessam seu hospital
                user_permissions,
                true
            );
        END IF;
        
        RAISE NOTICE '✅ Usuário % configurado como % para hospital %', 
                    user_email, user_role, hospital_code;
    END LOOP;
END $$;

-- 9. NOVAS POLÍTICAS RLS PARA USER_PROFILES
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

-- 10. APLICAR RLS PARA OUTRAS TABELAS PRINCIPAIS

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
            id::text = ANY(
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
        is_basic_user() AND hospital_id::text = ANY(
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
        is_basic_user() AND hospital_id::text = ANY(
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
        is_basic_user() AND hospital_id::text = ANY(
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
            AND aihs.hospital_id::text = ANY(
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

-- 11. CRIAR USUÁRIO ADMIN GERAL (SE NÃO EXISTIR)
INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
VALUES (
    gen_random_uuid(), 
    'admin@sigtap.com', 
    'admin', 
    'Administrador Geral do Sistema', 
    ARRAY['ALL'], 
    ARRAY['all'], 
    true
)
ON CONFLICT (email) DO UPDATE SET
    role = 'admin',
    full_name = 'Administrador Geral do Sistema',
    hospital_access = ARRAY['ALL'],
    permissions = ARRAY['all'],
    is_active = true,
    updated_at = NOW();

-- 12. VERIFICAR CONFIGURAÇÃO FINAL
SELECT 
    'Usuários Configurados' as check_name,
    COUNT(*) as total,
    string_agg(DISTINCT role, ', ') as roles_encontrados
FROM user_profiles 
WHERE email LIKE '%@sigtap.com';

SELECT 
    'Hospitais por Código' as check_name,
    COUNT(*) as total,
    string_agg(code, ', ') as codigos
FROM hospitals 
WHERE code IS NOT NULL;

SELECT 
    'Políticas RLS' as check_name,
    COUNT(*) as total
FROM pg_policies 
WHERE tablename IN ('user_profiles', 'hospitals', 'patients', 'aihs', 'procedure_records', 'aih_matches', 'audit_logs');

-- MENSAGEM FINAL
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 CONFIGURAÇÃO PARA USUÁRIOS REAIS CONCLUÍDA!';
    RAISE NOTICE '';
    RAISE NOTICE '👥 USUÁRIOS BÁSICOS CONFIGURADOS (24 users):';
    RAISE NOTICE '   👤 USER: Todos os emails da lista fornecida';
    RAISE NOTICE '   🔵 ADMIN: admin@sigtap.com (criado automaticamente)';
    RAISE NOTICE '';
    RAISE NOTICE '🏥 HOSPITAIS CRIADOS POR CÓDIGO:';
    RAISE NOTICE '   • CAR - Hospital Cardiologia';
    RAISE NOTICE '   • CAS - Hospital CAS'; 
    RAISE NOTICE '   • FAX - Hospital FAX';
    RAISE NOTICE '   • FOZ - Hospital FOZ';
    RAISE NOTICE '   • FRG - Hospital FRG';
    RAISE NOTICE '   • SM - Hospital SM';
    RAISE NOTICE '   • GUA - Hospital GUA';
    RAISE NOTICE '';
    RAISE NOTICE '🔒 REGRAS DE ACESSO ATUAIS:';
    RAISE NOTICE '   • USERS: Acesso apenas ao próprio hospital';
    RAISE NOTICE '   • ADMIN: Acesso total ao sistema';
    RAISE NOTICE '';
    RAISE NOTICE '⏳ AGUARDANDO: Lista dos outros roles (coordinator, director, auditor, ti)';
    RAISE NOTICE '✅ Usuários básicos prontos! Envie a próxima lista.';
    RAISE NOTICE '';
END $$; 