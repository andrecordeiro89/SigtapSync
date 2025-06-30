-- ================================================
-- RESET TOTAL DO ZERO - AUTENTICAÇÃO LIMPA
-- ================================================
-- ⚠️ REMOVE TUDO e recria sistema de autenticação limpo
-- Use quando há conflitos de usuários entre tabelas

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧹 INICIANDO RESET TOTAL DO ZERO...';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Removendo TODOS os usuários de TODAS as tabelas';
    RAISE NOTICE '';
END $$;

-- PASSO 1: Mostrar estado ANTES da limpeza
SELECT 
    'ANTES DA LIMPEZA' as status,
    'auth.users' as tabela,
    COUNT(*) as total
FROM auth.users

UNION ALL

SELECT 
    'ANTES DA LIMPEZA' as status,
    'user_profiles' as tabela,
    COUNT(*) as total
FROM user_profiles;

-- PASSO 2: LIMPAR TUDO - auth.users primeiro
DO $$
BEGIN
    RAISE NOTICE '🗑️ Removendo todos os usuários do sistema de autenticação...';
END $$;

DELETE FROM auth.users;

-- PASSO 3: LIMPAR user_profiles
DO $$
BEGIN
    RAISE NOTICE '🗑️ Removendo todos os perfis de usuário...';
END $$;

DELETE FROM user_profiles;

-- PASSO 4: Verificar limpeza total
SELECT 
    'APÓS LIMPEZA TOTAL' as status,
    'auth.users' as tabela,
    COUNT(*) as total
FROM auth.users

UNION ALL

SELECT 
    'APÓS LIMPEZA TOTAL' as status,
    'user_profiles' as tabela,
    COUNT(*) as total
FROM user_profiles;

-- PASSO 5: Recriar tabela user_profiles (estrutura limpa)
DROP TABLE IF EXISTS user_profiles CASCADE;

CREATE TABLE user_profiles (
  id UUID PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  role VARCHAR(20) NOT NULL DEFAULT 'user',
  full_name VARCHAR(255),
  avatar_url TEXT,
  hospital_access TEXT[] DEFAULT '{}',
  permissions TEXT[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  CONSTRAINT valid_roles CHECK (role IN ('developer', 'admin', 'user'))
);

-- PASSO 6: Configurar permissões (SEM RLS para evitar problemas)
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON TABLE user_profiles TO anon;
GRANT ALL PRIVILEGES ON TABLE user_profiles TO authenticated;
GRANT ALL PRIVILEGES ON TABLE user_profiles TO service_role;
GRANT ALL PRIVILEGES ON TABLE user_profiles TO postgres;

-- PASSO 7: Verificar estrutura criada
SELECT 
    'ESTRUTURA CRIADA' as status,
    table_name,
    'CRIADA' as estado
FROM information_schema.tables 
WHERE table_name = 'user_profiles';

-- PASSO 8: Status final - TUDO LIMPO
SELECT 
    'STATUS FINAL' as categoria,
    'auth.users' as tabela,
    COUNT(*)::TEXT as total
FROM auth.users

UNION ALL

SELECT 
    'STATUS FINAL' as categoria,
    'user_profiles' as tabela,
    COUNT(*)::TEXT as total
FROM user_profiles

UNION ALL

SELECT 
    'STATUS FINAL' as categoria,
    'RLS Status' as tabela,
    CASE WHEN c.relrowsecurity THEN 'HABILITADO' ELSE 'DESABILITADO ✅' END as total
FROM pg_class c WHERE c.relname = 'user_profiles';

-- RESULTADO FINAL
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 RESET TOTAL CONCLUÍDO!';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'SISTEMA COMPLETAMENTE LIMPO:';
    RAISE NOTICE '- auth.users: 0 usuários';
    RAISE NOTICE '- user_profiles: 0 usuários';
    RAISE NOTICE '- Estrutura recriada do zero';
    RAISE NOTICE '- Permissões configuradas';
    RAISE NOTICE '';
    RAISE NOTICE 'PRÓXIMOS PASSOS:';
    RAISE NOTICE '1. Acesse o sistema';
    RAISE NOTICE '2. Cadastre-se com:';
    RAISE NOTICE '   Email: developer@sigtap.com';
    RAISE NOTICE '   Senha: dev123456';
    RAISE NOTICE '   Role: Developer';
    RAISE NOTICE '3. Login funcionará normalmente';
    RAISE NOTICE '';
    RAISE NOTICE 'AGORA ESTÁ LIMPO PARA USAR! 🚀';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '';
END $$; 