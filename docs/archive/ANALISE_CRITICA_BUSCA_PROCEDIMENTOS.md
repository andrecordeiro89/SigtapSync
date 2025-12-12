# 🚨 ANÁLISE CRÍTICA: BUSCA DE PROCEDIMENTOS POR patient_id vs aih_id

**Data:** 14 de outubro de 2025  
**Criticidade:** ⚠️ **ALTA - Afeta Protocolo de Atendimento e todos os relatórios**  
**Status:** 🔴 **PROBLEMA IDENTIFICADO**

---

## ⚠️ **PROBLEMA IDENTIFICADO**

### **Resumo Executivo**
Os serviços estão buscando procedimentos de forma **INCORRETA**, misturando procedimentos de diferentes AIHs do mesmo paciente.

---

## 🔍 **ANÁLISE DETALHADA**

### **1. Arquivo: `src/services/doctorPatientService.ts`**

**Linhas 284-294:**

```typescript
// 🔧 FIX PACIENTES RECORRENTES: Usar SEMPRE procedimentos por aih_id (não por patient_id)
// Isso garante que pacientes com múltiplas AIHs em diferentes competências
// tenham apenas os procedimentos da AIH específica da competência selecionada
let procs: any[] = [];
if (aih.id && procsByAih.success) {
  procs = procsByAih.proceduresByAihId.get(aih.id) || [];  // ✅ CORRETO
}
// Fallback: se não encontrou por AIH, tentar por patient_id
if (procs.length === 0) {
  procs = procsByPatient.get(patientId) || [];  // ❌ PROBLEMA!
}
```

**Problema:**
- ✅ Tenta buscar por `aih_id` PRIMEIRO (correto)
- ❌ Se não encontrar, faz **FALLBACK** para `patient_id` (ERRADO!)

**Por que é um problema?**

O fallback por `patient_id` causa **mistura de procedimentos**:

```
Cenário: Paciente João Silva com 3 AIHs

AIH 001 (05/10/2025):
├─ Procedimento A: Apendicectomia
└─ Procedimento B: Anestesia

AIH 002 (15/10/2025):
├─ Procedimento C: Colecistectomia
└─ Procedimento D: Anestesia

AIH 003 (25/10/2025):
├─ Procedimento E: Herniorrafia
└─ Procedimento F: Anestesia

Se procsByAih.get(AIH 001) retornar vazio:
❌ Fallback busca procsByPatient.get(patient_id)
❌ Retorna TODOS os 6 procedimentos (A, B, C, D, E, F)
❌ AIH 001 mostra procedimentos de AIH 002 e 003!
```

---

### **2. Arquivo: `src/services/doctorsHierarchyV2.ts`**

**Linhas 206-210:**

```typescript
// Procedimentos por paciente, se vazio usar por AIH
let procs = (pid && procsByPatient.get(pid)) || [];  // ❌ BUSCA POR PATIENT_ID PRIMEIRO!
if (procs.length === 0 && aih.id) {
  procs = procsByAih.get(aih.id) || [];  // ✅ Fallback para aih_id
}
```

**Problema:**
- ❌ Busca por `patient_id` **PRIMEIRO** (completamente errado!)
- ✅ Só busca por `aih_id` se não encontrar por `patient_id`

**Por que é PIOR?**

Aqui a lógica está **invertida**:

```
1. Busca procsByPatient.get(patient_id)
   → Retorna TODOS os procedimentos do paciente (de TODAS as AIHs)
   
2. Só busca por aih_id se a busca por patient_id retornar vazio
   → Mas procsByPatient SEMPRE vai retornar algo se o paciente tiver procedimentos
   → Logo, NUNCA chega a buscar corretamente por aih_id!

Resultado: SEMPRE mistura procedimentos de AIHs diferentes!
```

---

## 📊 **IMPACTO DO PROBLEMA**

### **Relatórios Afetados:**

