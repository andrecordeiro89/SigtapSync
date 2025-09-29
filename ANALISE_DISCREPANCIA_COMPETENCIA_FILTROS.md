# 🔍 **ANÁLISE DE DISCREPÂNCIA: FILTROS DE COMPETÊNCIA**
## Problema: 7 Pacientes Ausentes no Relatório Pacientes Geral

---

## 📋 **PROBLEMA IDENTIFICADO**

**Situação:** Quando selecionado intervalo de competência (01/07/2025 a 31/07/2025):
- **Tela Pacientes:** Mostra MAIS pacientes
- **Analytics → Profissionais → Relatório Pacientes Geral:** Mostra MENOS pacientes (7 a menos)

**Impacto:** Inconsistência de dados entre operador e administrador

---

## 🏗️ **ANÁLISE DOS DOIS FLUXOS DE FILTRO**

### **1️⃣ TELA PACIENTES (`PatientManagement.tsx`)**

#### **Localização do Filtro:**
```typescript
// Linha 242-263: Definição do filtro de competência
const [selectedCompetency, setSelectedCompetency] = useState<string>('all');

const competencyRange = React.useMemo(() => {
  if (!selectedCompetency || selectedCompetency === 'all') return null;
  const m = selectedCompetency.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const start = new Date(Date.UTC(y, mo, 1, 0, 0, 0, 0));
  const end = new Date(Date.UTC(y, mo + 1, 0, 23, 59, 59, 999));
  return { start, end };
}, [selectedCompetency]);
```

#### **Aplicação do Filtro:**
```typescript
// Linha 624-647: Lógica de filtragem
const refStr = (item as any).competencia || item.discharge_date || item.admission_date;
const refDate = refStr ? new Date(refStr) : null;

// Filtro por competência (mês da alta; fallback admissão)
let matchesCompetency = true;
if (competencyRange && refDate) {
  matchesCompetency = refDate >= competencyRange.start && refDate <= competencyRange.end;
}
```

#### **Características:**
- ✅ **Fonte de Data:** `competencia` → `discharge_date` → `admission_date` (fallback)
- ✅ **Intervalo:** UTC com início e fim do mês
- ✅ **Inclusivo:** `>=` início e `<=` fim

---

### **2️⃣ ANALYTICS/RELATÓRIO PACIENTES GERAL (`MedicalProductionDashboard.tsx`)**

#### **Carregamento de Dados:**
```typescript
// Usa DoctorsHierarchyV2Service.getDoctorsHierarchyV2()
// Via ExecutiveDashboard com productionEffectiveDateRange
```

#### **Filtro no Serviço (`doctorsHierarchyV2.ts`):**
```typescript
// Linha 47-60: Filtro por data de alta
if (filters.dateFromISO) {
  query = query.gte('discharge_date', filters.dateFromISO);
}
if (filters.dateToISO) {
  const end = new Date(filters.dateToISO);
  const endExclusive = new Date(Date.UTC(end.getUTCFullYear(), end.getUTCMonth(), end.getUTCDate() + 1, 0, 0, 0, 0));
  query = query.lt('discharge_date', endExclusive.toISOString());
}
// Quando houver filtro de data, excluir AIHs sem data de alta
if (filters.dateFromISO || filters.dateToISO) {
  query = query.not('discharge_date', 'is', null);
}
```

#### **Filtro Adicional no Relatório:**
```typescript
// Linha 1592-1595: Filtro adicional por data de alta
if (useOnlyEnd && selectedEnd) {
  const discharge = p?.aih_info?.discharge_date ? new Date(p.aih_info.discharge_date) : undefined;
  if (!discharge || !isSameUTCDate(discharge, selectedEnd)) return;
}
```

#### **Características:**
- ⚠️ **Fonte de Data:** APENAS `discharge_date` (não usa fallback)
- ⚠️ **Exclusão:** AIHs sem `discharge_date` são EXCLUÍDAS
- ⚠️ **Filtro Duplo:** Serviço + Relatório podem estar conflitando

---

## 🚨 **DISCREPÂNCIAS IDENTIFICADAS**

### **1️⃣ DIFERENÇA NA FONTE DE DATA**

**Tela Pacientes:**
```typescript
const refStr = (item as any).competencia || item.discharge_date || item.admission_date;
```

**Analytics/Relatório:**
```typescript
// Apenas discharge_date, sem fallback
query = query.not('discharge_date', 'is', null);
```

### **2️⃣ EXCLUSÃO DE AIHs SEM ALTA**

**Tela Pacientes:**
- ✅ Inclui AIHs sem `discharge_date` (usa `admission_date` como fallback)

**Analytics/Relatório:**
- ❌ EXCLUI AIHs sem `discharge_date`

### **3️⃣ CAMPO `competencia` IGNORADO**

**Tela Pacientes:**
- ✅ Prioriza campo `competencia` quando disponível

**Analytics/Relatório:**
- ❌ Ignora campo `competencia`, usa apenas `discharge_date`

---

## 🎯 **HIPÓTESES SOBRE OS 7 PACIENTES AUSENTES**

Os 7 pacientes que estão faltando no Relatório Pacientes Geral provavelmente são:

1. **AIHs sem `discharge_date`** mas com `admission_date` em julho/2025
2. **AIHs com campo `competencia` definido** para julho/2025 mas com `discharge_date` diferente
3. **Combinação dos dois casos acima**

---

## 🔧 **SOLUÇÕES PROPOSTAS**

### **Opção 1: Padronizar no DoctorsHierarchyV2Service**
```typescript
// Modificar filtro para usar mesma lógica da tela Pacientes
const refDate = item.competencia || item.discharge_date || item.admission_date;
```

### **Opção 2: Padronizar na Tela Pacientes**
```typescript
// Usar apenas discharge_date (mais rigoroso, seguindo regras SUS)
query = query.not('discharge_date', 'is', null);
```

### **Opção 3: Criar Filtro Unificado**
- Criar função/hook compartilhado
- Garantir mesma lógica em ambas as telas
- Documentar regras de negócio claramente

---

## 🚀 **RECOMENDAÇÃO**

**Implementar Opção 1** - Padronizar no serviço para usar a mesma lógica da tela Pacientes:

1. **Prioridade:** `competencia` → `discharge_date` → `admission_date`
2. **Inclusão:** Manter AIHs sem alta quando têm admissão
3. **Consistência:** Garantir mesmos dados em ambas as telas

---

## 🔍 **PRÓXIMOS PASSOS**

1. ✅ Confirmar hipótese verificando os 7 pacientes específicos
2. ⚠️ Modificar `DoctorsHierarchyV2Service` para usar lógica unificada
3. ⚠️ Testar consistência entre as duas telas
4. ⚠️ Documentar regras de filtro de competência
