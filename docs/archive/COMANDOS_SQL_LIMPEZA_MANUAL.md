# 🧹 **COMANDOS SQL - LIMPEZA MANUAL ESPECÍFICA**

## 🎯 **LIMPEZA TABELA POR TABELA**

Se você quiser limpar apenas tabelas específicas, use os comandos abaixo:

## 📄 **LIMPAR AIHs E MATCHES**

```sql
-- Limpar matches de AIH primeiro (por causa das foreign keys)
TRUNCATE TABLE aih_matches RESTART IDENTITY CASCADE;

-- Limpar records de procedimentos
TRUNCATE TABLE procedure_records RESTART IDENTITY CASCADE;

-- Limpar AIHs
TRUNCATE TABLE aihs RESTART IDENTITY CASCADE;

-- Verificar
SELECT COUNT(*) as aihs FROM aihs;
SELECT COUNT(*) as matches FROM aih_matches;
SELECT COUNT(*) as records FROM procedure_records;
```

## 👥 **LIMPAR APENAS PACIENTES**

```sql
-- Limpar AIHs primeiro (dependem de pacientes)
TRUNCATE TABLE aih_matches RESTART IDENTITY CASCADE;
TRUNCATE TABLE procedure_records RESTART IDENTITY CASCADE;
TRUNCATE TABLE aihs RESTART IDENTITY CASCADE;

-- Limpar pacientes
TRUNCATE TABLE patients RESTART IDENTITY CASCADE;

-- Verificar
SELECT COUNT(*) as pacientes FROM patients;
```

## 📊 **LIMPAR APENAS SIGTAP**

```sql
-- Limpar procedures SIGTAP (pode afetar matches existentes)
TRUNCATE TABLE sigtap_procedures RESTART IDENTITY CASCADE;

-- Limpar versões SIGTAP
TRUNCATE TABLE sigtap_versions RESTART IDENTITY CASCADE;

-- Verificar
SELECT COUNT(*) as procedimentos FROM sigtap_procedures;
SELECT COUNT(*) as versoes FROM sigtap_versions;
```

## ⚙️ **LIMPAR APENAS CONFIGURAÇÕES**

```sql
-- Limpar configurações do sistema
TRUNCATE TABLE system_settings RESTART IDENTITY CASCADE;

-- Recriar configurações básicas
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public)
VALUES
    ('system.version', '"3.0.0"', 'string', 'Versão do sistema', true),
    ('system.name', '"SIGTAP Sync"', 'string', 'Nome do sistema', true),
    ('match.confidence_threshold', '70', 'number', 'Threshold mínimo de confiança', false),
    ('billing.default_currency', '"BRL"', 'string', 'Moeda padrão', true),
    ('development.mode', 'true', 'boolean', 'Modo desenvolvimento', true);

-- Verificar
SELECT COUNT(*) as configuracoes FROM system_settings;
```

## 🏥 **NÃO MEXER NOS HOSPITAIS**

```sql
-- ⚠️ NÃO EXECUTE ISTO SE QUISER MANTER OS HOSPITAIS:
-- TRUNCATE TABLE hospitals; -- ❌ NÃO FAÇA ISSO!

-- Para ver seus hospitais:
SELECT name, city, state FROM hospitals;
```

## 🔄 **COMANDOS DE VERIFICAÇÃO**

### **Contar registros em todas as tabelas:**
```sql
SELECT 
    'hospitals' as tabela, COUNT(*) as registros FROM hospitals
UNION ALL
SELECT 'patients', COUNT(*) FROM patients
UNION ALL
SELECT 'aihs', COUNT(*) FROM aihs
UNION ALL
SELECT 'aih_matches', COUNT(*) FROM aih_matches
UNION ALL
SELECT 'procedure_records', COUNT(*) FROM procedure_records
UNION ALL
SELECT 'sigtap_procedures', COUNT(*) FROM sigtap_procedures
UNION ALL
SELECT 'sigtap_versions', COUNT(*) FROM sigtap_versions
UNION ALL
SELECT 'system_settings', COUNT(*) FROM system_settings
ORDER BY tabela;
```

