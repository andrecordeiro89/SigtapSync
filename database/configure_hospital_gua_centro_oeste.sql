-- ============================================================================
-- CONFIGURAÇÃO HOSPITAL REGIONAL CENTRO OESTE (GUA) - SIGTAP BILLING WIZARD
-- Sistema: SIGTAP Billing Wizard v3.0
-- Data: Janeiro 2025
-- Descrição: Adiciona Hospital Regional Centro Oeste de Guarapuava/PR
-- ============================================================================

DO $$
DECLARE
    hospital_gua_id UUID := '1218dd7b-efcb-442e-ad2b-b72d04128cb9';
    user_record RECORD;
    hospital_exists BOOLEAN := FALSE;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🏥 === CONFIGURANDO HOSPITAL REGIONAL CENTRO OESTE (GUA) ===';
    RAISE NOTICE '';

    -- 1. VERIFICAR SE O HOSPITAL JÁ EXISTE
    SELECT true INTO hospital_exists
    FROM hospitals 
    WHERE id = hospital_gua_id;

    IF hospital_exists THEN
        RAISE NOTICE '✅ Hospital Regional Centro Oeste já existe com ID: %', hospital_gua_id;
    ELSE
        -- 2. CRIAR O HOSPITAL SE NÃO EXISTIR
        INSERT INTO hospitals (
            id,
            name,
            cnpj,
            address,
            city,
            state,
            zip_code,
            phone,
            email,
            habilitacoes,
            is_active,
            created_at,
            updated_at
        ) VALUES (
            hospital_gua_id,
            'Hospital Regional Centro Oeste',
            '12345678000190',
            'Rua Senador Pinheiro Machado, 1000',
            'Guarapuava',
            'PR',
            '85010-000',
            '(42) 3035-5000',
            'contato@hrco-gua.com.br',
            ARRAY['MAC', 'URGENCIA', 'INTERNACAO', 'CIRURGIA', 'UTI'],
            true,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE '🆕 Hospital Regional Centro Oeste criado com ID: %', hospital_gua_id;
    END IF;

    -- 3. CONFIGURAR USUÁRIOS PARA O HOSPITAL GUA
    RAISE NOTICE '👥 Configurando usuários para Hospital Regional Centro Oeste...';
    
    -- Array de usuários do hospital GUA
    FOR user_record IN 
        SELECT unnest(ARRAY[
            'faturamento.gua@sigtap.com',
            'faturamento.gua01@sigtap.com', 
            'faturamento.gua02@sigtap.com'
        ]) as email
    LOOP
        -- Verificar se usuário já existe
        IF EXISTS (SELECT 1 FROM user_profiles WHERE email = user_record.email) THEN
            -- Atualizar acesso ao hospital se necessário
            UPDATE user_profiles 
            SET 
                hospital_access = CASE 
                    WHEN 'ALL' = ANY(hospital_access) THEN hospital_access
                    WHEN hospital_gua_id::text = ANY(hospital_access) THEN hospital_access
                    ELSE array_append(hospital_access, hospital_gua_id::text)
                END,
                updated_at = NOW()
            WHERE email = user_record.email;
            
            RAISE NOTICE '✅ Usuário % atualizado com acesso ao hospital GUA', user_record.email;
        ELSE
            -- Criar novo usuário
            INSERT INTO user_profiles (
                id,
                email,
                role,
                full_name,
                hospital_access,
                permissions,
                is_active,
                created_at,
                updated_at
            ) VALUES (
                gen_random_uuid(),
                user_record.email,
                'user',
                'Operador ' || SPLIT_PART(user_record.email, '@', 1),
                ARRAY[hospital_gua_id::text],
                ARRAY['basic_access'],
                true,
                NOW(),
                NOW()
            );
            
            RAISE NOTICE '🆕 Usuário % criado com acesso ao hospital GUA', user_record.email;
        END IF;
    END LOOP;

    -- 4. ATUALIZAR FUNÇÃO get_user_hospitals PARA INCLUIR GUA
    RAISE NOTICE '🔧 Atualizando função get_user_hospitals...';
    
    CREATE OR REPLACE FUNCTION get_user_hospitals(user_id UUID)
    RETURNS TABLE(hospital_id UUID, hospital_name TEXT, hospital_code TEXT) AS $$
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
            -- Usuários normais veem apenas hospitais autorizados
            IF 'ALL' = ANY(user_hospital_list) THEN
                -- Se tem acesso 'ALL', retornar todos os hospitais
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
                -- Retornar apenas hospitais específicos do usuário
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
        END IF;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;

    -- 5. VERIFICAÇÃO FINAL
    RAISE NOTICE '';
    RAISE NOTICE '🔍 === VERIFICAÇÃO FINAL ===';
    
    -- Verificar hospital criado
    SELECT name INTO user_record
    FROM hospitals 
    WHERE id = hospital_gua_id;
    
    IF FOUND THEN
        RAISE NOTICE '✅ Hospital: %', user_record;
    ELSE
        RAISE NOTICE '❌ Hospital não encontrado!';
    END IF;
    
    -- Verificar usuários criados
    FOR user_record IN 
        SELECT email, role, hospital_access
        FROM user_profiles 
        WHERE email LIKE 'faturamento.gua%@sigtap.com'
        ORDER BY email
    LOOP
        RAISE NOTICE '✅ Usuário: % (role: %, access: %)', 
            user_record.email, 
            user_record.role, 
            user_record.hospital_access;
    END LOOP;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 CONFIGURAÇÃO DO HOSPITAL REGIONAL CENTRO OESTE CONCLUÍDA!';
    RAISE NOTICE '';
    
END $$; 