# 🔍 ANÁLISE COMPARATIVA: Relatório Conferência vs Protocolo de Atendimento

**Data:** 14 de outubro de 2025  
**Objetivo:** Alinhar arquitetura, lógica e estrutura de dados entre os dois relatórios

---

## 📊 **COMPARAÇÃO LADO A LADO**

### **1. ESTRUTURA DE DADOS**

| Aspecto | Relatório Conferência | Protocolo Atendimento | Status |
|---------|----------------------|----------------------|---------|
| **Fonte de dados** | `filteredDoctors` | `doctor` (médico específico) | ✅ Mesma origem |
| **Iteração** | `doctor.patients.forEach()` | `doctor.patients.forEach()` | ✅ Igual |
| **Busca de procedimentos** | ❌ **NÃO BUSCA** procedimentos | ✅ Itera `p.procedures` | ⚠️ DIFERENTE |
| **Chave única** | `aih_id` (via serviço) | `aih_id` (via serviço) | ✅ Igual |

---

### **2. LÓGICA DE PROCESSAMENTO**

#### **Relatório Conferência (ATUAL)**

```typescript
filteredDoctors.forEach((card: any) => {
  (card.patients || []).forEach((p: any) => {
    // ✅ Pega dados da AIH diretamente
    const name = p.patient_info?.name || 'Paciente';
    const medicalRecord = p.patient_info?.medical_record || '-';
    const aih = p?.aih_info?.aih_number || 'Aguardando geração';
    const disLabel = parseISODateToLocal(p?.aih_info?.discharge_date);
    
    // ✅ Calcula valores financeiros
    const baseAih = Number(p.total_value_reais || 0);
    const increment = computeIncrementForProcedures(p.procedures, ...);
    
    // ❌ NÃO pega descrição de procedimento - só valores!
    rows.push([
      idx++,
      medicalRecord,
      name,
      aih,
      disLabel,
      doctorName,
      hospitalName,
      formatCurrency(baseAih),
      formatCurrency(increment),
      formatCurrency(aihWithIncrements)
    ]);
  });
});
```

**Características:**
- ✅ Uma linha por AIH
- ✅ Valores financeiros (AIH Seca + Incremento)
- ❌ **NÃO mostra procedimento** (foco em valores)
- ✅ Ordenação por data (mais recente primeiro)
- ✅ Formato: Excel (XLSX)

---

#### **Protocolo de Atendimento (ATUAL)**

```typescript
(doctor.patients || []).forEach((p: any) => {
  const patientName = p.patient_info?.name || 'Paciente';
  const medicalRecord = p.patient_info?.medical_record || '-';
  const dischargeLabel = parseISODateToLocal(p?.aih_info?.discharge_date);
  
  const procedures = p.procedures || [];
  
  // 🎯 LÓGICA DO PRIMEIRO PROCEDIMENTO
  let firstProcedureAdded = false;
  
  procedures.forEach((proc: any) => {
    if (firstProcedureAdded) return; // Só adiciona 1 por AIH
    
    // ✅ FILTROS ESPECÍFICOS
    const regInstrument = proc.registration_instrument;
    const isMainProcedure = regInstrument === '03' || regInstrument.startsWith('03 -');
    
    const cbo = proc.cbo || '';
    const isNotAnesthetist = cbo !== '225151';
    
    // ✅ Se passar filtros, adiciona APENAS O PRIMEIRO
    if (isMainProcedure && isNotAnesthetist && !firstProcedureAdded) {
      const procCode = proc.procedure_code.replace(/[.\-]/g, '');
      const procDesc = proc.procedure_description.substring(0, 60);
      
      protocolData.push([
        idx++,
        medicalRecord,
        patientName,
        procCode,          // ✅ Código do procedimento
        procDesc,          // ✅ Descrição do procedimento
        dischargeLabel
      ]);
      
      firstProcedureAdded = true;
    }
  });
});
```

