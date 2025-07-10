-- ============================================================================
-- CONFIGURAÇÃO HOSPITAL TORAO TOKUDA (APU) - SIGTAP BILLING WIZARD
-- Sistema: SIGTAP Billing Wizard v3.0
-- Data: Janeiro 2025
-- ============================================================================

DO $$
DECLARE
    hospital_apu_id UUID;
    user_hospital_mapping RECORD;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🏥 === CONFIGURANDO HOSPITAL TORAO TOKUDA (APU) ===';
    RAISE NOTICE '';

    -- 1. VERIFICAR SE O HOSPITAL JÁ EXISTE
    SELECT id INTO hospital_apu_id
    FROM hospitals 
    WHERE name ILIKE '%torao tokuda%' OR cnpj = '99999999999999'
    LIMIT 1;

    IF hospital_apu_id IS NOT NULL THEN
        RAISE NOTICE '✅ Hospital Torao Tokuda já existe com ID: %', hospital_apu_id;
    ELSE
        -- 2. CRIAR O HOSPITAL SE NÃO EXISTIR
        INSERT INTO hospitals (
            id,
            name,
            cnpj,
            city,
            state,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            gen_random_uuid(),
            'Hospital Torao Tokuda',
            '99999999999999',
            'Apucarana',
            'PR',
            true,
            NOW(),
            NOW()
        )
        RETURNING id INTO hospital_apu_id;
        
        RAISE NOTICE '🆕 Hospital Torao Tokuda criado com ID: %', hospital_apu_id;
    END IF;

    -- 3. CONFIGURAR OS 3 USUÁRIOS DO HOSPITAL TORAO TOKUDA
    RAISE NOTICE '';
    RAISE NOTICE '👥 Configurando usuários do Hospital Torao Tokuda...';
    
    FOR user_hospital_mapping IN 
        SELECT email, hospital_apu_id as hospital_id, 'APU' as hospital_code
        FROM (VALUES 
            ('faturamento.apu@sigtap.com'),
            ('faturamento.apu01@sigtap.com'),
            ('faturamento.apu02@sigtap.com')
        ) AS t(email)
    LOOP
        INSERT INTO user_profiles (id, email, role, full_name, hospital_access, permissions, is_active)
        VALUES (
            gen_random_uuid(),
            user_hospital_mapping.email,
            'user',
            'Operador APU' || CASE 
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
            
        RAISE NOTICE '✅ Configurado: % -> Hospital APU (ID: %)', 
                    user_hospital_mapping.email, user_hospital_mapping.hospital_id;
    END LOOP;

    -- 4. ATUALIZAR AS FUNÇÕES SQL PARA INCLUIR O NOVO HOSPITAL
    RAISE NOTICE '';
    RAISE NOTICE '🔧 Atualizando funções SQL...';
    
    -- Recriar função get_user_accessible_hospitals com o novo hospital
    CREATE OR REPLACE FUNCTION get_user_accessible_hospitals(user_id UUID DEFAULT auth.uid())
    RETURNS TABLE (
        hospital_id UUID,
        hospital_name TEXT,
        hospital_code TEXT
    ) AS $func$
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
                       WHEN hospital_apu_id::text THEN 'APU'
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
                       WHEN hospital_apu_id::text THEN 'APU'
                       ELSE 'N/A'
                   END as hospital_code
            FROM hospitals h
            WHERE h.id::text = ANY(user_hospital_list)
            ORDER BY h.name;
        END IF;
    END;
    $func$ LANGUAGE plpgsql SECURITY DEFINER;

    -- 5. VERIFICAÇÃO FINAL
    RAISE NOTICE '';
    RAISE NOTICE '🧪 === VERIFICAÇÃO FINAL ===';
    
    -- Verificar hospital criado
    SELECT name, cnpj, city INTO user_hospital_mapping
    FROM hospitals 
    WHERE id = hospital_apu_id;
    
    RAISE NOTICE '✅ Hospital: % (CNPJ: %) em %', 
                user_hospital_mapping.email, user_hospital_mapping.hospital_id, user_hospital_mapping.hospital_code;
    
    -- Verificar usuários criados
    FOR user_hospital_mapping IN 
        SELECT email, role, full_name, is_active
        FROM user_profiles 
        WHERE email LIKE '%apu%@sigtap.com'
        ORDER BY email
    LOOP
        RAISE NOTICE '✅ Usuário: % (%) - Ativo: %', 
                    user_hospital_mapping.email, 
                    user_hospital_mapping.full_name,
                    user_hospital_mapping.is_active;
    END LOOP;

    -- Contar totais
    RAISE NOTICE '';
    RAISE NOTICE '📊 === RESUMO FINAL ===';
    RAISE NOTICE '🏥 Hospitais ativos: %', (SELECT COUNT(*) FROM hospitals WHERE is_active = true);
    RAISE NOTICE '👤 Usuários APU: %', (SELECT COUNT(*) FROM user_profiles WHERE email LIKE '%apu%@sigtap.com' AND is_active = true);
    RAISE NOTICE '👥 Total usuários: %', (SELECT COUNT(*) FROM user_profiles WHERE is_active = true);
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 === CONFIGURAÇÃO DO HOSPITAL TORAO TOKUDA CONCLUÍDA ===';
    RAISE NOTICE '';

END $$; 