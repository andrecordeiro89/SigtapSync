-- VERIFICAR SE SISTEMA DE CADASTRO ESTÁ PRONTO

-- 1. Verificar tabela user_profiles
SELECT 
    'TABELA USER_PROFILES' as categoria,
    CASE WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') 
         THEN '✅ EXISTE' ELSE '❌ NÃO EXISTE' END as status,
    COUNT(*) as usuarios_atuais
FROM user_profiles;

-- 2. Verificar permissões
SELECT 
    'PERMISSÕES' as categoria,
    has_table_privilege('authenticated', 'user_profiles', 'INSERT') as pode_inserir,
    has_table_privilege('authenticated', 'user_profiles', 'SELECT') as pode_selecionar;

-- 3. Teste de inserção (simulando o que o frontend fará)
DO $$
DECLARE
    test_id UUID := gen_random_uuid();
BEGIN
    -- Tentar inserir como o frontend fará
    INSERT INTO user_profiles (id, email, role, full_name, permissions, hospital_access) 
    VALUES (test_id, 'test@demo.com', 'developer', 'Test User', '{all}', '{}');
    
    -- Remover teste
    DELETE FROM user_profiles WHERE id = test_id;
    
    RAISE NOTICE '✅ SISTEMA DE CADASTRO: FUNCIONANDO!';
    RAISE NOTICE 'Você pode cadastrar o usuário dev normalmente';
    RAISE NOTICE '';
    RAISE NOTICE '📝 DADOS SUGERIDOS:';
    RAISE NOTICE 'Email: dev@sigtap.com';
    RAISE NOTICE 'Senha: dev123456';
    RAISE NOTICE 'Nome: Developer Principal';
    RAISE NOTICE 'Tipo: Developer';
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE '❌ ERRO NO SISTEMA DE CADASTRO!';
    RAISE NOTICE 'Erro: %', SQLERRM;
    RAISE NOTICE 'Execute o script fix_simples_rapido.sql primeiro';
END $$;

-- 4. Status atual
SELECT 
    'STATUS FINAL' as categoria,
    id,
    email,
    role,
    full_name
FROM user_profiles
ORDER BY created_at DESC; 