**Características:**
- ✅ Uma linha por AIH
- ✅ Mostra **primeiro procedimento principal** (Reg 03)
- ✅ Exclui anestesistas (CBO 225151)
- ❌ **NÃO mostra valores financeiros**
- ✅ Ordenação por data (mais antigo primeiro)
- ✅ Formato: PDF (jsPDF)

---

## 🎯 **DIFERENÇAS CRÍTICAS IDENTIFICADAS**

### **1. Busca de Procedimentos**

| Relatório | Como busca | Problema |
|-----------|-----------|----------|
| **Conferência** | ❌ Não busca (usa apenas valores) | Correto para seu propósito |
| **Protocolo** | ✅ Itera `p.procedures` | Correto |

**Análise:** ✅ Ambos estão corretos para seus propósitos distintos.

---

### **2. Filtro de Procedimentos**

#### **Relatório Conferência:**
```typescript
// ❌ NÃO FILTRA - usa valores consolidados da AIH
const baseAih = Number(p.total_value_reais || 0);
```

**Propósito:** Conferência financeira (valores totais da AIH).

#### **Protocolo de Atendimento:**
```typescript
// ✅ FILTRA:
// - Apenas Reg 03 (procedimento principal)
// - Exclui CBO 225151 (anestesistas)
// - Pega APENAS o primeiro que passa
```

**Propósito:** Protocolo de atendimento (procedimento principal realizado).

**Análise:** ✅ Correto - propósitos diferentes exigem filtros diferentes.

---

### **3. Ordenação de Dados**

| Relatório | Ordenação | Razão |
|-----------|-----------|-------|
| **Conferência** | Data **DECRESCENTE** (mais recente primeiro) | Facilita revisão de casos recentes |
| **Protocolo** | Data **CRESCENTE** (mais antigo primeiro) | Ordem cronológica de atendimentos |

**Análise:** ✅ Ambos corretos para seus contextos.

---

### **4. Formato de Saída**

| Relatório | Formato | Colunas |
|-----------|---------|---------|
| **Conferência** | Excel (XLSX) | 10 colunas (valores financeiros) |
| **Protocolo** | PDF (jsPDF) | 6 colunas (procedimento principal) |

**Análise:** ✅ Formatos apropriados para cada finalidade.

---

## ⚠️ **PROBLEMAS IDENTIFICADOS**

### **PROBLEMA 1: Protocolo não mostra valores financeiros**

**Situação Atual:**
```typescript
// Protocolo de Atendimento
protocolData.push([
  idx++,
  medicalRecord,
  patientName,
  procCode,
  procDesc,
  dischargeLabel  // ❌ Não tem valores!
]);
```

**Se o objetivo é alinhar com Relatório Conferência:**

Deveria incluir valores?

```typescript
protocolData.push([
  idx++,
  medicalRecord,
  patientName,
  procCode,
  procDesc,
  dischargeLabel,
  formatCurrency(baseAih),      // 🆕 AIH Seca?
  formatCurrency(increment),     // 🆕 Incremento?
  formatCurrency(total)          // 🆕 Total?
]);
```

**Decisão necessária:** O protocolo deve incluir valores financeiros?

---

### **PROBLEMA 2: Lógica de "primeiro procedimento" só existe no Protocolo**

**Relatório Conferência:**
- ❌ Não tem lógica de procedimento (correto - foco em valores)
- Uma linha por AIH com valores consolidados

**Protocolo de Atendimento:**
- ✅ Tem lógica de primeiro procedimento principal
- Uma linha por AIH com primeiro procedimento que passa nos filtros

**Análise:** ✅ Correto - propósitos diferentes.

---

## ✅ **ALINHAMENTO PROPOSTO**

### **Cenário 1: Manter Propósitos Distintos (RECOMENDADO)**

**Relatório Conferência:**
- ✅ Manter como está (foco em valores financeiros)
- ✅ Uma linha por AIH
- ✅ Valores: AIH Seca + Incremento + Total
- ✅ Sem descrição de procedimento

