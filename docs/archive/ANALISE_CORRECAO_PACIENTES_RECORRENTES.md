# 🔍 ANÁLISE E CORREÇÃO: PACIENTES RECORRENTES NO RELATÓRIO DE CONFERÊNCIA

**Data:** 14 de outubro de 2025  
**Sistema:** SIGTAP Sync v4.0  
**Componente:** Analytics → Aba Profissionais → Relatório Pacientes Conferência

---

## 📋 SUMÁRIO EXECUTIVO

### ❌ Problema Identificado
Pacientes recorrentes (mesmo paciente com múltiplas AIHs na mesma competência) estavam sendo **excluídos** do relatório de conferência. Apenas a primeira AIH do paciente era processada, as demais eram ignoradas.

### ✅ Solução Implementada
Alteração na lógica de processamento de dados para **criar uma entrada por AIH** em vez de uma entrada por paciente único, garantindo que todas as internações sejam incluídas no relatório.

### 🎯 Resultado Esperado
- ✅ Todas as AIHs aparecem no relatório
- ✅ Pacientes recorrentes têm múltiplas linhas (uma por AIH)
- ✅ Cada linha mostra valores individuais da AIH específica
- ✅ Relatório reflete a realidade operacional do hospital

---

## 🔍 ANÁLISE DETALHADA DO PROBLEMA

### 1. Localização do Bug

**Arquivo:** `src/services/doctorPatientService.ts`  
**Função:** `getDoctorsWithPatientsFromProceduresView()`  
**Linhas Afetadas:** 250-277 (código antigo)

### 2. Código Problemático (ANTES)

```typescript
// ❌ CÓDIGO ANTIGO - COM BUG
const patientId = aih.patient_id;
let patient = (doctor.patients as any[]).find(p => p.patient_id === patientId);
if (!patient) {
  // Cria paciente apenas se não existir
  patient = {
    patient_id: patientId,
    patient_info: { ... },
    aih_info: { ... },
    total_value_reais: (aih.calculated_total_value || 0) / 100,
    procedures: [],
    total_procedures: 0,
    approved_procedures: 0
  };
  (doctor.patients as any[]).push(patient);
}
// Se paciente já existe, AIH é ignorada ❌
```

### 3. Fluxo do Bug

```
AIH 1 do Paciente João
├─ Verifica se João já existe no array: NÃO
├─ Cria entrada para João com dados da AIH 1 ✅
└─ Adiciona ao array

AIH 2 do Paciente João (mesma competência)
├─ Verifica se João já existe no array: SIM
├─ NÃO cria nova entrada ❌
└─ AIH 2 é IGNORADA ❌

AIH 3 do Paciente João (mesma competência)
├─ Verifica se João já existe no array: SIM
├─ NÃO cria nova entrada ❌
└─ AIH 3 é IGNORADA ❌
```

### 4. Impacto

| Cenário | Comportamento Anterior | Comportamento Correto |
|---------|----------------------|---------------------|
| Paciente com 1 AIH | ✅ Aparece no relatório | ✅ Aparece no relatório |
| Paciente com 3 AIHs (mesma competência) | ❌ Apenas 1 linha (primeira AIH) | ✅ 3 linhas (uma por AIH) |
| Paciente retornou após alta | ❌ Segunda internação ignorada | ✅ Ambas internações aparecem |
| Valor total no relatório | ❌ SUBDIMENSIONADO | ✅ VALOR REAL COMPLETO |

---

## ✅ SOLUÇÃO IMPLEMENTADA

### 1. Código Corrigido (DEPOIS)

```typescript
// ✅ CÓDIGO NOVO - CORRIGIDO
// 🔧 CORREÇÃO CRÍTICA: UMA ENTRADA POR AIH (não por paciente)
// Cada AIH é uma internação/atendimento único, mesmo paciente pode ter múltiplas AIHs
// Usar aih.id como chave única em vez de patient_id
const patientId = aih.patient_id;
const aihId = aih.id; // ✅ Chave única: ID da AIH

// ✅ SEMPRE criar nova entrada (uma por AIH)
// Não verificar se paciente já existe, pois podem haver múltiplas AIHs do mesmo paciente
const patient = {
  patient_id: patientId,
  aih_id: aihId, // ✅ Incluir aih_id para rastreamento
  patient_info: {
    name: aih.patients?.name || 'Paciente sem nome',
    cns: aih.patients?.cns || '',
    birth_date: aih.patients?.birth_date || '',
    gender: aih.patients?.gender || '',
    medical_record: aih.patients?.medical_record || ''
  },
  aih_info: {
    admission_date: aih.admission_date,
    discharge_date: aih.discharge_date,
    aih_number: aih.aih_number,
    care_character: aih.care_character,
    hospital_id: aih.hospital_id,
    competencia: aih.competencia
  },
  total_value_reais: (aih.calculated_total_value || 0) / 100,
  procedures: [],
  total_procedures: 0,
  approved_procedures: 0
};
(doctor.patients as any[]).push(patient); // ✅ Sempre adiciona
```

