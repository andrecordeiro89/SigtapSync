-- ============================================================================
-- SCRIPT DE VERIFICAÇÃO - SIGTAP BILLING WIZARD
-- ============================================================================

-- 1. VERIFICAR SE TABELA user_profiles EXISTE
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        RAISE NOTICE '✅ Tabela user_profiles existe';
    ELSE
        RAISE NOTICE '❌ Tabela user_profiles NÃO existe - execute auth_setup.sql primeiro!';
    END IF;
END
$$;

-- 2. VERIFICAR ESTRUTURA DA TABELA
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 3. VERIFICAR TRIGGERS
SELECT 
    trigger_name,
    event_manipulation,
    action_timing
FROM information_schema.triggers 
WHERE event_object_table = 'user_profiles';

-- 4. VERIFICAR POLÍTICAS RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity
FROM pg_tables 
WHERE tablename = 'user_profiles';

-- 5. CONTAR REGISTROS
SELECT 
    'user_profiles' as tabela,
    COUNT(*) as total_registros
FROM user_profiles; 