**Protocolo de Atendimento:**
- ✅ Manter como está (foco em procedimento principal)
- ✅ Uma linha por AIH
- ✅ Primeiro procedimento principal (Reg 03, não anestesista)
- ✅ Sem valores financeiros (ou adicionar se desejado)

**Vantagem:** Cada relatório mantém seu propósito claro e específico.

---

### **Cenário 2: Alinhar Estrutura de Dados**

Se o objetivo é **usar a mesma estrutura** para ambos:

```typescript
// ✅ ESTRUTURA UNIFICADA
const reportData = [];

(doctor.patients || []).forEach((p: any) => {
  const patientName = p.patient_info?.name || 'Paciente';
  const medicalRecord = p.patient_info?.medical_record || '-';
  const aihNumber = p?.aih_info?.aih_number || 'Aguardando';
  const dischargeLabel = parseISODateToLocal(p?.aih_info?.discharge_date);
  
  // Valores financeiros (para ambos)
  const baseAih = Number(p.total_value_reais || 0);
  const increment = computeIncrementForProcedures(p.procedures, ...);
  const total = baseAih + increment;
  
  // Procedimento principal (para Protocolo)
  let mainProcedure = null;
  const procedures = p.procedures || [];
  
  for (const proc of procedures) {
    const isMainProcedure = proc.registration_instrument === '03' || 
                            proc.registration_instrument?.startsWith('03 -');
    const isNotAnesthetist = proc.cbo !== '225151';
    
    if (isMainProcedure && isNotAnesthetist) {
      mainProcedure = {
        code: proc.procedure_code.replace(/[.\-]/g, ''),
        description: proc.procedure_description.substring(0, 60)
      };
      break; // Primeiro procedimento que passa
    }
  }
  
  // ✅ Dados completos para ambos relatórios
  reportData.push({
    index: idx++,
    medicalRecord,
    patientName,
    aihNumber,
    dischargeDate: dischargeLabel,
    doctorName,
    hospitalName,
    procedureCode: mainProcedure?.code || '-',
    procedureDescription: mainProcedure?.description || '-',
    baseValue: baseAih,
    increment: increment,
    totalValue: total
  });
});

// Relatório Conferência usa: valores financeiros (sem procedimento)
// Protocolo Atendimento usa: procedimento (com ou sem valores)
```

---

## 🔧 **CORREÇÃO PROPOSTA PARA PROTOCOLO**

### **Adicionar Filtro de Competência ao PDF**

✅ **JÁ CORRIGIDO** - Campo de competência adicionado ao cabeçalho do PDF.

---

### **Unificar Lógica de Busca de Procedimentos**

✅ **JÁ CORRIGIDO** - Ambos usam `p.procedures` que vem da busca por `aih_id`.

---

### **Garantir Primeiro Procedimento Principal**

```typescript
// ✅ LÓGICA CORRETA (já implementada)
let firstProcedureAdded = false;

procedures.forEach((proc: any) => {
  if (firstProcedureAdded) return;
  
  const isMainProcedure = proc.registration_instrument === '03' || 
                          proc.registration_instrument?.startsWith('03 -');
  const isNotAnesthetist = proc.cbo !== '225151';
  
  if (isMainProcedure && isNotAnesthetist && !firstProcedureAdded) {
    // Adiciona procedimento
    firstProcedureAdded = true;
  }
});
```

✅ **CORRETO** - Implementação atual está perfeita.

---

## 📋 **CHECKLIST DE ALINHAMENTO**

### **Estrutura de Dados**
- [x] ✅ Ambos usam `doctor.patients` (uma entrada por AIH)
- [x] ✅ Ambos iteram com `.forEach()`
- [x] ✅ Procedimentos vêm de busca por `aih_id`
- [x] ✅ Sem fallback para `patient_id`

