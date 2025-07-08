# 🔐 **GUIA COMPLETO DE PERMISSÕES - SIGTAP BILLING WIZARD**

## 📋 **RESUMO EXECUTIVO**

Sistema de permissões granulares implementado com **Row Level Security (RLS)** do Supabase, garantindo que **users** vejam apenas seus próprios dados, enquanto **admin, auditor, coordinator, director e TI** têm acesso total ao sistema.

---

## 🎯 **HIERARQUIA DE ACESSO IMPLEMENTADA**

### **🔴 ROLES COM ACESSO TOTAL**
- **🟣 DEVELOPER** - Acesso total + código + configurações
- **🔵 ADMIN** - Acesso administrativo completo
- **🛡️ DIRECTOR** - Acesso executivo total
- **✅ COORDINATOR** - Acesso supervisão total  
- **👁️ AUDITOR** - Acesso monitoramento total
- **💻 TI** - Acesso técnico total

### **🔵 ROLE COM ACESSO LIMITADO**
- **👤 USER** - Acesso limitado ao próprio hospital e dados criados por ele

---

## 🗄️ **ESTRUTURA DA TABELA USER_PROFILES**

```sql
CREATE TABLE user_profiles (
    id UUID REFERENCES auth.users(id) PRIMARY KEY,
    email VARCHAR UNIQUE NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'user' 
        CHECK (role IN ('developer', 'admin', 'user', 'director', 'ti', 'coordinator', 'auditor')),
    full_name VARCHAR,
    avatar_url TEXT,
    hospital_access TEXT[] DEFAULT '{}',  -- Array de IDs de hospitais
    permissions TEXT[] DEFAULT '{}',      -- Array de permissões específicas
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    temp_password_set BOOLEAN DEFAULT false,
    migrated_to_auth BOOLEAN DEFAULT false
);
```

---

## 🔒 **REGRAS RLS IMPLEMENTADAS**

