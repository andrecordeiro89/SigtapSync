# 🚨 **PROBLEMA REAL IDENTIFICADO: TELA PACIENTES**
## Por que ainda mostra 360 em vez de 323 pacientes

---

## 🔍 **CAUSA RAIZ DESCOBERTA**

O problema não está apenas no filtro da interface, mas sim na **fonte dos dados**. A tela Pacientes e Analytics usam **serviços diferentes** que aplicam **lógicas diferentes**:

### **Tela Pacientes:**
- **Serviço:** `AIHPersistenceService.getAIHs()`
- **Carregamento:** Carrega **TODAS** as AIHs do hospital
- **Filtro de Data:** Usa `admission_date` (❌ ERRADO)
- **Filtro Interface:** Aplica filtro só na visualização

### **Analytics:**
- **Serviço:** `DoctorsHierarchyV2Service.getDoctorsHierarchyV2()`
- **Carregamento:** Carrega dados **já filtrados** por data
- **Filtro de Data:** Usa `discharge_date` (✅ CORRETO)
- **Filtro Interface:** Dados já vêm corretos

---

## 📊 **ANÁLISE DO PROBLEMA**

### **AIHPersistenceService.getAIHs() - Linhas 1534-1540:**
```typescript
// ❌ PROBLEMA: Usa admission_date para filtros de data
if (filters?.dateFrom) {
  query = query.gte('admission_date', filters.dateFrom);
}

if (filters?.dateTo) {
  query = query.lte('admission_date', filters.dateTo);
}
```

### **DoctorsHierarchyV2Service - Já corrigido:**
```typescript
// ✅ CORRETO: Usa discharge_date
const refStr = patient.aih_info?.discharge_date;
if (!refStr) return false; // Excluir pacientes sem alta
```

---

## 🎯 **POR QUE A CORREÇÃO ANTERIOR NÃO FUNCIONOU**

1. **Dados Carregados Errados:** A tela Pacientes carrega **todas** as AIHs, incluindo as sem alta
2. **Filtro na Fonte:** O `loadAIHs()` não aplica filtro de competência na query
3. **Filtro Interface Insuficiente:** O filtro na interface não consegue corrigir dados já carregados incorretamente

---

## 🔧 **SOLUÇÕES NECESSÁRIAS**

### **Opção 1: Corrigir AIHPersistenceService**
```typescript
// Para filtros de competência, usar discharge_date
if (filters?.dateFrom) {
  query = query.gte('discharge_date', filters.dateFrom);
}
if (filters?.dateTo) {
  query = query.lte('discharge_date', filters.dateTo);
}
// Excluir AIHs sem alta quando filtro ativo
if (filters?.dateFrom || filters?.dateTo) {
  query = query.not('discharge_date', 'is', null);
}
```

### **Opção 2: Modificar loadAIHs() na PatientManagement**
- Aplicar filtro de competência na query inicial
- Carregar apenas dados do período selecionado

### **Opção 3: Usar DoctorsHierarchyV2Service na tela Pacientes**
- Migrar para o mesmo serviço usado no Analytics
- Garantir consistência total

---

## 📋 **IMPLEMENTAÇÃO RECOMENDADA**

**Opção 1 + Melhorias:**

1. **Corrigir AIHPersistenceService** para usar `discharge_date` em filtros de competência
2. **Adicionar parâmetro** para distinguir filtros de competência vs filtros normais
3. **Modificar PatientManagement** para passar filtros corretos
4. **Manter compatibilidade** com outros usos do serviço

---

## 🚀 **PRÓXIMOS PASSOS**

1. ✅ Modificar `AIHPersistenceService.getAIHs()`
2. ⚠️ Adicionar suporte a filtros de competência
3. ⚠️ Atualizar `loadAIHs()` na tela Pacientes
4. ⚠️ Testar consistência entre as telas

---

## 📊 **RESULTADO ESPERADO**

Após as correções:
- **Tela Pacientes:** 323 pacientes (julho/2025)
- **Analytics:** 323 pacientes (julho/2025)
- **Consistência:** Total entre as duas telas
- **Dados:** Apenas pacientes com alta no período
