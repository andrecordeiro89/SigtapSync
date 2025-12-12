# 🔍 **DEBUG: 26 PACIENTES AUSENTES NO RELATÓRIO SIMPLIFICADO**
## Hospital 18 de Dezembro - 323 vs 297 Pacientes

---

## 🚨 **SITUAÇÃO ATUAL**

**Problema Reportado:**
- **Analytics mostra:** 323 pacientes
- **Relatório Simplificado gera:** 297 pacientes
- **Diferença:** 26 pacientes ausentes (8% dos dados)

---

## 🔍 **LOGS DE DEBUG IMPLEMENTADOS**

Adicionei logs detalhados no relatório simplificado para identificar exatamente onde os pacientes estão sendo filtrados:

### **Console Logs Adicionados:**
```javascript
console.log('🔍 [RELATÓRIO SIMPLIFICADO] Iniciando coleta de dados...');
console.log('🔍 [RELATÓRIO SIMPLIFICADO] Médicos filtrados:', filteredDoctors.length);
console.log(`👨‍⚕️ [RELATÓRIO SIMPLIFICADO] Médico: ${doctorName} - Pacientes: ${doctorPatients.length}`);
console.log(`📅 [RELATÓRIO SIMPLIFICADO] Excluído por filtro de data: ${nome} - AIH: ${aih}`);
console.log(`🚫 [RELATÓRIO SIMPLIFICADO] Excluído por AIH vazia: ${nome}`);

console.log('📊 [RELATÓRIO SIMPLIFICADO] ESTATÍSTICAS:');
console.log(`📊 [RELATÓRIO SIMPLIFICADO] Total encontrado: ${totalPatientsFound}`);
console.log(`📊 [RELATÓRIO SIMPLIFICADO] Excluídos por data: ${excludedByDateFilter}`);
console.log(`📊 [RELATÓRIO SIMPLIFICADO] Excluídos por AIH vazia: ${excludedByEmptyAIH}`);
console.log(`📊 [RELATÓRIO SIMPLIFICADO] Incluídos no relatório: ${allPatients.length}`);
console.log(`📊 [RELATÓRIO SIMPLIFICADO] Diferença esperada vs real: ${323 - allPatients.length}`);
```

---

## 🎯 **POSSÍVEIS CAUSAS IDENTIFICADAS**

### **1️⃣ Filtro de Data Específica (useOnlyEnd)**
```typescript
if (useOnlyEnd && selectedEnd) {
  const discharge = p?.aih_info?.discharge_date ? new Date(p.aih_info.discharge_date) : undefined;
  if (!discharge || !isSameUTCDate(discharge, selectedEnd)) {
    excludedByDateFilter++;
    return; // EXCLUI PACIENTE
  }
}
```

**Possível Problema:** Se o modo "apenas alta" estiver ativo, pode estar filtrando por um dia específico em vez do período completo.

### **2️⃣ AIHs Vazias ou Inválidas**
```typescript
const aih = (p?.aih_info?.aih_number || '').toString().replace(/\D/g, '');
if (!aih) {
  excludedByEmptyAIH++;
  return; // EXCLUI PACIENTE
}
```

**Possível Problema:** Pacientes com AIH nula, vazia ou com formato inválido estão sendo excluídos.

### **3️⃣ Diferença na Fonte de Dados**
- **Analytics:** Usa dados já filtrados pelo `DoctorsHierarchyV2Service`
- **Relatório:** Usa `filteredDoctors` que pode ter filtros adicionais aplicados

---

## 📋 **COMO USAR OS LOGS PARA DIAGNÓSTICO**

### **Passo 1: Executar Relatório Simplificado**
1. Vá para Analytics → Aba Profissionais
2. Selecione Hospital 18 de Dezembro
3. Selecione competência julho/2025
4. Clique em "Relatório Pacientes Geral Simplificado"

### **Passo 2: Verificar Console do Navegador**
1. Abra o DevTools (F12)
2. Vá para aba "Console"
3. Procure pelos logs `[RELATÓRIO SIMPLIFICADO]`

### **Passo 3: Analisar Estatísticas**
```
📊 [RELATÓRIO SIMPLIFICADO] ESTATÍSTICAS:
📊 [RELATÓRIO SIMPLIFICADO] Total encontrado: ???
📊 [RELATÓRIO SIMPLIFICADO] Excluídos por data: ???
📊 [RELATÓRIO SIMPLIFICADO] Excluídos por AIH vazia: ???
📊 [RELATÓRIO SIMPLIFICADO] Incluídos no relatório: 297
📊 [RELATÓRIO SIMPLIFICADO] Diferença esperada vs real: 26
```

---

## 🎯 **CENÁRIOS POSSÍVEIS**

### **Cenário A: Filtro de Data Específica**
```
Total encontrado: 323
Excluídos por data: 26
Excluídos por AIH vazia: 0
Incluídos no relatório: 297
```
**Solução:** Desativar ou corrigir filtro `useOnlyEnd`

### **Cenário B: AIHs Inválidas**
```
Total encontrado: 323
Excluídos por data: 0
Excluídos por AIH vazia: 26
Incluídos no relatório: 297
```
**Solução:** Revisar validação de AIH ou tratar casos especiais

### **Cenário C: Fonte de Dados Diferente**
```
Total encontrado: 297
Excluídos por data: 0
Excluídos por AIH vazia: 0
Incluídos no relatório: 297
```
**Solução:** Verificar se `filteredDoctors` já vem filtrado

---

## 🔧 **CORREÇÕES PROVÁVEIS**

### **Se o Problema for Filtro de Data:**
```typescript
// Remover ou condicionar o filtro useOnlyEnd
if (false && useOnlyEnd && selectedEnd) { // Desabilitar temporariamente
  // ... código do filtro
}
```

### **Se o Problema for AIH Vazia:**
```typescript
// Relaxar validação de AIH
const aih = (p?.aih_info?.aih_number || '').toString();
if (!aih || aih.trim() === '') {
  console.warn(`⚠️ Paciente sem AIH: ${name}`);
  // Ainda incluir no relatório com AIH vazia
}
```

### **Se o Problema for Fonte de Dados:**
- Verificar se `filteredDoctors` está sendo afetado por outros filtros
- Comparar com dados brutos antes da filtragem

---

## 📊 **PRÓXIMOS PASSOS**

1. **✅ EXECUTAR** o relatório e verificar logs
2. **🔍 ANALISAR** as estatísticas no console
3. **🎯 IDENTIFICAR** qual filtro está excluindo os 26 pacientes
4. **🔧 APLICAR** a correção específica baseada no diagnóstico
5. **✅ VALIDAR** que o relatório gera 323 pacientes

---

## 📋 **STATUS: DEBUG IMPLEMENTADO**

Os logs de debug estão implementados e prontos para uso. Execute o relatório simplificado e verifique o console do navegador para identificar exatamente onde os 26 pacientes estão sendo perdidos.

**Próximo passo:** Executar relatório e analisar logs! 🔍