### **Lógica de Processamento**
- [x] ✅ Conferência: Uma linha por AIH (valores)
- [x] ✅ Protocolo: Uma linha por AIH (procedimento)
- [x] ✅ Protocolo: Primeiro procedimento Reg 03 não anestesista
- [x] ✅ Ambos: Pacientes recorrentes aparecem múltiplas vezes

### **Dados Exibidos**
- [x] ✅ Conferência: Valores financeiros (AIH Seca + Incremento)
- [x] ✅ Protocolo: Procedimento principal
- [ ] ⏳ Protocolo: Considerar adicionar valores? (opcional)

### **Formato de Saída**
- [x] ✅ Conferência: Excel (apropriado para análise financeira)
- [x] ✅ Protocolo: PDF (apropriado para documento formal)

### **Filtros e Ordenação**
- [x] ✅ Conferência: Ordenação decrescente (mais recente primeiro)
- [x] ✅ Protocolo: Ordenação crescente (ordem cronológica)
- [x] ✅ Protocolo: Filtro Reg 03 + não anestesista

---

## 🎯 **RECOMENDAÇÃO FINAL**

### **✅ Manter Propósitos Distintos**

**Relatório Conferência:**
- Propósito: **Conferência financeira**
- Foco: **Valores** (AIH Seca, Incremento, Total)
- Linha: Uma por AIH com valores consolidados
- Não precisa: Descrição de procedimento

**Protocolo de Atendimento:**
- Propósito: **Documento de atendimentos realizados**
- Foco: **Procedimento principal** de cada internação
- Linha: Uma por AIH com primeiro procedimento Reg 03
- Não precisa: Valores financeiros (opcional)

### **✅ Ambos Já Usam Mesma Arquitetura de Dados**

| Aspecto | Status |
|---------|--------|
| Fonte: `doctor.patients` | ✅ Alinhado |
| Uma entrada por AIH | ✅ Alinhado |
| Busca por `aih_id` | ✅ Alinhado |
| Sem fallback `patient_id` | ✅ Alinhado |
| Pacientes recorrentes OK | ✅ Alinhado |

### **✅ Lógica de "Primeiro Procedimento" Correta**

```typescript
// ✅ Implementação perfeita no Protocolo
let firstProcedureAdded = false;
procedures.forEach((proc) => {
  if (firstProcedureAdded) return;
  if (isMainProcedure && isNotAnesthetist && !firstProcedureAdded) {
    // Adiciona
    firstProcedureAdded = true;
  }
});
```

---

## 📊 **RESULTADO DA ANÁLISE**

### **✅ SEM FALHAS CRÍTICAS IDENTIFICADAS**

Ambos os relatórios:
- ✅ Usam arquitetura de dados correta
- ✅ Buscam procedimentos por `aih_id`
- ✅ Processam pacientes recorrentes corretamente
- ✅ Têm propósitos distintos e adequados
- ✅ Implementações corretas para seus objetivos

### **Sugestão de Melhoria (Opcional):**

**Adicionar valores ao Protocolo de Atendimento?**

Se desejado, adicionar colunas de valores financeiros ao PDF:

```typescript
protocolData.push([
  idx++,
  medicalRecord,
  patientName,
  procCode,
  procDesc,
  dischargeLabel,
  formatCurrency(baseAih),      // 🆕 AIH Seca
  formatCurrency(increment),     // 🆕 Incremento
  formatCurrency(total)          // 🆕 Total
]);
```

Mas isso é **OPCIONAL** - o protocolo funciona perfeitamente como está.

---

## ✅ **CONCLUSÃO**

**Ambos os relatórios estão CORRETOS e ALINHADOS em arquitetura de dados!**

- ✅ Mesma fonte de dados (`doctor.patients`)
- ✅ Mesma estrutura (uma entrada por AIH)
- ✅ Mesma busca (por `aih_id`)
- ✅ Propósitos distintos mas implementações corretas
- ✅ Lógica de "primeiro procedimento" perfeita no Protocolo

**Nenhuma correção crítica necessária!** 🎉

