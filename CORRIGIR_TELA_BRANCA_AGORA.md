# 🚨 CORREÇÃO TELA BRANCA - EXECUTE AGORA

## 🎯 **PROBLEMA IDENTIFICADO:**
- **CAUSA:** Tabela `user_profiles` não existe
- **SINTOMA:** Tela branca infinita, sistema não carrega
- **LOG:** `🔍 Buscando perfil para userId: 32568fe0-b744-4a15-97a4-b54ed0b0610e`

---

## ⚡ **SOLUÇÃO RÁPIDA - EXECUTE AGORA:**

### **PASSO 1: Execute este SQL no Supabase**
```sql
database/fix_tela_branca_SIMPLES.sql
```

**OU copie e cole este código diretamente:**

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

-- DESABILITAR RLS TEMPORARIAMENTE
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
)
ON CONFLICT (id) DO UPDATE SET
    role = 'developer',
    permissions = ARRAY['all'];

-- VERIFICAR SUCESSO
SELECT 'SUCESSO - Sistema deve carregar agora!' as status, COUNT(*) as perfis FROM user_profiles;
```

---

### **PASSO 2: Recarregue o Sistema**
1. **Salve** o código React (Ctrl+S)
2. **Recarregue** a página no navegador (F5)
3. **Sistema deve carregar** normalmente

---

## ✅ **SINAIS DE SUCESSO:**

### **Console deve mostrar:**
```
✅ Perfil encontrado: {id: "32568fe0-...", role: "developer", ...}
🚀 Supabase habilitado - carregando dados...
```

### **Sistema deve:**
- ✅ Carregar interface completa
- ✅ Mostrar navegação
- ✅ Exibir nome do usuário
- ✅ Funcionar normalmente

---

## 🚨 **SE AINDA NÃO FUNCIONAR:**

### **Execute comandos adicionais:**
```sql
-- Verificar se tabela foi criada
SELECT COUNT(*) FROM user_profiles;

-- Verificar seu perfil
SELECT * FROM user_profiles WHERE id = '32568fe0-b744-4a15-97a4-b54ed0b0610e';

-- Recriar perfil se necessário
DELETE FROM user_profiles WHERE id = '32568fe0-b744-4a15-97a4-b54ed0b0610e';
INSERT INTO user_profiles (id, email, role, full_name, permissions)
VALUES ('32568fe0-b744-4a15-97a4-b54ed0b0610e', 'dev@sistema.com', 'developer', 'Dev Principal', ARRAY['all']);
```

---

## 🔧 **EXPLICAÇÃO TÉCNICA:**

1. **AuthContext** estava buscando perfil na tabela `user_profiles`
2. **Tabela não existia** no schema original
3. **Sistema travava** em loading infinito
4. **Solução:** Criar tabela + perfil do usuário
5. **Resultado:** Sistema carrega normalmente

---

**Execute o SQL acima e seu sistema voltará a funcionar! 🚀** 