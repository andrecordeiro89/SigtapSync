# 🚨 **PROBLEMA IDENTIFICADO: FILTRO DE DATA NO ANALYTICS**
## Data 01/07/2025 a 31/07/2025 está pegando dados do mês 08

---

## 🔍 **ANÁLISE DO PROBLEMA**

### **Situação Reportada:**
- **Filtro:** 01/07/2025 a 31/07/2025
- **Resultado Esperado:** Apenas pacientes com alta em julho/2025
- **Resultado Atual:** Inclui pacientes com alta em agosto/2025

### **Fluxo de Dados Identificado:**
```
ExecutiveDashboard.tsx
    ↓ productionEffectiveDateRange
MedicalProductionDashboard.tsx
    ↓ dateRange prop
DoctorsHierarchyV2Service.ts
    ↓ filters.dateFromISO / filters.dateToISO
```

---

## 🔧 **CAUSA RAIZ IDENTIFICADA**

### **1️⃣ Cálculo do `productionEffectiveDateRange`**
```typescript
// ExecutiveDashboard.tsx - Linha 318-329
const productionEffectiveDateRange: DateRange = React.useMemo(() => {
  if (!selectedCompetency || selectedCompetency === 'all') return selectedDateRange;
  const [yearStr, monthStr] = selectedCompetency.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  if (!year || !month) return selectedDateRange;
  const start = new Date(year, month - 1, 1);        // ✅ OK: 01/07/2025
  const end = new Date(year, month, 0);              // ❌ PROBLEMA: 31/07/2025
  // Garantir fim do dia
  end.setHours(23, 59, 59, 999);                     // ❌ PROBLEMA: 31/07/2025 23:59:59
  return { startDate: start, endDate: end };
}, [selectedCompetency, selectedDateRange]);
```

### **2️⃣ Filtro no `DoctorsHierarchyV2Service`**
```typescript
// doctorsHierarchyV2.ts - Linha 225-255
if (filters.dateFromISO || filters.dateToISO) {
  const startDate = filters.dateFromISO ? new Date(filters.dateFromISO) : null;
  const endDate = filters.dateToISO ? new Date(filters.dateToISO) : null;
  
  // Ajustar data final para fim do dia se fornecida
  if (endDate) {
    endDate.setHours(23, 59, 59, 999);              // ❌ DUPLICAÇÃO: Já ajustado no ExecutiveDashboard
  }

  filteredCards = cards.map(card => {
    const filteredPatients = card.patients.filter((patient: any) => {
      const refStr = patient.aih_info?.competencia || patient.aih_info?.discharge_date || patient.aih_info?.admission_date;
      if (!refStr) return false;
      
      const refDate = new Date(refStr);
      
      let matches = true;
      if (startDate) {
        matches = matches && refDate >= startDate;    // ✅ OK
      }
      if (endDate) {
        matches = matches && refDate <= endDate;      // ❌ PROBLEMA: Pode incluir agosto
      }
      
      return matches;
    });
```

---

## 🚨 **PROBLEMAS ENCONTRADOS**

### **1️⃣ Timezone Issues**
- `new Date(year, month - 1, 1)` usa timezone local
- `new Date(filters.dateToISO)` pode interpretar diferente

### **2️⃣ Ajuste Duplo de Horário**
- ExecutiveDashboard: `end.setHours(23, 59, 59, 999)`
- DoctorsHierarchyV2Service: `endDate.setHours(23, 59, 59, 999)` (duplicado)

### **3️⃣ Inconsistência de Referência**
- Pode estar usando `admission_date` em vez de `discharge_date`
- Fallback pode incluir datas incorretas

---

## 🎯 **SOLUÇÕES PROPOSTAS**

### **Opção 1: Corrigir Timezone e Ajuste Duplo**
```typescript
// ExecutiveDashboard.tsx
const start = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));

// DoctorsHierarchyV2Service.ts
// Remover ajuste duplo de horário
if (endDate) {
  // NÃO ajustar - já vem ajustado do ExecutiveDashboard
}
```

### **Opção 2: Forçar Uso de discharge_date**
```typescript
// Usar apenas discharge_date para filtro de competência
const refStr = patient.aih_info?.discharge_date;
if (!refStr) return false; // Excluir se não tem alta
```

### **Opção 3: Debug Específico**
- Adicionar logs para verificar datas exatas
- Identificar pacientes que estão "vazando" para agosto

---

## 🚀 **IMPLEMENTAÇÃO RECOMENDADA**

**Combinar Opção 1 + Opção 2:**

1. **Corrigir timezone** no `productionEffectiveDateRange`
2. **Remover ajuste duplo** no `DoctorsHierarchyV2Service`
3. **Forçar uso de `discharge_date`** para filtros de competência
4. **Adicionar logs** para debug

---

## 📋 **PRÓXIMOS PASSOS**

1. ✅ Implementar correção de timezone
2. ⚠️ Remover ajuste duplo de horário
3. ⚠️ Forçar uso de discharge_date
4. ⚠️ Testar com dados reais julho/2025
