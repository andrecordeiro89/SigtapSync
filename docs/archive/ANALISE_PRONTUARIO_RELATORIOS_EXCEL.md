# 📊 Análise da Coluna Prontuário nos Relatórios Excel

**Sistema:** SIGTAP Sync  
**Data da Análise:** 13/10/2025  
**Objetivo:** Verificar se todos os relatórios Excel incluem a coluna de prontuário do paciente

---

## 🔍 Resumo Executivo

Foram identificados **10 relatórios Excel** no sistema distribuídos em 3 arquivos principais:

### ✅ Relatórios COM Prontuário (5 de 10)
1. ✅ **Relatório Geral de Pacientes e Procedimentos** (`MedicalProductionDashboard.tsx`)
2. ✅ **Relatório de Conferência de AIHs** (`MedicalProductionDashboard.tsx`)
3. ✅ **Relatório Pacientes por Médico** (`MedicalProductionDashboard.tsx` - card individual)
4. ✅ **Relatório de Anestesistas por Médico** (`MedicalProductionDashboard.tsx` - card individual)
5. ✅ **Visualização na Interface** (`MedicalProductionDashboard.tsx` - cards de pacientes)

### ❌ Relatórios SEM Prontuário (5 de 10)
1. ❌ **Relatório Simplificado de Pacientes (Global)** (`MedicalProductionDashboard.tsx`)
2. ❌ **Relatório Simplificado por Médico** (`MedicalProductionDashboard.tsx` - card individual)
3. ❌ **Relatório Todos os Pacientes** (`exportService.ts`)
4. ❌ **Relatório de Anestesia (CBO 225151)** (`exportService.ts`)
5. ❌ **Relatório SUS (Excel)** (`ReportGenerator.tsx`)

---

## 📁 Análise Detalhada por Arquivo

### 1️⃣ `src/components/MedicalProductionDashboard.tsx`

Este componente possui **7 relatórios Excel**:

#### ✅ **A. Relatório Geral de Pacientes e Procedimentos** (LINHA ~1800-1963)

**Status:** ✅ **TEM PRONTUÁRIO**

**Nome do Arquivo:** `Relatorio_Pacientes_Procedimentos_[data].xlsx`

**Colunas:**
```javascript
const header = [
  '#', 
  'Nome do Paciente', 
  'Prontuário',           // ✅ PRESENTE
  'Nº AIH', 
  'Código Proc.', 
  'Descrição Proc.', 
  'Data Procedimento', 
  'Data Alta (SUS)', 
  'Especialidade de Atendimento', 
  'Caráter de Atendimento', 
  'Médico', 
  'Hospital', 
  'Valor Procedimento', 
  'AIH Seca', 
  'Incremento', 
  'AIH c/ Incremento'
];
```

**Código de Extração:**
```javascript
const medicalRecord = p.patient_info?.medical_record || '-';
```

---

#### ✅ **B. Relatório de Conferência de AIHs** (LINHA ~2000-2117)

**Status:** ✅ **TEM PRONTUÁRIO**

**Nome do Arquivo:** `Relatorio_AIHs_Conferencia_[data].xlsx`

**Colunas:**
```javascript
const header = [
  '#', 
  'Nome do Paciente', 
  'Prontuário',           // ✅ PRESENTE
  'Nº AIH', 
  'Data Alta (SUS)', 
  'Médico', 
  'Hospital', 
  'AIH Seca', 
  'Incremento', 
  'AIH c/ Incremento'
];
```

**Código de Extração:**
```javascript
const medicalRecord = p.patient_info?.medical_record || '-';
```

---

#### ❌ **C. Relatório Simplificado de Pacientes (Global)** (LINHA ~2200-2328)

**Status:** ❌ **NÃO TEM PRONTUÁRIO**

**Nome do Arquivo:** `Relatorio_Pacientes_Simplificado_[data].xlsx`

**Colunas:**
```javascript
const header = [
  '#', 
  'Nome do Paciente', 
  'Nº AIH', 
  'Data de Admissão', 
  'Data de Alta', 
  'Médico', 
  'AIH Seca', 
  'Incremento', 
  'AIH c/ Incremento'
];
```

**🚨 FALTA:** Coluna de Prontuário

**Dados Disponíveis:**
```javascript
const name = p.patient_info?.name || 'Paciente';
// medical_record está disponível mas NÃO é extraído
```

---

#### ✅ **D. Relatório Pacientes por Médico** (LINHA ~2650-2726)

**Status:** ✅ **TEM PRONTUÁRIO**

**Nome do Arquivo:** `Relatorio_Pacientes_[NomeMedico]_[data].xlsx`