### **Ver tamanho das tabelas:**
```sql
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables 
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
```

## 🧹 **LIMPEZA COMPLETA (EXCETO HOSPITAIS)**

```sql
-- Ordem correta por causa das foreign keys:
TRUNCATE TABLE procedure_records RESTART IDENTITY CASCADE;
TRUNCATE TABLE aih_matches RESTART IDENTITY CASCADE;
TRUNCATE TABLE aihs RESTART IDENTITY CASCADE;
TRUNCATE TABLE patients RESTART IDENTITY CASCADE;
TRUNCATE TABLE sigtap_procedures RESTART IDENTITY CASCADE;
TRUNCATE TABLE sigtap_versions RESTART IDENTITY CASCADE;
TRUNCATE TABLE system_settings RESTART IDENTITY CASCADE;

-- Recriar configurações básicas
INSERT INTO system_settings (setting_key, setting_value, setting_type, description, is_public)
VALUES
    ('system.version', '"3.0.0"', 'string', 'Versão do sistema', true),
    ('development.mode', 'true', 'boolean', 'Modo desenvolvimento', true);

-- Verificar hospitais preservados
SELECT 'Hospitais preservados:' as status, COUNT(*) as quantidade FROM hospitals;
```

## 🔒 **LIMPAR POLÍTICAS RLS**

```sql
-- Remover políticas RLS de tabelas específicas (preservar hospitals)
DROP POLICY IF EXISTS "patients_hospital_access" ON patients;
DROP POLICY IF EXISTS "aihs_hospital_access" ON aihs;
DROP POLICY IF EXISTS "procedure_records_hospital_access" ON procedure_records;

-- Verificar políticas restantes
SELECT tablename, policyname FROM pg_policies WHERE schemaname = 'public';
```

## ⚡ **COMANDOS RÁPIDOS MAIS USADOS**

### **Limpar tudo exceto hospitais (comando único):**
```sql
DO $$
DECLARE
    tabelas TEXT[] := ARRAY['procedure_records', 'aih_matches', 'aihs', 'patients', 'sigtap_procedures', 'sigtap_versions', 'system_settings'];
    tabela TEXT;
BEGIN
    FOREACH tabela IN ARRAY tabelas
    LOOP
        EXECUTE format('TRUNCATE TABLE %I RESTART IDENTITY CASCADE', tabela);
        RAISE NOTICE 'Tabela % limpa', tabela;
    END LOOP;
END $$;
```

### **Verificar se limpeza funcionou:**
```sql
SELECT 
    CASE WHEN COUNT(*) = 0 THEN '✅ LIMPO' ELSE '⚠️ TEM DADOS' END as status,
    COUNT(*) as registros,
    'patients' as tabela
FROM patients
UNION ALL
SELECT 
    CASE WHEN COUNT(*) = 0 THEN '✅ LIMPO' ELSE '⚠️ TEM DADOS' END,
    COUNT(*),
    'aihs'
FROM aihs
UNION ALL
SELECT 
    CASE WHEN COUNT(*) > 0 THEN '✅ PRESERVADO' ELSE '❌ PERDIDO' END,
    COUNT(*),
    'hospitals'
FROM hospitals;
```

---

## 📋 **RESUMO DE USO**

```sql
-- 1. Para ver o que você tem:
SELECT 'patients', COUNT(*) FROM patients UNION ALL SELECT 'aihs', COUNT(*) FROM aihs;

-- 2. Para limpar dados específicos:
TRUNCATE TABLE patients RESTART IDENTITY CASCADE;

-- 3. Para verificar hospitais preservados:
SELECT name FROM hospitals;

-- 4. Para recriar configurações:
-- (Use INSERT INTO system_settings conforme mostrado acima)
```

**🎯 Use o arquivo `database/limpar_PRESERVAR_HOSPITAIS.sql` para limpeza completa automática!** 