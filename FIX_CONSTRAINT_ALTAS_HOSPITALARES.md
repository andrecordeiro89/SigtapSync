# 🔧 FIX: Constraint de Foreign Key em hospital_discharges

## ❌ **PROBLEMA IDENTIFICADO**

```
Error: insert or update on table "hospital_discharges" violates foreign key constraint "hospital_discharges_created_by_fkey"
```

**Causa**: O campo `created_by` estava tentando fazer referência a `auth.users(id)`, mas o sistema usa autenticação customizada via `user_profiles`.

---

## ✅ **SOLUÇÃO APLICADA**

Removida a constraint de Foreign Key do campo `created_by`, tornando-o um simples UUID opcional.

---

## 🚀 **COMO APLICAR O FIX**

### **Opção 1: Script de Fix Rápido (RECOMENDADO)**

1. Abra o **Supabase SQL Editor**
2. Cole o conteúdo do arquivo:
   ```
   database/fix_hospital_discharges_constraint.sql
   ```
3. Clique em **RUN** para executar
4. Aguarde a mensagem de sucesso

### **Opção 2: Script Original Atualizado**

Se a tabela ainda não foi criada, use o script original atualizado:
1. Abra o **Supabase SQL Editor**
2. Cole o conteúdo do arquivo:
   ```
   database/create_hospital_discharges_table.sql
   ```
3. Clique em **RUN** para executar

---

## 📋 **O QUE FOI ALTERADO**

### **ANTES** ❌
```sql
created_by UUID REFERENCES auth.users(id),  -- ❌ Constraint FK problemática
```

### **DEPOIS** ✅
```sql
created_by UUID,  -- ✅ UUID simples sem FK (flexível)
```

---

## 🔒 **SEGURANÇA MANTIDA**

✅ O campo `created_by` ainda armazena o UUID do usuário  
✅ Row Level Security (RLS) continua ativo  
✅ Políticas de acesso por hospital mantidas  
✅ Isolamento de dados por hospital funcional  

**A única mudança é que não há mais validação de FK para `auth.users`**, permitindo que o sistema use os IDs de `user_profiles`.

---

## ✅ **TESTE APÓS APLICAR O FIX**

1. Vá para a tela **"Altas Hospitalares"**
2. Selecione um arquivo Excel
3. Clique em **"Importar"**
4. Deve funcionar sem erros! 🎉

---

## 📊 **SCRIPTS DISPONÍVEIS**

| Arquivo | Descrição | Quando Usar |
|---------|-----------|-------------|
| `fix_hospital_discharges_constraint.sql` | **Fix rápido** - Dropa e recria a tabela | Se a tabela já existe com erro |
| `create_hospital_discharges_table.sql` | Script original atualizado | Primeira instalação ou instalação limpa |

---

## 💡 **POR QUE ISSO ACONTECEU?**

O sistema SigtapSync usa um **modelo de autenticação customizado** baseado em `user_profiles`, onde os usuários são gerenciados manualmente no banco de dados, não via `auth.users` do Supabase.

A constraint de FK para `auth.users` causava conflito porque:
1. Os usuários não estão na tabela `auth.users`
2. Os IDs vêm de `user_profiles.id`
3. A validação FK falhava ao tentar inserir

**Solução**: Remover a constraint FK e manter apenas o UUID para rastreamento.

---

## ✅ **STATUS FINAL**

- ✅ Constraint FK removida
- ✅ Campo `created_by` mantido como UUID
- ✅ Auditoria funcional
- ✅ RLS mantido
- ✅ Scripts atualizados
- ✅ Sistema pronto para uso

---

**Execute o script de fix e teste novamente! O erro deve desaparecer.** 🚀

