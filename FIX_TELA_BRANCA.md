# 🚨 FIX TELA BRANCA - EXECUTE AGORA

## PROBLEMA: Tabela `user_profiles` não existe

## SOLUÇÃO RÁPIDA:

Execute este SQL no Supabase:

```sql
-- CRIAR TABELA USER_PROFILES
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
  
  CONSTRAINT valid_roles CHECK (role IN ('developer', 'admin', 'user'))
);

-- DESABILITAR RLS
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- GARANTIR PERMISSÕES
GRANT ALL ON TABLE user_profiles TO anon;
GRANT ALL ON TABLE user_profiles TO authenticated;

-- CRIAR SEU PERFIL
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
    'Usuário Principal',
    ARRAY['all']
);

-- VERIFICAR
SELECT 'SUCESSO!' as status, COUNT(*) as perfis FROM user_profiles;
```

## RESULTADO:
- ✅ Sistema deve carregar normalmente
- ✅ Tela branca corrigida
- ✅ Navegação funcionando 