### **1. FUNÇÃO DE VERIFICAÇÃO DE ACESSO TOTAL**
```sql
CREATE OR REPLACE FUNCTION has_full_access_role(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = user_id 
        AND role IN ('developer', 'admin', 'director', 'coordinator', 'auditor', 'ti')
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### **2. FUNÇÃO DE VERIFICAÇÃO DE USUÁRIO BÁSICO**
```sql
CREATE OR REPLACE FUNCTION is_basic_user(user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_profiles 
        WHERE id = user_id 
        AND role = 'user'
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### **3. POLÍTICAS RLS POR TABELA**

#### **📋 USER_PROFILES**
```sql
-- Users básicos só veem seu próprio perfil
CREATE POLICY "basic_users_own_profile" ON user_profiles
    FOR ALL USING (auth.uid() = id AND is_basic_user());

-- Users com acesso total veem todos os perfis  
CREATE POLICY "full_access_all_profiles" ON user_profiles
    FOR ALL USING (has_full_access_role());
```

#### **🏥 HOSPITALS**
```sql
-- Acesso total para roles elevados
CREATE POLICY "hospital_full_access" ON hospitals
    FOR ALL USING (has_full_access_role() OR auth.jwt() ->> 'role' = 'service_role');

-- Users só veem hospitais do seu acesso
CREATE POLICY "hospital_user_access" ON hospitals
    FOR SELECT USING (
        is_basic_user() AND (
            id = ANY(SELECT unnest(hospital_access) FROM user_profiles WHERE id = auth.uid())
        )
    );
```

#### **👥 PATIENTS**
```sql
-- Acesso total para roles elevados
CREATE POLICY "patients_full_access" ON patients
    FOR ALL USING (has_full_access_role() OR auth.jwt() ->> 'role' = 'service_role');

-- Users só veem pacientes do seu hospital
CREATE POLICY "patients_user_hospital" ON patients
    FOR ALL USING (
        is_basic_user() AND hospital_id = ANY(
            SELECT unnest(hospital_access) FROM user_profiles WHERE id = auth.uid()
        )
    );
```

#### **📋 AIHS**
```sql
-- Acesso total para roles elevados
CREATE POLICY "aihs_full_access" ON aihs
    FOR ALL USING (has_full_access_role() OR auth.jwt() ->> 'role' = 'service_role');

-- Users só veem AIHs do seu hospital
CREATE POLICY "aihs_user_hospital" ON aihs
    FOR ALL USING (
        is_basic_user() AND hospital_id = ANY(
            SELECT unnest(hospital_access) FROM user_profiles WHERE id = auth.uid()
        )
    );
```

#### **🔍 PROCEDURE_RECORDS**
```sql
-- Acesso total para roles elevados
CREATE POLICY "procedure_records_full_access" ON procedure_records
    FOR ALL USING (has_full_access_role() OR auth.jwt() ->> 'role' = 'service_role');

-- Users só veem procedimentos do seu hospital
CREATE POLICY "procedure_records_user_hospital" ON procedure_records
    FOR ALL USING (
        is_basic_user() AND hospital_id = ANY(
            SELECT unnest(hospital_access) FROM user_profiles WHERE id = auth.uid()
        )
    );
```

#### **📊 AUDIT_LOGS**
```sql
-- Acesso total para roles elevados
CREATE POLICY "audit_logs_full_access" ON audit_logs
    FOR ALL USING (has_full_access_role() OR auth.jwt() ->> 'role' = 'service_role');

-- Users só veem próprios logs
CREATE POLICY "audit_logs_own_actions" ON audit_logs
    FOR SELECT USING (is_basic_user() AND user_id = auth.uid());
```

---

## 💻 **VERIFICAÇÕES NO FRONTEND (AuthContext.tsx)**

### **FUNÇÃO DE ACESSO TOTAL**
```typescript
const hasFullAccessRole = (role: UserRole): boolean => {
    return ['developer', 'admin', 'director', 'coordinator', 'auditor', 'ti'].includes(role);
};
```

### **VERIFICAÇÕES DE ROLE**
```typescript
// Verificadores individuais
const isDeveloper = (): boolean => user?.role === 'developer';
const isAdmin = (): boolean => user?.role === 'admin' || user?.role === 'developer';
const isDirector = (): boolean => user?.role === 'director';
const isCoordinator = (): boolean => user?.role === 'coordinator';
const isAuditor = (): boolean => user?.role === 'auditor';
const isTI = (): boolean => user?.role === 'ti';

// Verificação de acesso total
const hasFullAccess = (): boolean => user?.full_access || false;

// Verificação de permissão específica
const hasPermission = (permission: string): boolean => {
    if (!user) return false;
    if (user.full_access) return true;
    if (user.role === 'developer') return true;
    return user.permissions.includes(permission) || user.permissions.includes('all');
};
```

---

## 🧪 **USUÁRIOS DEMO CRIADOS**

| **Email** | **Role** | **Hospital Access** | **Permissions** |
|-----------|----------|-------------------|-----------------|
| `developer@sigtap.com` | developer | ALL | all |
| `admin@sigtap.com` | admin | ALL | admin_access, generate_reports |
| `director@sigtap.com` | director | ALL | executive_access, generate_reports |
| `coordinator@sigtap.com` | coordinator | ALL | coordination_access, generate_reports |
| `auditor@sigtap.com` | auditor | ALL | audit_access, view_all_data |
| `ti@sigtap.com` | ti | ALL | technical_access, system_config |
| `user@hospital1.com` | user | hospital_id_específico | basic_access |

---

## 🚀 **COMO IMPLEMENTAR**

### **1. EXECUTAR SCRIPT SQL**
```sql
-- No SQL Editor do Supabase
\i database/fix_user_profiles_permissions.sql
```

### **2. VERIFICAR IMPLEMENTAÇÃO**
```sql
-- Verificar estrutura
\d user_profiles

-- Verificar políticas
SELECT * FROM pg_policies WHERE tablename = 'user_profiles';

-- Verificar usuários demo
SELECT email, role, hospital_access, permissions FROM user_profiles;

-- Teste de função
SELECT has_full_access_role();
```

### **3. TESTAR NO FRONTEND**
```typescript
// Em qualquer componente
const { user, hasFullAccess, hasPermission, isAdmin } = useAuth();

console.log('User role:', user?.role);
console.log('Has full access:', hasFullAccess());
console.log('Is admin:', isAdmin());
console.log('Can generate reports:', hasPermission('generate_reports'));
```

---

## 🔍 **CENÁRIOS DE TESTE**

### **TESTE 1: USER BÁSICO**
```typescript
// Login como user@hospital1.com
// Deve ver apenas:
// - Seu próprio perfil
// - Pacientes do hospital específico
// - AIHs do hospital específico  
// - Próprios logs de auditoria
```

### **TESTE 2: ADMIN**
```typescript
// Login como admin@sigtap.com
// Deve ver:
// - Todos os perfis de usuários
// - Todos os hospitais
// - Todos os pacientes
// - Todas as AIHs
// - Todos os logs de auditoria
```

### **TESTE 3: DIRECTOR**
```typescript
// Login como director@sigtap.com
// Deve ter acesso total igual ao admin
// + Dashboard Executivo
// + Relatórios Avançados
```

---

## ⚡ **PERFORMANCE E OTIMIZAÇÃO**

### **ÍNDICES CRIADOS**
```sql
CREATE INDEX idx_user_profiles_role ON user_profiles(role);
CREATE INDEX idx_user_profiles_active ON user_profiles(is_active);
CREATE INDEX idx_user_profiles_hospital_access ON user_profiles USING GIN(hospital_access);
```

### **CACHE DE PERMISSÕES**
- Verificações de role são calculadas no login
- `full_access` flag é persistida na sessão
- Reduz consultas ao banco durante navegação

---

## 🛡️ **SEGURANÇA IMPLEMENTADA**

### **RLS ATIVADO EM TODAS AS TABELAS**
- ✅ user_profiles
- ✅ hospitals  
- ✅ patients
- ✅ aihs
- ✅ procedure_records
- ✅ aih_matches
- ✅ audit_logs

### **PROTEÇÃO CONTRA BYPASS**
- Service role sempre tem acesso (para sistema)
- Funções são SECURITY DEFINER
- Políticas verificam is_active = true
- Logs de auditoria para todas as ações

---

## 📊 **MONITORAMENTO**

### **VERIFICAÇÃO DE SAÚDE**
```sql
-- Verificar políticas ativas
SELECT tablename, policyname, cmd, qual 
FROM pg_policies 
WHERE tablename IN ('user_profiles', 'hospitals', 'patients', 'aihs');

-- Verificar usuários por role
SELECT role, COUNT(*) 
FROM user_profiles 
WHERE is_active = true 
GROUP BY role;

-- Verificar logs de acesso
SELECT action, COUNT(*) 
FROM audit_logs 
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY action;
```

---

## 🔧 **TROUBLESHOOTING**

### **PROBLEMA: User não vê dados**
```sql
-- Verificar hospital_access
SELECT hospital_access FROM user_profiles WHERE email = 'user@email.com';

-- Verificar se hospital existe
SELECT id, name FROM hospitals WHERE id = 'hospital_id';
```

### **PROBLEMA: Admin não tem acesso total**
```sql
-- Verificar role e is_active
SELECT role, is_active FROM user_profiles WHERE email = 'admin@email.com';

-- Testar função manualmente
SELECT has_full_access_role('user_uuid_here');
```

### **PROBLEMA: RLS bloqueando tudo**
```sql
-- Desabilitar temporariamente para debug
ALTER TABLE user_profiles DISABLE ROW LEVEL SECURITY;

-- Reabilitar após correção
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
```

---

## ✅ **CHECKLIST DE IMPLEMENTAÇÃO**

- [ ] **Script SQL executado** - `fix_user_profiles_permissions.sql`
- [ ] **Constraint de roles atualizada** - todos os 7 roles
- [ ] **Campos adicionais criados** - temp_password_set, migrated_to_auth
- [ ] **Funções RLS criadas** - has_full_access_role, is_basic_user
- [ ] **Políticas aplicadas** - todas as 7 tabelas principais
- [ ] **Usuários demo criados** - 6 roles + 1 user básico
- [ ] **Frontend testado** - AuthContext funcionando
- [ ] **Navegação testada** - menus por role
- [ ] **Dados filtrados** - each role vê o que deve
- [ ] **Auditoria funcionando** - logs sendo criados

---

## 📞 **SUPORTE**

Para dúvidas ou problemas:
1. **Verificar logs do Supabase** - SQL Editor > Logs
2. **Testar funções individualmente** - SELECT has_full_access_role();
3. **Verificar RLS** - \dp table_name no psql
4. **Consultar auditoria** - SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 10;

---

**✅ SISTEMA DE PERMISSÕES IMPLEMENTADO E PRONTO PARA USO!** 