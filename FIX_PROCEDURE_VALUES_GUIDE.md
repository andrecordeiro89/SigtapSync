# 🔧 **GUIA DE CORREÇÃO: VALORES DOS PROCEDIMENTOS**

## 🚨 **PROBLEMAS IDENTIFICADOS E SOLUCIONADOS**

### **1. View `v_aih_billing_by_procedure` Não Existia**
- **Problema**: O serviço tentava buscar dados de uma view inexistente
- **Solução**: ✅ Criada a view completa com todas as dimensões

### **2. Dupla Conversão de Centavos para Reais**
- **Problema**: `formatCurrency(normalizeValue(valor))` convertia duas vezes
- **Solução**: ✅ Eliminada dupla conversão nas funções

### **3. Critério Inadequado de Detecção**
- **Problema**: Valores > 100.000 eram convertidos (R$ 1.000,00 = 100.000 centavos)
- **Solução**: ✅ Novo critério: apenas valores > 1.000.000 (R$ 10.000,00)

## 📋 **PASSOS PARA APLICAR A CORREÇÃO**

### **Passo 1: Executar Script SQL no Banco**
```sql
-- Execute o arquivo: database/create_aih_billing_views.sql
-- Isso criará todas as views necessárias
```

### **Passo 2: Verificar se as Views Foram Criadas**
```sql
-- Verificar se as views existem
SELECT schemaname, viewname 
FROM pg_views 
WHERE viewname LIKE '%aih_billing%';

-- Deve retornar:
-- v_aih_billing_summary
-- v_aih_billing_by_procedure
-- v_aih_billing_by_hospital  
-- v_aih_billing_by_doctor
-- v_aih_billing_by_month
-- v_aih_billing_by_hospital_specialty
```

### **Passo 3: Testar as Views com Dados**
```sql
-- Teste básico da view principal
SELECT procedure_code, procedure_description, total_value, total_aihs
FROM v_aih_billing_by_procedure 
LIMIT 5;

-- Verificar se os valores estão em reais (não centavos)
-- Valores devem estar entre R$ 100,00 - R$ 50.000,00 tipicamente
```

### **Passo 4: Verificar Frontend**
1. **Acesse**: Dashboard → Analytics → Aba Procedimentos
2. **Verifique**: 
   - Cards KPIs exibem valores corretos
   - Tabela de procedimentos mostra valores em reais
   - Não há valores exorbitantes (ex: R$ 1.250.000,00)
   - Não há valores muito baixos (ex: R$ 0,12)

## 🔍 **VALORES ESPERADOS APÓS CORREÇÃO**

### **Exemplos de Valores Corretos:**
- **Procedimento Simples**: R$ 150,00 - R$ 800,00
- **Procedimento Complexo**: R$ 1.500,00 - R$ 15.000,00
- **Cirurgias Grandes**: R$ 5.000,00 - R$ 50.000,00

### **Valores Suspeitos (Indicam Problema):**
- **Muito Alto**: > R$ 100.000,00 (podem estar em centavos)
- **Muito Baixo**: < R$ 10,00 (podem ter sido convertidos demais)

## 🛠️ **FUNÇÕES CORRIGIDAS**

### **Antes (Problemático):**
```typescript
// ❌ Dupla conversão
const formatCurrency = (value: number): string => {
  const normalizedValue = value > 100000 ? value / 100 : value; // Primeira conversão
  return normalizedValue.toLocaleString('pt-BR', { style: 'currency' });
};

const normalizeValue = (value: number): number => {
  if (value > 100000) {
    return value / 100; // Segunda conversão!
  }
  return value;
};

// Uso problemático
formatCurrency(normalizeValue(procedure.total_value)); // Dupla conversão!
```

