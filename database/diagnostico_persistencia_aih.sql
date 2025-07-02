-- ===================================================
-- DIAGNÓSTICO COMPLETO PARA PERSISTÊNCIA DE AIH
-- ===================================================

-- 1. VERIFICAR SE HOSPITAL DE DESENVOLVIMENTO EXISTE
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM hospitals WHERE id = 'dev-hospital'
    ) THEN
        INSERT INTO hospitals (id, name, cnpj, is_active, created_at)
        VALUES (
            'dev-hospital',
            'Hospital de Desenvolvimento',
            '00000000000000',
            true,
            NOW()
        );
        RAISE NOTICE '✅ Hospital de desenvolvimento criado: dev-hospital';
    ELSE
        RAISE NOTICE '✅ Hospital de desenvolvimento já existe: dev-hospital';
    END IF;
END $$;

-- 2. VERIFICAR ESTRUTURA DA TABELA PATIENTS
DO $$
DECLARE
    column_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_name = 'patients' 
    AND table_schema = 'public';
    
    RAISE NOTICE '📋 Tabela patients tem % colunas', column_count;
    
    -- Listar campos obrigatórios
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'id') THEN
        RAISE NOTICE '✅ Campo id existe';
    ELSE
        RAISE NOTICE '❌ Campo id NÃO existe';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'hospital_id') THEN
        RAISE NOTICE '✅ Campo hospital_id existe';
    ELSE
        RAISE NOTICE '❌ Campo hospital_id NÃO existe';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'name') THEN
        RAISE NOTICE '✅ Campo name existe';
    ELSE
        RAISE NOTICE '❌ Campo name NÃO existe';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'cns') THEN
        RAISE NOTICE '✅ Campo cns existe';
    ELSE
        RAISE NOTICE '❌ Campo cns NÃO existe';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'patients' AND column_name = 'gender') THEN
        RAISE NOTICE '✅ Campo gender existe';
    ELSE
        RAISE NOTICE '❌ Campo gender NÃO existe';
    END IF;
END $$;

-- 3. VERIFICAR ESTRUTURA DA TABELA AIHS
DO $$
DECLARE
    column_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO column_count
    FROM information_schema.columns 
    WHERE table_name = 'aihs' 
    AND table_schema = 'public';
    
    RAISE NOTICE '📋 Tabela aihs tem % colunas', column_count;
    
    -- Verificar campos essenciais
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'aihs' AND column_name = 'id') THEN
        RAISE NOTICE '✅ Campo aihs.id existe';
    ELSE
        RAISE NOTICE '❌ Campo aihs.id NÃO existe';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'aihs' AND column_name = 'hospital_id') THEN
        RAISE NOTICE '✅ Campo aihs.hospital_id existe';
    ELSE
        RAISE NOTICE '❌ Campo aihs.hospital_id NÃO existe';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'aihs' AND column_name = 'patient_id') THEN
        RAISE NOTICE '✅ Campo aihs.patient_id existe';
    ELSE
        RAISE NOTICE '❌ Campo aihs.patient_id NÃO existe';
    END IF;
    
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'aihs' AND column_name = 'aih_number') THEN
        RAISE NOTICE '✅ Campo aihs.aih_number existe';
    ELSE
        RAISE NOTICE '❌ Campo aihs.aih_number NÃO existe';
    END IF;
END $$;

-- 4. VERIFICAR PERMISSÕES RLS
DO $$
BEGIN
    -- Verificar se RLS está ativo nas tabelas
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'patients' AND n.nspname = 'public' AND c.relrowsecurity = true
    ) THEN
        RAISE NOTICE '⚠️ RLS ativo na tabela patients';
    ELSE
        RAISE NOTICE '✅ RLS desativado na tabela patients';
    END IF;
    
    IF EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = 'aihs' AND n.nspname = 'public' AND c.relrowsecurity = true
    ) THEN
        RAISE NOTICE '⚠️ RLS ativo na tabela aihs';
    ELSE
        RAISE NOTICE '✅ RLS desativado na tabela aihs';
    END IF;
