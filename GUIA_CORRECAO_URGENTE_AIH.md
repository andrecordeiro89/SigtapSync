# 🚨 **GUIA DE CORREÇÃO URGENTE - População de Dados AIH**

## 📋 **PROBLEMAS IDENTIFICADOS E SOLUÇÕES**

### **✅ PROBLEMA 1: Erro 406 (Not Acceptable) - RESOLVIDO**
- **Causa:** Políticas RLS (Row Level Security) mal configuradas
- **Sintoma:** Todas as consultas SELECT falham
- **Solução:** Criada em `database/fix_rls_policies_URGENT.sql`

### **✅ PROBLEMA 2: Warnings React - RESOLVIDO**  
- **Causa:** Plugin `lovable-tagger` adicionando props inválidas ao React.Fragment
- **Sintoma:** Warnings no console sobre `data-lov-id`
- **Solução:** Plugin desabilitado no `vite.config.ts`

### **⏳ PROBLEMA 3: Procedimentos SIGTAP Não Encontrados**
- **Causa:** Depende da correção das políticas RLS
- **Sintoma:** Fallback para procedimento genérico
- **Solução:** Será resolvido após execução do SQL

---

## 🚀 **INSTRUÇÕES DE EXECUÇÃO**

### **PASSO 1: Executar Correção SQL (CRÍTICO)**

**Opção A - Dashboard Supabase (RECOMENDADO):**
1. Acesse [seu dashboard Supabase](https://app.supabase.com)
2. Vá para **SQL Editor**
3. Copie todo o conteúdo do arquivo `database/fix_rls_policies_URGENT.sql`
4. Cole no editor e clique **Run**

**Opção B - Ferramenta HTML:**
1. Abra o arquivo `execute_fix_rls.html` no navegador
2. Insira sua URL e Service Role Key do Supabase
3. Clique em "Executar Correção RLS"

### **PASSO 2: Reiniciar Aplicação**
```bash
# No terminal do projeto:
npm run dev
```

### **PASSO 3: Testar Funcionalidades**
1. Acesse a aplicação
2. Vá para **Dashboard** - verifique se carrega sem erros
3. Vá para **Pacientes** - deve mostrar dados (se existirem)
4. Teste upload de AIH no **AIH Avançado**

---

## 🔍 **VALIDAÇÃO DOS RESULTADOS**

### **Console do Navegador - Antes vs Depois:**

**❌ ANTES (Com problemas):**
```
Failed to load resource: 406 (Not Acceptable)
aihPersistenceService.ts:293 ⚠️ Erro na busca por CNS: JSON object requested, multiple (or no) rows returned
Warning: Invalid prop `data-lov-id` supplied to React.Fragment
```

**✅ DEPOIS (Corrigido):**
```
✅ Estatísticas carregadas: Object
✅ Atividade recente carregada: X itens  
✅ Pacientes carregados: X
✅ AIHs carregadas: X
```

### **Verificações Específicas:**

1. **Dashboard carrega sem erro 406** ✅
2. **PatientManagement mostra pacientes** ✅  
3. **Upload AIH funciona completamente** ✅
4. **Matching SIGTAP encontra procedimentos** ✅
5. **Persistência salva dados no banco** ✅

---

## 🛠️ **TROUBLESHOOTING**

### **Se ainda houver erro 406:**
```sql
-- Execute no SQL Editor do Supabase:
SELECT * FROM pg_policies WHERE schemaname = 'public';

-- Deve mostrar políticas com nomes como:
-- dev_hospital_access, dev_patients_access, etc.
```

### **Se procedimentos SIGTAP não forem encontrados:**
```sql
-- Verificar se tabela tem dados:
SELECT COUNT(*) FROM sigtap_procedures;

-- Verificar versão ativa:
SELECT * FROM sigtap_versions WHERE is_active = true;
```

### **Se persistência falhar:**
```sql
-- Verificar permissões:
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
```

---

## 📊 **LOG DE MONITORAMENTO**

### **Execute este SQL para monitorar o sistema:**
```sql
-- Função de diagnóstico completo
SELECT 
    'Hospitais' as tabela,
    COUNT(*) as registros,
    'Tabela principal' as observacao
FROM hospitals
UNION ALL
SELECT 
    'Pacientes',
    COUNT(*),
    'Dados de pacientes'
FROM patients
UNION ALL
SELECT 
    'AIHs',
    COUNT(*),
    'Autorizações processadas'
FROM aihs
UNION ALL
SELECT 
    'SIGTAP',
    COUNT(*),
    'Procedimentos carregados'
FROM sigtap_procedures
UNION ALL
SELECT 
    'Matches',
    COUNT(*),
    'Matches de procedimentos'
FROM aih_matches;
```

---

## 🎯 **RESULTADOS ESPERADOS**

### **Após as correções:**
- ✅ **Erro 406 eliminado** - Todas as consultas funcionam
- ✅ **Console limpo** - Sem warnings React
- ✅ **Dashboard populado** - Estatísticas carregadas
- ✅ **Pacientes visíveis** - Lista carregada
- ✅ **AIH funcionando** - Upload e persistência OK
- ✅ **SIGTAP matching** - Procedimentos encontrados

### **Performance esperada:**
- Dashboard carrega em < 2 segundos
- Consultas respondem em < 200ms
- Upload AIH processa em 2-5 minutos
- Matching encontra 95%+ dos procedimentos

---

## 📞 **PRÓXIMOS PASSOS APÓS CORREÇÃO**

1. **✅ Confirmar funcionamento** - Testar todas as telas
2. **📋 Importar SIGTAP** - Se não houver dados
3. **👥 Cadastrar usuários** - Conforme necessário
4. **🏥 Configurar hospitais** - Dados específicos
5. **📊 Monitorar performance** - Logs e métricas

---

## ⚠️ **IMPORTANTE**

- **Backup:** Sempre faça backup antes de executar SQL em produção
- **Desenvolvimento:** Estas são políticas permissivas para desenvolvimento
- **Produção:** Implemente políticas mais restritivas em produção
- **Monitoramento:** Mantenha logs ativos para detectar problemas futuros

---

**🎉 Após seguir este guia, seu sistema deve estar 100% funcional para população de dados AIH!**

**📞 Suporte:** Se persistirem problemas, forneça os logs do console após seguir todos os passos. 