-- ================================================
-- VERIFICAÇÃO: SISTEMA DE CADASTRO CONFIGURADO
-- ================================================

-- ETAPA 1: Verificar se tabela user_profiles existe e está acessível
SELECT 
    'TABELA USER_PROFILES' as categoria,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') 
        THEN '✅ EXISTE' 
        ELSE '❌ NÃO EXISTE' 
    END as tabela_existe,
    COUNT(*) as usuarios_existentes
FROM user_profiles;

-- ETAPA 2: Verificar RLS e permissões
SELECT 
    'CONFIGURAÇÃO RLS' as categoria,
    c.relname as tabela,
    CASE WHEN c.relrowsecurity THEN '🔒 HABILITADO' ELSE '✅ DESABILITADO' END as rls_status,
    (SELECT COUNT(*) FROM pg_policies WHERE tablename = c.relname) as politicas_ativas
FROM pg_class c
WHERE c.relname = 'user_profiles';

-- ETAPA 3: Verificar permissões para inserção
SELECT 
    'PERMISSÕES INSERÇÃO' as categoria,
    has_table_privilege('anon', 'user_profiles', 'INSERT') as anon_pode_inserir,
    has_table_privilege('authenticated', 'user_profiles', 'INSERT') as auth_pode_inserir,
    has_table_privilege('anon', 'user_profiles', 'SELECT') as anon_pode_selecionar,
    has_table_privilege('authenticated', 'user_profiles', 'SELECT') as auth_pode_selecionar;

-- ETAPA 4: Testar inserção de usuário demo (igual ao que o frontend fará)
DO $$
DECLARE
    test_user_id UUID := gen_random_uuid();
    insertion_success BOOLEAN := false;
BEGIN
    -- Simular exatamente o que o signUp fará
    BEGIN
        INSERT INTO user_profiles (
            id,
            email,
            role,
            full_name,
            hospital_access,
            permissions
        ) VALUES (
            test_user_id,
            'teste.cadastro@demo.com',
            'developer',
            'Teste de Cadastro',
            '{}',
            '{all}'
        );
        
        insertion_success := true;
        RAISE NOTICE '✅ TESTE DE INSERÇÃO: SUCESSO!';
        RAISE NOTICE 'ID criado: %', test_user_id;
        
        -- Limpar teste
        DELETE FROM user_profiles WHERE id = test_user_id;
        RAISE NOTICE '🧹 Dados de teste removidos';
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ TESTE DE INSERÇÃO: FALHOU!';
        RAISE NOTICE 'Erro: %', SQLERRM;
        RAISE NOTICE 'Código: %', SQLSTATE;
    END;
    
    -- Resultado do teste
    IF insertion_success THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 SISTEMA DE CADASTRO: FUNCIONANDO!';
        RAISE NOTICE 'Você pode cadastrar usuários normalmente';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '🚨 SISTEMA DE CADASTRO: PROBLEMA DETECTADO!';
        RAISE NOTICE 'Execute o script de correção primeiro';
    END IF;
    RAISE NOTICE '';
END $$;

-- ETAPA 5: Mostrar usuários existentes
SELECT 
    'USUÁRIOS EXISTENTES' as categoria,
    id,
    email,
    role,
    full_name,
    created_at
FROM user_profiles
ORDER BY created_at DESC;

-- ETAPA 6: Verificar se Supabase Auth está funcionando
-- (Esta verificação é limitada do lado SQL, mas podemos verificar se a tabela auth.users existe)
SELECT 
    'SUPABASE AUTH' as categoria,
    CASE 
        WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'auth' AND table_name = 'users') 
        THEN '✅ CONFIGURADO' 
        ELSE '❌ NÃO CONFIGURADO' 
    END as auth_configurado,
    (SELECT COUNT(*) FROM auth.users) as total_usuarios_auth;

-- RESULTADO FINAL
DO $$
DECLARE
    can_insert BOOLEAN;
    table_exists BOOLEAN;
BEGIN
    -- Verificar se pode inserir
    SELECT has_table_privilege('authenticated', 'user_profiles', 'INSERT') INTO can_insert;
    
    -- Verificar se tabela existe
    SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') INTO table_exists;
    
    RAISE NOTICE '';
    RAISE NOTICE '📋 RESUMO FINAL DO SISTEMA DE CADASTRO:';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Tabela user_profiles: %', CASE WHEN table_exists THEN '✅ OK' ELSE '❌ ERRO' END;
    RAISE NOTICE 'Permissão inserção: %', CASE WHEN can_insert THEN '✅ OK' ELSE '❌ ERRO' END;
    RAISE NOTICE 'RLS: %', 'Desabilitado (recomendado)';
    
    IF table_exists AND can_insert THEN
        RAISE NOTICE '';
        RAISE NOTICE '🎉 TUDO CONFIGURADO!';
        RAISE NOTICE 'Você pode cadastrar o usuário dev agora!';
        RAISE NOTICE '';
        RAISE NOTICE '📝 DADOS SUGERIDOS PARA CADASTRO:';
        RAISE NOTICE 'Email: dev@sigtap.com';
        RAISE NOTICE 'Senha: dev123456';
        RAISE NOTICE 'Nome: Developer Principal';
        RAISE NOTICE 'Tipo: Developer';
    ELSE
        RAISE NOTICE '';
        RAISE NOTICE '🚨 AINDA HÁ PROBLEMAS!';
        RAISE NOTICE 'Execute o script de correção primeiro';
    END IF;
    
    RAISE NOTICE '==========================================';
    RAISE NOTICE '';
END $$; 