# 🚨 **DISCREPÂNCIA IDENTIFICADA: 361 vs 323 PACIENTES**
## Tela Pacientes vs Analytics - Hospital Municipal 18 de Dezembro - Julho/2025

---

## 📊 **PROBLEMA IDENTIFICADO**

**Discrepância de Dados:**
- **Tela Pacientes:** 361 pacientes
- **Analytics:** 323 pacientes
- **Diferença:** 38 pacientes a mais na tela Pacientes
- **Informação Correta:** 323 (Analytics)

---

## 🔍 **CAUSA RAIZ IDENTIFICADA**

### **Diferença na Lógica de Filtro de Competência**

#### **Tela Pacientes (`PatientManagement.tsx` - Linha 625):**
```typescript
// ❌ PROBLEMA: Usa fallback que inclui pacientes inadequados
const refStr = (item as any).competencia || item.discharge_date || item.admission_date;
const refDate = refStr ? new Date(refStr) : null;

// Filtro por competência (mês da alta; fallback admissão) via range mensal
let matchesCompetency = true;
if (competencyRange && refDate) {
  matchesCompetency = refDate >= competencyRange.start && refDate <= competencyRange.end;
}
```

#### **Analytics (`DoctorsHierarchyV2Service.ts` - Linha 235):**
```typescript
// ✅ CORRETO: Usa apenas discharge_date
const refStr = patient.aih_info?.discharge_date;
if (!refStr) return false; // Excluir pacientes sem alta
```

---

## 🎯 **ANÁLISE DA DISCREPÂNCIA**

### **Os 38 Pacientes Extras são:**

1. **Pacientes sem alta (`discharge_date = null`)** mas com `admission_date` em julho/2025
2. **Pacientes com campo `competencia`** definido para julho mas com alta em outro mês
3. **Combinação dos casos acima**

### **Por que o Analytics está correto (323):**

- ✅ **Regra SUS:** Competência é definida pela **data de alta**
- ✅ **Precisão:** Exclui pacientes sem alta no período
- ✅ **Conformidade:** Segue padrão de faturamento hospitalar

### **Por que a tela Pacientes está incorreta (361):**

- ❌ **Fallback inadequado:** Inclui pacientes sem alta
- ❌ **Competência inconsistente:** Mistura critérios diferentes
- ❌ **Inflação de dados:** Conta pacientes que não deveriam estar no período

---

## 🔧 **CORREÇÃO NECESSÁRIA**

### **Arquivo:** `src/components/PatientManagement.tsx`

#### **Problema Atual:**
```typescript
// Linha 625 - PROBLEMA
const refStr = (item as any).competencia || item.discharge_date || item.admission_date;
```

#### **Correção Proposta:**
```typescript
// CORREÇÃO: Para filtros de competência, usar APENAS discharge_date
const refStr = item.discharge_date;
if (competencyRange && !refStr) {
  // Para filtros de competência, excluir pacientes sem alta
  return false;
}
```

---

## 📋 **IMPACTO DA CORREÇÃO**

### **Antes da Correção:**
```
Filtro Competência Julho/2025:
- Pacientes com alta em julho ✅
- Pacientes sem alta mas admissão julho ❌ (38 extras)
- Total: 361 pacientes
```

### **Depois da Correção:**
```
Filtro Competência Julho/2025:
- Pacientes com alta em julho ✅
- Pacientes sem alta ❌ (excluídos)
- Total: 323 pacientes (igual Analytics)
```

---

## ✅ **BENEFÍCIOS DA CORREÇÃO**

### **Consistência:**
- ✅ Mesma contagem entre Pacientes e Analytics
- ✅ Mesma lógica de filtro em ambas as telas
- ✅ Dados confiáveis para relatórios

### **Conformidade:**
- ✅ Segue regras SUS de competência
- ✅ Usa apenas data de alta para faturamento
- ✅ Elimina dados inconsistentes

### **Precisão:**
- ✅ Remove 38 pacientes inadequados
- ✅ Mostra apenas pacientes com alta no período
- ✅ Dados corretos para auditoria

---

## 🚀 **IMPLEMENTAÇÃO**

A correção deve ser aplicada na tela Pacientes para:

1. **Usar apenas `discharge_date`** para filtros de competência
2. **Excluir pacientes sem alta** quando filtro de competência ativo
3. **Manter consistência** com a tela Analytics
4. **Garantir precisão** de 323 pacientes

---

## 📊 **STATUS: CORREÇÃO NECESSÁRIA**

A tela Pacientes precisa ser corrigida para mostrar 323 pacientes (igual Analytics) em vez dos 361 atuais, removendo os 38 pacientes que não deveriam estar incluídos no filtro de competência de julho/2025.
