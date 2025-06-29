-- ============================================================================
-- SCRIPT DE EMERGÊNCIA - DIAGNÓSTICO E CORREÇÃO COMPLETA
-- ============================================================================

-- 1. VERIFICAR SE EXTENSÕES ESTÃO HABILITADAS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. VERIFICAR E CRIAR TABELA user_profiles
DO $$
BEGIN
    -- Verificar se tabela existe
    IF NOT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles') THEN
        RAISE NOTICE '❌ Tabela user_profiles não existe - criando agora...';
        
        -- Criar tabela
        CREATE TABLE user_profiles (
            id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
            email TEXT UNIQUE NOT NULL,
            role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('developer', 'admin', 'user')),
            full_name TEXT,
            avatar_url TEXT,
            hospital_access TEXT[] DEFAULT '{}',
            permissions TEXT[] DEFAULT '{}',
            is_active BOOLEAN DEFAULT true,
            last_login_at TIMESTAMP WITH TIME ZONE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        RAISE NOTICE '✅ Tabela user_profiles criada com sucesso!';
    ELSE
        RAISE NOTICE '✅ Tabela user_profiles já existe';
    END IF;
END
$$;

-- 3. VERIFICAR E CONFIGURAR RLS
DO $$
BEGIN
    -- Desabilitar RLS temporariamente para diagnóstico
    ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
    RAISE NOTICE '⚠️ RLS temporariamente DESABILITADO para diagnóstico';
    
    -- Remover políticas existentes
    DROP POLICY IF EXISTS "Users can view own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Users can update own profile" ON user_profiles;
    DROP POLICY IF EXISTS "Admins can view all profiles" ON user_profiles;
    
    RAISE NOTICE '🗑️ Políticas antigas removidas';
END
$$;

-- 4. CRIAR FUNÇÃO DE TRIGGER (SE NÃO EXISTIR)
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.user_profiles (id, email, role, full_name)
    VALUES (
        NEW.id,
        NEW.email,
        'admin', -- TEMPORÁRIO: todos começam como admin para teste
        COALESCE(NEW.raw_user_meta_data->>'full_name', '')
    );
    RETURN NEW;
EXCEPTION
    WHEN OTHERS THEN
        RAISE NOTICE 'Erro no trigger: %', SQLERRM;
        RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. RECRIAR TRIGGER
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6. VERIFICAR USUÁRIOS EXISTENTES NO AUTH
DO $$
DECLARE
    user_rec RECORD;
BEGIN
    RAISE NOTICE '👥 Usuários no auth.users:';
    
    FOR user_rec IN SELECT id, email, created_at FROM auth.users ORDER BY created_at LOOP
        RAISE NOTICE 'ID: % | Email: % | Criado: %', user_rec.id, user_rec.email, user_rec.created_at;
        
        -- Inserir na user_profiles se não existir
        INSERT INTO user_profiles (id, email, role, full_name, created_at)
        VALUES (
            user_rec.id,
            user_rec.email,
            'admin', -- Temporário para teste
            'Usuário ' || split_part(user_rec.email, '@', 1),
            NOW()
        )
        ON CONFLICT (id) DO UPDATE SET
            role = 'admin',
            updated_at = NOW();
    END LOOP;
    
    RAISE NOTICE '✅ Perfis sincronizados com auth.users';
END
$$;

-- 7. VERIFICAR RESULTADO
SELECT 
    up.id,
    up.email,
    up.role,
    up.full_name,
    up.created_at,
    au.email_confirmed_at
FROM user_profiles up
LEFT JOIN auth.users au ON up.id = au.id
ORDER BY up.created_at;

-- 8. CONFIGURAR POLÍTICAS SIMPLES PARA TESTE
CREATE POLICY "Allow all for testing" ON user_profiles
    FOR ALL USING (true);

-- Reabilitar RLS
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- 9. CRIAR ÍNDICES
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);
CREATE INDEX IF NOT EXISTS idx_user_profiles_role ON user_profiles(role);

-- 10. VERIFICAÇÃO FINAL
DO $$
BEGIN
    RAISE NOTICE '🎯 VERIFICAÇÃO FINAL:';
    RAISE NOTICE 'Tabela user_profiles existe: %', 
        (SELECT EXISTS(SELECT 1 FROM information_schema.tables WHERE table_name = 'user_profiles'));
    RAISE NOTICE 'Total de perfis: %', (SELECT COUNT(*) FROM user_profiles);
    RAISE NOTICE 'RLS habilitado: %', 
        (SELECT rowsecurity FROM pg_tables WHERE tablename = 'user_profiles');
    RAISE NOTICE 'Trigger exists: %',
        (SELECT EXISTS(SELECT 1 FROM information_schema.triggers WHERE trigger_name = 'on_auth_user_created'));
    
    RAISE NOTICE '🚀 Setup de emergência concluído!';
    RAISE NOTICE '⚠️ IMPORTANTE: RLS está com política permissiva para teste';
    RAISE NOTICE '🔧 Todos os usuários estão como ADMIN temporariamente';
END
$$; 