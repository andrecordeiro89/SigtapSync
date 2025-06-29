-- ============================================================================
-- TESTE RÁPIDO - VERIFICAR SE TUDO ESTÁ FUNCIONANDO
-- ============================================================================

-- 1. VERIFICAR CONEXÃO E PERMISSÕES
SELECT 'Conexão OK' as status, NOW() as timestamp;

-- 2. VERIFICAR SE TABELA user_profiles EXISTE
SELECT 
    CASE 
        WHEN EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') 
        THEN '✅ Tabela user_profiles EXISTE'
        ELSE '❌ Tabela user_profiles NÃO EXISTE'
    END as status_tabela;

-- 3. VERIFICAR ESTRUTURA DA TABELA (se existir)
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'user_profiles'
ORDER BY ordinal_position;

-- 4. VERIFICAR RLS
SELECT 
    schemaname,
    tablename,
    rowsecurity as rls_enabled
FROM pg_tables 
WHERE tablename = 'user_profiles';

-- 5. VERIFICAR POLÍTICAS
SELECT 
    schemaname,
    tablename,
    policyname,
    permissive,
    roles,
    cmd,
    qual
FROM pg_policies 
WHERE tablename = 'user_profiles';

-- 6. VERIFICAR TRIGGERS
SELECT 
    trigger_name,
    event_manipulation,
    action_timing,
    action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'user_profiles';

-- 7. VERIFICAR USUÁRIOS NO AUTH
SELECT 
    COUNT(*) as total_usuarios_auth,
    MIN(created_at) as primeiro_usuario,
    MAX(created_at) as ultimo_usuario
FROM auth.users;

-- 8. VERIFICAR PERFIS EXISTENTES
SELECT 
    COUNT(*) as total_perfis,
    COUNT(CASE WHEN role = 'admin' THEN 1 END) as admins,
    COUNT(CASE WHEN role = 'developer' THEN 1 END) as developers,
    COUNT(CASE WHEN role = 'user' THEN 1 END) as users
FROM user_profiles;

-- 9. LISTAR USUÁRIOS E PERFIS
SELECT 
    au.id,
    au.email as auth_email,
    au.created_at as auth_created,
    up.email as profile_email,
    up.role,
    up.full_name,
    up.is_active
FROM auth.users au
LEFT JOIN user_profiles up ON au.id = up.id
ORDER BY au.created_at;

-- 10. TESTE DE INSERÇÃO (SIMULAR NOVO USUÁRIO)
DO $$
DECLARE
    test_id UUID := '00000000-0000-0000-0000-000000000999';
BEGIN
    -- Tentar inserir um perfil de teste
    BEGIN
        INSERT INTO user_profiles (id, email, role, full_name)
        VALUES (test_id, 'teste@exemplo.com', 'admin', 'Usuário Teste')
        ON CONFLICT (id) DO NOTHING;
        
        -- Verificar se inseriu
        IF EXISTS(SELECT 1 FROM user_profiles WHERE id = test_id) THEN
            RAISE NOTICE '✅ Teste de inserção: SUCESSO';
            
            -- Limpar teste
            DELETE FROM user_profiles WHERE id = test_id;
            RAISE NOTICE '🗑️ Registro de teste removido';
        ELSE
            RAISE NOTICE '❌ Teste de inserção: FALHOU';
        END IF;
        
    EXCEPTION WHEN OTHERS THEN
        RAISE NOTICE '❌ Erro no teste de inserção: %', SQLERRM;
    END;
END
$$; 