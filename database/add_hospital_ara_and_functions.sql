-- ============================================================================
-- ADICIONAR HOSPITAL ARA E FUNÇÕES AUXILIARES - SIGTAP BILLING WIZARD
-- Sistema: SIGTAP Billing Wizard v3.0
-- ============================================================================

-- 1. ADICIONAR USUÁRIOS DO HOSPITAL ARA
DO $$
DECLARE
    user_hospital_mapping RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🏥 ADICIONANDO HOSPITAL ARA E USUÁRIOS...';
    RAISE NOTICE '=====================================';
    
    -- Hospital ARA: 01221e51-4bcd-4c45-b3d3-18d1df25c8f2
    FOR user_hospital_mapping IN 
        SELECT email, '01221e51-4bcd-4c45-b3d3-18d1df25c8f2'::uuid as hospital_id, 'ARA' as hospital_name
        FROM (VALUES 
            ('faturamento.ara@sigtap.com'),
            ('faturamento.ara01@sigtap.com'),
            ('faturamento.ara02@sigtap.com')
        ) AS t(email)
    LOOP
        INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
        VALUES (
            gen_random_uuid(),
            user_hospital_mapping.email,
            'user',
            'Operador ARA' || CASE 
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
            
        RAISE NOTICE '✅ Configurado: % -> Hospital ARA (ID: %)', 
                    user_hospital_mapping.email, user_hospital_mapping.hospital_id;
    END LOOP;
    
END $$;

-- 2. CRIAR FUNÇÃO user_has_hospital_access() PARA VERIFICAR ACESSO
CREATE OR REPLACE FUNCTION user_has_hospital_access(target_hospital_id UUID, user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
    user_role TEXT;
    user_hospital_list TEXT[];
BEGIN
    -- Buscar role e hospital_access do usuário
    SELECT role, hospital_access 
    INTO user_role, user_hospital_list
    FROM user_profiles 
    WHERE id = user_id AND is_active = true;
    
    -- Se usuário não encontrado, negar acesso
    IF user_role IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Roles especiais têm acesso a todos os hospitais
    IF user_role IN ('admin', 'auditoria', 'coordenacao', 'diretoria', 'medicos', 'ti', 'developer', 'coordinator', 'director', 'auditor') THEN
        RETURN TRUE;
    END IF;
    
    -- Usuários básicos verificam hospital_access
    IF user_role = 'user' THEN
        -- Verificar se tem acesso ALL ou ao hospital específico
        RETURN 'ALL' = ANY(user_hospital_list) OR target_hospital_id::text = ANY(user_hospital_list);
    END IF;
    
    -- Caso não identificado, negar acesso
    RETURN FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. CRIAR FUNÇÃO PARA OBTER HOSPITAIS ACESSÍVEIS PELO USUÁRIO
CREATE OR REPLACE FUNCTION get_user_accessible_hospitals(user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
    hospital_id UUID,
    hospital_name TEXT,
    hospital_code TEXT
) AS $$
DECLARE
    user_role TEXT;
    user_hospital_list TEXT[];
BEGIN
    -- Buscar role e hospital_access do usuário
    SELECT role, hospital_access 
    INTO user_role, user_hospital_list
    FROM user_profiles 
    WHERE id = user_id AND is_active = true;
    
    -- Se usuário não encontrado, retornar vazio
    IF user_role IS NULL THEN
        RETURN;
    END IF;
    
    -- Roles especiais veem todos os hospitais
    IF user_role IN ('admin', 'auditoria', 'coordenacao', 'diretoria', 'medicos', 'ti', 'developer', 'coordinator', 'director', 'auditor') THEN
        RETURN QUERY
        SELECT h.id, h.name, 
               CASE h.id::text
                   WHEN '792a0316-92b4-4504-8238-491d284099a3' THEN 'CAR'
                   WHEN '1d8ca73a-1927-462e-91c0-fa7004d0b377' THEN 'CAS'
                   WHEN '019c7380-459d-4aa5-bbd8-2dba4f361e7e' THEN 'FAX'
                   WHEN '47eddf6e-ac64-4433-acc1-7b644a2b43d0' THEN 'FOZ'
                   WHEN 'a8978eaa-b90e-4dc8-8fd5-0af984374d34' THEN 'FRG'
                   WHEN '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b' THEN 'SM'
                   WHEN '1218dd7b-efcb-442e-ad2b-b72d04128cb9' THEN 'GUA'
                   WHEN '01221e51-4bcd-4c45-b3d3-18d1df25c8f2' THEN 'ARA'
                   ELSE 'N/A'
               END as hospital_code
        FROM hospitals h
        ORDER BY h.name;
    ELSE
        -- Usuários básicos veem apenas seus hospitais
        RETURN QUERY
        SELECT h.id, h.name,
               CASE h.id::text
                   WHEN '792a0316-92b4-4504-8238-491d284099a3' THEN 'CAR'
                   WHEN '1d8ca73a-1927-462e-91c0-fa7004d0b377' THEN 'CAS'
                   WHEN '019c7380-459d-4aa5-bbd8-2dba4f361e7e' THEN 'FAX'
                   WHEN '47eddf6e-ac64-4433-acc1-7b644a2b43d0' THEN 'FOZ'
                   WHEN 'a8978eaa-b90e-4dc8-8fd5-0af984374d34' THEN 'FRG'
                   WHEN '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b' THEN 'SM'
                   WHEN '1218dd7b-efcb-442e-ad2b-b72d04128cb9' THEN 'GUA'
                   WHEN '01221e51-4bcd-4c45-b3d3-18d1df25c8f2' THEN 'ARA'
                   ELSE 'N/A'
               END as hospital_code
        FROM hospitals h
        WHERE h.id::text = ANY(user_hospital_list)
        ORDER BY h.name;
    END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. CRIAR FUNÇÃO PARA OBTER INFORMAÇÕES DO USUÁRIO ATUAL
CREATE OR REPLACE FUNCTION get_current_user_info(user_id UUID DEFAULT auth.uid())
RETURNS TABLE (
    user_id UUID,
    email TEXT,
    role TEXT,
    full_name TEXT,
    hospital_access TEXT[],
    permissions TEXT[],
    is_admin BOOLEAN,
    has_full_access BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        up.id,
        up.email,
        up.role,
        up.full_name,
        up.hospital_access,
        up.permissions,
        up.role IN ('admin', 'developer') as is_admin,
        up.role IN ('admin', 'auditoria', 'coordenacao', 'diretoria', 'medicos', 'ti', 'developer', 'coordinator', 'director', 'auditor') as has_full_access
    FROM user_profiles up
    WHERE up.id = user_id AND up.is_active = true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. CRIAR VIEW PARA MAPEAMENTO DE HOSPITAIS (para facilitar consultas)
CREATE OR REPLACE VIEW v_hospital_mapping AS
SELECT 
    h.id as hospital_id,
    h.name as hospital_name,
    CASE h.id::text
        WHEN '792a0316-92b4-4504-8238-491d284099a3' THEN 'CAR'
        WHEN '1d8ca73a-1927-462e-91c0-fa7004d0b377' THEN 'CAS'
        WHEN '019c7380-459d-4aa5-bbd8-2dba4f361e7e' THEN 'FAX'
        WHEN '47eddf6e-ac64-4433-acc1-7b644a2b43d0' THEN 'FOZ'
        WHEN 'a8978eaa-b90e-4dc8-8fd5-0af984374d34' THEN 'FRG'
        WHEN '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b' THEN 'SM'
        WHEN '1218dd7b-efcb-442e-ad2b-b72d04128cb9' THEN 'GUA'
        WHEN '01221e51-4bcd-4c45-b3d3-18d1df25c8f2' THEN 'ARA'
        ELSE 'UNKNOWN'
    END as hospital_code,
    CASE h.id::text
        WHEN '792a0316-92b4-4504-8238-491d284099a3' THEN 'CAR'
        WHEN '1d8ca73a-1927-462e-91c0-fa7004d0b377' THEN 'CAS'
        WHEN '019c7380-459d-4aa5-bbd8-2dba4f361e7e' THEN 'FAX'
        WHEN '47eddf6e-ac64-4433-acc1-7b644a2b43d0' THEN 'FOZ'
        WHEN 'a8978eaa-b90e-4dc8-8fd5-0af984374d34' THEN 'FRG'
        WHEN '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b' THEN 'SM'
        WHEN '1218dd7b-efcb-442e-ad2b-b72d04128cb9' THEN 'GUA'
        WHEN '01221e51-4bcd-4c45-b3d3-18d1df25c8f2' THEN 'ARA'
        ELSE 'UNKNOWN'
    END as standard_code
FROM hospitals h;

-- 6. VERIFICAR CONFIGURAÇÃO COMPLETA
SELECT 
    'Hospital ARA adicionado' as status,
    COUNT(*) as usuarios_ara
FROM user_profiles 
WHERE email LIKE '%ara%@sigtap.com';

-- Verificar todas as funções criadas
SELECT 
    'Funções criadas' as status,
    COUNT(*) as total_funcoes
FROM pg_proc 
WHERE proname IN ('user_has_hospital_access', 'get_user_accessible_hospitals', 'get_current_user_info');

-- 7. TESTAR FUNÇÕES COM DADOS REAIS
DO $$
DECLARE
    test_user_id UUID;
    test_hospital_id UUID := '792a0316-92b4-4504-8238-491d284099a3'::uuid; -- Hospital CAR
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTANDO FUNÇÕES COM DADOS REAIS...';
    RAISE NOTICE '===================================';
    
    -- Buscar um usuário user básico
    SELECT id INTO test_user_id 
    FROM user_profiles 
    WHERE role = 'user' AND email LIKE '%car%' 
    LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        -- Testar função de acesso
        RAISE NOTICE '✅ Usuário CAR tem acesso ao Hospital CAR: %', 
                    user_has_hospital_access(test_hospital_id, test_user_id);
        
        -- Testar com hospital diferente
        RAISE NOTICE '✅ Usuário CAR tem acesso ao Hospital CAS: %', 
                    user_has_hospital_access('1d8ca73a-1927-462e-91c0-fa7004d0b377'::uuid, test_user_id);
    ELSE
        RAISE NOTICE '⚠️ Usuário CAR não encontrado para teste';
    END IF;
    
    -- Buscar usuário admin
    SELECT id INTO test_user_id 
    FROM user_profiles 
    WHERE role = 'admin' 
    LIMIT 1;
    
    IF test_user_id IS NOT NULL THEN
        RAISE NOTICE '✅ Admin tem acesso ao Hospital CAR: %', 
                    user_has_hospital_access(test_hospital_id, test_user_id);
    ELSE
        RAISE NOTICE '⚠️ Admin não encontrado para teste';
    END IF;
    
END $$;

-- MENSAGEM FINAL
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 HOSPITAL ARA E FUNÇÕES AUXILIARES CONFIGURADOS!';
    RAISE NOTICE '';
    RAISE NOTICE '📋 FUNÇÕES CRIADAS PARA O FRONTEND:';
    RAISE NOTICE '   • user_has_hospital_access(hospital_id, user_id)';
    RAISE NOTICE '   • get_user_accessible_hospitals(user_id)';
    RAISE NOTICE '   • get_current_user_info(user_id)';
    RAISE NOTICE '';
    RAISE NOTICE '🏥 HOSPITAIS CONFIGURADOS (8 total):';
    RAISE NOTICE '   • CAR: 792a0316-92b4-4504-8238-491d284099a3';
    RAISE NOTICE '   • CAS: 1d8ca73a-1927-462e-91c0-fa7004d0b377';
    RAISE NOTICE '   • FAX: 019c7380-459d-4aa5-bbd8-2dba4f361e7e';
    RAISE NOTICE '   • FOZ: 47eddf6e-ac64-4433-acc1-7b644a2b43d0';
    RAISE NOTICE '   • FRG: a8978eaa-b90e-4dc8-8fd5-0af984374d34';
    RAISE NOTICE '   • SM:  68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b';
    RAISE NOTICE '   • GUA: 1218dd7b-efcb-442e-ad2b-b72d04128cb9';
    RAISE NOTICE '   • ARA: 01221e51-4bcd-4c45-b3d3-18d1df25c8f2 (NOVO)';
    RAISE NOTICE '';
    RAISE NOTICE '👥 TOTAL DE USUÁRIOS: 33 (27 users + 6 roles elevados)';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Sistema pronto para implementação no frontend!';
    RAISE NOTICE '';
END $$; 