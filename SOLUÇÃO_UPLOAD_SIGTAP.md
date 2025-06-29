# 🔧 **SOLUÇÃO: UPLOAD SIGTAP NÃO SALVANDO NO BANCO**

## 🎯 **PROBLEMA IDENTIFICADO**

Você processou **4866 procedimentos** com sucesso, mas eles não estão sendo salvos na tabela `sigtap_procedures`. Vamos resolver!

## 🔍 **DIAGNÓSTICO RÁPIDO**

### **PASSO 1: Verificar se dados estão sendo salvos**

Execute no **SQL Editor do Supabase**:

```sql
-- Verificar últimas versões criadas
SELECT 
    version_name,
    total_procedures,
    import_status,
    is_active,
    created_at
FROM sigtap_versions 
ORDER BY created_at DESC 
LIMIT 5;

-- Contar procedimentos salvos
SELECT COUNT(*) as total_procedimentos FROM sigtap_procedures;

-- Verificar se há procedimentos da última versão
SELECT 
    sv.version_name,
    sv.total_procedures as "declarado",
    COUNT(sp.id) as "realmente_salvo"
FROM sigtap_versions sv
LEFT JOIN sigtap_procedures sp ON sv.id = sp.version_id
WHERE sv.created_at > NOW() - INTERVAL '1 hour'
GROUP BY sv.id, sv.version_name, sv.total_procedures
ORDER BY sv.created_at DESC;
```

## ✅ **SOLUÇÕES (EM ORDEM DE PRIORIDADE)**

### **SOLUÇÃO 1: Desabilitar RLS Temporariamente**

```sql
-- Desabilitar Row Level Security que pode estar bloqueando
ALTER TABLE sigtap_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE sigtap_procedures DISABLE ROW LEVEL SECURITY;

-- Verificar se resolveu
SELECT 'RLS desabilitado - teste novo upload' as status;
```

### **SOLUÇÃO 2: Verificar e Corrigir Constraints**

```sql
-- Verificar constraints problemáticas
SELECT constraint_name, check_clause
FROM information_schema.check_constraints 
WHERE table_name = 'sigtap_versions';

-- Corrigir constraint de extraction_method se necessário
DO $$
BEGIN
    -- Remover constraint restritiva se existir
    IF EXISTS (
        SELECT 1 FROM information_schema.check_constraints 
        WHERE table_name = 'sigtap_versions' 
        AND check_clause LIKE '%extraction_method%'
        AND check_clause NOT LIKE '%pdf%'
    ) THEN
        ALTER TABLE sigtap_versions DROP CONSTRAINT sigtap_versions_extraction_method_check;
        ALTER TABLE sigtap_versions ADD CONSTRAINT sigtap_versions_extraction_method_check 
        CHECK (extraction_method IN ('excel', 'pdf', 'hybrid', 'traditional', 'gemini', 'manual') OR extraction_method IS NULL);
        RAISE NOTICE 'Constraint corrigida';
    END IF;
END $$;
```

### **SOLUÇÃO 3: Teste Manual de Inserção**

```sql
-- Testar se consegue inserir dados manualmente
DO $$
DECLARE
    test_version_id UUID;
BEGIN
    -- Criar versão de teste
    INSERT INTO sigtap_versions (
        version_name, 
        file_type, 
        total_procedures, 
        extraction_method,
        import_status
    ) VALUES (
        'TESTE_MANUAL_' || TO_CHAR(NOW(), 'HH24:MI:SS'),
        'pdf',
        1,
        'pdf',
        'completed'
    ) RETURNING id INTO test_version_id;
    
    -- Criar procedimento de teste
    INSERT INTO sigtap_procedures (
        version_id,
        code,
        description,
        complexity
    ) VALUES (
        test_version_id,
        '88888888',
        'Teste Manual',
        'BAIXA'
    );
    
    RAISE NOTICE 'TESTE OK: Versão % criada com procedimento', test_version_id;
    
    -- Limpar teste
    DELETE FROM sigtap_procedures WHERE version_id = test_version_id;
    DELETE FROM sigtap_versions WHERE id = test_version_id;
    
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'ERRO: % (Código: %)', SQLERRM, SQLSTATE;
END $$;
```

