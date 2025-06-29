# 🔥 **GUIA DE RESET COMPLETO - SUPABASE**

## ⚠️ **QUANDO USAR ESTE RESET**

- **Erros de constraints** (CNPJ, CPF, etc.)
- **Dados antigos/inconsistentes** 
- **Problemas de RLS** não resolvidos
- **Começar desenvolvimento** do zero
- **Migração** de dados problemáticos

## 🎯 **O QUE O RESET FAZ**

### ✅ **Remove Completamente**
- 🧹 **Todos os dados** de todas as tabelas
- 🔒 **Políticas RLS** problemáticas
- ⚖️ **Constraints** que causam erros
- 📊 **Dados de teste** antigos
- 🏥 **Hospitais** e configurações antigas

### ✅ **Recria do Zero**
- 🏥 **2 hospitais demo** funcionais
- ⚙️ **10 configurações** do sistema
- 📋 **Versão SIGTAP** inicial
- 🔍 **Função de verificação** atualizada
- 🎯 **Sistema 100% limpo**

## 🚀 **COMO EXECUTAR O RESET**

### **PASSO 1: Acessar Supabase**
1. Vá para [supabase.com](https://supabase.com)
2. Entre no seu projeto
3. Clique em **SQL Editor**

### **PASSO 2: Executar Script de Reset**
1. Copie **TODO** o conteúdo de: `database/reset_completo_CLEAN_START.sql`
2. Cole no SQL Editor
3. **Execute** o script completo
4. Aguarde a conclusão (pode demorar 30-60 segundos)

### **PASSO 3: Verificar Resultado**
Você deve ver mensagens como:
```
🧹 LIMPANDO TODAS AS TABELAS...
✅ Tabela procedure_records limpa
✅ Tabela hospitals limpa
[...]
🎉 RESET COMPLETO FINALIZADO COM SUCESSO!
```

### **PASSO 4: Testar Sistema**
```bash
npm run dev
```

## 📊 **APÓS O RESET - DADOS INCLUSOS**

### 🏥 **2 Hospitais Demo**
```
1. Hospital Demo - SIGTAP Sync (São Paulo/SP)
   - CNPJ: 12345678000190
   - Habilitações: CARDIOLOGIA, NEUROLOGIA, ONCOLOGIA, UTI

2. Hospital Teste - SIGTAP Sync (Rio de Janeiro/RJ)
   - CNPJ: 98765432000111
   - Habilitações: PEDIATRIA, CARDIOLOGIA, EMERGENCIA
```

### ⚙️ **10 Configurações Sistema**
- Versão 3.0.0
- Thresholds de matching
- Configurações de billing
- Modo desenvolvimento ativo
- Limites de usuários por hospital

### 📋 **1 Versão SIGTAP Inicial**
- Demo Version 2024.06
- 0 procedimentos (aguardando importação)
- Pronta para receber dados reais

## ✅ **VERIFICAÇÃO DE SAÚDE**

Após o reset, execute:
```sql
SELECT * FROM check_system_health();
```

**Resultado esperado:**
```
Hospitais        | ✅ OK           | 2 hospitais configurados
Configurações    | ✅ OK           | 10 configurações carregadas
Procedimentos    | ⚠️ EMPTY        | 0 procedimentos (normal)
Versões SIGTAP   | ✅ OK           | 1 versões disponíveis
Pacientes        | ⚠️ VAZIO        | 0 pacientes (normal)
AIHs             | ⚠️ VAZIO        | 0 AIHs (normal)
Status Geral     | ✅ SISTEMA LIMPO | Pronto para uso
```

## 🔄 **PRÓXIMOS PASSOS APÓS RESET**

### **1. Testar Autenticação**
```bash
npm run dev
```
- Login deve funcionar
- Dashboard deve carregar
- Estatísticas devem mostrar zeros (normal)

### **2. Importar Dados SIGTAP**
- Use a aba "Importar SIGTAP"
- Carregue arquivo Excel/PDF/ZIP
- Aguarde processamento

### **3. Testar Upload AIH**
- Use a aba "Upload AIH"
- Teste com arquivo PDF
- Verifique se persiste no banco

### **4. Registrar Pacientes**
- Use "Gestão de Pacientes"
- Adicione pacientes de teste
- Confirme persistência

### **5. Verificar Relatórios**
- Acesse "Relatórios"
- Confirme dados reais
- Teste exportação CSV

## 🚨 **TROUBLESHOOTING**

### **Erro: "table does not exist"**
```sql
-- Execute primeiro o schema principal:
-- database/schema.sql
```

### **Erro: "function uuid_generate_v4() does not exist"**
```sql
-- Habilite extensão UUID:
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### **Sistema ainda com problemas**
```sql
-- Execute novamente o reset:
-- database/reset_completo_CLEAN_START.sql
```

## 📞 **SUPORTE**

Se ainda houver problemas após o reset:

1. **Verifique logs** no console do navegador
2. **Execute verificação**: `SELECT * FROM check_system_health();`
3. **Teste conexão**: Arquivo `.env` configurado corretamente
4. **Recrear projeto** Supabase (última opção)

---

## ⚡ **RESUMO RÁPIDO**

```bash
# 1. Copie e execute no SQL Editor:
database/reset_completo_CLEAN_START.sql

# 2. Teste o sistema:
npm run dev

# 3. Verifique saúde:
SELECT * FROM check_system_health();

# 4. Comece a usar normalmente!
```

**✅ Sistema 100% limpo e pronto para produção!** 