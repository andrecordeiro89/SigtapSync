-- ================================================
-- SETUP USUÁRIO ÚNICO: developer@sigtap.com
-- ================================================

-- PASSO 1: Mostrar estado atual
SELECT 
    'ANTES DA LIMPEZA' as status,
    COUNT(*) as total_usuarios
FROM user_profiles;

-- PASSO 2: Limpar TODOS os usuários existentes
DELETE FROM user_profiles;

-- PASSO 3: Verificar se tabela está vazia
SELECT 
    'APÓS LIMPEZA' as status,
    COUNT(*) as total_usuarios
FROM user_profiles;

-- PASSO 4: Criar APENAS o usuário developer
INSERT INTO user_profiles (
    id, 
    email, 
    role, 
    full_name, 
    permissions, 
    hospital_access,
    created_at,
    updated_at
) VALUES (
    -- ID fixo para facilitar referência
    '00000000-1111-2222-3333-444444444444',
    'developer@sigtap.com',
    'developer',
    'Developer SIGTAP',
    ARRAY['all']::TEXT[],
    ARRAY[]::TEXT[],
    NOW(),
    NOW()
);

-- PASSO 5: Verificar criação
SELECT 
    'USUÁRIO CRIADO' as status,
    id,
    email,
    role,
    full_name,
    permissions,
    created_at
FROM user_profiles;

-- PASSO 6: Teste de busca (simular o que o frontend faz)
DO $$
DECLARE
    test_user RECORD;
BEGIN
    SELECT * INTO test_user
    FROM user_profiles 
    WHERE email = 'developer@sigtap.com';
    
    IF FOUND THEN
        RAISE NOTICE '';
        RAISE NOTICE '✅ USUÁRIO DEVELOPER CRIADO COM SUCESSO!';
        RAISE NOTICE '==========================================';
        RAISE NOTICE 'Email: %', test_user.email;
        RAISE NOTICE 'ID: %', test_user.id;
        RAISE NOTICE 'Role: %', test_user.role;
        RAISE NOTICE 'Nome: %', test_user.full_name;
        RAISE NOTICE 'Permissões: %', test_user.permissions;
        RAISE NOTICE '==========================================';
        RAISE NOTICE '';
    ELSE
        RAISE NOTICE '❌ ERRO: Usuário developer não foi criado!';
    END IF;
END $$;

-- PASSO 7: Status final da tabela
SELECT 
    'STATUS FINAL' as categoria,
    'Total de usuários' as item,
    COUNT(*)::TEXT as valor
FROM user_profiles

UNION ALL

SELECT 
    'STATUS FINAL' as categoria,
    'RLS Status' as item,
    CASE WHEN c.relrowsecurity THEN 'HABILITADO' ELSE 'DESABILITADO' END as valor
FROM pg_class c WHERE c.relname = 'user_profiles';

-- RESULTADO FINAL
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 SETUP CONCLUÍDO!';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'CREDENCIAIS PARA LOGIN:';
    RAISE NOTICE 'Email: developer@sigtap.com';
    RAISE NOTICE 'Senha: (você define na tela de cadastro)';
    RAISE NOTICE '';
    RAISE NOTICE 'PRÓXIMOS PASSOS:';
    RAISE NOTICE '1. Acesse o sistema no navegador';
    RAISE NOTICE '2. Se aparecer tela de cadastro, use:';
    RAISE NOTICE '   - Email: developer@sigtap.com';
    RAISE NOTICE '   - Senha: dev123456 (ou sua preferência)';
    RAISE NOTICE '   - Role: Developer';
    RAISE NOTICE '3. Se aparecer tela de login, use as credenciais acima';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '';
END $$; 