## 🚀 **APÓS APLICAR AS SOLUÇÕES**

### **1. Teste Novo Upload**
- Faça upload de um arquivo SIGTAP pequeno
- Verifique o console do navegador
- Procure por mensagens: `"✅ Procedimentos salvos"`

### **2. Verificar Resultado**
```sql
-- Ver últimas versões
SELECT version_name, total_procedures, created_at
FROM sigtap_versions 
ORDER BY created_at DESC 
LIMIT 3;

-- Contar procedimentos da última versão
SELECT COUNT(*) as procedimentos_salvos
FROM sigtap_procedures 
WHERE version_id = (
    SELECT id FROM sigtap_versions 
    ORDER BY created_at DESC 
    LIMIT 1
);
```

### **3. Verificar Console do Navegador**
Procure por estas mensagens no console:
```
✅ Versão criada: [UUID]
💾 Salvando procedimentos no banco...
✅ Procedimentos salvos
✅ Versão ativada
🎉 UPLOAD COMPLETO: Dados processados e persistidos no banco!
```

## 🔧 **SE AINDA NÃO FUNCIONAR**

### **Opção A: Reset + Novo Schema**
```sql
-- Fazer backup dos hospitais
CREATE TEMP TABLE temp_hospitals AS SELECT * FROM hospitals;

-- Executar reset preservando hospitais
-- (Use: database/limpar_PRESERVAR_HOSPITAIS.sql)

-- Recriar schema se necessário
-- (Use: database/schema.sql)
```

### **Opção B: Verificar Logs Detalhados**
1. **Supabase Dashboard** → **Settings** → **Database** 
2. Habilitar **"Log Statements"**
3. Tentar novo upload
4. Verificar logs de erro

### **Opção C: Testar em Modo de Desenvolvimento**
```typescript
// No arquivo .env, adicionar:
VITE_DEBUG_MODE=true
VITE_LOG_LEVEL=debug
```

## 📊 **COMANDOS DE VERIFICAÇÃO ÚTEIS**

### **Status completo do sistema:**
```sql
SELECT 
    'sigtap_versions' as tabela, 
    COUNT(*) as registros,
    MAX(created_at) as ultimo_registro
FROM sigtap_versions
UNION ALL
SELECT 
    'sigtap_procedures',
    COUNT(*),
    MAX(created_at)
FROM sigtap_procedures;
```

### **Verificar dados da última importação:**
```sql
SELECT 
    sv.version_name,
    sv.total_procedures as "Declarado",
    COUNT(sp.id) as "Realmente_Salvo",
    sv.import_status,
    sv.created_at
FROM sigtap_versions sv
LEFT JOIN sigtap_procedures sp ON sv.id = sp.version_id
GROUP BY sv.id, sv.version_name, sv.total_procedures, sv.import_status, sv.created_at
ORDER BY sv.created_at DESC
LIMIT 5;
```

## 🎯 **RESUMO EXECUTIVO**

1. **Execute SOLUÇÃO 1** (Desabilitar RLS)
2. **Execute SOLUÇÃO 2** (Corrigir constraints)
3. **Teste novo upload**
4. **Verifique com comandos SQL**
5. **Se não funcionar, use SOLUÇÃO 3** (Teste manual)

## ⚡ **COMANDOS RÁPIDOS**

```sql
-- 1. Desabilitar RLS
ALTER TABLE sigtap_versions DISABLE ROW LEVEL SECURITY;
ALTER TABLE sigtap_procedures DISABLE ROW LEVEL SECURITY;

-- 2. Verificar dados após upload
SELECT COUNT(*) FROM sigtap_procedures;

-- 3. Ver última versão
SELECT version_name, total_procedures FROM sigtap_versions ORDER BY created_at DESC LIMIT 1;
```

**🚀 Execute estas soluções e teste novamente o upload do SIGTAP!** 