### 2. Alterações na Interface TypeScript

```typescript
export interface PatientWithProcedures {
  patient_id?: string; // ID real do paciente (UUID da tabela patients)
  aih_id?: string; // ✅ NOVO: ID único da AIH para múltiplas AIHs do mesmo paciente
  patient_info: { ... };
  aih_info: { ... };
  total_value_reais: number;
  procedures: ProcedureDetail[];
  total_procedures: number;
  approved_procedures: number;
}
```

### 3. Novo Fluxo Corrigido

```
AIH 1 do Paciente João
├─ Cria entrada única para AIH 1 ✅
├─ Usa aih_id como identificador único
└─ Adiciona ao array

AIH 2 do Paciente João (mesma competência)
├─ Cria entrada única para AIH 2 ✅
├─ Usa aih_id como identificador único
└─ Adiciona ao array

AIH 3 do Paciente João (mesma competência)
├─ Cria entrada única para AIH 3 ✅
├─ Usa aih_id como identificador único
└─ Adiciona ao array

Resultado no Relatório:
- Linha 1: João Silva | AIH 001 | R$ 1.500,00 | 10/10/2025
- Linha 2: João Silva | AIH 002 | R$ 2.300,00 | 15/10/2025
- Linha 3: João Silva | AIH 003 | R$ 1.800,00 | 20/10/2025
```

---

## 🎯 GARANTIAS IMPLEMENTADAS

### ✅ 1. Todas AIHs Incluídas
- Cada AIH gera uma linha no relatório
- Não há mais verificação de duplicação por `patient_id`
- Chave única: `aih_id`

### ✅ 2. Pacientes Recorrentes Suportados
- Mesmo paciente pode aparecer múltiplas vezes
- Cada aparição representa uma internação diferente
- Valores individuais por AIH preservados

### ✅ 3. Mesma Competência Suportada
- Múltiplas AIHs do mesmo paciente na mesma competência ✅
- Exemplo: Paciente internado 3 vezes em outubro/2025
- Todas as 3 internações aparecem no relatório

### ✅ 4. Rastreabilidade Completa
- `aih_id` incluído em cada registro
- `patient_id` mantido para referência
- Número da AIH (`aih_number`) visível no relatório

### ✅ 5. Valores Corretos
- Cada linha mostra o valor específico da AIH
- Valores base (SIGTAP) + incrementos Opera Paraná
- Total do relatório reflete a soma de TODAS as AIHs

---

## 📊 EXEMPLO PRÁTICO

### Cenário: Paciente Maria Silva

**Situação:**
- 3 internações em outubro/2025
- Mesmo hospital, mesmo médico
- AIHs diferentes para cada internação

**ANTES da Correção (❌ ERRADO):**
```
Relatório mostra apenas 1 linha:
#  | Prontuário | Nome         | Nº AIH          | Data Alta  | Médico      | Valor AIH
1  | 12345      | Maria Silva  | 4120240001001  | 05/10/2025 | Dr. João    | R$ 1.500,00

Total: R$ 1.500,00 ❌ (faltam R$ 3.800,00!)
```

**DEPOIS da Correção (✅ CORRETO):**
```
Relatório mostra 3 linhas:
#  | Prontuário | Nome         | Nº AIH          | Data Alta  | Médico      | Valor AIH
1  | 12345      | Maria Silva  | 4120240001001  | 05/10/2025 | Dr. João    | R$ 1.500,00
2  | 12345      | Maria Silva  | 4120240001002  | 12/10/2025 | Dr. João    | R$ 2.300,00
3  | 12345      | Maria Silva  | 4120240001003  | 18/10/2025 | Dr. João    | R$ 1.800,00

Total: R$ 5.600,00 ✅ (CORRETO!)
```

---

## 🔄 COMPATIBILIDADE

### ✅ Componentes Afetados (Beneficiados)
1. **Analytics → Aba Profissionais**
   - Estatísticas mais precisas
   - Contagem correta de AIHs vs Pacientes Únicos

2. **Relatório Pacientes Conferência**
   - ✅ TODAS as AIHs incluídas
   - ✅ Pacientes recorrentes aparecem múltiplas vezes

