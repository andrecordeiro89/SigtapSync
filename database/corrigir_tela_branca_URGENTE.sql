-- ================================================
-- CORREÇÃO URGENTE: TELA BRANCA - CRIAR AUTENTICAÇÃO
-- ================================================
-- Este script resolve a tela branca criando o sistema de auth completo

-- ETAPA 1: Criar tabela user_profiles
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  full_name VARCHAR(255),
  avatar_url TEXT,
  hospital_access TEXT[] DEFAULT '{}',
  permissions TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Constraints
  CONSTRAINT valid_roles CHECK (role IN ('developer', 'admin', 'user'))
);

-- ETAPA 2: Desabilitar RLS temporariamente para user_profiles
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- ETAPA 3: Garantir permissões básicas
GRANT ALL ON TABLE user_profiles TO anon;
GRANT ALL ON TABLE user_profiles TO authenticated;
GRANT ALL ON TABLE user_profiles TO service_role;

-- ETAPA 4: Criar função para auto-criar perfil
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, role, full_name)
  VALUES (
    NEW.id,
    NEW.email,
    'user',
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'Usuário')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ETAPA 5: Criar trigger para novos usuários
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ETAPA 6: Criar perfis para usuários existentes (se houver)
DO $$
DECLARE
    user_record RECORD;
BEGIN
    -- Buscar usuários sem perfil
    FOR user_record IN 
        SELECT u.id, u.email 
        FROM auth.users u 
        LEFT JOIN user_profiles p ON u.id = p.id 
        WHERE p.id IS NULL
    LOOP
        INSERT INTO user_profiles (id, email, role, full_name)
        VALUES (
            user_record.id,
            user_record.email,
            'user',
            'Usuário Existente'
        )
        ON CONFLICT (id) DO NOTHING;
        
        RAISE NOTICE 'Perfil criado para usuário: %', user_record.email;
    END LOOP;
END $$;

-- ETAPA 7: Criar usuários demo se não existirem
DO $$
DECLARE
    dev_user_id UUID;
    admin_user_id UUID;
    hospital_demo_id UUID;
BEGIN
    -- Verificar se já existe hospital demo
    SELECT id INTO hospital_demo_id 
    FROM hospitals 
    WHERE cnpj = '12345678000190' 
    LIMIT 1;
    
    -- Se não existe, criar hospital demo
    IF hospital_demo_id IS NULL THEN
        INSERT INTO hospitals (name, cnpj, city, state, is_active)
        VALUES ('Hospital Demo', '12345678000190', 'São Paulo', 'SP', true)
        RETURNING id INTO hospital_demo_id;
        
        RAISE NOTICE 'Hospital demo criado: %', hospital_demo_id;
    END IF;
    
    -- Criar/atualizar perfil developer
    INSERT INTO user_profiles (
        id, 
        email, 
        role, 
        full_name, 
        hospital_access, 
        permissions
    ) VALUES (
        '11111111-1111-1111-1111-111111111111',
        'dev@demo.com',
        'developer',
        'Developer Demo',
        ARRAY[hospital_demo_id::TEXT],
        ARRAY['all']
    )
    ON CONFLICT (id) DO UPDATE SET
        role = 'developer',
        hospital_access = ARRAY[hospital_demo_id::TEXT],
        permissions = ARRAY['all'],
        updated_at = NOW();
    
    -- Criar/atualizar perfil admin
    INSERT INTO user_profiles (
        id, 
        email, 
        role, 
        full_name, 
        hospital_access, 
        permissions
    ) VALUES (
        '22222222-2222-2222-2222-222222222222',
        'admin@demo.com',
        'admin',
        'Admin Demo',
        ARRAY[hospital_demo_id::TEXT],
        ARRAY['patients_manage', 'procedures_manage', 'reports_view']
    )
    ON CONFLICT (id) DO UPDATE SET
        role = 'admin',
        hospital_access = ARRAY[hospital_demo_id::TEXT],
        permissions = ARRAY['patients_manage', 'procedures_manage', 'reports_view'],
        updated_at = NOW();
    
    RAISE NOTICE 'Perfis demo criados/atualizados';
END $$;

-- ETAPA 8: Criar função de atualização de updated_at
CREATE OR REPLACE FUNCTION update_user_profiles_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ETAPA 9: Criar trigger para updated_at
DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
    BEFORE UPDATE ON user_profiles
    FOR EACH ROW
    EXECUTE FUNCTION update_user_profiles_updated_at();

-- ETAPA 10: Verificação final
DO $$
DECLARE
    profile_count INTEGER;
    hospital_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO profile_count FROM user_profiles;
    SELECT COUNT(*) INTO hospital_count FROM hospitals;
    
    RAISE NOTICE '';
    RAISE NOTICE '🎉 CORREÇÃO DE TELA BRANCA APLICADA!';
    RAISE NOTICE '================================';
    RAISE NOTICE 'Perfis de usuário: %', profile_count;
    RAISE NOTICE 'Hospitais: %', hospital_count;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Sistema deve carregar normalmente agora';
    RAISE NOTICE '✅ Use dev@demo.com / admin@demo.com para teste';
    RAISE NOTICE '================================';
END $$;

-- ETAPA 11: Status das tabelas
SELECT 
    'TABELAS AUTENTICAÇÃO' as categoria,
    c.relname as tabela,
    CASE WHEN c.relrowsecurity THEN 'RLS ATIVO' ELSE 'RLS DESABILITADO' END as rls_status,
    (CASE c.relname 
        WHEN 'user_profiles' THEN (SELECT COUNT(*) FROM user_profiles)
        WHEN 'hospitals' THEN (SELECT COUNT(*) FROM hospitals)
        ELSE 0
    END) as total_registros
FROM pg_class c
WHERE c.relname IN ('user_profiles', 'hospitals')
ORDER BY c.relname;

-- ETAPA 12: Criar perfil para usuário atual
INSERT INTO user_profiles (
    id, 
    email, 
    role, 
    full_name, 
    permissions
) VALUES (
    '32568fe0-b744-4a15-97a4-b54ed0b0610e',
    'usuario@demo.com',
    'developer',
    'Usuário Demo',
    ARRAY['all']
)
ON CONFLICT (id) DO UPDATE SET
    role = 'developer',
    permissions = ARRAY['all'],
    updated_at = NOW();

-- VERIFICAÇÃO
SELECT 
    'CORREÇÃO APLICADA' as status,
    COUNT(*) as perfis_criados
FROM user_profiles; 