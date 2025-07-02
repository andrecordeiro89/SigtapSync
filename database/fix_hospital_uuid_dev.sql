-- ===================================================
-- CORREÇÃO HOSPITAL UUID PARA DESENVOLVIMENTO
-- ===================================================

-- 1. Verificar se existe hospital com UUID correto
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM hospitals 
        WHERE id = '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b'
    ) THEN
        RAISE NOTICE '✅ Hospital com UUID correto já existe: 68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b';
    ELSE
        RAISE NOTICE '⚠️ Hospital com UUID não encontrado, criando...';
        
        -- Criar hospital com UUID válido
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
            is_active,
            created_at,
            updated_at
        ) VALUES (
            '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b',
            'Hospital de Desenvolvimento',
            '00.000.000/0000-00',
            'Rua de Desenvolvimento, 123',
            'Cidade Teste',
            'SP',
            '00000-000',
            '(11) 9999-9999',
            'hospital@desenvolvimento.com',
            true,
            NOW(),
            NOW()
        );
        
        RAISE NOTICE '✅ Hospital criado com UUID: 68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b';
    END IF;
END $$;

-- 2. Verificar estrutura da tabela patients para este hospital
DO $$
DECLARE
    patient_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO patient_count 
    FROM patients 
    WHERE hospital_id = '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b';
    
    RAISE NOTICE '📊 Pacientes existentes para este hospital: %', patient_count;
END $$;

-- 3. Verificar estrutura da tabela aihs para este hospital
DO $$
DECLARE
    aih_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO aih_count 
    FROM aihs 
    WHERE hospital_id = '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b';
    
    RAISE NOTICE '📊 AIHs existentes para este hospital: %', aih_count;
END $$;

-- 4. Teste de inserção com UUID correto
DO $$
DECLARE
    test_patient_id UUID;
    test_aih_id UUID;
BEGIN
    -- Limpar teste anterior se existir
    DELETE FROM aihs WHERE aih_number = 'TEST-UUID-123456789';
    DELETE FROM patients WHERE cns = '99999999999999999' AND hospital_id = '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b';
    
    -- Gerar IDs
    test_patient_id := gen_random_uuid();
    test_aih_id := gen_random_uuid();
    
    -- Inserir paciente de teste
    INSERT INTO patients (
        id, hospital_id, name, cns, birth_date, gender, is_active, created_at, updated_at
    ) VALUES (
        test_patient_id,
        '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b',
        'Paciente Teste UUID',
        '99999999999999999',
        '1990-01-01',
        'M',
        true,
        NOW(),
        NOW()
    );
    
    RAISE NOTICE '✅ Paciente teste inserido com UUID: %', test_patient_id;
    
    -- Inserir AIH de teste
    INSERT INTO aihs (
        id, hospital_id, patient_id, aih_number, procedure_code, 
        admission_date, main_cid, processing_status, created_at
    ) VALUES (
        test_aih_id,
        '68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b',
        test_patient_id,
        'TEST-UUID-123456789',
        '04.15.02.006-9',
        NOW(),
        'M751',
        'pending',
        NOW()
    );
    
    RAISE NOTICE '✅ AIH teste inserida com UUID: %', test_aih_id;
    
    -- Limpar dados de teste
    DELETE FROM aihs WHERE id = test_aih_id;
    DELETE FROM patients WHERE id = test_patient_id;
    
    RAISE NOTICE '🧹 Dados de teste removidos';
    RAISE NOTICE '🎉 TESTE UUID COMPLETO: SUCESSO!';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ ERRO NO TESTE UUID: %', SQLERRM;
        RAISE NOTICE '🔧 SQL State: %', SQLSTATE;
END $$;

RAISE NOTICE '';
RAISE NOTICE '🎯 CORREÇÃO UUID CONCLUÍDA!';
RAISE NOTICE 'Hospital UUID: 68bf9b1a-9d0b-423b-9bb3-3c02017b1d7b';
RAISE NOTICE 'Agora o sistema deve funcionar sem erros de UUID.'; 