**Colunas:** (Mesmas do Relatório Geral)
```javascript
const header = [
  '#', 'Nome do Paciente', 'Prontuário', 'Nº AIH', ...
];
```

---

#### ❌ **E. Relatório Simplificado por Médico** (LINHA ~2750-2838)

**Status:** ❌ **NÃO TEM PRONTUÁRIO**

**Nome do Arquivo:** `Relatorio_Pacientes_Simplificado_[NomeMedico]_[data].xlsx`

**Colunas:**
```javascript
const header = [
  '#', 
  'Nome do Paciente', 
  'Nº AIH', 
  'Data de Admissão', 
  'Data de Alta'
];
```

**🚨 FALTA:** Coluna de Prontuário

---

#### ✅ **F. Relatório de Anestesistas por Médico** (LINHA ~3050-3206)

**Status:** ✅ **TEM PRONTUÁRIO**

**Nome do Arquivo:** `Relatorio_Anestesistas_[NomeMedico]_[data].xlsx`

**Colunas:**
```javascript
const header = [
  '#', 
  'Nome do Paciente', 
  'Prontuário',           // ✅ PRESENTE
  'Nº AIH', 
  'Código Proc. Anestésico', 
  'Descrição Proc. Anestésico', 
  'Data Procedimento', 
  'Data Alta (SUS)', 
  'Anestesista', 
  'CBO', 
  'Médico Cirurgião', 
  'Hospital'
];
```

---

#### ✅ **G. Visualização na Interface** (LINHA ~3486)

**Status:** ✅ **TEM PRONTUÁRIO**

**Local:** Cards de pacientes expandidos na interface

**Renderização:**
```jsx
<span className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
  Prontuário:
</span>
<span className="text-xs font-medium text-gray-900">
  {patient.patient_info.medical_record || '-'}
</span>
```

---

### 2️⃣ `src/services/exportService.ts`

Este serviço possui **2 relatórios Excel**:

#### ❌ **A. Relatório Todos os Pacientes** (LINHA ~119)

**Status:** ❌ **NÃO TEM PRONTUÁRIO**

**Função:** `exportAllPatientsExcel()`

**Nome do Arquivo:** `Relatorio_Pacientes_Todos_[data].xlsx`

**Colunas:**
```javascript
const header = [
  '#', 
  'Nome do Paciente', 
  'Nº AIH', 
  'Data Alta (SUS)', 
  'Valor Total', 
  'Médico', 
  'Hospital'
];
```

**🚨 FALTA:** Coluna de Prontuário

**Dados Disponíveis:**
```javascript
// A estrutura de dados vem de DoctorsHierarchyV2Service
// patient_info possui medical_record mas não é extraído
```

---

#### ❌ **B. Relatório de Anestesia (CBO 225151)** (LINHA ~204)

**Status:** ❌ **NÃO TEM PRONTUÁRIO**

**Função:** `exportAnesthesiaExcel()`

**Nome do Arquivo:** `Relatorio_Anestesia_CBO_225151_[data].xlsx`

**Colunas:**
```javascript
const header = [
  '#', 
  'Nome do Paciente', 
  'CNS', 
  'Nº AIH', 
  'Data Alta (SUS)', 
  'Hospital', 
  'Total Anestesias',
  ...dynamicHeaders,
  'Obs.'
];
```

**🚨 FALTA:** Coluna de Prontuário

**Dados Disponíveis:**
```javascript
const patientName = p.patient_info?.name || 'Paciente';
const cns = p.patient_info?.cns || '';
// medical_record está disponível mas NÃO é extraído
```

---

### 3️⃣ `src/components/ReportGenerator.tsx`

Este componente possui **1 relatório Excel** (entre vários PDFs):

#### ❌ **A. Relatório SUS (Excel)** (LINHA ~1252)

**Status:** ❌ **NÃO TEM PRONTUÁRIO**

**Função:** `renderDoctorSUSExcelFromReport()`

**Nome do Arquivo:** `Relatorio_SUS_[NomeMedico]_[data].xlsx`

**Colunas:**
```javascript
const header = [
  '#', 
  'Nome do Paciente', 
  'Nº AIH', 
  'Especialidade de Atendimento', 
  'Data Alta (SUS)', 
  'Valor Total', 
  'Valor Médico'
];
```

**🚨 FALTA:** Coluna de Prontuário

**Estrutura de Dados:**
```javascript
// O relatório vem de getDoctorPatientReport()
// Mas a interface DoctorPatientReport não inclui medical_record
```

---

## 🛠️ Recomendações de Implementação

### 📌 **Prioridade Alta**

