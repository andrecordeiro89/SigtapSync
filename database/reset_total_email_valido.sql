-- ================================================
-- RESET TOTAL COM EMAIL VÁLIDO
-- ================================================
-- Versão corrigida usando email @gmail.com (válido)

DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🧹 RESET TOTAL - EMAIL VÁLIDO...';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'Usando email: developer@gmail.com';
    RAISE NOTICE '';
END $$;

-- PASSO 1: Limpeza total
DELETE FROM auth.users;
DELETE FROM user_profiles;

-- PASSO 2: Recriar tabela user_profiles
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

-- PASSO 3: Configurar permissões
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;
GRANT ALL PRIVILEGES ON TABLE user_profiles TO anon;
GRANT ALL PRIVILEGES ON TABLE user_profiles TO authenticated;
GRANT ALL PRIVILEGES ON TABLE user_profiles TO service_role;
GRANT ALL PRIVILEGES ON TABLE user_profiles TO postgres;

-- PASSO 4: Verificar status final
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
FROM user_profiles;

-- RESULTADO FINAL
DO $$
BEGIN
    RAISE NOTICE '';
    RAISE NOTICE '🎉 RESET CONCLUÍDO!';
    RAISE NOTICE '==========================================';
    RAISE NOTICE 'AGORA CADASTRE-SE COM:';
    RAISE NOTICE 'Email: developer@gmail.com';
    RAISE NOTICE 'Senha: dev123456';
    RAISE NOTICE 'Role: Developer';
    RAISE NOTICE '';
    RAISE NOTICE 'EMAIL VÁLIDO - DEVE FUNCIONAR! 🚀';
    RAISE NOTICE '==========================================';
    RAISE NOTICE '';
END $$; 