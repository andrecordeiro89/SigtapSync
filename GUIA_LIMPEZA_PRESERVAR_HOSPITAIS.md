# 🏥 **LIMPEZA SELETIVA - PRESERVAR HOSPITAIS**

## 🎯 **OBJETIVO**

Limpar **TODOS** os dados do sistema, **EXCETO** os hospitais reais que você já configurou.

## ✅ **O QUE É PRESERVADO**
- 🏥 **Tabela `hospitals`** - Todos os seus hospitais reais
- 🔒 **Políticas RLS dos hospitais** - Segurança mantida

## 🧹 **O QUE É LIMPO**
- 👥 **`patients`** - Todos os pacientes
- 📄 **`aihs`** - Todas as AIHs processadas
- 🔗 **`aih_matches`** - Todos os matches de procedimentos
- 📋 **`procedure_records`** - Todos os registros de procedimentos
- 📊 **`sigtap_procedures`** - Tabela SIGTAP (pronta para nova importação)
- 📦 **`sigtap_versions`** - Versões anteriores
- ⚙️ **`system_settings`** - Configurações (recriadas limpas)

## 🚀 **COMO EXECUTAR**

### **PASSO 1: Supabase SQL Editor**
1. Acesse [supabase.com](https://supabase.com)
2. Entre no seu projeto
3. Clique em **SQL Editor**

### **PASSO 2: Execute o Script**
1. Copie **TODO** o conteúdo de: `database/limpar_PRESERVAR_HOSPITAIS.sql`
2. Cole no SQL Editor
3. Clique em **"RUN"** ou **"Executar"**

### **PASSO 3: Verificar Resultado**
Você verá mensagens como:
```
🧹 LIMPANDO TABELAS (PRESERVANDO HOSPITAIS)...
✅ Tabela patients limpa (X registros removidos)
✅ Tabela aihs limpa (Y registros removidos)
🏥 HOSPITAIS PRESERVADOS - dados mantidos intactos

🏥 HOSPITAIS PRESERVADOS: X hospitais mantidos
  📍 Hospital ABC: São Paulo, SP
  📍 Hospital XYZ: Rio de Janeiro, RJ
```

## 📊 **VERIFICAÇÃO DE SUCESSO**

Execute no SQL Editor:
```sql
SELECT * FROM check_system_health();
```

**Resultado esperado:**
```
Hospitais Preservados | ✅ MANTIDOS | X hospitais preservados
Configurações        | ✅ OK       | 10 configurações carregadas
Procedimentos SIGTAP  | ⚠️ LIMPO    | 0 procedimentos (pronto para importação)
Pacientes            | ✅ LIMPO    | 0 pacientes registrados
AIHs                 | ✅ LIMPO    | 0 AIHs processadas
Status Geral         | ✅ HOSPITAIS PRESERVADOS | Dados limpos, hospitais mantidos
```

## 🏥 **VERIFICAR HOSPITAIS PRESERVADOS**

```sql
SELECT name, city, state FROM hospitals ORDER BY name;
```

Deve mostrar todos os seus hospitais reais intactos.

## ✅ **APÓS A LIMPEZA**

### **1. Teste o Sistema**
```bash
npm run dev
```

### **2. Verificações Esperadas**
- ✅ **Login funcionando**
- ✅ **Dashboard carregando** (estatísticas zeradas - normal)
- ✅ **Hospitais aparecendo** nos seletores
- ✅ **Gestão de pacientes vazia** (pronta para novos cadastros)
- ✅ **Upload AIH funcional** (pronto para novos uploads)

### **3. Próximos Passos**
1. **Importar SIGTAP** (aba "Importar SIGTAP")
2. **Cadastrar pacientes** (aba "Gestão de Pacientes")
3. **Upload AIHs** (aba "Upload AIH")
4. **Gerar relatórios** (aba "Relatórios")

## 🔍 **COMANDOS ÚTEIS APÓS LIMPEZA**

### Ver hospitais preservados:
```sql
SELECT name, city, state, is_active FROM hospitals;
```

### Verificar se tabelas estão limpas:
```sql
SELECT 
    'patients' as tabela, COUNT(*) as registros FROM patients
UNION ALL
SELECT 'aihs', COUNT(*) FROM aihs
UNION ALL
SELECT 'sigtap_procedures', COUNT(*) FROM sigtap_procedures;
```

### Verificar saúde geral:
```sql
SELECT * FROM check_system_health();
```

## ⚠️ **IMPORTANTE**

- **NÃO** remove os hospitais - eles ficam intactos
- **Remove TODOS** os outros dados - pacientes, AIHs, procedimentos
- **Recria** configurações básicas do sistema
- **Mantém** a estrutura das tabelas

## 🎯 **QUANDO USAR**

- ✅ Quando quiser **manter hospitais** e limpar dados
- ✅ Para **recomeçar** com dados reais dos hospitais
- ✅ Eliminar **dados de teste/desenvolvimento**
- ✅ **Preparar sistema** para produção com hospitais reais

---

## ⚡ **RESUMO RÁPIDO**

```bash
# 1. Supabase SQL Editor:
database/limpar_PRESERVAR_HOSPITAIS.sql

# 2. Verificar:
SELECT * FROM check_system_health();
SELECT name FROM hospitals;

# 3. Teste:
npm run dev

# ✅ HOSPITAIS PRESERVADOS, DADOS LIMPOS!
```

**🏥 Seus hospitais ficam intactos, tudo o resto fica limpo e pronto para uso!** 