3. **Relatório Pacientes Geral**
   - Mesma lógica aplicada
   - Dados consistentes

4. **Relatório Pacientes Geral Simplificado**
   - Comportamento alinhado
   - Valores totais corretos

### ✅ Componentes NÃO Afetados
- Dashboard executivo (usa agregações)
- Gestão de Pacientes (view separada)
- Processamento de AIHs (não depende desta lógica)
- Cálculos de incrementos Opera Paraná

---

## 🧪 TESTES RECOMENDADOS

### Teste 1: Paciente com Múltiplas AIHs
```
✅ Criar paciente João Silva
✅ Processar AIH 001 (competência 10/2025)
✅ Processar AIH 002 (competência 10/2025) - mesmo paciente
✅ Processar AIH 003 (competência 10/2025) - mesmo paciente
✅ Gerar relatório de conferência
✅ Verificar se aparecem 3 linhas para João Silva
```

### Teste 2: Valores Totais
```
✅ Anotar valores individuais de cada AIH
✅ Gerar relatório
✅ Somar valores manualmente
✅ Comparar com total do relatório
✅ Valores devem bater exatamente
```

### Teste 3: Filtro por Competência
```
✅ Criar AIH 001 (competência 09/2025)
✅ Criar AIH 002 (competência 10/2025)
✅ Filtrar relatório por 10/2025
✅ Verificar se apenas AIH 002 aparece
```

### Teste 4: Paciente Único vs AIHs
```
✅ No card do médico, verificar:
   - Total de AIHs: 3
   - Pacientes Únicos: 1
✅ Ambas métricas devem estar corretas
```

---

## 📝 NOTAS TÉCNICAS

### 1. Estrutura de Dados
```typescript
// Cada entrada no array doctor.patients representa:
{
  patient_id: "uuid-paciente",  // ID do paciente (pode repetir)
  aih_id: "uuid-aih",            // ID da AIH (ÚNICO)
  patient_info: { ... },          // Dados do paciente
  aih_info: { 
    aih_number: "4120240001001", // Número da AIH
    admission_date: "...",
    discharge_date: "...",
    competencia: "2025-10-01"
  },
  total_value_reais: 1500.00,    // Valor desta AIH específica
  procedures: [ ... ]             // Procedimentos desta AIH
}
```

### 2. Compatibilidade SQL
A query SQL já busca corretamente todas as AIHs:
```sql
SELECT * FROM aihs 
WHERE competencia = '2025-10-01'
ORDER BY admission_date DESC
```

O problema estava apenas na lógica de **processamento JavaScript** que descartava AIHs duplicadas do mesmo paciente.

### 3. Performance
- ✅ Não há impacto negativo de performance
- Mesma quantidade de queries ao banco
- Apenas lógica de processamento alterada
- Array pode ficar maior (uma entrada por AIH em vez de por paciente)

---

## ✅ VALIDAÇÃO DA CORREÇÃO

### Checklist de Validação

- [x] Código alterado em `doctorPatientService.ts`
- [x] Interface TypeScript atualizada
- [x] Linter sem erros
- [x] Lógica de processamento corrigida
- [x] Comentários adicionados explicando a correção
- [x] Documentação criada

### Arquivos Modificados

1. **src/services/doctorPatientService.ts**
   - Linha 26-28: Interface `PatientWithProcedures` atualizada
   - Linhas 250-281: Lógica de processamento corrigida
   - Comentários explicativos adicionados

2. **src/services/doctorsHierarchyV2.ts**
   - Linhas 166-204: Mesma lógica corrigida
   - Usado em: exportService, doctorReportService, ProcedureHierarchyDashboard
   - Garante consistência em toda a aplicação

---

## 🎯 CONCLUSÃO

### Problema Resolvido ✅
A lógica agora **garante** que **todas as AIHs** sejam processadas e incluídas no relatório, independentemente de:
- Paciente ter múltiplas AIHs
- AIHs serem da mesma competência
- Paciente retornar após alta
- Qualquer outro cenário de recorrência

### Próximos Passos
1. ✅ Correção aplicada
2. ⏳ Testar em ambiente de desenvolvimento
3. ⏳ Validar com dados reais
4. ⏳ Deploy em produção

### Contato para Dúvidas
Esta correção foi implementada para resolver definitivamente o problema de pacientes recorrentes no relatório de conferência. Qualquer dúvida ou comportamento inesperado deve ser reportado imediatamente.

---

**Documento gerado automaticamente**  
**SIGTAP Sync v4.0 - Sistema de Gestão de Faturamento Hospitalar SUS**

