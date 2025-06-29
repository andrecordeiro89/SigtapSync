-- ============================================================================
-- SCRIPT PARA CONFIGURAR USUÁRIOS DEMO - SIGTAP BILLING WIZARD
-- ============================================================================
-- IMPORTANTE: Execute APENAS após criar os usuários via signup na interface
-- ============================================================================

-- 1. VERIFICAR SE USUÁRIOS EXISTEM NO AUTH
DO $$
BEGIN
    RAISE NOTICE '🔍 Verificando usuários existentes...';
    
    -- Mostrar usuários no auth.users
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'dev@sigtap.com') THEN
        RAISE NOTICE '✅ dev@sigtap.com encontrado no auth.users';
    ELSE
        RAISE NOTICE '❌ dev@sigtap.com NÃO encontrado - crie via signup primeiro!';
    END IF;
    
    IF EXISTS (SELECT 1 FROM auth.users WHERE email = 'admin@sigtap.com') THEN
        RAISE NOTICE '✅ admin@sigtap.com encontrado no auth.users';
    ELSE
        RAISE NOTICE '❌ admin@sigtap.com NÃO encontrado - crie via signup primeiro!';
    END IF;
END
$$;

-- 2. VERIFICAR PERFIS NA TABELA user_profiles
DO $$
BEGIN
    RAISE NOTICE '👤 Verificando perfis de usuário...';
    RAISE NOTICE 'Total de perfis: %', (SELECT COUNT(*) FROM user_profiles);
    
    -- Mostrar usuários existentes
    FOR rec IN SELECT email, role FROM user_profiles LOOP
        RAISE NOTICE 'Usuário: % | Role: %', rec.email, rec.role;
    END LOOP;
END
$$;

-- 3. ATUALIZAR ROLES DOS USUÁRIOS DEMO (se existirem)
DO $$
BEGIN
    -- Atualizar developer
    IF EXISTS (SELECT 1 FROM user_profiles WHERE email = 'dev@sigtap.com') THEN
        UPDATE user_profiles 
        SET 
            role = 'developer',
            full_name = 'Developer SIGTAP',
            permissions = '{"*"}',
            hospital_access = '{}',
            updated_at = NOW()
        WHERE email = 'dev@sigtap.com';
        
        RAISE NOTICE '✅ dev@sigtap.com atualizado para DEVELOPER';
    ELSE
        RAISE NOTICE '⚠️ dev@sigtap.com não encontrado para atualizar';
    END IF;
    
    -- Atualizar admin  
    IF EXISTS (SELECT 1 FROM user_profiles WHERE email = 'admin@sigtap.com') THEN
        UPDATE user_profiles 
        SET 
            role = 'admin',
            full_name = 'Admin SIGTAP',
            permissions = '{"admin:*"}',
            hospital_access = '{}',
            updated_at = NOW()
        WHERE email = 'admin@sigtap.com';
        
        RAISE NOTICE '✅ admin@sigtap.com atualizado para ADMIN';
    ELSE
        RAISE NOTICE '⚠️ admin@sigtap.com não encontrado para atualizar';
    END IF;
END
$$;

-- 4. VERIFICAÇÃO FINAL
DO $$
BEGIN
    RAISE NOTICE '🎯 Verificação final dos usuários demo:';
    
    -- Developer
    FOR rec IN 
        SELECT email, role, full_name, array_length(permissions, 1) as perm_count
        FROM user_profiles 
        WHERE email = 'dev@sigtap.com'
    LOOP
        RAISE NOTICE '👨‍💻 DEVELOPER: % | Nome: % | Permissões: %', 
            rec.email, rec.full_name, rec.perm_count;
    END LOOP;
    
    -- Admin
    FOR rec IN 
        SELECT email, role, full_name, array_length(permissions, 1) as perm_count
        FROM user_profiles 
        WHERE email = 'admin@sigtap.com'
    LOOP
        RAISE NOTICE '👑 ADMIN: % | Nome: % | Permissões: %', 
            rec.email, rec.full_name, rec.perm_count;
    END LOOP;
    
    -- Estatísticas gerais
    RAISE NOTICE '📊 Total de usuários: %', (SELECT COUNT(*) FROM user_profiles);
    RAISE NOTICE '🔧 Developers: %', (SELECT COUNT(*) FROM user_profiles WHERE role = 'developer');
    RAISE NOTICE '👑 Admins: %', (SELECT COUNT(*) FROM user_profiles WHERE role = 'admin');
    
    IF (SELECT COUNT(*) FROM user_profiles WHERE role IN ('developer', 'admin')) > 0 THEN
        RAISE NOTICE '🎉 Usuários demo configurados com sucesso!';
    ELSE
        RAISE NOTICE '⚠️ Nenhum usuário demo encontrado. Crie via signup primeiro.';
    END IF;
END
$$; 