END $$;

-- 5. CONTAR REGISTROS EXISTENTES
DO $$
DECLARE
    patient_count INTEGER;
    aih_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO patient_count FROM patients WHERE hospital_id = 'dev-hospital';
    SELECT COUNT(*) INTO aih_count FROM aihs WHERE hospital_id = 'dev-hospital';
    
    RAISE NOTICE '📊 Pacientes no dev-hospital: %', patient_count;
    RAISE NOTICE '📊 AIHs no dev-hospital: %', aih_count;
END $$;

-- 6. TESTE DE INSERÇÃO SIMPLES
DO $$
DECLARE
    test_patient_id UUID;
    test_aih_id UUID;
BEGIN
    -- Limpar teste anterior se existir
    DELETE FROM aihs WHERE aih_number = 'TEST-123456789';
    DELETE FROM patients WHERE cns = '00000000000000000' AND hospital_id = 'dev-hospital';
    
    -- Gerar IDs
    test_patient_id := gen_random_uuid();
    test_aih_id := gen_random_uuid();
    
    -- Inserir paciente de teste
    INSERT INTO patients (
        id, hospital_id, name, cns, birth_date, gender, is_active, created_at, updated_at
    ) VALUES (
        test_patient_id,
        'dev-hospital',
        'Paciente Teste',
        '00000000000000000',
        '1990-01-01',
        'M',
        true,
        NOW(),
        NOW()
    );
    
    RAISE NOTICE '✅ Paciente de teste inserido: %', test_patient_id;
    
    -- Inserir AIH de teste
    INSERT INTO aihs (
        id, hospital_id, patient_id, aih_number, procedure_code, 
        admission_date, main_cid, processing_status, created_at
    ) VALUES (
        test_aih_id,
        'dev-hospital',
        test_patient_id,
        'TEST-123456789',
        '04.15.02.006-9',
        NOW(),
        'M751',
        'pending',
        NOW()
    );
    
    RAISE NOTICE '✅ AIH de teste inserida: %', test_aih_id;
    
    -- Limpar dados de teste
    DELETE FROM aihs WHERE id = test_aih_id;
    DELETE FROM patients WHERE id = test_patient_id;
    
    RAISE NOTICE '🧹 Dados de teste removidos';
    RAISE NOTICE '🎉 TESTE DE PERSISTÊNCIA: SUCESSO!';
    
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE '❌ ERRO NO TESTE DE PERSISTÊNCIA: %', SQLERRM;
        RAISE NOTICE '🔧 Detalhes: % %', SQLSTATE, SQLERRM;
END $$;

-- 7. VERIFICAR CONSTRAINTS PROBLEMÁTICAS
DO $$
DECLARE
    constraint_info RECORD;
BEGIN
    RAISE NOTICE '🔍 VERIFICANDO CONSTRAINTS...';
    
    FOR constraint_info IN 
        SELECT tc.constraint_name, tc.table_name, tc.constraint_type
        FROM information_schema.table_constraints tc
        WHERE tc.table_schema = 'public' 
        AND tc.table_name IN ('patients', 'aihs')
        AND tc.constraint_type IN ('FOREIGN KEY', 'CHECK')
    LOOP
        RAISE NOTICE 'Constraint: % em % (tipo: %)', 
            constraint_info.constraint_name, 
            constraint_info.table_name, 
            constraint_info.constraint_type;
    END LOOP;
END $$;

RAISE NOTICE '';
RAISE NOTICE '🎯 DIAGNÓSTICO COMPLETO FINALIZADO!';
RAISE NOTICE 'Se todos os testes passaram, a persistência deve funcionar.';
RAISE NOTICE 'Execute este script e verifique os logs antes de testar a interface.'; 