### **Depois (Corrigido):**
```typescript
// ✅ Conversão única e inteligente
const formatCurrency = (value: number): string => {
  // Views já retornam valores em reais - não converter
  return value.toLocaleString('pt-BR', { style: 'currency' });
};

const safeValue = (value: number): number => {
  // Critério mais rigoroso: apenas > R$ 10.000,00
  if (value > 1000000) {
    return value / 100; // Conversão apenas se realmente necessário
  }
  return value;
};

// Uso correto
formatCurrency(safeValue(procedure.total_value)); // Conversão única se necessário
```

## 📊 **ESTRUTURA DAS VIEWS CRIADAS**

### **View Principal: `v_aih_billing_by_procedure`**
```sql
SELECT 
  sp.code as procedure_code,
  sp.description as procedure_description,
  COUNT(pr.id) as total_aihs,
  ROUND(SUM(pr.value_charged) / 100.0, 2) as total_value, -- Conversão no banco
  ROUND(AVG(pr.value_charged) / 100.0, 2) as avg_value_per_aih,
  -- ... outros campos
FROM procedure_records pr
JOIN sigtap_procedures sp ON pr.procedure_id = sp.id
GROUP BY sp.code, sp.description
ORDER BY total_value DESC;
```

**Características:**
- ✅ Conversão de centavos para reais feita no banco (`/ 100.0`)
- ✅ Valores arredondados para 2 casas decimais
- ✅ Ordenação por valor total (descendente)
- ✅ Agregação por código de procedimento

## 🧪 **TESTES PARA VALIDAÇÃO**

### **Teste 1: Valores Realistas**
```sql
-- Os valores devem estar em uma faixa realista
SELECT procedure_code, total_value
FROM v_aih_billing_by_procedure 
WHERE total_value BETWEEN 100 AND 100000 -- Entre R$ 100,00 e R$ 100.000,00
ORDER BY total_value DESC;
```

### **Teste 2: Consistência de Dados**
```sql
-- Verificar se não há valores zerados ou negativos
SELECT COUNT(*) as total_procedures,
       COUNT(CASE WHEN total_value > 0 THEN 1 END) as positive_values,
       AVG(total_value) as avg_value,
       MIN(total_value) as min_value,
       MAX(total_value) as max_value
FROM v_aih_billing_by_procedure;
```

### **Teste 3: Performance**
```sql
-- Verificar se a view responde rápido (< 2 segundos)
EXPLAIN ANALYZE SELECT * FROM v_aih_billing_by_procedure LIMIT 20;
```

## 🎯 **RESULTADO ESPERADO**

Após aplicar todas as correções:

1. **Dashboard Funcional**: Aba Procedimentos carrega sem erros
2. **Valores Corretos**: Procedimentos exibem valores em reais (R$ 150,00 - R$ 50.000,00)
3. **Performance Boa**: Cards e tabela carregam em < 3 segundos
4. **Dados Consistentes**: Ranking por valor funciona corretamente

## 🚨 **TROUBLESHOOTING**

### **Problema: View não existe**
```sql
-- Executar manualmente
\i database/create_aih_billing_views.sql
```

### **Problema: Valores ainda incorretos**
1. Verificar se há dados em `procedure_records`
2. Conferir se `value_charged` está populado
3. Validar joins com `sigtap_procedures`

### **Problema: Performance lenta**
```sql
-- Criar índices adicionais se necessário
CREATE INDEX IF NOT EXISTS idx_procedure_records_complete 
ON procedure_records(procedure_id, value_charged, billing_status);
```

## ✅ **CHECKLIST FINAL**

- [ ] Views SQL criadas no banco
- [ ] Frontend atualizado (funções corrigidas)  
- [ ] Dashboard Procedimentos carregando
- [ ] Valores em faixa realista (R$ 100 - R$ 50.000)
- [ ] Performance < 3 segundos
- [ ] Ranking funcionando corretamente
- [ ] KPIs exibindo valores corretos

---

**🎉 Após completar todos os passos, os valores dos procedimentos estarão corretos e funcionais!** 