1. **`exportService.ts` - Relatório Todos os Pacientes**
   - Adicionar coluna "Prontuário" após "Nome do Paciente"
   - Extrair de `p.patient_info?.medical_record`

2. **`exportService.ts` - Relatório de Anestesia**
   - Adicionar coluna "Prontuário" após "Nome do Paciente"
   - Extrair de `p.patient_info?.medical_record`

3. **`MedicalProductionDashboard.tsx` - Relatório Simplificado Global**
   - Adicionar coluna "Prontuário" após "Nome do Paciente"
   - Já tem acesso ao dado via `p.patient_info?.medical_record`

4. **`MedicalProductionDashboard.tsx` - Relatório Simplificado por Médico**
   - Adicionar coluna "Prontuário" após "Nome do Paciente"
   - Já tem acesso ao dado via `patient.patient_info.medical_record`

5. **`ReportGenerator.tsx` - Relatório SUS Excel**
   - Adicionar coluna "Prontuário" após "Nome do Paciente"
   - Necessário estender interface `DoctorPatientReportItem` em `doctorReportService.ts`

---

## 📊 Estatísticas

| Métrica | Valor |
|---------|-------|
| **Total de Relatórios Excel** | 10 |
| **Relatórios COM Prontuário** | 5 (50%) |
| **Relatórios SEM Prontuário** | 5 (50%) |
| **Arquivos a Modificar** | 3 arquivos TypeScript |
| **Interfaces a Estender** | 1 (DoctorPatientReportItem) |

---

## ✅ Checklist de Implementação

### 1. `src/services/exportService.ts`

- [ ] **Função `exportAllPatientsExcel()`** (linha ~119)
  - [ ] Adicionar coluna "Prontuário" no array `header`
  - [ ] Adicionar extração `p.patient_info?.medical_record || '-'` nos dados
  - [ ] Ajustar larguras das colunas (`!cols`)
  
- [ ] **Função `exportAnesthesiaExcel()`** (linha ~204)
  - [ ] Adicionar coluna "Prontuário" no array `header`
  - [ ] Adicionar extração `p.patient_info?.medical_record || '-'` nos dados
  - [ ] Ajustar larguras das colunas (`!cols`)

### 2. `src/components/MedicalProductionDashboard.tsx`

- [ ] **Relatório Simplificado Global** (linha ~2200)
  - [ ] Adicionar coluna "Prontuário" no array `header`
  - [ ] Adicionar extração `p.patient_info?.medical_record || '-'` nos dados
  - [ ] Ajustar larguras das colunas (`!cols`)
  
- [ ] **Relatório Simplificado por Médico** (linha ~2750)
  - [ ] Adicionar coluna "Prontuário" no array `header`
  - [ ] Adicionar extração `patient.patient_info.medical_record || '-'` nos dados
  - [ ] Ajustar larguras das colunas (`!cols`)

### 3. `src/services/doctorReportService.ts`

- [ ] **Estender Interface `DoctorPatientReportItem`**
  - [ ] Adicionar campo `medicalRecord?: string`
  - [ ] Atualizar função `getDoctorPatientReport()` para incluir o dado

### 4. `src/components/ReportGenerator.tsx`

- [ ] **Função `renderDoctorSUSExcelFromReport()`** (linha ~1252)
  - [ ] Adicionar coluna "Prontuário" no array `header`
  - [ ] Adicionar extração `item.medicalRecord || '-'` nos dados
  - [ ] Ajustar larguras das colunas (`!cols`)

---

## 🎯 Benefícios da Padronização

1. **Rastreabilidade Completa:** Todos os relatórios terão identificação única do paciente via prontuário
2. **Consistência:** Mesma estrutura de dados em todos os relatórios
3. **Auditoria:** Facilita cruzamento de dados entre sistemas internos do hospital
4. **LGPD:** Melhora identificação de dados sensíveis para conformidade
5. **Usabilidade:** Médicos e gestores podem identificar pacientes mais facilmente

---

## 📝 Notas Técnicas

### Fonte dos Dados
- O campo `medical_record` está presente na tabela `patients`
- É carregado via JOIN nas queries principais
- Já está disponível em `patient_info` na maioria dos relatórios

### Formato de Exibição
- Usar `medical_record || '-'` para casos onde o prontuário não está cadastrado
- Largura recomendada da coluna: `{ wch: 16 }` (16 caracteres)
- Posição: Após "Nome do Paciente" para manter consistência visual

### Compatibilidade
- Não requer alterações no banco de dados
- Não requer migração de dados
- Impacto: Apenas adição de coluna nos relatórios

---

**Análise realizada em:** 13/10/2025  
**Sistema:** SIGTAP Sync v3.0  
**Analista:** AI Assistant

