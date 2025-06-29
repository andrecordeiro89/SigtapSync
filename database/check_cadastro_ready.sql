-- VERIFICAR SE CADASTRO ESTÁ FUNCIONANDO

-- 1. Tabela existe?
SELECT 
    'TABELA' as item,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') 
         THEN '✅ OK' ELSE '❌ ERRO' END as status;

-- 2. Permissões OK?
SELECT 
    'PERMISSÕES' as item,
    CASE WHEN has_table_privilege('authenticated', 'user_profiles', 'INSERT') 
         THEN '✅ OK' ELSE '❌ ERRO' END as status;

-- 3. Teste inserção
DO $$
DECLARE
    test_id UUID := gen_random_uuid();
BEGIN
    INSERT INTO user_profiles (id, email, role, full_name, permissions, hospital_access) 
    VALUES (test_id, 'test@test.com', 'developer', 'Test User', '{all}', '{}');
    
    DELETE FROM user_profiles WHERE id = test_id;
    
    RAISE NOTICE '✅ CADASTRO FUNCIONANDO!';
    RAISE NOTICE 'Você pode cadastrar o usuário dev agora';
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ERRO NO CADASTRO: %', SQLERRM;
END $$;

-- 4. Usuários existentes
SELECT 'USUÁRIOS ATUAIS' as info, COUNT(*) as total, string_agg(email, ', ') as emails 
FROM user_profiles; 