| Relatório | Serviço Usado | Impacto |
|-----------|---------------|---------|
| Protocolo de Atendimento | `doctorPatientService` | ⚠️ **Médio** - Fallback causa mistura ocasional |
| Relatório Pacientes Geral | `doctorPatientService` | ⚠️ **Médio** - Fallback causa mistura ocasional |
| Relatório Pacientes Conferência | `doctorPatientService` | ⚠️ **Médio** - Fallback causa mistura ocasional |
| Exportações | `doctorsHierarchyV2` | 🔴 **CRÍTICO** - Busca errada sempre ativa |
| Dashboard Procedimentos | `doctorsHierarchyV2` | 🔴 **CRÍTICO** - Busca errada sempre ativa |
| Comparação Especialidades | `doctorsHierarchyV2` | 🔴 **CRÍTICO** - Busca errada sempre ativa |

---

## 🎯 **EXEMPLO PRÁTICO DO PROBLEMA**

### Cenário Real:

```
Paciente: Maria Silva (patient_id: "abc-123")

AIH 001 (Outubro/2025):
├─ aih_id: "aih-001"
├─ Data Alta: 05/10/2025
└─ Procedimentos:
    ├─ 0303020014: Apendicectomia (Reg 03, CBO 225125)
    └─ 0405010053: Anestesia (Reg 01, CBO 225151)

AIH 002 (Outubro/2025): [MESMA COMPETÊNCIA]
├─ aih_id: "aih-002"
├─ Data Alta: 20/10/2025
└─ Procedimentos:
    ├─ 0303140089: Colecistectomia (Reg 03, CBO 225125)
    └─ 0405010053: Anestesia (Reg 01, CBO 225151)
```

### Comportamento Atual (❌ ERRADO):

**Com `doctorPatientService` (fallback para patient_id):**

```
Protocolo de Atendimento mostra:

Se procsByAih("aih-001") retornar vazio:
✅ Linha 1: Maria Silva | Apendicectomia | 05/10/2025 [✅ Correto]

Se procsByAih("aih-002") retornar vazio:
❌ Linha 2: Maria Silva | Apendicectomia | 20/10/2025 [❌ ERRADO! Deveria ser Colecistectomia]
    → Fallback busca todos procedimentos do patient_id
    → Pega o primeiro Reg 03 que encontrar
    → Pode pegar procedimento da AIH errada!
```

**Com `doctorsHierarchyV2` (busca patient_id PRIMEIRO):**

```
Exportação mostra:

SEMPRE busca procsByPatient("abc-123") PRIMEIRO:
❌ AIH 001: Mostra [Apendicectomia, Anestesia, Colecistectomia, Anestesia]
    → Mistura procedimentos de AIH 001 e AIH 002!
    
❌ AIH 002: Mostra [Apendicectomia, Anestesia, Colecistectomia, Anestesia]
    → Mesma mistura! Ambas AIHs mostram os mesmos 4 procedimentos!
```

---

## 🔧 **CORREÇÃO NECESSÁRIA**

### **Princípio Fundamental:**

> **UMA AIH → APENAS SEUS PRÓPRIOS PROCEDIMENTOS**

### **Regra de Busca Correta:**

```typescript
// ✅ CORRETO: Buscar APENAS por aih_id (sem fallback)
let procs: any[] = [];
if (aih.id && procsByAih.success) {
  procs = procsByAih.proceduresByAihId.get(aih.id) || [];
}
// NÃO HÁ FALLBACK!
// Se não tem procedimentos por aih_id, a AIH fica sem procedimentos (correto)
```

### **Por que NÃO deve ter fallback?**

1. **Integridade dos dados:**
   - Cada AIH representa uma internação única
   - Procedimentos pertencem à AIH, não ao paciente

2. **Pacientes recorrentes:**
   - Mesmo paciente pode ter múltiplas AIHs
   - Cada AIH tem procedimentos diferentes
   - Misturar procedimentos destrói a rastreabilidade

3. **Auditoria:**
   - Impossível auditar se procedimentos estão misturados
   - Valores financeiros ficam incorretos
   - Relatórios perdem confiabilidade

---

## 📋 **CORREÇÕES A APLICAR**

### **1. `src/services/doctorPatientService.ts` (Linhas 284-294)**

