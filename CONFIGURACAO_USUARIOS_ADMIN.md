# 🔐 CONFIGURAÇÃO DOS USUÁRIOS ADMINISTRATIVOS - SIGTAP SYNC

## 📋 Resumo dos Usuários Administrativos

| Email | Role | Acesso | Descrição |
|-------|------|---------|-----------|
| `diretoria@sigtap.com` | `director` | **TOTAL** | Diretoria - Controle executivo completo |
| `admin@sigtap.com` | `admin` | **TOTAL** | Administrador geral do sistema |
| `ti@sigtap.com` | `ti` | **TOTAL** | TI - Acesso técnico e debug |
| `coordenacao@sigtap.com` | `coordinator` | **TOTAL** | Coordenação - Supervisão geral |
| `auditoria@sigtap.com` | `auditor` | **TOTAL** | Auditoria - Monitoramento completo |

## 🚀 Como Configurar

### 1. Execute o Script de Configuração *(RECOMENDADO)*
```sql
-- Cole e execute no SQL Editor do Supabase:
-- database/setup_admin_users_COMPLETE.sql
-- (Agora inclui correção automática de todas as constraints)
```

### 2. Verifique a Configuração
```sql
-- Cole e execute para verificar:
-- database/verify_admin_setup.sql
```

### 3. (OPCIONAL) Scripts Individuais se necessário
```sql
-- Se tiver problemas específicos:
-- database/fix_user_profiles_constraint.sql (para FK)
-- database/fix_valid_roles_constraint.sql (para roles)
-- database/create_audit_logs_table.sql (para audit_logs)
-- database/test_insert_simples.sql (para testar)
-- database/diagnostico_completo_constraints.sql (para diagnóstico)
```

## 🎯 Funcionalidades por Usuário

### 🏢 **DIRETORIA** (`diretoria@sigtap.com`)
**Acesso Completo de Gestão:**
- ✅ Dashboard executivo
- ✅ Consulta SIGTAP
- ✅ AIH Avançado (Sistema Oficial)
- ✅ Gerenciamento de Pacientes
- ✅ **Importação SIGTAP** (Exclusivo diretoria)
- ✅ Upload AIH (Testes)
- ✅ **Relatórios Executivos**
- ✅ **Acesso a todos os hospitais**

### ⚙️ **ADMIN** (`admin@sigtap.com`)
**Administração Geral:**
- ✅ Todas as funcionalidades da diretoria
- ✅ Gerenciamento de usuários
- ✅ Configurações do sistema
- ✅ **Acesso administrativo completo**

### 💻 **TI** (`ti@sigtap.com`)
**Acesso Técnico Avançado:**
- ✅ Todas as funcionalidades administrativas
- ✅ **Modo debug**
- ✅ **Acesso ao banco de dados**
- ✅ Logs técnicos detalhados
- ✅ **Resolução de problemas técnicos**

### 👥 **COORDENAÇÃO** (`coordenacao@sigtap.com`)
**Supervisão Operacional:**
- ✅ Dashboard de coordenação
- ✅ Todas as funcionalidades operacionais
- ✅ Relatórios de supervisão
- ✅ **Gestão de processos**

### 🔍 **AUDITORIA** (`auditoria@sigtap.com`)
**Monitoramento e Controle:**
- ✅ Dashboard de auditoria
- ✅ **Acesso total aos logs**
- ✅ Relatórios de auditoria
- ✅ Monitoramento de atividades
- ✅ **Rastreamento completo**

## 🚫 Usuários Operadores (Comparação)

### 👤 **OPERADORES** (`faturamento@hospital.com.br`)
**Interface Simplificada:**
- ✅ Dashboard
- ✅ Consulta SIGTAP
- ✅ AIH Avançado (Sistema Oficial)
- ✅ Gerenciamento de Pacientes
- ❌ ~~Importação SIGTAP~~ (Oculto)
- ❌ ~~Upload AIH (Testes)~~ (Oculto)
- ❌ ~~Relatórios Executivos~~ (Oculto)

## 🔧 Sistema de Permissões

### **Permissões Administrativas:**
```json
[
  "read_all_data",        // Leitura total
  "write_all_data",       // Escrita total  
  "delete_data",          // Exclusão
  "manage_users",         // Gestão de usuários
  "access_all_hospitals", // Todos os hospitais
  "generate_reports",     // Relatórios
  "import_sigtap",        // Importação SIGTAP
  "manage_procedures",    // Gestão de procedimentos
  "audit_access",         // Acesso a auditoria
  "system_admin"          // Administração do sistema
]
```

