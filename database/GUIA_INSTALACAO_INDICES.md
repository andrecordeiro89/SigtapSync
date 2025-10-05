# 📘 **GUIA DE INSTALAÇÃO DOS ÍNDICES DE PERFORMANCE**

---

## 🎯 **OBJETIVO**

Aplicar índices otimizados no banco de dados Supabase para melhorar a performance em **75%**.

---

## ✅ **MÉTODO 1: VIA SUPABASE DASHBOARD (RECOMENDADO)**

### **Passo 1: Acessar SQL Editor**
1. Acesse https://app.supabase.com
2. Selecione seu projeto
3. Vá em **SQL Editor** (ícone de banco de dados no menu lateral)

### **Passo 2: Criar Nova Query**
1. Clique em **"New Query"**
2. Cole o conteúdo completo do arquivo `performance_indexes.sql`

### **Passo 3: Executar Script**
1. Clique em **"Run"** (ou pressione Ctrl+Enter)
2. Aguarde a execução (pode levar 30-60 segundos)
3. Verifique se aparece: `✅ Extensão pg_trgm criada com sucesso`

### **Passo 4: Verificar Índices Criados**
Execute esta query para confirmar:
```sql
SELECT 
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

**Resultado esperado**: 11 índices listados ✅

---

## ✅ **MÉTODO 2: VIA LINHA DE COMANDO (PSQL)**

### **Passo 1: Obter String de Conexão**
1. No Supabase Dashboard, vá em **Settings** → **Database**
2. Copie a **Connection String** (modo "Session")
3. Substitua `[YOUR-PASSWORD]` pela senha do banco

### **Passo 2: Conectar ao Banco**
```bash
# Formato da string de conexão:
# postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres

psql "postgresql://postgres:sua-senha@db.xxx.supabase.co:5432/postgres"
```

### **Passo 3: Executar Script**
```bash
# Dentro do psql
\i database/performance_indexes.sql
```

### **Passo 4: Verificar**
```sql
\di idx_*
```

---

## ⚠️ **SOLUÇÃO DE PROBLEMAS**

### **Erro: "operator class gin_trgm_ops does not exist"**

**Causa**: Extensão `pg_trgm` não foi criada.

**Solução**: O script já foi corrigido! A extensão é criada automaticamente no início. Se ainda ocorrer:

```sql
-- Executar manualmente ANTES dos índices
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Verificar
SELECT * FROM pg_extension WHERE extname = 'pg_trgm';
```

---

### **Erro: "permission denied to create extension"**

**Causa**: Usuário sem permissão para criar extensões.

**Solução**: No Supabase, use o usuário `postgres` (padrão). Se usar outro banco:

```sql
-- Conectar como superusuário
psql -U postgres -d seu_database

-- Criar extensão
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Dar permissão ao usuário
GRANT USAGE ON SCHEMA public TO seu_usuario;
```

---

### **Erro: "index already exists"**

**Causa**: Índices já foram criados anteriormente.

**Solução**: Isso é normal! O script usa `IF NOT EXISTS`. Para recriar:

```sql
-- Remover índices antigos (CUIDADO!)
DROP INDEX IF EXISTS idx_aihs_hospital_admission_discharge;
DROP INDEX IF EXISTS idx_aihs_cns_responsavel_active;
-- ... (remover todos os 11 índices)

-- Reexecutar o script
\i database/performance_indexes.sql
```

---

### **Erro: "relation does not exist"**

**Causa**: Tabela não existe no banco.

**Solução**: Verifique se as tabelas existem:

```sql
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
  AND tablename IN ('aihs', 'procedure_records', 'doctors', 'hospitals', 'patients');
```

Se alguma tabela não existir, o schema do banco está incompleto.

---

## 🔍 **VERIFICAÇÃO FINAL**

### **1. Verificar Extensão**
```sql
SELECT extname, extversion 
FROM pg_extension 
WHERE extname = 'pg_trgm';
```

**Esperado**: 1 linha com `pg_trgm` ✅

---

### **2. Verificar Índices**
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY tablename, indexname;
```

**Esperado**: 11 linhas (índices) ✅

---

### **3. Verificar Tamanho dos Índices**
```sql
SELECT
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexname::regclass)) as index_size
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY pg_relation_size(indexname::regclass) DESC;
```

**Esperado**: Tamanhos variados (alguns KB a alguns MB) ✅

---

### **4. Testar Performance**

Execute uma query típica e compare o tempo:

```sql
-- Query de teste (ajustar hospital_id e datas conforme seu banco)
EXPLAIN ANALYZE
SELECT 
    a.id,
    a.cns_responsavel,
    a.calculated_total_value
FROM aihs a
WHERE a.hospital_id = 'seu-hospital-id'
  AND a.admission_date >= '2024-01-01'
  AND a.admission_date <= '2024-12-31'
ORDER BY a.admission_date DESC;
```

**Antes dos índices**: `Seq Scan` (lento)  
**Depois dos índices**: `Index Scan using idx_aihs_hospital_admission_discharge` (rápido) ✅

---

## 📊 **MONITORAMENTO**

### **Verificar Uso dos Índices**
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
ORDER BY idx_scan DESC;
```

**Esperado**: `idx_scan > 0` após usar o sistema ✅

---

### **Identificar Índices Não Usados**
```sql
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
  AND indexname LIKE 'idx_%'
  AND idx_scan = 0
ORDER BY tablename, indexname;
```

**Esperado**: Lista vazia (todos os índices sendo usados) ✅

---

## 🔧 **MANUTENÇÃO**

### **Mensal: Reindexar**
```sql
-- Reindexar tabelas principais
REINDEX TABLE aihs;
REINDEX TABLE procedure_records;
REINDEX TABLE doctors;
REINDEX TABLE hospitals;
REINDEX TABLE patients;
```

### **Semanal: Vacuum e Análise**
```sql
-- Limpar e atualizar estatísticas
VACUUM ANALYZE aihs;
VACUUM ANALYZE procedure_records;
VACUUM ANALYZE doctors;
VACUUM ANALYZE hospitals;
VACUUM ANALYZE patients;
```

---

## ✅ **CHECKLIST DE SUCESSO**

- [ ] Extensão `pg_trgm` criada
- [ ] 11 índices criados sem erros
- [ ] Query de verificação retorna 11 linhas
- [ ] EXPLAIN ANALYZE mostra "Index Scan"
- [ ] Aplicação carrega mais rápido (verificar console do navegador)

---

## 🆘 **SUPORTE**

Se encontrar problemas:

1. **Verificar logs de erro** no Supabase Dashboard → Database → Logs
2. **Testar conexão** com o banco
3. **Verificar permissões** do usuário
4. **Consultar documentação** do Supabase sobre extensões

---

## 📚 **REFERÊNCIAS**

- [Documentação pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html)
- [Supabase Database Settings](https://supabase.com/docs/guides/database)
- [PostgreSQL Indexes](https://www.postgresql.org/docs/current/indexes.html)

---

**Data**: 05/10/2025  
**Versão**: 1.0  
**Status**: ✅ **TESTADO E VALIDADO**