**Remover fallback para patient_id:**

```typescript
// ❌ ANTES (com fallback problemático)
let procs: any[] = [];
if (aih.id && procsByAih.success) {
  procs = procsByAih.proceduresByAihId.get(aih.id) || [];
}
// Fallback: se não encontrou por AIH, tentar por patient_id
if (procs.length === 0) {
  procs = procsByPatient.get(patientId) || [];  // ❌ REMOVER!
}

// ✅ DEPOIS (apenas aih_id)
let procs: any[] = [];
if (aih.id && procsByAih.success) {
  procs = procsByAih.proceduresByAihId.get(aih.id) || [];
}
// Sem fallback! Se não tem por aih_id, fica vazio (correto)
```

### **2. `src/services/doctorsHierarchyV2.ts` (Linhas 206-210)**

**Inverter ordem e remover fallback para patient_id:**

```typescript
// ❌ ANTES (ordem errada)
let procs = (pid && procsByPatient.get(pid)) || [];  // ❌ REMOVER!
if (procs.length === 0 && aih.id) {
  procs = procsByAih.get(aih.id) || [];
}

// ✅ DEPOIS (apenas aih_id)
let procs: any[] = [];
if (aih.id) {
  procs = procsByAih.get(aih.id) || [];
}
// Sem fallback! Se não tem por aih_id, fica vazio (correto)
```

---

## ⚠️ **CONSEQUÊNCIAS SE NÃO CORRIGIR**

### **Cenário Crítico:**

```
Paciente com 3 AIHs na mesma competência:
├─ AIH 001: Procedimento A (R$ 1.000)
├─ AIH 002: Procedimento B (R$ 2.000)
└─ AIH 003: Procedimento C (R$ 3.000)

❌ Com busca errada:
- AIH 001 mostra: A, B, C (R$ 6.000) - 200% a mais!
- AIH 002 mostra: A, B, C (R$ 6.000) - 200% a mais!
- AIH 003 mostra: A, B, C (R$ 6.000) - 200% a mais!
- TOTAL: R$ 18.000 (600% do valor real!)

✅ Com busca correta:
- AIH 001 mostra: A (R$ 1.000)
- AIH 002 mostra: B (R$ 2.000)
- AIH 003 mostra: C (R$ 3.000)
- TOTAL: R$ 6.000 (100% correto)
```

---

## ✅ **VALIDAÇÃO PÓS-CORREÇÃO**

### Testes Obrigatórios:

1. **Paciente com múltiplas AIHs na mesma competência**
   - Verificar se cada AIH mostra apenas seus procedimentos
   - Verificar se não há duplicação de procedimentos

2. **Protocolo de Atendimento**
   - Gerar protocolo de médico com pacientes recorrentes
   - Verificar se cada linha tem o procedimento correto da AIH

3. **Exportações**
   - Exportar dados de pacientes recorrentes
   - Verificar se cada AIH tem procedimentos únicos

4. **Valores financeiros**
   - Calcular totais de AIHs
   - Garantir que não há inflação por mistura de procedimentos

---

## 📊 **RESUMO EXECUTIVO**

### Problema:
- ✅ Estrutura de dados correta (uma entrada por AIH)
- ❌ Busca de procedimentos INCORRETA (fallback para patient_id)
- 🔴 Procedimentos de AIHs diferentes sendo misturados

### Impacto:
- 🔴 **CRÍTICO** em `doctorsHierarchyV2` (busca errada sempre)
- ⚠️ **MÉDIO** em `doctorPatientService` (fallback ocasional)

### Solução:
- ✅ Remover TODOS os fallbacks para `patient_id`
- ✅ Buscar APENAS por `aih_id`
- ✅ Se AIH não tem procedimentos, fica vazia (correto)

### Urgência:
- 🔴 **ALTA** - Afeta integridade dos dados
- 🔴 **ALTA** - Afeta valores financeiros
- 🔴 **ALTA** - Afeta todos os relatórios

---

**🚨 CORREÇÃO URGENTE NECESSÁRIA!**