### **Permissões Especiais TI:**
```json
// Todas as acima +
[
  "database_access",      // Acesso ao DB
  "debug_mode"           // Modo debug
]
```

## 🧪 Como Testar

### 1. **Teste de Login:**
- Acesse o sistema com qualquer email administrativo
- Selecione qualquer hospital na lista
- Confirme acesso total às funcionalidades

### 2. **Verificação de Interface:**
```
HEADER ADMINISTRATIVO:
Dashboard | Consulta SIGTAP | AIH Avançado [OFICIAL] | Pacientes | SIGTAP | Upload AIH (Teste) | Relatórios

HEADER OPERADOR:
Dashboard | Consulta SIGTAP | AIH Avançado [OFICIAL] | Pacientes
```

### 3. **Teste de Permissões:**
- **Admins:** Veem todas as 7 tabs
- **Operadores:** Veem apenas 4 tabs

## 🔐 Segurança

### **Logs de Auditoria:**
- Todas as ações administrativas são logadas
- Rastreamento completo de acesso
- Monitoramento em tempo real

### **Controle de Acesso:**
- Baseado em roles e permissões
- Acesso granular por funcionalidade
- Verificação automática no frontend

## 📊 Relatórios Disponíveis

### **Para Administradores:**
- Relatórios executivos completos
- Análise de uso do sistema
- Estatísticas de hospitais
- Performance de processamento

### **Para Operadores:**
- Relatórios básicos do hospital
- Estatísticas operacionais simples

## ✅ Checklist de Configuração

- [ ] Execute `setup_admin_users_COMPLETE.sql` *(corrige tudo automaticamente)*
- [ ] Execute `verify_admin_setup.sql`
- [ ] Confirme que 5 usuários foram criados
- [ ] Verifique que tabela `audit_logs` foi criada
- [ ] Teste login com `diretoria@sigtap.com`
- [ ] Verifique se todas as 7 tabs aparecem
- [ ] Teste login com usuário operador
- [ ] Confirme que apenas 4 tabs aparecem
- [ ] Verifique logs de auditoria funcionando

## 🚨 Solução de Problemas

### **ERRO: null value in column "id" violates not-null constraint**
Este erro indica problema com foreign key. Execute a correção:
```sql
-- 1. Execute primeiro:
-- database/fix_user_profiles_constraint.sql

-- 2. Depois execute:
-- database/setup_admin_users_COMPLETE.sql
```

### **ERRO: new row violates check constraint "valid_roles"**
Este erro indica que a constraint de roles não aceita os valores administrativos:
```sql
-- 1. Execute primeiro:
-- database/fix_valid_roles_constraint.sql

-- 2. Depois execute:
-- database/setup_admin_users_COMPLETE.sql
```

### **ERRO: column "user_email" of relation "audit_logs" does not exist**
Este erro indica que a tabela audit_logs não existe ou tem estrutura incorreta:
```sql
-- 1. Execute primeiro:
-- database/create_audit_logs_table.sql

-- 2. Depois execute:
-- database/setup_admin_users_COMPLETE.sql
```

### **SOLUÇÃO RÁPIDA - Execute apenas:**
```sql
-- O script principal agora corrige automaticamente:
-- database/setup_admin_users_COMPLETE.sql
-- (Inclui: FK + roles + audit_logs + inserção + verificação)
```

### **Se algum usuário não aparecer:**
```sql
-- Verifique se foi criado:
SELECT * FROM user_profiles WHERE email = 'email@sigtap.com';
```

### **Se não tiver acesso total:**
```sql
-- Verifique permissões:
SELECT email, role, hospital_access, permissions 
FROM user_profiles 
WHERE email = 'email@sigtap.com';
```

### **Se as tabs não aparecerem:**
- Limpe o cache do navegador
- Verifique se `hasFullAccess()` retorna `true`
- Confirme que o role está correto

### **Outros erros de constraint:**
```sql
-- Verificar constraints ativas:
SELECT constraint_name, constraint_type 
FROM information_schema.table_constraints 
WHERE table_name = 'user_profiles';
```

## 📞 Suporte

Em caso de problemas, verifique:
1. Scripts SQL executados corretamente
2. Usuários criados com roles corretos
3. Permissões configuradas adequadamente
4. Cache do navegador limpo
5. Logs de auditoria para diagnóstico 