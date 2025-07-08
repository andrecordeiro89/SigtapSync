-- ============================================================================
-- CORREÇÃO RÁPIDA: ERRO COLUMN hospitals_1.code DOES NOT EXIST
-- Sistema: SIGTAP Billing Wizard v3.0
-- Problema: Funções SQL tentando acessar campo 'code' que não existe na tabela hospitals
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🔧 CORRIGINDO ERRO DE COLUNA hospital_code...';
    RAISE NOTICE '================================================';
    RAISE NOTICE '';
END $$;

-- 1. CORRIGIR FUNÇÃO get_user_accessible_hospitals
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

-- 2. CORRIGIR VIEW v_hospital_mapping
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

-- 3. TESTAR FUNÇÃO CORRIGIDA
DO $$
DECLARE
    test_result RECORD;
    test_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧪 TESTANDO FUNÇÃO CORRIGIDA...';
    RAISE NOTICE '=================================';
    
    -- Testar função get_user_accessible_hospitals
    FOR test_result IN 
        SELECT * FROM get_user_accessible_hospitals() LIMIT 5
    LOOP
        test_count := test_count + 1;
        RAISE NOTICE '✅ Hospital: % (ID: %, Code: %)', 
                    test_result.hospital_name, 
                    test_result.hospital_id, 
                    test_result.hospital_code;
    END LOOP;
    
    IF test_count > 0 THEN
        RAISE NOTICE '✅ Função get_user_accessible_hospitals funcionando! (% hospitais encontrados)', test_count;
    ELSE
        RAISE NOTICE '⚠️ Nenhum hospital encontrado. Verifique se há dados na tabela hospitals.';
    END IF;
    
    -- Testar view v_hospital_mapping
    SELECT COUNT(*) INTO test_count FROM v_hospital_mapping;
    RAISE NOTICE '✅ View v_hospital_mapping: % hospitais mapeados', test_count;
    
END $$;

-- 4. VERIFICAR ESTRUTURA DA TABELA HOSPITALS
DO $$
DECLARE
    col_record RECORD;
    col_count INTEGER := 0;
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '📋 VERIFICANDO ESTRUTURA DA TABELA HOSPITALS...';
    RAISE NOTICE '================================================';
    
    FOR col_record IN 
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns 
        WHERE table_name = 'hospitals' 
        AND table_schema = 'public'
        ORDER BY ordinal_position
    LOOP
        col_count := col_count + 1;
        RAISE NOTICE '  └─ %: % (nullable: %)', 
                    col_record.column_name, 
                    col_record.data_type, 
                    col_record.is_nullable;
    END LOOP;
    
    RAISE NOTICE '📊 Total de colunas: %', col_count;
    
    IF col_count = 0 THEN
        RAISE NOTICE '❌ ERRO: Tabela hospitals não encontrada ou não acessível!';
    END IF;
    
END $$;

-- MENSAGEM FINAL
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 CORREÇÃO CONCLUÍDA!';
    RAISE NOTICE '';
    RAISE NOTICE '✅ Função get_user_accessible_hospitals corrigida';
    RAISE NOTICE '✅ View v_hospital_mapping corrigida';
    RAISE NOTICE '✅ Códigos de hospital mapeados via CASE WHEN';
    RAISE NOTICE '';
    RAISE NOTICE '🔄 Agora recarregue a página e teste novamente!';
    RAISE NOTICE '';
END $$; 